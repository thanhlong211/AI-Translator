const {
  BrowserWindow,
  screen
} = require("electron");

const path = require("path");

let overlayWindow = null;
let controlsWindow = null;
let sessionInspectorWindow = null;
let sessionInspectorRequestedVisible = false;
let overlayPinned = false;
let overlayEditing = false;
let overlayDebug = false;
let overlayTextInputActive = false;
let lastPayload = null;

let overlayPreferences = {
  opacity: 0.96,
  fontScale: 1
};

function clamp(
  value,
  min,
  max
) {
  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );
}

function normalizeOverlayPreferences(
  next
) {
  const opacity =
    Number(
      next?.opacity
    );

  const fontScale =
    Number(
      next?.fontScale
    );

  return {
    opacity:
      Number.isFinite(opacity)
        ? clamp(
            opacity,
            0.65,
            1
          )
        : 0.96,

    fontScale:
      Number.isFinite(fontScale)
        ? clamp(
            fontScale,
            0.8,
            1.4
          )
        : 1
  };
}

function resolveDisplay(
  displayData
) {
  const displays =
    screen.getAllDisplays();

  const requestedId =
    String(
      displayData?.id ??
      ""
    );

  const exact =
    displays.find(
      (display) =>
        String(display.id) ===
        requestedId
    );

  if (exact) {
    return exact;
  }

  const bounds =
    displayData?.bounds;

  if (
    bounds &&
    Number.isFinite(
      Number(bounds.x)
    ) &&
    Number.isFinite(
      Number(bounds.y)
    )
  ) {
    return screen
      .getDisplayNearestPoint({
        x:
          Math.round(
            Number(bounds.x) +
            Math.max(
              0,
              Number(bounds.width) || 0
            ) / 2
          ),

        y:
          Math.round(
            Number(bounds.y) +
            Math.max(
              0,
              Number(bounds.height) || 0
            ) / 2
          )
      });
  }

  return screen.getPrimaryDisplay();
}

function normalizeBlock(
  block,
  viewportBounds,
  index
) {
  const logicalBox =
    block?.logicalBox ||
    {};

  const rawX =
    Math.round(
      Number(logicalBox.x) || 0
    ) -
    viewportBounds.x;

  const rawY =
    Math.round(
      Number(logicalBox.y) || 0
    ) -
    viewportBounds.y;

  const rawWidth =
    Math.max(
      1,
      Math.round(
        Number(
          logicalBox.width
        ) || 1
      )
    );

  const rawHeight =
    Math.max(
      1,
      Math.round(
        Number(
          logicalBox.height
        ) || 1
      )
    );

  const text =
    String(
      block?.translatedText ||
      block?.vietnamese ||
      ""
    ).trim();

  const textLength =
    Array.from(text).length;

  const detectionSource =
    String(
      block?.detectionSource ||
      "OCR_GROUP"
    ).toUpperCase();

  const detectedSpeechBubble =
    detectionSource ===
    "SPEECH_BUBBLE";

  const verticalSource =
    typeof block?.verticalSource ===
    "boolean"
      ? block.verticalSource
      : rawHeight >
        rawWidth * 1.25;

  const maxBubbleWidth =
    Math.max(
      100,
      Math.min(
        detectedSpeechBubble
          ? 340
          : 250,
        viewportBounds.width *
          (detectedSpeechBubble
            ? 0.50
            : 0.42)
      )
    );

  /*
   * Không dùng nguyên chiều cao OCR dọc làm chiều cao bubble Việt.
   * Bản dịch Việt là text ngang nên bubble được tính lại theo nội dung.
   */
  const contentWidth =
    Math.sqrt(
      Math.max(
        1,
        textLength
      )
    ) * 25;

  let width;

  if (detectedSpeechBubble) {
    /*
     * Bubble Detector đã tìm được vùng trắng thật của speech bubble.
     * Ưu tiên nằm bên trong vùng đó thay vì nở khung theo độ dài text.
     * Nếu câu Việt dài, fitText sẽ giảm font và user vẫn có thể resize bằng ↘.
     */
    const detectedMaxWidth =
      Math.max(
        82,
        Math.min(
          maxBubbleWidth,
          rawWidth * 1.03
        )
      );

    width =
      clamp(
        Math.round(
          Math.max(
            82,
            rawWidth * 0.90
          )
        ),
        82,
        detectedMaxWidth
      );
  } else {
    width =
      verticalSource
        ? Math.max(
            108,
            Math.min(
              190,
              rawHeight * 0.82
            ),
            contentWidth
          )
        : Math.max(
            88,
            Math.min(
              rawWidth * 1.12,
              220
            ),
            contentWidth
          );

    width =
      clamp(
        Math.round(width),
        82,
        maxBubbleWidth
      );
  }

  const estimatedCharsPerLine =
    Math.max(
      8,
      Math.floor(
        (width - 18) / 11
      )
    );

  const estimatedLines =
    Math.max(
      1,
      Math.ceil(
        textLength /
        estimatedCharsPerLine
      )
    );

  let height =
    18 +
    estimatedLines * 20;

  if (!verticalSource) {
    height = Math.max(
      height,
      Math.min(
        rawHeight * 1.08,
        88
      )
    );
  }

  const maxBubbleHeight =
    Math.max(
      80,
      Math.min(
        detectedSpeechBubble
          ? 270
          : 210,
        viewportBounds.height *
          (detectedSpeechBubble
            ? 0.42
            : 0.34)
      )
    );

  if (detectedSpeechBubble) {
    const detectedMaxHeight =
      Math.max(
        36,
        Math.min(
          maxBubbleHeight,
          rawHeight * 1.03
        )
      );

    height =
      clamp(
        Math.round(
          Math.max(
            36,
            rawHeight * 0.88
          )
        ),
        36,
        detectedMaxHeight
      );
  } else {
    height =
      clamp(
        Math.round(height),
        36,
        maxBubbleHeight
      );
  }

  const centerX =
    rawX +
    rawWidth / 2;

  const centerY =
    rawY +
    rawHeight / 2;

  const x =
    clamp(
      Math.round(
        centerX -
        width / 2
      ),
      0,
      Math.max(
        0,
        viewportBounds.width -
        width
      )
    );

  const y =
    clamp(
      Math.round(
        centerY -
        height / 2
      ),
      0,
      Math.max(
        0,
        viewportBounds.height -
        height
      )
    );

  return {
    id:
      String(
        block?.id ||
        `overlay-${index + 1}`
      ),

    order:
      Number.isFinite(
        Number(block?.order)
      )
        ? Number(block.order)
        : index,

    text,

    original:
      String(
        block?.original ||
        block?.text ||
        ""
      ).trim(),

    source:
      String(
        block?.source ||
        "AI"
      ),

    x,
    y,
    width,
    height,

    anchorX:
      clamp(
        Math.round(centerX),
        0,
        viewportBounds.width
      ),

    anchorY:
      clamp(
        Math.round(centerY),
        0,
        viewportBounds.height
      ),

    verticalSource,

    detectionSource,
    bubbleConfidence:
      Number(
        block?.bubbleConfidence ||
        0
      ),

    originalBox: {
      x: rawX,
      y: rawY,
      width: rawWidth,
      height: rawHeight
    }
  };
}

