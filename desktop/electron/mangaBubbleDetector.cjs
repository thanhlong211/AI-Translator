const sharp = require("sharp");

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function metrics(box) {
  const x = Number(box?.x) || 0;
  const y = Number(box?.y) || 0;
  const width = Math.max(1, Number(box?.width) || 1);
  const height = Math.max(1, Number(box?.height) || 1);

  return {
    x,
    y,
    width,
    height,
    right: x + width,
    bottom: y + height,
    centerX: x + width / 2,
    centerY: y + height / 2,
    area: width * height,
  };
}

function unionBoxes(boxes) {
  if (!boxes.length) {
    return null;
  }

  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const input of boxes) {
    const box = metrics(input);
    left = Math.min(left, box.x);
    top = Math.min(top, box.y);
    right = Math.max(right, box.right);
    bottom = Math.max(bottom, box.bottom);
  }

  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function intersectionArea(leftInput, rightInput) {
  const left = metrics(leftInput);
  const right = metrics(rightInput);

  return Math.max(
    0,
    Math.min(left.right, right.right) - Math.max(left.x, right.x)
  ) * Math.max(
    0,
    Math.min(left.bottom, right.bottom) - Math.max(left.y, right.y)
  );
}

function iou(left, right) {
  const intersection = intersectionArea(left, right);
  const leftArea = metrics(left).area;
  const rightArea = metrics(right).area;
  const union = leftArea + rightArea - intersection;
  return union > 0 ? intersection / union : 0;
}

function containsPoint(boxInput, x, y, padding = 0) {
  const box = metrics(boxInput);
  return (
    x >= box.x - padding &&
    x <= box.right + padding &&
    y >= box.y - padding &&
    y <= box.bottom + padding
  );
}

function percentile(values, ratio) {
  if (!values.length) {
    return 255;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = clamp(
    Math.round((sorted.length - 1) * ratio),
    0,
    sorted.length - 1
  );

  return sorted[index];
}

async function loadGrayRaster(imagePath, maxDimension = 1400) {
  const metadata = await sharp(imagePath).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Không đọc được kích thước ảnh Manga Panel.");
  }

  const scale = Math.min(
    1,
    maxDimension / Math.max(metadata.width, metadata.height)
  );

  const width = Math.max(1, Math.round(metadata.width * scale));
  const height = Math.max(1, Math.round(metadata.height * scale));

  let pipeline = sharp(imagePath).grayscale();

  if (scale < 0.999) {
    pipeline = pipeline.resize({
      width,
      height,
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    });
  }

  const { data, info } = await pipeline
    .raw()
    .toBuffer({ resolveWithObject: true });

  const samples = [];
  const stride = Math.max(1, Math.floor(data.length / 5000));

  for (let index = 0; index < data.length; index += stride) {
    samples.push(data[index]);
  }

  const bright = percentile(samples, 0.82);
  const whiteThreshold = clamp(bright - 34, 182, 224);

  return {
    data,
    width: info.width,
    height: info.height,
    scaleX: info.width / metadata.width,
    scaleY: info.height / metadata.height,
    whiteThreshold,
    originalWidth: metadata.width,
    originalHeight: metadata.height,
  };
}

function scaledBox(input, raster) {
  const box = metrics(input);

  return {
    x: Math.round(box.x * raster.scaleX),
    y: Math.round(box.y * raster.scaleY),
    width: Math.max(1, Math.round(box.width * raster.scaleX)),
    height: Math.max(1, Math.round(box.height * raster.scaleY)),
  };
}

function toOriginalBox(input, raster) {
  const box = metrics(input);
  const x = box.x / raster.scaleX;
  const y = box.y / raster.scaleY;
  const right = box.right / raster.scaleX;
  const bottom = box.bottom / raster.scaleY;

  const padding = 3;

  return {
    x: clamp(Math.round(x - padding), 0, raster.originalWidth - 1),
    y: clamp(Math.round(y - padding), 0, raster.originalHeight - 1),
    width: Math.max(
      1,
      Math.min(
        raster.originalWidth - Math.max(0, Math.round(x - padding)),
        Math.round(right - x + padding * 2)
      )
    ),
    height: Math.max(
      1,
      Math.min(
        raster.originalHeight - Math.max(0, Math.round(y - padding)),
        Math.round(bottom - y + padding * 2)
      )
    ),
  };
}

