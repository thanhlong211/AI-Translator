const crypto = require("crypto");

const ACTION_TYPES = new Set([
  "MANUAL",
  "KEY",
  "CLICK",
  "SCROLL",
]);

const KEY_NAMES = new Set([
  "ARROWRIGHT",
  "ARROWLEFT",
  "PAGEDOWN",
  "PAGEUP",
  "SPACE",
  "ENTER",
]);

const BROWSER_SUFFIXES = [
  "google chrome",
  "microsoft edge",
  "mozilla firefox",
  "brave",
  "opera",
  "vivaldi",
];

function cleanText(value, maxLength = 120) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanProcessName(value) {
  return cleanText(value, 80).toLowerCase();
}

function normalizeComparable(value) {
  return cleanText(value, 220).toLowerCase();
}

function clampNumber(value, fallback, min, max) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numeric));
}

function normalizeAction(input) {
  const requestedType = cleanText(input?.type, 20).toUpperCase();
  const type = ACTION_TYPES.has(requestedType)
    ? requestedType
    : "MANUAL";

  const keyName = cleanText(input?.key, 30).toUpperCase();

  const explicitClickPoint =
    Number.isFinite(Number(input?.clickX)) &&
    Number.isFinite(Number(input?.clickY));

  return {
    type,
    key:
      KEY_NAMES.has(keyName)
        ? keyName
        : "ARROWRIGHT",
    clickX:
      clampNumber(input?.clickX, 0.9, 0.02, 0.98),
    clickY:
      clampNumber(input?.clickY, 0.5, 0.02, 0.98),
    clickConfigured:
      Boolean(input?.clickConfigured) ||
      (type === "CLICK" && explicitClickPoint),
    scrollDirection:
      cleanText(input?.scrollDirection, 10).toUpperCase() === "UP"
        ? "UP"
        : "DOWN",
    scrollSteps:
      Math.round(
        clampNumber(input?.scrollSteps, 5, 1, 12)
      ),
    changeTimeoutMs:
      Math.round(
        clampNumber(input?.changeTimeoutMs, 2800, 1200, 7000)
      ),
  };
}

function normalizeProfile(input) {
  const processName = cleanProcessName(input?.processName);
  const titleContains = cleanText(input?.titleContains, 100);
  const name = cleanText(input?.name, 80) || titleContains || processName || "Manga site";

  return {
    id:
      cleanText(input?.id, 80) || crypto.randomUUID(),
    name,
    processName,
    titleContains,
    action: normalizeAction(input?.action),
    updatedAt:
      Number.isFinite(Number(input?.updatedAt))
        ? Number(input.updatedAt)
        : Date.now(),
  };
}

function normalizeProfiles(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  const result = [];
  const seen = new Set();

  for (const rawProfile of input.slice(0, 80)) {
    const profile = normalizeProfile(rawProfile);

    if (seen.has(profile.id)) {
      continue;
    }

    seen.add(profile.id);
    result.push(profile);
  }

  return result;
}

function isBrowserSuffix(value) {
  const normalized = normalizeComparable(value);
  return BROWSER_SUFFIXES.some((suffix) => normalized === suffix);
}