function normalizeViewportBounds(
  requested,
  displayBounds
) {
  const rawX =
    Number(requested?.x);
  const rawY =
    Number(requested?.y);
  const rawWidth =
    Number(requested?.width);
  const rawHeight =
    Number(requested?.height);

  if (
    !Number.isFinite(rawX) ||
    !Number.isFinite(rawY) ||
    !Number.isFinite(rawWidth) ||
    !Number.isFinite(rawHeight) ||
    rawWidth <= 0 ||
    rawHeight <= 0
  ) {
    return {
      ...displayBounds
    };
  }

  const left =
    Math.max(
      displayBounds.x,
      Math.round(rawX)
    );

  const top =
    Math.max(
      displayBounds.y,
      Math.round(rawY)
    );

  const right =
    Math.min(
      displayBounds.x +
      displayBounds.width,
      Math.round(
        rawX +
        rawWidth
      )
    );

  const bottom =
    Math.min(
      displayBounds.y +
      displayBounds.height,
      Math.round(
        rawY +
        rawHeight
      )
    );

  if (
    right <= left ||
    bottom <= top
  ) {
    return {
      ...displayBounds
    };
  }

  return {
    x: left,
    y: top,
    width:
      right - left,
    height:
      bottom - top
  };
}

function normalizeDebugRect(
  input,
  overlayBounds,
  type,
  index
) {
  const logicalBox =
    input?.logicalBox ||
    {};

  const rawX =
    Math.round(
      Number(logicalBox.x) || 0
    ) -
    overlayBounds.x;

  const rawY =
    Math.round(
      Number(logicalBox.y) || 0
    ) -
    overlayBounds.y;

  const width =
    Math.max(
      1,
      Math.round(
        Number(
          logicalBox.width
        ) || 1
      )
    );

  const height =
    Math.max(
      1,
      Math.round(
        Number(
          logicalBox.height
        ) || 1
      )
    );

  const x =
    clamp(
      rawX,
      0,
      Math.max(
        0,
        overlayBounds.width -
        width
      )
    );

  const y =
    clamp(
      rawY,
      0,
      Math.max(
        0,
        overlayBounds.height -
        height
      )
    );

  return {
    id:
      String(
        input?.id ||
        `${type.toLowerCase()}-${index + 1}`
      ),
    type,
    x,
    y,
    width:
      Math.min(
        width,
        Math.max(
          1,
          overlayBounds.width - x
        )
      ),
    height:
      Math.min(
        height,
        Math.max(
          1,
          overlayBounds.height - y
        )
      ),
    text:
      String(
        input?.text ||
        ""
      ),
    score:
      Number(
        input?.score || 0
      ),
    confidence:
      Number(
        input?.confidence || 0
      ),
  };
}