function nearestWhiteSeed(raster, x, y, roi, radius = 16) {
  const cx = clamp(Math.round(x), roi.left, roi.right);
  const cy = clamp(Math.round(y), roi.top, roi.bottom);
  const threshold = raster.whiteThreshold;

  for (let distance = 0; distance <= radius; distance++) {
    const minX = Math.max(roi.left, cx - distance);
    const maxX = Math.min(roi.right, cx + distance);
    const minY = Math.max(roi.top, cy - distance);
    const maxY = Math.min(roi.bottom, cy + distance);

    for (let px = minX; px <= maxX; px++) {
      for (const py of [minY, maxY]) {
        const index = py * raster.width + px;
        if (raster.data[index] >= threshold) {
          return { x: px, y: py };
        }
      }
    }

    for (let py = minY + 1; py < maxY; py++) {
      for (const px of [minX, maxX]) {
        const index = py * raster.width + px;
        if (raster.data[index] >= threshold) {
          return { x: px, y: py };
        }
      }
    }
  }

  return null;
}

function floodWhiteRegion(raster, seed, roi, maxPixels) {
  const roiWidth = roi.right - roi.left + 1;
  const roiHeight = roi.bottom - roi.top + 1;
  const visited = new Uint8Array(roiWidth * roiHeight);
  const queueX = new Int32Array(Math.min(maxPixels, roiWidth * roiHeight));
  const queueY = new Int32Array(queueX.length);
  let head = 0;
  let tail = 0;

  function push(x, y) {
    if (x < roi.left || x > roi.right || y < roi.top || y > roi.bottom) {
      return;
    }

    const localIndex = (y - roi.top) * roiWidth + (x - roi.left);
    if (visited[localIndex]) {
      return;
    }

    visited[localIndex] = 1;

    const imageIndex = y * raster.width + x;
    if (raster.data[imageIndex] < raster.whiteThreshold) {
      return;
    }

    if (tail >= queueX.length) {
      return;
    }

    queueX[tail] = x;
    queueY[tail] = y;
    tail += 1;
  }

  push(seed.x, seed.y);

  let minX = seed.x;
  let maxX = seed.x;
  let minY = seed.y;
  let maxY = seed.y;
  let count = 0;
  let touchLeft = false;
  let touchRight = false;
  let touchTop = false;
  let touchBottom = false;

  while (head < tail && count < maxPixels) {
    const x = queueX[head];
    const y = queueY[head];
    head += 1;
    count += 1;

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);

    if (x <= roi.left + 1) touchLeft = true;
    if (x >= roi.right - 1) touchRight = true;
    if (y <= roi.top + 1) touchTop = true;
    if (y >= roi.bottom - 1) touchBottom = true;

    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }

  return {
    box: {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX + 1),
      height: Math.max(1, maxY - minY + 1),
    },
    pixelCount: count,
    reachedLimit: count >= maxPixels,
    touchCount: [touchLeft, touchRight, touchTop, touchBottom]
      .filter(Boolean)
      .length,
  };
}