function looksLikePageLabel(value) {
  const normalized = normalizeComparable(value);

  return (
    /^(chapter|chap|ch\.?|page|trang|episode|ep\.?|vol\.?|volume)\s*[#:\-]?\s*\d+/i.test(normalized) ||
    /^\d+\s*\/\s*\d+$/.test(normalized)
  );
}

function deriveSiteHint(targetWindow) {
  const title = cleanText(targetWindow?.title, 220);
  const processName = cleanProcessName(targetWindow?.processName);

  const pieces = title
    .split(/\s(?:-|–|—|\||·|•)\s/g)
    .map((part) => cleanText(part, 100))
    .filter(Boolean)
    .filter((part) => !isBrowserSuffix(part));

  const candidates = pieces.filter((part) => !looksLikePageLabel(part));
  const best =
    candidates.length > 0
      ? candidates[candidates.length - 1]
      : "";

  if (best) {
    return best;
  }

  if (processName) {
    return processName.replace(/(^|\s)\w/g, (match) => match.toUpperCase());
  }

  return "Manga site";
}

function profileMatchesTarget(profile, targetWindow) {
  if (!profile || !targetWindow) {
    return false;
  }

  const targetProcess = cleanProcessName(targetWindow.processName);
  const targetTitle = normalizeComparable(targetWindow.title);

  if (
    profile.processName &&
    targetProcess &&
    profile.processName !== targetProcess
  ) {
    return false;
  }

  const titleNeedle = normalizeComparable(profile.titleContains);

  if (titleNeedle && !targetTitle.includes(titleNeedle)) {
    return false;
  }

  return Boolean(profile.processName || titleNeedle);
}

function findMatchingProfile(profiles, targetWindow) {
  const normalizedProfiles = normalizeProfiles(profiles);

  return normalizedProfiles
    .filter((profile) => profileMatchesTarget(profile, targetWindow))
    .sort((left, right) => {
      const leftScore =
        normalizeComparable(left.titleContains).length * 10 +
        (left.processName ? 5 : 0);
      const rightScore =
        normalizeComparable(right.titleContains).length * 10 +
        (right.processName ? 5 : 0);

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return Number(right.updatedAt || 0) - Number(left.updatedAt || 0);
    })[0] || null;
}

function createDraftForTarget(targetWindow, existingProfile = null) {
  if (existingProfile) {
    return normalizeProfile(existingProfile);
  }

  const hint = deriveSiteHint(targetWindow);
  const processName = cleanProcessName(targetWindow?.processName);
  const hintIsOnlyProcess =
    normalizeComparable(hint) === processName;

  return normalizeProfile({
    name: hint,
    processName,
    titleContains:
      hintIsOnlyProcess
        ? ""
        : hint,
    action: {
      type: "MANUAL",
    },
  });
}

function upsertProfile(profiles, input, targetWindow) {
  const normalizedProfiles = normalizeProfiles(profiles);
  const normalizedInput = normalizeProfile({
    ...input,
    processName:
      cleanProcessName(input?.processName) ||
      cleanProcessName(targetWindow?.processName),
    updatedAt: Date.now(),
  });

  const next = [];
  let replaced = false;

  for (const profile of normalizedProfiles) {
    if (profile.id === normalizedInput.id) {
      next.push(normalizedInput);
      replaced = true;
    } else {
      next.push(profile);
    }
  }

  if (!replaced) {
    next.push(normalizedInput);
  }

  return {
    profiles: next.slice(-80),
    profile: normalizedInput,
  };
}

function deleteProfile(profiles, profileId) {
  const cleanId = cleanText(profileId, 80);

  return normalizeProfiles(profiles).filter((profile) => profile.id !== cleanId);
}

function actionLabel(action) {
  const normalized = normalizeAction(action);

  if (normalized.type === "KEY") {
    const labels = {
      ARROWRIGHT: "Phím →",
      ARROWLEFT: "Phím ←",
      PAGEDOWN: "Page Down",
      PAGEUP: "Page Up",
      SPACE: "Space",
      ENTER: "Enter",
    };

    return labels[normalized.key] || normalized.key;
  }

  if (normalized.type === "CLICK") {
    return `Click ${Math.round(normalized.clickX * 100)}% · ${Math.round(normalized.clickY * 100)}%`;
  }

  if (normalized.type === "SCROLL") {
    return `${normalized.scrollDirection === "UP" ? "Cuộn lên" : "Cuộn xuống"} · ${normalized.scrollSteps}`;
  }

  return "Tự chuyển trang";
}

function publicNavigationState({
  profiles,
  targetWindow,
  preferredProfileId = null,
} = {}) {
  const normalizedProfiles = normalizeProfiles(profiles);
  const preferred = preferredProfileId
    ? normalizedProfiles.find((profile) => profile.id === preferredProfileId) || null
    : null;
  const matched = preferred || findMatchingProfile(normalizedProfiles, targetWindow);
  const hint = deriveSiteHint(targetWindow);

  return {
    configured: Boolean(matched),
    profileId: matched?.id || null,
    profileName: matched?.name || hint,
    siteHint: hint,
    processName: cleanProcessName(targetWindow?.processName),
    title: cleanText(targetWindow?.title, 220),
    titleContains: matched?.titleContains || hint,
    action: normalizeAction(matched?.action),
    actionLabel: actionLabel(matched?.action),
  };
}

module.exports = {
  normalizeAction,
  normalizeProfiles,
  deriveSiteHint,
  findMatchingProfile,
  createDraftForTarget,
  upsertProfile,
  deleteProfile,
  publicNavigationState,
  actionLabel,
};