function buildDebugPayload(
  debugGeometry,
  overlayBounds
) {
  if (!debugGeometry) {
    return null;
  }

  const rects = [];

  const append =
    (items, type) => {
      if (!Array.isArray(items)) {
        return;
      }

      items.forEach(
        (item, index) => {
          rects.push(
            normalizeDebugRect(
              item,
              overlayBounds,
              type,
              index
            )
          );
        }
      );
    };

  append(
    debugGeometry.ocrBoxes,
    "OCR"
  );

  append(
    debugGeometry.ignoredOcrBoxes,
    "IGNORED"
  );

  append(
    debugGeometry.speechBubbles,
    "SPEECH_BUBBLE"
  );

  append(
    debugGeometry.fallbackGroups,
    "FALLBACK_GROUP"
  );

  const diagnostics = {
    ...(debugGeometry
      .diagnostics ||
      {})
  };

  return {
    diagnostics,
    rects,
    counts: {
      ocr:
        Array.isArray(
          debugGeometry.ocrBoxes
        )
          ? debugGeometry
              .ocrBoxes.length
          : 0,
      ignored:
        Array.isArray(
          debugGeometry.ignoredOcrBoxes
        )
          ? debugGeometry
              .ignoredOcrBoxes.length
          : 0,
      bubbles:
        Array.isArray(
          debugGeometry.speechBubbles
        )
          ? debugGeometry
              .speechBubbles.length
          : 0,
      fallback:
        Array.isArray(
          debugGeometry.fallbackGroups
        )
          ? debugGeometry
              .fallbackGroups.length
          : 0,
    },
  };
}

function buildPayload(
  data
) {
  const display =
    resolveDisplay(
      data?.display
    );

  const bounds = {
    ...display.bounds
  };

  const mode =
    String(
      data?.mode ||
      "full-screen"
    );

  /*
   * sourceBounds là vùng thật sự đã OCR (khung manga).
   * Với panel mode, BrowserWindow overlay phủ display để người dùng
   * có thể kéo bubble ra lề ngoài trang truyện mà không cần OCR cả screen.
   */
  const sourceBounds =
    normalizeViewportBounds(
      data?.viewportBounds,
      bounds
    );

  const overlayBounds =
    mode === "panel"
      ? {
          ...bounds
        }
      : {
          ...sourceBounds
        };

  const items =
    (Array.isArray(data?.blocks)
      ? data.blocks
      : [])
      .map(
        (block, index) =>
          normalizeBlock(
            block,
            overlayBounds,
            index
          )
      )
      .filter(
        (item) =>
          item.text
      )
      .map((item) => ({
        ...item,
        profileId:
          data?.profileId ??
          null,
        sourceLanguage:
          String(
            data?.sourceLanguage ||
            "AUTO"
          ),
        targetLanguage:
          String(
            data?.targetLanguage ||
            "VI"
          ),
        provider:
          String(
            data?.ai?.provider ||
            ""
          ),
        model:
          String(
            data?.ai?.model ||
            ""
          ),
        baselineTranslation:
          item.text,
      }));

  return {
    displayId:
      display.id,

    displayBounds:
      bounds,

    sourceBounds: {
      ...sourceBounds
    },

    windowBounds: {
      ...overlayBounds
    },

    mode,

    sourceLanguage:
      String(
        data?.sourceLanguage ||
        "AUTO"
      ),

    targetLanguage:
      String(
        data?.targetLanguage ||
        "VI"
      ),

    profileId:
      data?.profileId ??
      null,

    session:
      data?.session?.active
        ? {
            ...data.session,
            selection:
              data.session.selection
                ? { ...data.session.selection }
                : undefined,
          }
        : null,

    ai: {
      provider:
        String(
          data?.ai?.provider ||
          ""
        ),
      model:
        String(
          data?.ai?.model ||
          ""
        )
    },

    items,

    debug:
      buildDebugPayload(
        data?.debugGeometry,
        overlayBounds
      ),

    preferences: {
      ...overlayPreferences
    }
  };
}

function createWindowReadyPromise(
  win,
  loadPromise,
  label
) {
  return new Promise(
    (resolve, reject) => {
      let settled = false;

      const finish =
        () => {
          if (
            settled ||
            !win ||
            win.isDestroyed()
          ) {
            return;
          }

          settled = true;
          resolve();
        };

      /*
       * ready-to-show = renderer đã paint frame đầu tiên.
       * Đây là mốc an toàn hơn chỉ did-finish-load cho transparent window.
       */
      win.once(
        "ready-to-show",
        finish
      );

      win.webContents.once(
        "did-finish-load",
        () => {
          /*
           * Fallback cho trường hợp ready-to-show không đến đúng lúc.
           * Cho Chromium thêm vài frame để composite transparent surface.
           */
          setTimeout(
            finish,
            48
          );
        }
      );

      Promise.resolve(
        loadPromise
      )
        .catch((error) => {
          if (settled) {
            return;
          }

          settled = true;

          console.error(
            `${label} LOAD FAILED:`,
            error
          );

          reject(error);
        });
    }
  );
}