function candidateForEntry(raster, entry, entryIndex) {
  const textBox = scaledBox(entry.box, raster);
  const text = metrics(textBox);
  const vertical = text.height > text.width * 1.25;

  const padX = vertical
    ? Math.max(54, text.width * 3.4)
    : Math.max(50, text.width * 0.75);

  const padY = vertical
    ? Math.max(44, text.height * 0.58)
    : Math.max(46, text.height * 1.75);

  const roi = {
    left: clamp(Math.floor(text.x - padX), 0, raster.width - 1),
    top: clamp(Math.floor(text.y - padY), 0, raster.height - 1),
    right: clamp(Math.ceil(text.right + padX), 0, raster.width - 1),
    bottom: clamp(Math.ceil(text.bottom + padY), 0, raster.height - 1),
  };

  const seedTargets = [
    [text.centerX, text.centerY],
    [text.x + text.width * 0.18, text.centerY],
    [text.x + text.width * 0.82, text.centerY],
    [text.centerX, text.y + text.height * 0.18],
    [text.centerX, text.y + text.height * 0.82],
  ];

  const seen = new Set();
  const candidates = [];

  for (const [seedX, seedY] of seedTargets) {
    const seed = nearestWhiteSeed(raster, seedX, seedY, roi);
    if (!seed) {
      continue;
    }

    const seedKey = `${seed.x}:${seed.y}`;
    if (seen.has(seedKey)) {
      continue;
    }
    seen.add(seedKey);

    const roiArea = Math.max(
      1,
      (roi.right - roi.left + 1) * (roi.bottom - roi.top + 1)
    );

    const region = floodWhiteRegion(
      raster,
      seed,
      roi,
      Math.min(260000, roiArea)
    );

    const regionBox = metrics(region.box);
    const textArea = text.area;
    const regionArea = regionBox.area;
    const fillRatio = region.pixelCount / Math.max(1, regionArea);
    const areaRatio = regionArea / Math.max(1, textArea);

    const containsTextCenter = containsPoint(
      region.box,
      text.centerX,
      text.centerY,
      6
    );

    const hasMargin =
      regionBox.width >= text.width * 1.05 &&
      regionBox.height >= text.height * 1.05;

    const imageAreaRatio =
      regionArea / Math.max(1, raster.width * raster.height);

    const escaped =
      region.touchCount >= 2 &&
      regionArea >= roiArea * 0.72;

    if (
      !containsTextCenter ||
      !hasMargin ||
      escaped ||
      region.reachedLimit ||
      fillRatio < 0.44 ||
      areaRatio < 1.15 ||
      areaRatio > 55 ||
      imageAreaRatio > 0.34
    ) {
      continue;
    }

    const marginX = Math.max(
      0,
      (regionBox.width - text.width) / Math.max(1, text.width)
    );
    const marginY = Math.max(
      0,
      (regionBox.height - text.height) / Math.max(1, text.height)
    );

    const score = clamp(
      0.34 +
        Math.min(0.26, fillRatio * 0.22) +
        Math.min(0.18, (marginX + marginY) * 0.035) +
        (region.touchCount === 0 ? 0.14 : 0.04),
      0,
      0.99
    );

    candidates.push({
      entryIndex,
      box: toOriginalBox(region.box, raster),
      score,
      fillRatio,
      touchCount: region.touchCount,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

function shouldClusterCandidates(left, right) {
  const overlap = iou(left.box, right.box);

  if (overlap >= 0.34) {
    return true;
  }

  const leftBox = metrics(left.box);
  const rightBox = metrics(right.box);
  const intersection = intersectionArea(left.box, right.box);
  const containment = intersection / Math.max(1, Math.min(leftBox.area, rightBox.area));

  return containment >= 0.72;
}

function clusterCandidates(candidates) {
  const clusters = [];

  for (const candidate of [...candidates].sort((a, b) => b.score - a.score)) {
    let target = null;

    for (const cluster of clusters) {
      if (cluster.candidates.some((existing) => shouldClusterCandidates(existing, candidate))) {
        target = cluster;
        break;
      }
    }

    if (!target) {
      target = { candidates: [] };
      clusters.push(target);
    }

    target.candidates.push(candidate);
  }

  return clusters.map((cluster, index) => {
    const boxes = cluster.candidates.map((item) => item.box);
    const box = unionBoxes(boxes);
    const confidence =
      cluster.candidates.reduce((sum, item) => sum + item.score, 0) /
      Math.max(1, cluster.candidates.length);

    return {
      id: `bubble-${index + 1}`,
      box,
      confidence,
      candidates: cluster.candidates,
      entries: [],
    };
  });
}

function pointDistanceToBox(boxInput, x, y) {
  const box = metrics(boxInput);
  const dx =
    x < box.x
      ? box.x - x
      : x > box.right
        ? x - box.right
        : 0;

  const dy =
    y < box.y
      ? box.y - y
      : y > box.bottom
        ? y - box.bottom
        : 0;

  return Math.hypot(dx, dy);
}

function chooseBubbleForEntry(entry, bubbles) {
  const box = metrics(entry.box);
  const candidates = [];

  for (const bubble of bubbles) {
    const bubbleBox = metrics(bubble.box);
    const overlapRatio =
      intersectionArea(entry.box, bubble.box) /
      Math.max(1, box.area);

    const strictInside = containsPoint(
      bubble.box,
      box.centerX,
      box.centerY,
      0
    );

    const softPadding = clamp(
      Math.round(
        Math.min(box.width, box.height) * 0.45 +
        Math.min(bubbleBox.width, bubbleBox.height) * 0.035
      ),
      7,
      24
    );

    const softInside = containsPoint(
      bubble.box,
      box.centerX,
      box.centerY,
      softPadding
    );

    const edgeDistance = pointDistanceToBox(
      bubble.box,
      box.centerX,
      box.centerY
    );

    const edgeAllowance = clamp(
      Math.round(
        Math.min(box.width, box.height) * 1.15 + 7
      ),
      10,
      30
    );

    const nearEdge = edgeDistance <= edgeAllowance;

    /*
     * Batch 09.2:
     * OCR box có thể lệch vài pixel khỏi speech bubble vì PaddleOCR polygon,
     * anti-alias hoặc detector flood-fill dừng ngay trên viền đen. Không yêu
     * cầu center phải nằm cứng bên trong nữa, nhưng edge assignment vẫn được
     * giới hạn chặt để tránh hút SFX/chữ ngoài bubble vào nhầm.
     */
    if (
      !strictInside &&
      !softInside &&
      overlapRatio < 0.12 &&
      !nearEdge
    ) {
      continue;
    }

    const centerDistance = Math.hypot(
      bubbleBox.centerX - box.centerX,
      bubbleBox.centerY - box.centerY
    );

    const diagonal = Math.max(
      24,
      Math.hypot(
        bubbleBox.width,
        bubbleBox.height
      )
    );

    const proximity =
      edgeDistance <= 0
        ? 1
        : Math.max(
            0,
            1 - edgeDistance / Math.max(1, edgeAllowance)
          );

    let mode = "EDGE";
    if (strictInside) {
      mode = "INSIDE";
    } else if (overlapRatio >= 0.22) {
      mode = "OVERLAP";
    }

    const score =
      bubble.confidence +
      overlapRatio * 2.45 +
      (strictInside ? 0.72 : softInside ? 0.34 : 0) +
      proximity * 0.48 -
      centerDistance / diagonal * 0.18 -
      edgeDistance / Math.max(12, edgeAllowance) * 0.08;

    candidates.push({
      bubble,
      score,
      mode,
      overlapRatio,
      edgeDistance,
    });
  }

  candidates.sort((left, right) => right.score - left.score);

  const best = candidates[0];
  if (!best || best.score < 0.58) {
    return {
      bubble: null,
      mode: "UNASSIGNED",
      ambiguous: false,
    };
  }

  const second = candidates[1];

  /*
   * Nếu OCR nằm đúng giữa hai speech bubble và cả hai chỉ thắng bằng
   * proximity/edge, đừng đoán. Để Smart OCR fallback xử lý sẽ an toàn hơn
   * việc merge nhầm hai người nói vào cùng một câu.
   */
  const ambiguous = Boolean(
    second &&
    best.mode !== "INSIDE" &&
    second.mode !== "INSIDE" &&
    Math.abs(best.score - second.score) < 0.16
  );

  if (ambiguous) {
    return {
      bubble: null,
      mode: "AMBIGUOUS",
      ambiguous: true,
    };
  }

  return {
    bubble: best.bubble,
    mode: best.mode,
    ambiguous: false,
    score: best.score,
    overlapRatio: best.overlapRatio,
    edgeDistance: best.edgeDistance,
  };
}

function expandBubbleToAssignedText(bubble) {
  if (!bubble?.entries?.length) {
    return bubble;
  }

  const entryUnion = unionBoxes(
    bubble.entries.map((entry) => entry.box)
  );

  if (!entryUnion) {
    return bubble;
  }

  const base = metrics(bubble.box);
  const text = metrics(entryUnion);

  /*
   * Chỉ nới detector tối đa vài pixel. OCR box edge-assigned có thể nằm hơi
   * ngoài viền do polygon của PaddleOCR; nếu union toàn bộ text box thì overlay
   * lại phình ra che tranh, trái mục tiêu của Bubble Detection.
   */
  const maxExpansion = 8;
  const left = Math.max(
    base.x - maxExpansion,
    Math.min(base.x, text.x - 4)
  );
  const top = Math.max(
    base.y - maxExpansion,
    Math.min(base.y, text.y - 4)
  );
  const right = Math.min(
    base.right + maxExpansion,
    Math.max(base.right, text.right + 4)
  );
  const bottom = Math.min(
    base.bottom + maxExpansion,
    Math.max(base.bottom, text.bottom + 4)
  );

  return {
    ...bubble,
    box: {
      x: left,
      y: top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
    },
  };
}

async function detectMangaSpeechBubbles({ imagePath, entries }) {
  const normalizedEntries = Array.isArray(entries)
    ? entries.filter((entry) => entry?.box && String(entry?.line || "").trim())
    : [];

  if (!imagePath || normalizedEntries.length < 2) {
    return {
      groups: [],
      unassignedEntries: normalizedEntries,
      diagnostics: {
        enabled: true,
        candidateCount: 0,
        bubbleCount: 0,
        assignedCount: 0,
        directAssignedCount: 0,
        overlapAssignedCount: 0,
        edgeAssignedCount: 0,
        ambiguousCount: 0,
        coverage: 0,
        reason: "not-enough-entries",
      },
    };
  }

  const raster = await loadGrayRaster(imagePath);
  const candidates = [];

  for (let index = 0; index < normalizedEntries.length; index++) {
    const candidate = candidateForEntry(raster, normalizedEntries[index], index);
    if (candidate) {
      candidates.push(candidate);
    }
  }

  let bubbles = clusterCandidates(candidates)
    .filter((bubble) => bubble.confidence >= 0.48);

  let directAssignedCount = 0;
  let overlapAssignedCount = 0;
  let edgeAssignedCount = 0;
  let ambiguousCount = 0;

  for (const entry of normalizedEntries) {
    const assignment = chooseBubbleForEntry(entry, bubbles);

    if (assignment.ambiguous) {
      ambiguousCount += 1;
      continue;
    }

    if (!assignment.bubble) {
      continue;
    }

    assignment.bubble.entries.push(entry);

    if (assignment.mode === "INSIDE") {
      directAssignedCount += 1;
    } else if (assignment.mode === "OVERLAP") {
      overlapAssignedCount += 1;
    } else if (assignment.mode === "EDGE") {
      edgeAssignedCount += 1;
    }
  }

  bubbles = bubbles
    .filter((bubble) => bubble.entries.length > 0)
    .map(expandBubbleToAssignedText);

  const assigned = new Set();
  for (const bubble of bubbles) {
    for (const entry of bubble.entries) {
      assigned.add(entry);
    }
  }

  const unassignedEntries = normalizedEntries.filter((entry) => !assigned.has(entry));
  const assignedCount = assigned.size;
  const coverage = assignedCount / Math.max(1, normalizedEntries.length);

  /*
   * Chỉ bật Bubble Detection khi detector thực sự có ích.
   * Nếu coverage quá thấp, caller dùng Smart OCR Grouping cũ cho toàn bộ trang.
   */
  const reliable =
    bubbles.length > 0 &&
    assignedCount >= Math.min(2, normalizedEntries.length) &&
    coverage >= 0.34;

  return {
    groups: reliable ? bubbles : [],
    unassignedEntries: reliable ? unassignedEntries : normalizedEntries,
    diagnostics: {
      enabled: true,
      reliable,
      whiteThreshold: raster.whiteThreshold,
      candidateCount: candidates.length,
      bubbleCount: reliable ? bubbles.length : 0,
      assignedCount: reliable ? assignedCount : 0,
      directAssignedCount: reliable ? directAssignedCount : 0,
      overlapAssignedCount: reliable ? overlapAssignedCount : 0,
      edgeAssignedCount: reliable ? edgeAssignedCount : 0,
      ambiguousCount,
      totalEntries: normalizedEntries.length,
      coverage: reliable ? coverage : 0,
    },
  };
}

module.exports = {
  detectMangaSpeechBubbles,
};