function createOverlayWindow(
  payload
) {
  overlayWindow =
    new BrowserWindow({
      ...payload.windowBounds,

      show: false,

      /*
       * Renderer được phép paint ngay khi window còn hidden.
       * Kết hợp ready-to-show để lần overlay đầu tiên không chỉ hiện controls.
       */
      paintWhenInitiallyHidden: true,

      frame: false,
      transparent: true,
      backgroundColor:
        "#00000000",

      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      focusable: false,
      hasShadow: false,

      webPreferences: {
        preload:
          path.join(
            __dirname,
            "preload.cjs"
          ),

        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false
      }
    });

  overlayWindow
    .setAlwaysOnTop(
      true,
      "screen-saver"
    );

  /*
   * Toàn bộ vùng dịch click-through để không chặn game/manga.
   */
  overlayWindow
    .setIgnoreMouseEvents(
      true,
      {
        forward: true
      }
    );

  /*
   * Giữ Promise load để lần render đầu tiên chỉ gửi payload
   * sau khi renderer thực sự hoàn tất load. Trước đây did-finish-load
   * + isLoading() có thể tạo race: controls hiện nhưng bubble không nhận payload.
   */
  const createdWindow =
    overlayWindow;

  createdWindow.__overlayLoadPromise =
    createdWindow.loadFile(
      path.join(
        __dirname,
        "fullScreenOverlay.html"
      )
    );

  createdWindow.__overlayReadyPromise =
    createWindowReadyPromise(
      createdWindow,
      createdWindow.__overlayLoadPromise,
      "FULL SCREEN OVERLAY"
    );

  createdWindow.on(
    "closed",
    () => {
      /*
       * Một window cũ có thể phát closed sau khi instance mới đã được tạo.
       * Không được để callback cũ xóa state của overlay mới.
       */
      if (
        overlayWindow !==
        createdWindow
      ) {
        return;
      }

      overlayWindow = null;

      const controls =
        controlsWindow;

      controlsWindow = null;
      lastPayload = null;
      overlayEditing = false;
      overlayDebug = false;

      if (
        controls &&
        !controls.isDestroyed()
      ) {
        controls.close();
      }
    }
  );

  return createdWindow;
}

function controlsBounds(
  viewportBounds,
  mode = "full-screen"
) {
  const display =
    screen.getDisplayNearestPoint({
      x:
        viewportBounds.x +
        Math.max(
          0,
          viewportBounds.width -
          20
        ),

      y:
        viewportBounds.y +
        20
    });

  const workArea =
    display.workArea;

  const width = 430;
  const height = 34;
  const gap = 8;

  const maxX =
    Math.max(
      workArea.x,
      workArea.x +
      workArea.width -
      width
    );

  const maxY =
    Math.max(
      workArea.y,
      workArea.y +
      workArea.height -
      height
    );

  if (mode === "panel") {
    /*
     * Panel mode: ưu tiên đặt controls bên phải vùng truyện.
     * Tránh trường hợp controls nhảy lên tab/address bar của browser.
     */
    const rightX =
      viewportBounds.x +
      viewportBounds.width +
      gap;

    if (
      rightX + width <=
      workArea.x +
      workArea.width
    ) {
      return {
        x: rightX,
        y:
          clamp(
            viewportBounds.y + 6,
            workArea.y,
            maxY
          ),
        width,
        height
      };
    }

    return {
      x:
        clamp(
          viewportBounds.x +
          viewportBounds.width -
          width -
          8,
          workArea.x,
          maxX
        ),

      y:
        clamp(
          viewportBounds.y + 8,
          workArea.y,
          maxY
        ),

      width,
      height
    };
  }

  const preferredX =
    clamp(
      viewportBounds.x +
      viewportBounds.width -
      width,
      workArea.x,
      maxX
    );

  const aboveY =
    viewportBounds.y -
    height -
    gap;

  if (aboveY >= workArea.y) {
    return {
      x: preferredX,
      y: aboveY,
      width,
      height
    };
  }

  const belowY =
    viewportBounds.y +
    viewportBounds.height +
    gap;

  if (
    belowY + height <=
    workArea.y +
    workArea.height
  ) {
    return {
      x: preferredX,
      y: belowY,
      width,
      height
    };
  }

  return {
    x:
      workArea.x +
      workArea.width -
      width -
      10,

    y:
      workArea.y +
      10,

    width,
    height
  };
}

function sessionInspectorBounds() {
  const width = 420;
  const height = 520;

  const display =
    lastPayload?.displayId != null
      ? screen.getAllDisplays().find(
          (item) =>
            String(item.id) ===
            String(lastPayload.displayId)
        ) || screen.getPrimaryDisplay()
      : screen.getPrimaryDisplay();

  const workArea =
    display.workArea ||
    display.bounds;

  const controls =
    controlsWindow &&
    !controlsWindow.isDestroyed()
      ? controlsWindow.getBounds()
      : null;

  const gap = 8;

  let x =
    controls
      ? controls.x + controls.width - width
      : workArea.x +
        workArea.width -
        width -
        12;

  let y =
    controls
      ? controls.y + controls.height + gap
      : workArea.y + 52;

  const maxX =
    workArea.x +
    workArea.width -
    width;

  const maxY =
    workArea.y +
    workArea.height -
    height;

  x = clamp(
    Math.round(x),
    workArea.x,
    Math.max(workArea.x, maxX)
  );

  y = clamp(
    Math.round(y),
    workArea.y,
    Math.max(workArea.y, maxY)
  );

  return {
    x,
    y,
    width,
    height
  };
}

function createSessionInspectorWindow() {
  const win =
    new BrowserWindow({
      ...sessionInspectorBounds(),
      show: false,
      paintWhenInitiallyHidden: true,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: true,
      minWidth: 340,
      minHeight: 360,
      maxWidth: 620,
      maxHeight: 760,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      webPreferences: {
        preload:
          path.join(
            __dirname,
            "preload.cjs"
          ),
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false
      }
    });

  win.setAlwaysOnTop(
    true,
    "screen-saver"
  );

  const created = win;

  created.__sessionInspectorLoadPromise =
    created.loadFile(
      path.join(
        __dirname,
        "mangaSessionInspector.html"
      )
    );

  created.__sessionInspectorReadyPromise =
    createWindowReadyPromise(
      created,
      created.__sessionInspectorLoadPromise,
      "MANGA SESSION INSPECTOR"
    );

  created.on(
    "closed",
    () => {
      if (
        sessionInspectorWindow ===
        created
      ) {
        sessionInspectorWindow = null;
      }

      sessionInspectorRequestedVisible = false;
      notifyOverlayState();
    }
  );

  sessionInspectorWindow = created;

  return created;
}

function notifyMangaSessionInspectorRefresh() {
  if (
    sessionInspectorWindow &&
    !sessionInspectorWindow.isDestroyed() &&
    !sessionInspectorWindow.webContents.isLoading()
  ) {
    sessionInspectorWindow.webContents.send(
      "manga-session-inspector-refresh"
    );
  }
}

function showMangaSessionInspector() {
  if (
    !lastPayload?.session?.active
  ) {
    return {
      success: false,
      visible: false,
      error:
        "Chưa có Manga Session đang hoạt động."
    };
  }

  sessionInspectorRequestedVisible = true;

  let win =
    sessionInspectorWindow;

  if (
    !win ||
    win.isDestroyed()
  ) {
    win =
      createSessionInspectorWindow();

    Promise.resolve(
      win.__sessionInspectorReadyPromise
    )
      .then(() => {
        if (
          win.isDestroyed() ||
          !sessionInspectorRequestedVisible
        ) {
          return;
        }

        win.setBounds(
          sessionInspectorBounds()
        );
        win.show();
        win.focus();
        notifyMangaSessionInspectorRefresh();
        notifyOverlayState();
      })
      .catch((error) => {
        console.error(
          "MANGA SESSION INSPECTOR READY FAILED:",
          error
        );
      });
  } else {
    win.setBounds(
      sessionInspectorBounds()
    );
    win.show();
    win.focus();
    notifyMangaSessionInspectorRefresh();
    notifyOverlayState();
  }

  return {
    success: true,
    visible: true
  };
}

function hideMangaSessionInspector(
  preserveRequest = false
) {
  if (!preserveRequest) {
    sessionInspectorRequestedVisible = false;
  }

  if (
    sessionInspectorWindow &&
    !sessionInspectorWindow.isDestroyed()
  ) {
    sessionInspectorWindow.hide();
  }

  notifyOverlayState();

  return {
    success: true,
    visible: false
  };
}

function toggleMangaSessionInspector() {
  const visible =
    Boolean(
      sessionInspectorWindow &&
      !sessionInspectorWindow.isDestroyed() &&
      sessionInspectorWindow.isVisible()
    );

  return visible
    ? hideMangaSessionInspector(false)
    : showMangaSessionInspector();
}

function closeMangaSessionInspector() {
  sessionInspectorRequestedVisible = false;

  const win =
    sessionInspectorWindow;

  sessionInspectorWindow = null;

  if (
    win &&
    !win.isDestroyed()
  ) {
    win.close();
  }

  notifyOverlayState();

  return {
    success: true,
    visible: false
  };
}

function updateFullScreenOverlaySession(
  session
) {
  if (lastPayload) {
    lastPayload.session =
      session?.active
        ? {
            ...session,
            selection:
              session.selection
                ? { ...session.selection }
                : undefined,
          }
        : null;
  }

  notifyMangaSessionInspectorRefresh();
  notifyOverlayState();

  return getFullScreenOverlayState();
}

function createControlsWindow(
  payload
) {
  controlsWindow =
    new BrowserWindow({
      ...controlsBounds(
        payload.sourceBounds ||
        payload.windowBounds,
        payload.mode
      ),

      show: false,

      /*
       * Renderer được phép paint ngay khi window còn hidden.
       * Kết hợp ready-to-show để lần overlay đầu tiên không chỉ hiện controls.
       */
      paintWhenInitiallyHidden: true,

      frame: false,
      transparent: true,
      backgroundColor:
        "#00000000",

      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,

      webPreferences: {
        preload:
          path.join(
            __dirname,
            "preload.cjs"
          ),

        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false
      }
    });

  controlsWindow
    .setAlwaysOnTop(
      true,
      "screen-saver"
    );

  const createdControls =
    controlsWindow;

  createdControls.__overlayLoadPromise =
    createdControls.loadFile(
      path.join(
        __dirname,
        "fullScreenControls.html"
      )
    );

  createdControls.__overlayReadyPromise =
    createWindowReadyPromise(
      createdControls,
      createdControls.__overlayLoadPromise,
      "FULL SCREEN CONTROLS"
    );

  createdControls.on(
    "closed",
    () => {
      if (
        controlsWindow ===
        createdControls
      ) {
        controlsWindow = null;
      }
    }
  );

  return createdControls;
}

function applyOverlayInteractionMode() {
  if (
    !overlayWindow ||
    overlayWindow.isDestroyed()
  ) {
    return;
  }

  /*
   * Bình thường overlay không được chiếm keyboard focus để tránh làm
   * browser/game/mainWindow mất focus. Riêng lúc đang sửa text trong
   * bubble, BrowserWindow PHẢI focusable thì textarea mới nhận bàn phím
   * trên Windows. Sau Save/Cancel chúng ta trả ngay về non-focusable.
   */
  const needsKeyboardFocus =
    overlayEditing &&
    overlayTextInputActive;

  if (
    typeof overlayWindow.setFocusable ===
    "function"
  ) {
    overlayWindow.setFocusable(
      needsKeyboardFocus
    );
  }

  if (overlayEditing) {
    overlayWindow.setIgnoreMouseEvents(
      false
    );
  } else {
    overlayWindow.setIgnoreMouseEvents(
      true,
      {
        forward: true
      }
    );
  }

  if (needsKeyboardFocus) {
    overlayWindow.show();

    if (
      typeof overlayWindow.moveTop ===
      "function"
    ) {
      overlayWindow.moveTop();
    }

    /*
     * setFocusable(true) không tự đảm bảo native keyboard focus.
     * focus() là bước bắt buộc để keydown/input đi vào textarea.
     */
    overlayWindow.focus();
  } else {
    overlayWindow.showInactive();
  }

  if (
    controlsWindow &&
    !controlsWindow.isDestroyed() &&
    typeof controlsWindow.moveTop ===
    "function"
  ) {
    controlsWindow.moveTop();
  }
}

function setFullScreenOverlayTextInputActive(
  value
) {
  overlayTextInputActive =
    Boolean(value) &&
    overlayEditing;

  applyOverlayInteractionMode();

  return overlayTextInputActive;
}

function notifyOverlayItems() {
  if (
    !overlayWindow ||
    overlayWindow.isDestroyed() ||
    overlayWindow.webContents.isLoading() ||
    !lastPayload
  ) {
    return;
  }

  overlayWindow.webContents.send(
    "full-screen-overlay-items",
    lastPayload
  );
}

function notifyOverlayPreferences() {
  const preferences = {
    ...overlayPreferences
  };

  if (
    overlayWindow &&
    !overlayWindow.isDestroyed() &&
    !overlayWindow.webContents.isLoading()
  ) {
    overlayWindow.webContents.send(
      "full-screen-overlay-preferences",
      preferences
    );
  }

  return preferences;
}

function notifyOverlayState() {
  const state = {
    pinned:
      overlayPinned,

    editing:
      overlayEditing,

    visible:
      Boolean(
        overlayWindow &&
        !overlayWindow.isDestroyed() &&
        overlayWindow.isVisible()
      ),

    blockCount:
      lastPayload?.items?.length ||
      0,

    debugging:
      overlayDebug,

    debugAvailable:
      Boolean(
        lastPayload?.debug?.rects?.length
      ),

    debugCounts: {
      ...(
        lastPayload?.debug?.counts ||
        {
          ocr: 0,
          ignored: 0,
          bubbles: 0,
          fallback: 0,
        }
      )
    },

    debugDiagnostics: {
      ...(
        lastPayload?.debug
          ?.diagnostics ||
        {}
      )
    },

    sessionInspectorVisible:
      Boolean(
        sessionInspectorWindow &&
        !sessionInspectorWindow.isDestroyed() &&
        sessionInspectorWindow.isVisible()
      ),

    sourceLanguage:
      lastPayload?.sourceLanguage ||
      "AUTO",

    targetLanguage:
      lastPayload?.targetLanguage ||
      "VI",

    mode:
      lastPayload?.mode ||
      "full-screen",

    session:
      lastPayload?.session
        ? {
            ...lastPayload.session,
            selection:
              lastPayload.session.selection
                ? { ...lastPayload.session.selection }
                : undefined,
          }
        : null
  };

  if (
    controlsWindow &&
    !controlsWindow.isDestroyed() &&
    !controlsWindow.webContents.isLoading()
  ) {
    controlsWindow.webContents.send(
      "full-screen-overlay-state",
      state
    );
  }

  if (
    overlayWindow &&
    !overlayWindow.isDestroyed() &&
    !overlayWindow.webContents.isLoading()
  ) {
    overlayWindow.webContents.send(
      "full-screen-overlay-state",
      state
    );
  }

  return state;
}

function updateFullScreenOverlayItemText(
  itemId,
  correctedText,
  metadata = {}
) {
  if (!lastPayload) {
    return false;
  }

  const id =
    String(itemId || "");

  const text =
    String(correctedText || "")
      .trim();

  if (!id || !text) {
    return false;
  }

  let changed = false;

  lastPayload = {
    ...lastPayload,
    items:
      (Array.isArray(lastPayload.items)
        ? lastPayload.items
        : [])
        .map((item) => {
          if (
            String(item?.id || "") !== id
          ) {
            return item;
          }

          changed = true;

          return {
            ...item,
            text,
            source:
              metadata?.source ||
              item.source,
            baselineTranslation:
              text,
          };
        }),
  };

  return changed;
}

function setFullScreenOverlayPreferences(
  next
) {
  overlayPreferences =
    normalizeOverlayPreferences(
      next
    );

  if (lastPayload) {
    lastPayload = {
      ...lastPayload,
      preferences: {
        ...overlayPreferences
      }
    };
  }

  notifyOverlayPreferences();

  return {
    ...overlayPreferences
  };
}

function getFullScreenOverlayPayload() {
  if (!lastPayload) {
    return null;
  }

  /*
   * Payload chỉ chứa dữ liệu JSON/plain object. Trả snapshot mới để renderer
   * có thể chủ động pull dữ liệu nếu IPC push đầu tiên bị miss.
   */
  return {
    ...lastPayload,
    preferences: {
      ...(lastPayload.preferences || {})
    },
    debug:
      lastPayload.debug
        ? {
            ...lastPayload.debug,
            diagnostics: {
              ...(lastPayload.debug
                .diagnostics || {})
            },
            counts: {
              ...(lastPayload.debug
                .counts || {})
            },
            rects:
              Array.isArray(
                lastPayload.debug.rects
              )
                ? lastPayload.debug.rects
                    .map(
                      (item) => ({
                        ...item
                      })
                    )
                : []
          }
        : null,
    items: Array.isArray(lastPayload.items)
      ? lastPayload.items.map((item) => ({ ...item }))
      : []
  };
}

function showFullScreenTranslationOverlay(
  data
) {
  const payload =
    buildPayload(
      data
    );

  if (!payload.items.length) {
    closeFullScreenTranslationOverlay();

    return {
      success: false,
      blockCount: 0
    };
  }

  lastPayload =
    payload;

  overlayEditing = false;
  overlayDebug = false;

  let win =
    overlayWindow;

  if (
    !win ||
    win.isDestroyed()
  ) {
    win =
      createOverlayWindow(
        payload
      );

    Promise.resolve(
      win.__overlayReadyPromise
    )
      .then(() => {
        if (win.isDestroyed()) {
          return;
        }

        /*
         * loadFile() đã resolve => isLoading() đã ổn định false.
         * setImmediate thêm một tick để preload/page listeners đăng ký xong.
         */
        setImmediate(() => {
          if (win.isDestroyed()) {
            return;
          }

          notifyOverlayPreferences();
          notifyOverlayItems();
          applyOverlayInteractionMode();
          notifyOverlayState();
        });
      })
      .catch((error) => {
        console.error(
          "FULL SCREEN OVERLAY LOAD FAILED:",
          error
        );
      });
  } else {
    win.setBounds(
      payload.windowBounds
    );

    notifyOverlayPreferences();
    notifyOverlayItems();
    applyOverlayInteractionMode();
    notifyOverlayState();
  }

  let controls =
    controlsWindow;

  if (
    !controls ||
    controls.isDestroyed()
  ) {
    controls =
      createControlsWindow(
        payload
      );

    Promise.resolve(
      controls.__overlayReadyPromise
    )
      .then(() => {
        if (
          controls.isDestroyed()
        ) {
          return;
        }

        controls.showInactive();
        notifyOverlayState();
      })
      .catch((error) => {
        console.error(
          "FULL SCREEN CONTROLS LOAD FAILED:",
          error
        );
      });
  } else {
    controls.setBounds(
      controlsBounds(
        payload.sourceBounds ||
        payload.windowBounds,
        payload.mode
      )
    );

    controls.showInactive();
    notifyOverlayState();
  }

  if (
    sessionInspectorRequestedVisible &&
    payload.session?.active
  ) {
    setTimeout(() => {
      showMangaSessionInspector();
    }, 40);
  }

  return {
    success: true,
    blockCount:
      payload.items.length,
    displayId:
      payload.displayId
  };
}

function hideFullScreenTranslationOverlay() {
  if (
    overlayWindow &&
    !overlayWindow.isDestroyed()
  ) {
    overlayWindow.hide();
  }

  if (
    controlsWindow &&
    !controlsWindow.isDestroyed()
  ) {
    controlsWindow.hide();
  }

  hideMangaSessionInspector(true);
  notifyOverlayState();
}

function closeFullScreenTranslationOverlay() {
  const overlay =
    overlayWindow;

  const controls =
    controlsWindow;

  const inspector =
    sessionInspectorWindow;

  /*
   * Tách globals khỏi native windows trước khi close().
   * Nếu Electron phát closed trễ, callback cũ không thể xóa state của
   * overlay mới vừa được tạo ở lần scan kế tiếp.
   */
  overlayWindow = null;
  controlsWindow = null;
  sessionInspectorWindow = null;
  sessionInspectorRequestedVisible = false;
  overlayEditing = false;
  overlayDebug = false;
  overlayTextInputActive = false;
  lastPayload = null;

  if (
    overlay &&
    !overlay.isDestroyed()
  ) {
    overlay.close();
  }

  if (
    controls &&
    !controls.isDestroyed()
  ) {
    controls.close();
  }

  if (
    inspector &&
    !inspector.isDestroyed()
  ) {
    inspector.close();
  }
}

function setFullScreenOverlayPinned(
  value
) {
  overlayPinned =
    Boolean(value);

  notifyOverlayState();

  return overlayPinned;
}

function toggleFullScreenOverlayPinned() {
  return setFullScreenOverlayPinned(
    !overlayPinned
  );
}

function setFullScreenOverlayEditing(
  value
) {
  overlayEditing =
    Boolean(value);

  if (!overlayEditing) {
    overlayTextInputActive = false;
  }

  applyOverlayInteractionMode();
  notifyOverlayState();

  return overlayEditing;
}

function toggleFullScreenOverlayEditing() {
  return setFullScreenOverlayEditing(
    !overlayEditing
  );
}

function setFullScreenOverlayDebug(
  value
) {
  overlayDebug =
    Boolean(value) &&
    Boolean(
      lastPayload?.debug?.rects?.length
    );

  notifyOverlayState();

  return overlayDebug;
}

function toggleFullScreenOverlayDebug() {
  return setFullScreenOverlayDebug(
    !overlayDebug
  );
}

function isFullScreenOverlayDebug() {
  return overlayDebug;
}

function isFullScreenOverlayEditing() {
  return overlayEditing;
}

function resetFullScreenOverlayLayout() {
  if (
    overlayWindow &&
    !overlayWindow.isDestroyed() &&
    !overlayWindow.webContents.isLoading()
  ) {
    overlayWindow.webContents.send(
      "full-screen-overlay-reset-layout"
    );
  }

  return getFullScreenOverlayState();
}

function isFullScreenOverlayPinned() {
  return overlayPinned;
}

function getFullScreenOverlayState() {
  return notifyOverlayState();
}

module.exports = {
  showFullScreenTranslationOverlay,
  hideFullScreenTranslationOverlay,
  closeFullScreenTranslationOverlay,
  setFullScreenOverlayPinned,
  toggleFullScreenOverlayPinned,
  isFullScreenOverlayPinned,
  setFullScreenOverlayEditing,
  toggleFullScreenOverlayEditing,
  isFullScreenOverlayEditing,
  setFullScreenOverlayDebug,
  toggleFullScreenOverlayDebug,
  isFullScreenOverlayDebug,
  setFullScreenOverlayTextInputActive,
  resetFullScreenOverlayLayout,
  showMangaSessionInspector,
  hideMangaSessionInspector,
  toggleMangaSessionInspector,
  closeMangaSessionInspector,
  notifyMangaSessionInspectorRefresh,
  updateFullScreenOverlaySession,
  getFullScreenOverlayState,
  getFullScreenOverlayPayload,
  updateFullScreenOverlayItemText,
  setFullScreenOverlayPreferences
};
