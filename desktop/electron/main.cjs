const {
    app,
    BrowserWindow,
    ipcMain,
    screen,
    globalShortcut,
    Tray,
    Menu,
    nativeImage,
    safeStorage,
    dialog,
    shell
} = require("electron");
const { spawn } = require("child_process");
const readline = require("readline");
const path = require("path");
const os = require("os");
const screenshot = require("screenshot-desktop");
const sharp = require("sharp");
const {
  showSelectionTranslation,
  hideSelectionTranslation,
  closeSelectionTranslation,
  setTranslationOverlayPinned,
  toggleTranslationOverlayPinned,
  isTranslationOverlayPinned,
  getTranslationOverlayState,
  setTranslationOverlayPreferences,
} = require("./translateOverlay.cjs");

const {
  showFullScreenTranslationOverlay,
  hideFullScreenTranslationOverlay,
  closeFullScreenTranslationOverlay,
  setFullScreenOverlayPinned,
  toggleFullScreenOverlayPinned,
  isFullScreenOverlayPinned,
  toggleFullScreenOverlayEditing,
  isFullScreenOverlayEditing,
  toggleFullScreenOverlayDebug,
  setFullScreenOverlayTextInputActive,
  resetFullScreenOverlayLayout,
  toggleMangaSessionInspector,
  closeMangaSessionInspector,
  notifyMangaSessionInspectorRefresh,
  updateFullScreenOverlaySession,
  getFullScreenOverlayState,
  getFullScreenOverlayPayload,
  updateFullScreenOverlayItemText,
  setFullScreenOverlayPreferences,
} = require("./fullScreenOverlay.cjs");

const {
  showTranslationLoading,
  updateTranslationLoading,
  closeTranslationLoading,
} = require("./loadingOverlay.cjs");

const {
  detectMangaSpeechBubbles,
} = require("./mangaBubbleDetector.cjs");

const {
  readDocumentPath,
  openDocumentFiles,
  getTranslationRouteForFormat,
  listDocumentFormats,
} = require("./documentReaderCore.cjs");

const {
  extractPdfPagePng,
  ocrResultToPageBlocks,
} = require("./pdfOcrParser.cjs");

const {
  startForegroundWindowTracker,
  stopForegroundWindowTracker,
  getForegroundWindowSnapshot,
} = require("./foregroundWindowTracker.cjs");

const {
  createOverlay,
  closeOverlay
} = require("./overlay.cjs");
// ======================================================
// JAVA BACKEND
// ======================================================

const BACKEND_BASE_URL =
  String(
    process.env.AI_TRANSLATOR_BACKEND_URL ||
      "http://localhost:8080"
  ).replace(/\/+$/, "");

const BACKEND_TRANSLATE_URL =
  `${BACKEND_BASE_URL}/api/v1/translate`;

const BACKEND_TRANSLATE_BATCH_URL =
  `${BACKEND_BASE_URL}/api/v1/translate/batch`;

const BACKEND_TRANSLATION_FEEDBACK_URL =
  `${BACKEND_BASE_URL}/api/v1/translation-feedback`;

const BACKEND_HEALTH_URL =
  `${BACKEND_BASE_URL}/actuator/health/readiness`;

const BACKEND_AUTH_BASE_URL =
  `${BACKEND_BASE_URL}/api/v1/auth`;

const BACKEND_LOGIN_URL =
  `${BACKEND_AUTH_BASE_URL}/login`;

const BACKEND_REGISTER_URL =
  `${BACKEND_AUTH_BASE_URL}/register`;

const BACKEND_SOCIAL_AUTH_URL =
  `${BACKEND_AUTH_BASE_URL}/social`;

const BACKEND_IDENTITIES_URL =
  `${BACKEND_BASE_URL}/api/v1/account/identities`;

const BACKEND_REFRESH_URL =
  `${BACKEND_AUTH_BASE_URL}/refresh`;

const BACKEND_LOGOUT_URL =
  `${BACKEND_AUTH_BASE_URL}/logout`;

const BACKEND_ME_URL =
  `${BACKEND_BASE_URL}/api/v1/me`;

const BACKEND_ENTITLEMENTS_URL =
  `${BACKEND_BASE_URL}/api/v1/account/entitlements`;

const BACKEND_LICENSE_ACTIVATE_URL =
  `${BACKEND_BASE_URL}/api/v1/account/license/activate`;

const BACKEND_DEVICES_URL =
  `${BACKEND_BASE_URL}/api/v1/me/devices`;

const BACKEND_PROFILES_URL =
  `${BACKEND_BASE_URL}/api/v1/profiles`;

const BACKEND_STUDY_ANALYZE_URL =
  `${BACKEND_BASE_URL}/api/v1/study/analyze`;

const BACKEND_VOCABULARY_URL =
  `${BACKEND_BASE_URL}/api/v1/vocabulary`;

const BACKEND_VOCABULARY_STATS_URL =
  `${BACKEND_VOCABULARY_URL}/stats`;

const BACKEND_GRAMMAR_URL =
  `${BACKEND_BASE_URL}/api/v1/grammar`;

const BACKEND_GRAMMAR_STATS_URL =
  `${BACKEND_GRAMMAR_URL}/stats`;

const BACKEND_REVIEW_URL =
  `${BACKEND_BASE_URL}/api/v1/review`;

const BACKEND_REVIEW_DUE_URL =
  `${BACKEND_REVIEW_URL}/due`;

const BACKEND_REVIEW_PRACTICE_URL =
  `${BACKEND_REVIEW_URL}/practice`;

const BACKEND_REVIEW_STATS_URL =
  `${BACKEND_REVIEW_URL}/stats`;

const BACKEND_REVIEW_ANSWER_URL =
  `${BACKEND_REVIEW_URL}/answer`;


const BACKEND_LEARNING_DASHBOARD_URL =
  `${BACKEND_BASE_URL}/api/v1/learning/dashboard`;

let activeTranslationProfile = null;

const SUPPORTED_TRANSLATION_LANGUAGES =
  new Set([
    "AUTO",
    "VI",
    "JA",
    "EN",
    "KO",
    "ZH",
    "ZH_TW",
    "FR",
    "DE",
    "ES",
    "TH",
    "ID",
  ]);

let currentTranslationSourceLanguage =
  "AUTO";

let currentTranslationTargetLanguage =
  "VI";

function normalizeTranslationSourceLanguage(
  value
) {
  const normalized =
    String(value || "")
      .trim()
      .toUpperCase();

  return SUPPORTED_TRANSLATION_LANGUAGES
    .has(normalized)
      ? normalized
      : "AUTO";
}

function normalizeTranslationTargetLanguage(
  value
) {
  const normalized =
    String(value || "")
      .trim()
      .toUpperCase();

  if (
    normalized === "AUTO" ||
    !SUPPORTED_TRANSLATION_LANGUAGES
      .has(normalized)
  ) {
    return "VI";
  }

  return normalized;
}

function setTranslationLanguages(
  options = {}
) {
  currentTranslationSourceLanguage =
    normalizeTranslationSourceLanguage(
      options?.sourceLanguage
    );

  currentTranslationTargetLanguage =
    normalizeTranslationTargetLanguage(
      options?.targetLanguage
    );

  return {
    sourceLanguage:
      currentTranslationSourceLanguage,
    targetLanguage:
      currentTranslationTargetLanguage,
  };
}

let currentWorkspaceMode =
  "translate";

let currentStudyLevel =
  "AUTO";

let currentStudyAutoSaveVocabulary =
  false;

let currentStudyAutoSaveGrammar =
  false;

let pendingScanMode =
  "translate";

let pendingTranslationSourceLanguage =
  "AUTO";

let pendingTranslationTargetLanguage =
  "VI";

let pendingTargetWindow =
  null;

let activeOverlayTargetWindow =
  null;

let overlayLifecycleTimer =
  null;

let workspaceScanGuardReason =
  "";

const translationContextByProfile =
  new Map();

/*
 * Batch 10 - Manga Page Translation Session
 *
 * Session giữ riêng vùng quét + context 10 câu gần nhất cho manga.
 * Nó không dùng chung context của Quick Translate/Study để tránh nhiễu hội thoại.
 */
let mangaPanelSession = null;


/*
 * Batch 12 - Plans / Entitlements / License
 *
 * Backend là source-of-truth cho plan/features/limits.
 * Desktop chỉ giữ một snapshot an toàn để UI/overlay feature-gate.
 * Nếu chưa đăng nhập hoặc backend chưa trả entitlement, paid feature mặc định OFF.
 */
const DEFAULT_ACCOUNT_ENTITLEMENTS = Object.freeze({
  planCode: "FREE",
  planName: "Free",
  subscriptionStatus: "ACTIVE",
  subscriptionSource: "DEFAULT",
  periodEnd: null,
  features: Object.freeze({
    quickTranslate: true,
    studyMode: false,
    mangaPanel: false,
    mangaSession: false,
    translationMemory: true,
    continuousManga: false,
    novelReaderTxt: false,
    novelReaderEpub: false,
    pdfTextReader: false,
    pdfOcrReader: false,
  }),
  limits: Object.freeze({
    monthlyTranslations: 300,
    mangaPagesPerDay: 0,
    continuousMangaPagesPerDay: 0,
    contextItems: 5,
    devices: 1,
  }),
  usage: Object.freeze({
    monthlyTranslationsUsed: 0,
  }),
  developmentOverride: false,
});

let accountEntitlements = {
  ...DEFAULT_ACCOUNT_ENTITLEMENTS,
  features: {
    ...DEFAULT_ACCOUNT_ENTITLEMENTS.features,
  },
  limits: {
    ...DEFAULT_ACCOUNT_ENTITLEMENTS.limits,
  },
  usage: {
    ...DEFAULT_ACCOUNT_ENTITLEMENTS.usage,
  },
};

function normalizeAccountEntitlements(payload) {
  const raw =
    payload &&
    typeof payload === "object"
      ? payload
      : {};

  const rawFeatures =
    raw.features &&
    typeof raw.features === "object"
      ? raw.features
      : {};

  const rawLimits =
    raw.limits &&
    typeof raw.limits === "object"
      ? raw.limits
      : {};

  const rawUsage =
    raw.usage &&
    typeof raw.usage === "object"
      ? raw.usage
      : {};

  const features = {
    ...DEFAULT_ACCOUNT_ENTITLEMENTS.features,
  };

  for (const [
    key,
    value,
  ] of Object.entries(
    rawFeatures
  )) {
    features[
      String(key)
    ] = Boolean(value);
  }

  const limits = {
    ...DEFAULT_ACCOUNT_ENTITLEMENTS.limits,
  };

  for (const [
    key,
    value,
  ] of Object.entries(
    rawLimits
  )) {
    const numeric =
      Number(value);

    if (
      Number.isFinite(numeric)
    ) {
      limits[
        String(key)
      ] = numeric;
    }
  }

  const usage = {
    ...DEFAULT_ACCOUNT_ENTITLEMENTS.usage,
  };

  for (const [
    key,
    value,
  ] of Object.entries(
    rawUsage
  )) {
    const numeric =
      Number(value);

    if (
      Number.isFinite(numeric)
    ) {
      usage[
        String(key)
      ] = numeric;
    }
  }

  return {
    planCode:
      String(
        raw.planCode ||
        "FREE"
      )
        .trim()
        .toUpperCase(),
    planName:
      String(
        raw.planName ||
        raw.planCode ||
        "Free"
      ).trim(),
    subscriptionStatus:
      String(
        raw.subscriptionStatus ||
        "ACTIVE"
      ).trim(),
    subscriptionSource:
      String(
        raw.subscriptionSource ||
        "DEFAULT"
      ).trim(),
    periodEnd:
      raw.periodEnd ||
      null,
    features,
    limits,
    usage,
    developmentOverride:
      Boolean(
        raw.developmentOverride
      ),
  };
}

function getAccountEntitlementsSnapshot() {
  return {
    ...accountEntitlements,
    features: {
      ...accountEntitlements.features,
    },
    limits: {
      ...accountEntitlements.limits,
    },
    usage: {
      ...accountEntitlements.usage,
    },
  };
}

function resetAccountEntitlements({
  notify = true,
} = {}) {
  accountEntitlements =
    normalizeAccountEntitlements(
      DEFAULT_ACCOUNT_ENTITLEMENTS
    );

  if (mangaPanelSession) {
    endMangaPanelSession(
      "entitlement-reset"
    );
  } else if (
    mangaContinuousState.enabled
  ) {
    stopMangaContinuousMode(
      "entitlement-reset",
      false
    );
  }

  if (notify) {
    sendToMainWindow(
      "account-entitlements-changed",
      getAccountEntitlementsSnapshot()
    );
  }

  return getAccountEntitlementsSnapshot();
}

function getDesktopFeatureCapabilities() {
  return {
    ...DEFAULT_ACCOUNT_ENTITLEMENTS.features,
    ...accountEntitlements.features,
  };
}

const MANGA_CONTINUOUS_POLL_MS = 1400;
const MANGA_CONTINUOUS_CHANGE_THRESHOLD = 0.12;
const MANGA_CONTINUOUS_STABLE_THRESHOLD = 0.035;
const MANGA_CONTINUOUS_COOLDOWN_MS = 2600;

let mangaContinuousTimer = null;
let mangaContinuousPollBusy = false;
let mangaContinuousState = {
  enabled: false,
  paused: false,
  status: "OFF",
  baselineFingerprint: null,
  candidateFingerprint: null,
  stableHits: 0,
  lastDifference: 0,
  lastCheckedAt: null,
  lastTriggeredAt: null,
  cooldownUntil: 0,
  error: "",
};

function hasDesktopFeatureCapability(name) {
  return Boolean(
    getDesktopFeatureCapabilities()[
      String(name || "")
    ]
  );
}

const PAID_FEATURE_REQUIREMENTS = Object.freeze({
  studyMode: Object.freeze({ featureKey: "studyMode", featureName: "Study Mode" }),
  mangaPanel: Object.freeze({ featureKey: "mangaPanel", featureName: "Manga Translation" }),
  mangaSession: Object.freeze({ featureKey: "mangaSession", featureName: "Manga Session" }),
  continuousManga: Object.freeze({ featureKey: "continuousManga", featureName: "Continuous Manga" }),
  novelReaderTxt: Object.freeze({ featureKey: "novelReaderTxt", featureName: "Novel Reader TXT" }),
  novelReaderEpub: Object.freeze({ featureKey: "novelReaderEpub", featureName: "Novel Reader EPUB" }),
  pdfTextReader: Object.freeze({ featureKey: "pdfTextReader", featureName: "PDF Text Reader" }),
  pdfOcrReader: Object.freeze({ featureKey: "pdfOcrReader", featureName: "PDF OCR Reader" }),
});

function getPaidFeatureRequirement(featureKey) {
  return PAID_FEATURE_REQUIREMENTS[String(featureKey || "")] || {
    featureKey: String(featureKey || ""),
    featureName: String(featureKey || "Tính năng"),
  };
}

function paidFeatureRequiredMessage(featureKey) {
  const requirement = getPaidFeatureRequirement(featureKey);
  const currentPlan =
    String(accountEntitlements.planName || accountEntitlements.planCode || "gói hiện tại").trim();

  return (
    `${requirement.featureName} chưa được bật trong ${currentPlan}. ` +
    "Mở Settings → Plan & License để xem quyền hiện tại hoặc đổi gói."
  );
}

function notifyPaidFeatureRequired(featureKey) {
  const requirement =
    getPaidFeatureRequirement(featureKey);
  const payload = {
    ...requirement,
    currentPlan:
      accountEntitlements.planCode ||
      "FREE",
    message:
      paidFeatureRequiredMessage(
        featureKey
      ),
  };

  if (
    mainWindow &&
    !mainWindow.isDestroyed()
  ) {
    mainWindow.show();
    mainWindow.focus();
  }

  sendToMainWindow(
    "paid-feature-required",
    payload
  );

  return payload;
}

function requireDesktopFeatureCapability(
  featureKey,
  { notify = true } = {}
) {
  if (
    hasDesktopFeatureCapability(
      featureKey
    )
  ) {
    return true;
  }

  if (notify) {
    notifyPaidFeatureRequired(
      featureKey
    );
  }

  throw new Error(
    paidFeatureRequiredMessage(
      featureKey
    )
  );
}

async function requireFreshDesktopFeatureCapability(
  featureKey,
  { notify = true } = {}
) {
  await refreshAccountEntitlements({
    silent: true,
  });

  return requireDesktopFeatureCapability(
    featureKey,
    { notify }
  );
}

function getMangaContinuousPublicState() {
  return {
    available:
      hasDesktopFeatureCapability(
        "continuousManga"
      ),
    enabled:
      Boolean(
        mangaContinuousState.enabled
      ),
    paused:
      Boolean(
        mangaContinuousState.paused
      ),
    status:
      String(
        mangaContinuousState.status ||
        "OFF"
      ),
    lastDifference:
      Number(
        mangaContinuousState.lastDifference ||
        0
      ),
    lastCheckedAt:
      mangaContinuousState.lastCheckedAt,
    lastTriggeredAt:
      mangaContinuousState.lastTriggeredAt,
    error:
      String(
        mangaContinuousState.error ||
        ""
      ),
    pollMs:
      MANGA_CONTINUOUS_POLL_MS,
  };
}

function clearMangaContinuousTimer() {
  if (mangaContinuousTimer) {
    clearTimeout(
      mangaContinuousTimer
    );
    mangaContinuousTimer = null;
  }
}

function resetMangaContinuousDetection(
  status = null
) {
  mangaContinuousState = {
    ...mangaContinuousState,
    status:
      status ||
      (
        mangaContinuousState.enabled
          ? mangaContinuousState.paused
            ? "PAUSED"
            : "CALIBRATING"
          : "OFF"
      ),
    baselineFingerprint: null,
    candidateFingerprint: null,
    stableHits: 0,
    lastDifference: 0,
    error: "",
  };
}

function stopMangaContinuousMode(
  reason = "manual",
  notify = true
) {
  clearMangaContinuousTimer();

  mangaContinuousState = {
    enabled: false,
    paused: false,
    status: "OFF",
    baselineFingerprint: null,
    candidateFingerprint: null,
    stableHits: 0,
    lastDifference: 0,
    lastCheckedAt: null,
    lastTriggeredAt:
      mangaContinuousState.lastTriggeredAt,
    cooldownUntil: 0,
    error: "",
  };

  console.log(
    "MANGA CONTINUOUS STOPPED:",
    reason
  );

  if (notify && mangaPanelSession) {
    publishMangaSessionState();
  }

  return getMangaContinuousPublicState();
}

function scheduleMangaContinuousPoll(
  waitMs = MANGA_CONTINUOUS_POLL_MS
) {
  clearMangaContinuousTimer();

  if (
    !mangaContinuousState.enabled ||
    mangaContinuousState.paused ||
    !mangaPanelSession
  ) {
    return;
  }

  mangaContinuousTimer =
    setTimeout(
      () => {
        void pollMangaContinuousMode();
      },
      Math.max(
        250,
        Number(waitMs) ||
        MANGA_CONTINUOUS_POLL_MS
      )
    );
}

async function buildMangaSelectionFingerprint(
  screenshotBuffer,
  selection
) {
  if (!screenshotBuffer) {
    throw new Error(
      "Không có screenshot để kiểm tra trang manga."
    );
  }

  const normalizedSelection =
    normalizeMangaSessionSelection(
      selection
    );

  if (!normalizedSelection) {
    throw new Error(
      "Vùng Manga Session không hợp lệ."
    );
  }

  const metadata =
    await sharp(
      screenshotBuffer
    ).metadata();

  if (
    !metadata.width ||
    !metadata.height
  ) {
    throw new Error(
      "Không đọc được kích thước screenshot khi theo dõi manga."
    );
  }

  const display =
    screen.getPrimaryDisplay();

  const scaleX =
    metadata.width /
    display.bounds.width;
  const scaleY =
    metadata.height /
    display.bounds.height;

  const left =
    Math.max(
      0,
      Math.min(
        metadata.width - 1,
        Math.round(
          normalizedSelection.x *
          scaleX
        )
      )
    );

  const top =
    Math.max(
      0,
      Math.min(
        metadata.height - 1,
        Math.round(
          normalizedSelection.y *
          scaleY
        )
      )
    );

  const width =
    Math.max(
      1,
      Math.min(
        metadata.width - left,
        Math.round(
          normalizedSelection.width *
          scaleX
        )
      )
    );

  const height =
    Math.max(
      1,
      Math.min(
        metadata.height - top,
        Math.round(
          normalizedSelection.height *
          scaleY
        )
      )
    );

  return sharp(
    screenshotBuffer
  )
    .extract({
      left,
      top,
      width,
      height,
    })
    .resize(
      48,
      48,
      {
        fit: "fill",
      }
    )
    .grayscale()
    .raw()
    .toBuffer();
}

function mangaFingerprintDifference(
  left,
  right
) {
  if (
    !left ||
    !right ||
    left.length !== right.length ||
    !left.length
  ) {
    return 1;
  }

  let total = 0;

  for (
    let index = 0;
    index < left.length;
    index += 1
  ) {
    total += Math.abs(
      left[index] -
      right[index]
    );
  }

  return total /
    left.length /
    255;
}

async function captureMangaContinuousFingerprint() {
  if (!mangaPanelSession) {
    return null;
  }

  const image =
    await screenshot({
      format: "png",
    });

  return buildMangaSelectionFingerprint(
    image,
    mangaPanelSession.selection
  );
}

function markMangaContinuousPageTranslated() {
  if (!mangaContinuousState.enabled) {
    return;
  }

  resetMangaContinuousDetection(
    mangaContinuousState.paused
      ? "PAUSED"
      : "CALIBRATING"
  );

  mangaContinuousState.cooldownUntil =
    Date.now() +
    MANGA_CONTINUOUS_COOLDOWN_MS;

  publishMangaSessionState();
  scheduleMangaContinuousPoll(
    MANGA_CONTINUOUS_POLL_MS
  );
}

async function pollMangaContinuousMode() {
  clearMangaContinuousTimer();

  if (
    mangaContinuousPollBusy ||
    !mangaContinuousState.enabled ||
    mangaContinuousState.paused ||
    !mangaPanelSession
  ) {
    scheduleMangaContinuousPoll();
    return;
  }

  if (
    selectorIsOpen ||
    isProcessingSelection ||
    isFullScreenProcessing ||
    isMangaSessionProcessing
  ) {
    scheduleMangaContinuousPoll();
    return;
  }

  const overlayState =
    getFullScreenOverlayState();

  if (
    overlayState?.editing ||
    overlayState?.debugging
  ) {
    mangaContinuousState.status =
      overlayState?.editing
        ? "WAITING_EDIT"
        : "WAITING_DEBUG";
    publishMangaSessionState();
    scheduleMangaContinuousPoll();
    return;
  }

  mangaContinuousPollBusy = true;

  try {
    const current =
      await captureMangaContinuousFingerprint();

    if (!current) {
      scheduleMangaContinuousPoll();
      return;
    }

    mangaContinuousState.lastCheckedAt =
      Date.now();
    mangaContinuousState.error = "";

    if (
      !mangaContinuousState.baselineFingerprint
    ) {
      mangaContinuousState.baselineFingerprint =
        current;
      mangaContinuousState.candidateFingerprint =
        null;
      mangaContinuousState.stableHits = 0;
      mangaContinuousState.status =
        "WATCHING";
      publishMangaSessionState();
      scheduleMangaContinuousPoll();
      return;
    }

    const difference =
      mangaFingerprintDifference(
        mangaContinuousState.baselineFingerprint,
        current
      );

    mangaContinuousState.lastDifference =
      Number(
        difference.toFixed(4)
      );

    if (
      Date.now() <
      mangaContinuousState.cooldownUntil
    ) {
      mangaContinuousState.status =
        "COOLDOWN";
      publishMangaSessionState();
      scheduleMangaContinuousPoll();
      return;
    }

    if (
      difference <
      MANGA_CONTINUOUS_CHANGE_THRESHOLD
    ) {
      mangaContinuousState.candidateFingerprint =
        null;
      mangaContinuousState.stableHits = 0;
      mangaContinuousState.status =
        "WATCHING";
      publishMangaSessionState();
      scheduleMangaContinuousPoll();
      return;
    }

    if (
      !mangaContinuousState.candidateFingerprint
    ) {
      mangaContinuousState.candidateFingerprint =
        current;
      mangaContinuousState.stableHits = 0;
      mangaContinuousState.status =
        "WAITING_STABLE";
      publishMangaSessionState();
      scheduleMangaContinuousPoll();
      return;
    }

    const candidateDifference =
      mangaFingerprintDifference(
        mangaContinuousState.candidateFingerprint,
        current
      );

    if (
      candidateDifference <=
      MANGA_CONTINUOUS_STABLE_THRESHOLD
    ) {
      mangaContinuousState.stableHits += 1;
    } else {
      mangaContinuousState.candidateFingerprint =
        current;
      mangaContinuousState.stableHits = 0;
    }

    if (
      mangaContinuousState.stableHits < 1
    ) {
      mangaContinuousState.status =
        "WAITING_STABLE";
      publishMangaSessionState();
      scheduleMangaContinuousPoll();
      return;
    }

    mangaContinuousState.status =
      "TRANSLATING";
    mangaContinuousState.lastTriggeredAt =
      Date.now();
    mangaContinuousState.cooldownUntil =
      Date.now() +
      MANGA_CONTINUOUS_COOLDOWN_MS;
    publishMangaSessionState();

    const autoResult =
      await runMangaSessionNextPage(
        "continuous-auto"
      );

    if (!autoResult?.success) {
      mangaContinuousState.status =
        "ERROR";
      mangaContinuousState.error =
        String(
          autoResult?.error ||
          "Không thể tự dịch trang mới."
        );
      mangaContinuousState.cooldownUntil =
        Date.now() +
        MANGA_CONTINUOUS_COOLDOWN_MS;
      publishMangaSessionState();
      scheduleMangaContinuousPoll(
        MANGA_CONTINUOUS_POLL_MS * 2
      );
    }
  } catch (error) {
    console.error(
      "MANGA CONTINUOUS POLL ERROR:",
      error
    );

    mangaContinuousState.status =
      "ERROR";
    mangaContinuousState.error =
      error instanceof Error
        ? error.message
        : String(error);
    mangaContinuousState.cooldownUntil =
      Date.now() +
      MANGA_CONTINUOUS_COOLDOWN_MS;
    publishMangaSessionState();
    scheduleMangaContinuousPoll(
      MANGA_CONTINUOUS_POLL_MS * 2
    );
  } finally {
    mangaContinuousPollBusy = false;
  }
}

function publishMangaSessionState() {
  const state =
    getMangaPanelSessionState();

  updateFullScreenOverlaySession(
    state.active
      ? state
      : null
  );

  notifyMangaSessionInspectorRefresh();

  sendToMainWindow(
    "manga-session-state",
    state
  );

  return state;
}

function setMangaContinuousEnabled(
  enabled
) {
  if (enabled) {
    if (
      !hasDesktopFeatureCapability(
        "continuousManga"
      )
    ) {
      requireDesktopFeatureCapability(
        "continuousManga"
      );
    }

    if (!mangaPanelSession) {
      throw new Error(
        `Chưa có Manga Session. Hãy dùng ${shortcutDisplay(shortcutSettings.panel)} để chọn trang đầu tiên.`
      );
    }

    mangaContinuousState = {
      ...mangaContinuousState,
      enabled: true,
      paused: false,
      status: "CALIBRATING",
      baselineFingerprint: null,
      candidateFingerprint: null,
      stableHits: 0,
      lastDifference: 0,
      cooldownUntil:
        Date.now() + 700,
      error: "",
    };

    console.log(
      "MANGA CONTINUOUS ENABLED"
    );

    publishMangaSessionState();
    scheduleMangaContinuousPoll(
      700
    );

    return getMangaContinuousPublicState();
  }

  return stopMangaContinuousMode(
    "toggle-off",
    true
  );
}

function toggleMangaContinuousPause() {
  if (!mangaContinuousState.enabled) {
    throw new Error(
      "Continuous Manga chưa được bật."
    );
  }

  mangaContinuousState.paused =
    !mangaContinuousState.paused;

  if (mangaContinuousState.paused) {
    clearMangaContinuousTimer();
    mangaContinuousState.status =
      "PAUSED";
  } else {
    resetMangaContinuousDetection(
      "CALIBRATING"
    );
    mangaContinuousState.cooldownUntil =
      Date.now() + 700;
    scheduleMangaContinuousPoll(
      700
    );
  }

  publishMangaSessionState();

  return getMangaContinuousPublicState();
}

function normalizeMangaSessionSelection(
  selection
) {
  if (!selection) {
    return null;
  }

  const normalized = {
    x:
      Math.round(
        Number(selection.x) || 0
      ),
    y:
      Math.round(
        Number(selection.y) || 0
      ),
    width:
      Math.max(
        1,
        Math.round(
          Number(selection.width) || 1
        )
      ),
    height:
      Math.max(
        1,
        Math.round(
          Number(selection.height) || 1
        )
      ),
  };

  if (
    normalized.width < 12 ||
    normalized.height < 12
  ) {
    return null;
  }

  return normalized;
}

function getMangaPanelSessionContext() {
  if (!mangaPanelSession) {
    return [];
  }

  return (
    Array.isArray(
      mangaPanelSession.context
    )
      ? mangaPanelSession.context
      : []
  )
    .slice(-10)
    .map((item) => ({
      ...item,
    }));
}

function getMangaPanelSessionState() {
  if (!mangaPanelSession) {
    return {
      active: false,
      chapterNumber: 0,
      pageNumber: 0,
      nextPageNumber: 1,
      contextItems: 0,
      nextShortcut:
        shortcutDisplay(
          shortcutSettings.panelNext
        ),
      capabilities:
        getDesktopFeatureCapabilities(),
      continuous:
        getMangaContinuousPublicState(),
    };
  }

  return {
    active: true,
    id:
      mangaPanelSession.id,
    chapterNumber:
      Math.max(
        1,
        Number(
          mangaPanelSession.chapterNumber || 1
        )
      ),
    pageNumber:
      mangaPanelSession.pageNumber,
    nextPageNumber:
      mangaPanelSession.pageNumber + 1,
    contextItems:
      getMangaPanelSessionContext().length,
    sourceLanguage:
      mangaPanelSession.sourceLanguage,
    targetLanguage:
      mangaPanelSession.targetLanguage,
    profileId:
      mangaPanelSession.profileId,
    selection: {
      ...mangaPanelSession.selection,
    },
    startedAt:
      mangaPanelSession.startedAt,
    lastUsedAt:
      mangaPanelSession.lastUsedAt,
    nextShortcut:
      shortcutDisplay(
        shortcutSettings.panelNext
      ),
    capabilities:
      getDesktopFeatureCapabilities(),
    continuous:
      getMangaContinuousPublicState(),
  };
}

function beginMangaPanelSession({
  selection,
  profile,
  sourceLanguage,
  targetLanguage,
  targetWindow = null,
} = {}) {
  const normalizedSelection =
    normalizeMangaSessionSelection(
      selection
    );

  if (!normalizedSelection) {
    throw new Error(
      "Không thể tạo Manga Session từ vùng chọn hiện tại."
    );
  }

  const source =
    normalizeTranslationSourceLanguage(
      sourceLanguage
    );

  const target =
    normalizeTranslationTargetLanguage(
      targetLanguage
    );

  stopMangaContinuousMode(
    "new-session",
    false
  );

  mangaPanelSession = {
    id:
      crypto.randomUUID(),
    selection:
      normalizedSelection,
    profileId:
      Number(profile?.id) || null,
    sourceLanguage:
      source,
    targetLanguage:
      target,
    chapterNumber: 1,
    pageNumber: 0,
    context: [],
    targetWindow:
      targetWindow
        ? { ...targetWindow }
        : null,
    startedAt:
      Date.now(),
    lastUsedAt:
      Date.now(),
  };

  console.log(
    "MANGA SESSION STARTED:",
    getMangaPanelSessionState()
  );

  notifyMangaSessionInspectorRefresh();

  return getMangaPanelSessionState();
}

function endMangaPanelSession(
  reason = "manual"
) {
  const previous =
    mangaPanelSession;

  stopMangaContinuousMode(
    reason,
    false
  );

  mangaPanelSession = null;

  if (previous) {
    console.log(
      "MANGA SESSION ENDED:",
      {
        id:
          previous.id,
        pageNumber:
          previous.pageNumber,
        reason,
      }
    );
  }

  closeMangaSessionInspector();
  updateFullScreenOverlaySession(null);
  notifyMangaSessionInspectorRefresh();

  return {
    success: true,
    active: false,
  };
}

function getMangaPanelSessionDetails() {
  const state =
    getMangaPanelSessionState();

  if (!state.active) {
    return {
      ...state,
      maxContextItems: 10,
      context: [],
      profileName: "",
    };
  }

  const profileName =
    String(
      activeTranslationProfile?.name ||
      ""
    );

  return {
    ...state,
    maxContextItems: 10,
    profileName,
    context:
      getMangaPanelSessionContext()
        .map((item, index) => ({
          index: index + 1,
          pageNumber:
            Number(item?.pageNumber) ||
            null,
          original:
            normalizeTranslationText(
              item?.original
            ),
          translatedText:
            String(
              item?.translatedText ||
              item?.vietnamese ||
              ""
            ).trim(),
        })),
  };
}

function resetMangaPanelSessionChapter() {
  if (!mangaPanelSession) {
    throw new Error(
      "Chưa có Manga Session để bắt đầu chapter mới."
    );
  }

  mangaPanelSession = {
    ...mangaPanelSession,
    id:
      crypto.randomUUID(),
    chapterNumber:
      Math.max(
        1,
        Number(
          mangaPanelSession.chapterNumber || 1
        ) + 1
      ),
    pageNumber: 0,
    context: [],
    startedAt:
      Date.now(),
    lastUsedAt:
      Date.now(),
  };

  if (mangaContinuousState.enabled) {
    resetMangaContinuousDetection(
      mangaContinuousState.paused
        ? "PAUSED"
        : "CALIBRATING"
    );
    mangaContinuousState.cooldownUntil =
      Date.now() +
      MANGA_CONTINUOUS_COOLDOWN_MS;
    scheduleMangaContinuousPoll();
  }

  const state =
    getMangaPanelSessionState();

  updateFullScreenOverlaySession(
    state
  );
  notifyMangaSessionInspectorRefresh();

  console.log(
    "MANGA SESSION CHAPTER RESET:",
    state
  );

  return {
    success: true,
    session: state,
    details:
      getMangaPanelSessionDetails(),
  };
}

function ensureMangaPanelSessionCompatible(
  profile,
  sourceLanguage,
  targetLanguage
) {
  if (!mangaPanelSession) {
    throw new Error(
      `Chưa có Manga Session. Hãy dùng ${shortcutDisplay(shortcutSettings.panel)} để chọn vùng trang đầu tiên.`
    );
  }

  const profileId =
    Number(profile?.id) || null;

  const source =
    normalizeTranslationSourceLanguage(
      sourceLanguage
    );

  const target =
    normalizeTranslationTargetLanguage(
      targetLanguage
    );

  if (
    String(
      mangaPanelSession.profileId ?? ""
    ) !==
      String(profileId ?? "") ||
    mangaPanelSession.sourceLanguage !==
      source ||
    mangaPanelSession.targetLanguage !==
      target
  ) {
    throw new Error(
      `Profile hoặc cặp ngôn ngữ đã thay đổi. Hãy dùng ${shortcutDisplay(shortcutSettings.panel)} để bắt đầu Manga Session mới.`
    );
  }

  return mangaPanelSession;
}

function rememberMangaPanelSessionContext(
  result
) {
  if (!mangaPanelSession) {
    return;
  }

  const translatedText =
    result?.translatedText ||
    result?.vietnamese ||
    "";

  const original =
    normalizeTranslationText(
      result?.original
    );

  if (
    !original ||
    !translatedText
  ) {
    return;
  }

  const items =
    getMangaPanelSessionContext();

  const last =
    items[items.length - 1];

  if (
    last?.original === original &&
    (
      last?.translatedText ||
      last?.vietnamese
    ) === translatedText
  ) {
    return;
  }

  items.push({
    pageNumber:
      Math.max(
        1,
        Number(
          mangaPanelSession.pageNumber || 0
        ) + 1
      ),
    original,
    translatedText,
    vietnamese:
      translatedText,
  });

  while (items.length > 10) {
    items.shift();
  }

  mangaPanelSession.context =
    items;
  mangaPanelSession.lastUsedAt =
    Date.now();

  notifyMangaSessionInspectorRefresh();
}

function completeMangaPanelSessionPage(
  targetWindow = null
) {
  if (!mangaPanelSession) {
    return null;
  }

  mangaPanelSession.pageNumber += 1;
  mangaPanelSession.lastUsedAt =
    Date.now();

  if (targetWindow) {
    mangaPanelSession.targetWindow = {
      ...targetWindow,
    };
  }

  console.log(
    "MANGA SESSION PAGE COMPLETE:",
    {
      id:
        mangaPanelSession.id,
      pageNumber:
        mangaPanelSession.pageNumber,
      contextItems:
        getMangaPanelSessionContext().length,
    }
  );

  notifyMangaSessionInspectorRefresh();

  return getMangaPanelSessionState();
}

function getProfileContextKey(
  profile,
  sourceLanguage =
    currentTranslationSourceLanguage,
  targetLanguage =
    currentTranslationTargetLanguage
) {
  const profileIdentity =
    profile?.id
      ? String(profile.id)
      : "default";

  const source =
    normalizeTranslationSourceLanguage(
      sourceLanguage
    );

  const target =
    normalizeTranslationTargetLanguage(
      targetLanguage
    );

  return `${profileIdentity}:${source}->${target}`;
}

function getCurrentTranslationContext(
  profile,
  sourceLanguage =
    currentTranslationSourceLanguage,
  targetLanguage =
    currentTranslationTargetLanguage
) {
  const key =
    getProfileContextKey(
      profile,
      sourceLanguage,
      targetLanguage
    );

  return [
    ...(
      translationContextByProfile
        .get(key) ||
      []
    )
  ];
}

function rememberTranslationContext(
  profile,
  result,
  sourceLanguage =
    currentTranslationSourceLanguage,
  targetLanguage =
    currentTranslationTargetLanguage
) {
  const translatedText =
    result?.translatedText ||
    result?.vietnamese ||
    "";

  if (
    !result?.original ||
    !translatedText
  ) {
    return;
  }

  const key =
    getProfileContextKey(
      profile,
      sourceLanguage,
      targetLanguage
    );

  const items =
    getCurrentTranslationContext(
      profile,
      sourceLanguage,
      targetLanguage
    );

  const last =
    items[items.length - 1];

  if (
    last?.original ===
      result.original &&
    (
      last?.translatedText ||
      last?.vietnamese
    ) === translatedText
  ) {
    return;
  }

  items.push({
    original:
      result.original,
    translatedText,

    /*
     * Legacy alias cho backend/client cũ.
     */
    vietnamese:
      translatedText,
  });

  while (items.length > 10) {
    items.shift();
  }

  translationContextByProfile
    .set(key, items);
}


function normalizeWorkspaceMode(
  mode
) {
  return mode === "study"
    ? "study"
    : "translate";
}

function setWorkspaceMode(
  mode
) {
  currentWorkspaceMode =
    normalizeWorkspaceMode(
      mode
    );

  return {
    mode:
      currentWorkspaceMode,
  };
}

function normalizeStudyLevel(
  level
) {
  const value =
    String(
      level || "AUTO"
    )
      .trim()
      .toUpperCase();

  return [
    "AUTO",
    "N5",
    "N4",
    "N3",
    "N2",
    "N1",
  ].includes(value)
    ? value
    : "AUTO";
}

function setStudyLevel(
  level
) {
  currentStudyLevel =
    normalizeStudyLevel(
      level
    );

  if (
    typeof studyPreferences !==
    "undefined"
  ) {
    studyPreferences = {
      ...studyPreferences,
      level:
        currentStudyLevel,
    };

    if (app.isReady()) {
      void saveDesktopPreferences()
        .catch(
          (error) => {
            console.warn(
              "SAVE STUDY LEVEL PREFERENCE ERROR:",
              error
            );
          }
        );
    }
  }

  return {
    level:
      currentStudyLevel,
  };
}


function setStudyAutoSaveVocabulary(
  value
) {
  currentStudyAutoSaveVocabulary =
    Boolean(value);

  if (
    typeof studyPreferences !==
    "undefined"
  ) {
    studyPreferences = {
      ...studyPreferences,
      autoSaveVocabulary:
        currentStudyAutoSaveVocabulary,
    };

    if (app.isReady()) {
      void saveDesktopPreferences()
        .catch(
          (error) => {
            console.warn(
              "SAVE VOCAB AUTOSAVE PREFERENCE ERROR:",
              error
            );
          }
        );
    }
  }

  return {
    autoSaveVocabulary:
      currentStudyAutoSaveVocabulary,
  };
}


function setStudyAutoSaveGrammar(
  value
) {
  currentStudyAutoSaveGrammar =
    Boolean(value);

  if (
    typeof studyPreferences !==
    "undefined"
  ) {
    studyPreferences = {
      ...studyPreferences,
      autoSaveGrammar:
        currentStudyAutoSaveGrammar,
    };

    if (app.isReady()) {
      void saveDesktopPreferences()
        .catch(
          (error) => {
            console.warn(
              "SAVE GRAMMAR AUTOSAVE PREFERENCE ERROR:",
              error
            );
          }
        );
    }
  }

  return {
    autoSaveGrammar:
      currentStudyAutoSaveGrammar,
  };
}


function setWorkspaceScanGuard(
  reason
) {
  workspaceScanGuardReason =
    String(
      reason || ""
    ).trim();

  return {
    blocked:
      Boolean(
        workspaceScanGuardReason
      ),

    reason:
      workspaceScanGuardReason,
  };
}

function ensureWorkspaceScanAllowed() {
  if (
    workspaceScanGuardReason
  ) {
    throw new Error(
      workspaceScanGuardReason
    );
  }
}

function clearTranslationContext(
  profileId = null
) {
  if (profileId == null) {
    translationContextByProfile
      .clear();

    endMangaPanelSession(
      "translation-context-cleared"
    );

    return;
  }

  const prefix =
    `${String(profileId)}:`;

  for (
    const key of
    translationContextByProfile.keys()
  ) {
    if (key.startsWith(prefix)) {
      translationContextByProfile
        .delete(key);
    }
  }

  if (
    mangaPanelSession &&
    String(
      mangaPanelSession.profileId ?? ""
    ) === String(profileId)
  ) {
    endMangaPanelSession(
      "profile-context-cleared"
    );
  }
}

const BACKEND_TIMEOUT_MS =
  30000;

const TRANSLATE_TIMEOUT_MS =
  15000;

const BATCH_TRANSLATE_TIMEOUT_MS =
  30000;

const STUDY_TIMEOUT_MS =
  30000;

function isSafeRetryMethod(
  method
) {
  return [
    "GET",
    "HEAD",
  ].includes(
    String(
      method || "GET"
    ).toUpperCase()
  );
}

function backendRetryDelayMs(
  attempt
) {
  return 180 * attempt;
}

async function waitMs(
  delayMs
) {
  await new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        delayMs
      );
    }
  );
}

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = BACKEND_TIMEOUT_MS
) {
  const method =
    String(
      options?.method ||
      "GET"
    ).toUpperCase();

  const safeRetry =
    isSafeRetryMethod(
      method
    );

  const maxAttempts =
    safeRetry
      ? 2
      : 1;

  const suppliedHeaders = {
    ...(options.headers || {}),
  };

  const suppliedRequestId =
    suppliedHeaders[
      "X-Request-Id"
    ] ||
    suppliedHeaders[
      "x-request-id"
    ];

  const requestId =
    String(
      suppliedRequestId ||
      crypto.randomUUID()
    );

  delete suppliedHeaders[
    "x-request-id"
  ];

  const headers = {
    ...suppliedHeaders,
    "X-Request-Id":
      requestId,
  };

  let lastError = null;

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt += 1
  ) {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => controller.abort(),
        timeoutMs
      );

    try {
      const response =
        await fetch(
          url,
          {
            ...options,
            headers,
            signal:
              controller.signal,
          }
        );

      const retryableStatus =
        [
          502,
          503,
          504,
        ].includes(
          response.status
        );

      if (
        safeRetry &&
        retryableStatus &&
        attempt < maxAttempts
      ) {
        clearTimeout(
          timeout
        );

        await waitMs(
          backendRetryDelayMs(
            attempt
          )
        );

        continue;
      }

      return response;
    } catch (error) {
      lastError =
        error;

      if (
        error?.name ===
        "AbortError"
      ) {
        const timeoutError =
          new Error(
            "Java backend phản hồi quá thời gian."
          );

        timeoutError.requestId =
          requestId;

        throw timeoutError;
      }

      if (
        safeRetry &&
        attempt < maxAttempts
      ) {
        clearTimeout(
          timeout
        );

        await waitMs(
          backendRetryDelayMs(
            attempt
          )
        );

        continue;
      }

      if (
        error &&
        typeof error === "object"
      ) {
        error.requestId =
          requestId;
      }

      throw error;
    } finally {
      clearTimeout(
        timeout
      );
    }
  }

  throw lastError ||
    new Error(
      "Không kết nối được Java backend."
    );
}


async function removeLegacyDesktopApiKey() {
  const settingsPath =
    path.join(
      app.getPath("userData"),
      "config",
      "settings.json"
    );

  try {
    const content =
      await fs.readFile(
        settingsPath,
        "utf8"
      );

    const settings =
      JSON.parse(content);

    if (
      !settings ||
      !settings.encryptedApiKey
    ) {
      return;
    }

    delete settings.encryptedApiKey;

    if (
      Object.keys(settings)
        .length === 0
    ) {
      await fs.unlink(
        settingsPath
      );
    } else {
      await fs.writeFile(
        settingsPath,
        JSON.stringify(
          settings,
          null,
          2
        ),
        "utf8"
      );
    }

    console.log(
      "LEGACY DESKTOP OPENAI KEY REMOVED"
    );
  } catch (error) {
    if (
      error?.code !== "ENOENT"
    ) {
      console.error(
        "LEGACY API KEY CLEANUP ERROR:",
        error
      );
    }
  }
}

async function getBackendStatus() {
  try {
    const response =
      await fetchWithTimeout(
        BACKEND_HEALTH_URL,
        {
          method: "GET",
          headers: {
            Accept:
              "application/json",
          },
        },
        5000
      );

    let data = null;

    try {
      data =
        await response.json();
    } catch {
      data = null;
    }

    const connected =
      response.ok &&
      (
        !data?.status ||
        data.status === "UP"
      );

    return {
      connected,
      status:
        data?.status ||
        (
          response.ok
            ? "UP"
            : `HTTP ${response.status}`
        ),
      baseUrl:
        BACKEND_BASE_URL,
    };
  } catch (error) {
    return {
      connected: false,
      status: "DOWN",
      baseUrl:
        BACKEND_BASE_URL,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }
}


// ======================================================
// DESKTOP AUTH SESSION
// ======================================================

let accessToken = "";
let currentUser = null;
let refreshPromise = null;
let desktopDeviceId = "";

function getAuthSettingsPath() {
  return path.join(
    app.getPath("userData"),
    "config",
    "auth.json"
  );
}

async function readAuthSettings() {
  try {
    const content =
      await fs.readFile(
        getAuthSettingsPath(),
        "utf8"
      );

    const parsed =
      JSON.parse(content);

    return parsed &&
      typeof parsed === "object"
      ? parsed
      : {};
  } catch (error) {
    if (
      error?.code ===
      "ENOENT"
    ) {
      return {};
    }

    console.error(
      "READ AUTH SETTINGS ERROR:",
      error
    );

    return {};
  }
}

async function writeAuthSettings(settings) {
  const filePath =
    getAuthSettingsPath();

  await fs.mkdir(
    path.dirname(filePath),
    {
      recursive: true,
    }
  );

  await fs.writeFile(
    filePath,
    JSON.stringify(
      settings,
      null,
      2
    ),
    "utf8"
  );
}

async function ensureDeviceId() {
  if (desktopDeviceId) {
    return desktopDeviceId;
  }

  const settings =
    await readAuthSettings();

  const saved =
    String(
      settings.deviceId ||
      ""
    ).trim();

  if (saved) {
    desktopDeviceId =
      saved;

    return desktopDeviceId;
  }

  desktopDeviceId =
    crypto.randomUUID();

  await writeAuthSettings({
    ...settings,
    deviceId:
      desktopDeviceId,
  });

  return desktopDeviceId;
}

function getDeviceName() {
  const hostname =
    String(
      os.hostname() ||
      ""
    ).trim();

  return hostname ||
    "AI Translator Desktop";
}

async function saveRefreshToken(
  refreshToken
) {
  const clean =
    String(
      refreshToken ||
      ""
    ).trim();

  if (!clean) {
    throw new Error(
      "Refresh token trống."
    );
  }

  if (
    !safeStorage
      .isEncryptionAvailable()
  ) {
    throw new Error(
      "Windows secure storage chưa sẵn sàng."
    );
  }

  const settings =
    await readAuthSettings();

  const encrypted =
    safeStorage
      .encryptString(clean)
      .toString("base64");

  await writeAuthSettings({
    ...settings,
    deviceId:
      await ensureDeviceId(),
    encryptedRefreshToken:
      encrypted,
  });
}

async function loadRefreshToken() {
  const settings =
    await readAuthSettings();

  const encrypted =
    String(
      settings
        .encryptedRefreshToken ||
      ""
    ).trim();

  if (!encrypted) {
    return "";
  }

  try {
    if (
      !safeStorage
        .isEncryptionAvailable()
    ) {
      return "";
    }

    return safeStorage
      .decryptString(
        Buffer.from(
          encrypted,
          "base64"
        )
      );
  } catch (error) {
    console.error(
      "DECRYPT REFRESH TOKEN ERROR:",
      error
    );

    return "";
  }
}

async function clearStoredRefreshToken() {
  const settings =
    await readAuthSettings();

  delete settings
    .encryptedRefreshToken;

  settings.deviceId =
    await ensureDeviceId();

  await writeAuthSettings(
    settings
  );
}

async function hasStoredRefreshToken() {
  const settings =
    await readAuthSettings();

  return Boolean(
    settings
      .encryptedRefreshToken
  );
}

function clearAccessSession() {
  accessToken = "";
  currentUser = null;
  resetAccountEntitlements();
}

function sendAuthChanged() {
  sendToMainWindow(
    "auth-changed",
    {
      authenticated:
        Boolean(
          accessToken &&
          currentUser
        ),
      user:
        currentUser,
    }
  );
}

async function parseBackendJson(
  response
) {
  let payload = null;

  try {
    payload =
      await response.json();
  } catch {
    payload = null;
  }

  const requestId =
    response?.headers?.get?.(
      "x-request-id"
    ) ||
    payload?.requestId ||
    "";

  if (
    payload &&
    typeof payload === "object" &&
    requestId
  ) {
    if (!payload.requestId) {
      payload.requestId =
        requestId;
    }

    if (
      !response.ok &&
      payload.error &&
      !String(
        payload.error
      ).includes(
        "Mã lỗi:"
      )
    ) {
      payload.error =
        `${payload.error}\nMã lỗi: ${requestId}`;
    }
  }

  return payload;
}

async function callPublicAuthApi(
  url,
  body
) {
  let response;

  try {
    response =
      await fetchWithTimeout(
        url,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json; charset=utf-8",

            Accept:
              "application/json",
          },

          body:
            JSON.stringify(body),
        }
      );
  } catch (error) {
    throw new Error(
      "Không kết nối được Java backend. " +
      (
        error instanceof Error
          ? error.message
          : String(error)
      )
    );
  }

  const payload =
    await parseBackendJson(
      response
    );

  if (!response.ok) {
    const error =
      new Error(
        payload?.error ||
        `Backend lỗi HTTP ${response.status}.`
      );

    error.statusCode =
      response.status;

    throw error;
  }

  return payload;
}

async function applyAuthPayload(
  payload
) {
  if (
    !payload?.success ||
    !payload?.accessToken ||
    !payload?.refreshToken ||
    !payload?.user
  ) {
    throw new Error(
      "Backend không trả về phiên đăng nhập hợp lệ."
    );
  }

  accessToken =
    String(
      payload.accessToken
    );

  currentUser =
    payload.user;

  await saveRefreshToken(
    payload.refreshToken
  );

  sendAuthChanged();

  await refreshAccountEntitlements({
    silent: true,
    retryAfterRefresh: false,
  });
}

async function loginDesktop(
  email,
  password
) {
  const deviceId =
    await ensureDeviceId();

  const payload =
    await callPublicAuthApi(
      BACKEND_LOGIN_URL,
      {
        email:
          String(email || "")
            .trim(),

        password:
          String(password || ""),

        deviceId,

        deviceName:
          getDeviceName(),
      }
    );

  await applyAuthPayload(
    payload
  );

  return getDesktopAuthStatus();
}

async function registerDesktop(
  email,
  password
) {
  const deviceId =
    await ensureDeviceId();

  const payload =
    await callPublicAuthApi(
      BACKEND_REGISTER_URL,
      {
        email:
          String(email || "")
            .trim(),

        password:
          String(password || ""),

        deviceId,

        deviceName:
          getDeviceName(),
      }
    );

  await applyAuthPayload(
    payload
  );

  return getDesktopAuthStatus();
}


async function getSocialProvidersDesktop() {
  let response;

  try {
    response =
      await fetchWithTimeout(
        `${BACKEND_SOCIAL_AUTH_URL}/providers`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }
      );
  } catch (error) {
    throw new Error(
      "Không tải được cấu hình Social Login. " +
      (
        error instanceof Error
          ? error.message
          : String(error)
      )
    );
  }

  const payload =
    await parseBackendJson(response);

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Backend lỗi HTTP ${response.status}.`
    );
  }

  return Array.isArray(payload)
    ? payload
    : [];
}

function normalizeSocialProvider(provider) {
  const value =
    String(provider || "")
      .trim()
      .toLowerCase();

  if (
    value !== "google" &&
    value !== "facebook"
  ) {
    throw new Error(
      "Nhà cung cấp đăng nhập không được hỗ trợ."
    );
  }

  return value;
}

function validateSocialAuthorizationUrl(
  providerCode,
  rawUrl
) {
  const parsed = new URL(
    String(rawUrl || "")
  );

  const allowedHost =
    providerCode === "google"
      ? parsed.hostname ===
        "accounts.google.com"
      : parsed.hostname ===
          "www.facebook.com" ||
        parsed.hostname ===
          "facebook.com";

  if (
    parsed.protocol !== "https:" ||
    !allowedHost
  ) {
    throw new Error(
      "Backend trả về OAuth URL không hợp lệ."
    );
  }

  return parsed.toString();
}

function waitMs(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

let socialBrowserFlowPromise = null;

async function startSocialBrowserFlow(
  provider,
  mode = "LOGIN"
) {
  if (socialBrowserFlowPromise) {
    throw new Error(
      "Một cửa sổ đăng nhập Social đang chờ hoàn tất."
    );
  }

  const providerCode =
    normalizeSocialProvider(provider);

  socialBrowserFlowPromise =
    (async () => {
      const isLink =
        String(mode).toUpperCase() ===
        "LINK";

      let startPayload;

      if (isLink) {
        const response =
          await authorizedBackendFetch(
            `${BACKEND_IDENTITIES_URL}/${providerCode}/link/start`,
            {
              method: "POST",
              headers: {
                Accept: "application/json",
              },
            }
          );

        startPayload =
          await parseBackendJson(response);

        if (!response.ok) {
          throw new Error(
            startPayload?.error ||
            `Backend lỗi HTTP ${response.status}.`
          );
        }
      } else {
        startPayload =
          await callPublicAuthApi(
            `${BACKEND_SOCIAL_AUTH_URL}/${providerCode}/start`,
            {
              deviceId:
                await ensureDeviceId(),
              deviceName:
                getDeviceName(),
            }
          );
      }

      if (
        !startPayload?.success ||
        !startPayload?.attemptId ||
        !startPayload?.pollSecret ||
        !startPayload?.authorizationUrl
      ) {
        throw new Error(
          "Backend không tạo được phiên Social Login."
        );
      }

      const authorizationUrl =
        validateSocialAuthorizationUrl(
          providerCode,
          startPayload.authorizationUrl
        );

      await shell.openExternal(
        authorizationUrl
      );

      const expiresAt =
        new Date(
          startPayload.expiresAt ||
          Date.now() + 5 * 60 * 1000
        ).getTime();

      const pollDelay =
        Math.max(
          800,
          Math.min(
            2500,
            Number(
              startPayload.pollAfterMs ||
              1200
            )
          )
        );

      while (
        Date.now() <
        expiresAt + 3000
      ) {
        await waitMs(pollDelay);

        let poll;

        try {
          poll =
            await callPublicAuthApi(
              `${BACKEND_SOCIAL_AUTH_URL}/attempts/${encodeURIComponent(startPayload.attemptId)}/poll`,
              {
                pollSecret:
                  startPayload.pollSecret,
              }
            );
        } catch (error) {
          if (
            !error?.statusCode &&
            Date.now() < expiresAt
          ) {
            continue;
          }

          throw error;
        }

        if (
          poll?.status ===
          "PENDING"
        ) {
          continue;
        }

        if (
          isLink &&
          poll?.status ===
          "LINKED"
        ) {
          return {
            success: true,
            status: "LINKED",
            provider:
              poll.provider,
            identity:
              poll.identity || null,
          };
        }

        if (
          !isLink &&
          poll?.status ===
          "SUCCESS" &&
          poll?.auth
        ) {
          await applyAuthPayload(
            poll.auth
          );

          return {
            success: true,
            status: "SUCCESS",
            provider:
              poll.provider,
            auth:
              await getDesktopAuthStatus(),
          };
        }

        throw new Error(
          poll?.message ||
          "Social Login không hoàn tất."
        );
      }

      throw new Error(
        "Phiên Social Login đã hết hạn. Vui lòng thử lại."
      );
    })();

  try {
    return await socialBrowserFlowPromise;
  } finally {
    socialBrowserFlowPromise = null;
  }
}

async function socialLoginDesktop(provider) {
  const result =
    await startSocialBrowserFlow(
      provider,
      "LOGIN"
    );

  return result.auth ||
    getDesktopAuthStatus();
}

async function getAccountIdentitiesDesktop() {
  const response =
    await authorizedBackendFetch(
      BACKEND_IDENTITIES_URL,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );

  const payload =
    await parseBackendJson(response);

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Backend lỗi HTTP ${response.status}.`
    );
  }

  return Array.isArray(payload)
    ? payload
    : [];
}

async function linkSocialIdentityDesktop(
  provider
) {
  const result =
    await startSocialBrowserFlow(
      provider,
      "LINK"
    );

  return {
    ...result,
    identities:
      await getAccountIdentitiesDesktop(),
  };
}

async function refreshDesktopSession() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise =
    (async () => {
      const refreshToken =
        await loadRefreshToken();

      if (!refreshToken) {
        clearAccessSession();

        return false;
      }

      try {
        const payload =
          await callPublicAuthApi(
            BACKEND_REFRESH_URL,
            {
              refreshToken,
            }
          );

        await applyAuthPayload(
          payload
        );

        return true;
      } catch (error) {
        /*
         * Chỉ xóa refresh token khi backend
         * xác nhận token/session không còn hợp lệ.
         *
         * Nếu backend offline, giữ token để
         * có thể thử khôi phục phiên sau.
         */
        if (
          error?.statusCode === 400 ||
          error?.statusCode === 401 ||
          error?.statusCode === 403
        ) {
          await clearStoredRefreshToken();
        }

        clearAccessSession();
        sendAuthChanged();

        console.error(
          "REFRESH SESSION ERROR:",
          error
        );

        return false;
      } finally {
        refreshPromise = null;
      }
    })();

  return refreshPromise;
}

async function restoreDesktopSession() {
  await ensureDeviceId();

  if (
    !(await hasStoredRefreshToken())
  ) {
    return false;
  }

  return refreshDesktopSession();
}

async function logoutDesktop() {
  const refreshToken =
    await loadRefreshToken();

  try {
    if (refreshToken) {
      await callPublicAuthApi(
        BACKEND_LOGOUT_URL,
        {
          refreshToken,
        }
      );
    }
  } catch (error) {
    /*
     * Logout local vẫn phải thành công
     * nếu backend đang offline.
     */
    console.error(
      "BACKEND LOGOUT ERROR:",
      error
    );
  }

  clearAccessSession();

  await clearStoredRefreshToken();

  translationCache.clear();

  activeTranslationProfile =
    null;

  clearTranslationContext();

  await saveTranslationCache();

  sendAuthChanged();

  return {
    success: true,
  };
}

async function getDesktopAuthStatus() {
  return {
    authenticated:
      Boolean(
        accessToken &&
        currentUser
      ),

    user:
      currentUser,

    sessionStored:
      await hasStoredRefreshToken(),

    deviceId:
      await ensureDeviceId(),

    deviceName:
      getDeviceName(),
  };
}

async function ensureAuthenticated() {
  if (
    accessToken &&
    currentUser
  ) {
    return true;
  }

  const restored =
    await refreshDesktopSession();

  if (!restored) {
    throw new Error(
      "Bạn cần đăng nhập AI Translator."
    );
  }

  return true;
}

async function authorizedBackendFetch(
  url,
  options = {},
  retryAfterRefresh = true
) {
  await ensureAuthenticated();

  const {
    timeoutMs =
      BACKEND_TIMEOUT_MS,

    ...fetchOptions
  } = options;

  const headers = {
    ...(fetchOptions.headers || {}),
    Authorization:
      `Bearer ${accessToken}`,
  };

  const response =
    await fetchWithTimeout(
      url,
      {
        ...fetchOptions,
        headers,
      },
      timeoutMs
    );

  if (
    response.status === 401 &&
    retryAfterRefresh
  ) {
    accessToken = "";

    const refreshed =
      await refreshDesktopSession();

    if (!refreshed) {
      throw new Error(
        "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại."
      );
    }

    return authorizedBackendFetch(
      url,
      options,
      false
    );
  }

  return response;
}


async function refreshAccountEntitlements({
  silent = false,
  retryAfterRefresh = true,
} = {}) {
  if (
    !accessToken ||
    !currentUser
  ) {
    return resetAccountEntitlements();
  }

  try {
    const response =
      await authorizedBackendFetch(
        BACKEND_ENTITLEMENTS_URL,
        {
          method: "GET",
          headers: {
            Accept:
              "application/json",
          },
        },
        retryAfterRefresh
      );

    const payload =
      await parseBackendJson(
        response
      );

    if (!response.ok) {
      throw new Error(
        payload?.error ||
        `Không tải được entitlement (HTTP ${response.status}).`
      );
    }

    accountEntitlements =
      normalizeAccountEntitlements(
        payload
      );

    if (
      mangaPanelSession &&
      !hasDesktopFeatureCapability(
        "mangaSession"
      )
    ) {
      endMangaPanelSession(
        "entitlement-revoked"
      );
    }

    if (
      mangaContinuousState.enabled &&
      !hasDesktopFeatureCapability(
        "continuousManga"
      )
    ) {
      stopMangaContinuousMode(
        "entitlement-revoked",
        false
      );
    } else {
      publishMangaSessionState();
    }

    const snapshot =
      getAccountEntitlementsSnapshot();

    sendToMainWindow(
      "account-entitlements-changed",
      snapshot
    );

    return snapshot;
  } catch (error) {
    const fallback =
      resetAccountEntitlements();

    console.error(
      "ACCOUNT ENTITLEMENTS ERROR:",
      error
    );

    if (silent) {
      return fallback;
    }

    throw error;
  }
}

async function activateDesktopLicense(
  licenseKey
) {
  const cleanKey =
    String(
      licenseKey ||
      ""
    ).trim();

  if (!cleanKey) {
    throw new Error(
      "Nhập license key trước khi kích hoạt."
    );
  }

  const response =
    await authorizedBackendFetch(
      BACKEND_LICENSE_ACTIVATE_URL,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json; charset=utf-8",
          Accept:
            "application/json",
        },
        body:
          JSON.stringify({
            licenseKey:
              cleanKey,
            deviceId:
              await ensureDeviceId(),
          }),
      }
    );

  const payload =
    await parseBackendJson(
      response
    );

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Kích hoạt license thất bại (HTTP ${response.status}).`
    );
  }

  accountEntitlements =
    normalizeAccountEntitlements(
      payload
    );

  const snapshot =
    getAccountEntitlementsSnapshot();

  sendToMainWindow(
    "account-entitlements-changed",
    snapshot
  );

  publishMangaSessionState();

  return snapshot;
}



async function listVocabulary(
  filters = {}
) {
  const params =
    new URLSearchParams();

  const query =
    String(
      filters?.q ||
      ""
    ).trim();

  if (query) {
    params.set(
      "q",
      query
    );
  }

  const status =
    String(
      filters?.status ||
      ""
    ).trim();

  if (
    status &&
    status !== "ALL"
  ) {
    params.set(
      "status",
      status
    );
  }

  if (
    filters?.favorite ===
    true
  ) {
    params.set(
      "favorite",
      "true"
    );
  }

  params.set(
    "page",
    String(
      Number.isInteger(
        Number(filters?.page)
      )
        ? Number(filters.page)
        : 0
    )
  );

  params.set(
    "size",
    String(
      Number.isInteger(
        Number(filters?.size)
      )
        ? Number(filters.size)
        : 100
    )
  );

  const response =
    await authorizedBackendFetch(
      `${BACKEND_VOCABULARY_URL}?${params.toString()}`,
      {
        method: "GET",

        headers: {
          Accept:
            "application/json",
        },
      }
    );

  const payload =
    await parseBackendJson(
      response
    );

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Không tải được từ vựng (${response.status}).`
    );
  }

  return payload;
}

async function getVocabularyStats() {
  const response =
    await authorizedBackendFetch(
      BACKEND_VOCABULARY_STATS_URL,
      {
        method: "GET",

        headers: {
          Accept:
            "application/json",
        },
      }
    );

  const payload =
    await parseBackendJson(
      response
    );

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Không tải được thống kê từ vựng (${response.status}).`
    );
  }

  return payload;
}

async function saveVocabulary(
  item
) {
  const response =
    await authorizedBackendFetch(
      BACKEND_VOCABULARY_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json; charset=utf-8",

          Accept:
            "application/json",
        },

        body:
          JSON.stringify(
            item || {}
          ),
      }
    );

  const payload =
    await parseBackendJson(
      response
    );

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Không lưu được từ vựng (${response.status}).`
    );
  }

  return payload;
}

async function updateVocabulary(
  vocabularyId,
  patch
) {
  const cleanId =
    Number(
      vocabularyId
    );

  if (
    !Number.isInteger(cleanId) ||
    cleanId <= 0
  ) {
    throw new Error(
      "Vocabulary ID không hợp lệ."
    );
  }

  const response =
    await authorizedBackendFetch(
      `${BACKEND_VOCABULARY_URL}/${cleanId}`,
      {
        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json; charset=utf-8",

          Accept:
            "application/json",
        },

        body:
          JSON.stringify(
            patch || {}
          ),
      }
    );

  const payload =
    await parseBackendJson(
      response
    );

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Không cập nhật được từ vựng (${response.status}).`
    );
  }

  return payload;
}

async function deleteVocabulary(
  vocabularyId
) {
  const cleanId =
    Number(
      vocabularyId
    );

  if (
    !Number.isInteger(cleanId) ||
    cleanId <= 0
  ) {
    throw new Error(
      "Vocabulary ID không hợp lệ."
    );
  }

  const response =
    await authorizedBackendFetch(
      `${BACKEND_VOCABULARY_URL}/${cleanId}`,
      {
        method: "DELETE",

        headers: {
          Accept:
            "application/json",
        },
      }
    );

  if (!response.ok) {
    const payload =
      await parseBackendJson(
        response
      );

    throw new Error(
      payload?.error ||
      "Không xóa được từ vựng."
    );
  }

  return {
    success: true,
  };
}


async function listGrammar(
  filters = {}
) {
  const params =
    new URLSearchParams();

  const query =
    String(
      filters?.q ||
      ""
    ).trim();

  if (query) {
    params.set(
      "q",
      query
    );
  }

  const status =
    String(
      filters?.status ||
      ""
    ).trim();

  if (
    status &&
    status !== "ALL"
  ) {
    params.set(
      "status",
      status
    );
  }

  if (
    filters?.favorite ===
    true
  ) {
    params.set(
      "favorite",
      "true"
    );
  }

  params.set(
    "page",
    String(
      Number.isInteger(
        Number(filters?.page)
      )
        ? Number(filters.page)
        : 0
    )
  );

  params.set(
    "size",
    String(
      Number.isInteger(
        Number(filters?.size)
      )
        ? Number(filters.size)
        : 100
    )
  );

  const response =
    await authorizedBackendFetch(
      `${BACKEND_GRAMMAR_URL}?${params.toString()}`,
      {
        method: "GET",

        headers: {
          Accept:
            "application/json",
        },
      }
    );

  const payload =
    await parseBackendJson(
      response
    );

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Không tải được ngữ pháp (${response.status}).`
    );
  }

  return payload;
}

async function getGrammarStats() {
  const response =
    await authorizedBackendFetch(
      BACKEND_GRAMMAR_STATS_URL,
      {
        method: "GET",

        headers: {
          Accept:
            "application/json",
        },
      }
    );

  const payload =
    await parseBackendJson(
      response
    );

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Không tải được thống kê ngữ pháp (${response.status}).`
    );
  }

  return payload;
}

async function saveGrammar(
  item
) {
  const response =
    await authorizedBackendFetch(
      BACKEND_GRAMMAR_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json; charset=utf-8",

          Accept:
            "application/json",
        },

        body:
          JSON.stringify(
            item || {}
          ),
      }
    );

  const payload =
    await parseBackendJson(
      response
    );

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Không lưu được ngữ pháp (${response.status}).`
    );
  }

  return payload;
}

async function updateGrammar(
  grammarId,
  patch
) {
  const cleanId =
    Number(
      grammarId
    );

  if (
    !Number.isInteger(cleanId) ||
    cleanId <= 0
  ) {
    throw new Error(
      "Grammar ID không hợp lệ."
    );
  }

  const response =
    await authorizedBackendFetch(
      `${BACKEND_GRAMMAR_URL}/${cleanId}`,
      {
        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json; charset=utf-8",

          Accept:
            "application/json",
        },

        body:
          JSON.stringify(
            patch || {}
          ),
      }
    );

  const payload =
    await parseBackendJson(
      response
    );

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Không cập nhật được ngữ pháp (${response.status}).`
    );
  }

  return payload;
}

async function deleteGrammar(
  grammarId
) {
  const cleanId =
    Number(
      grammarId
    );

  if (
    !Number.isInteger(cleanId) ||
    cleanId <= 0
  ) {
    throw new Error(
      "Grammar ID không hợp lệ."
    );
  }

  const response =
    await authorizedBackendFetch(
      `${BACKEND_GRAMMAR_URL}/${cleanId}`,
      {
        method: "DELETE",

        headers: {
          Accept:
            "application/json",
        },
      }
    );

  if (!response.ok) {
    const payload =
      await parseBackendJson(
        response
      );

    throw new Error(
      payload?.error ||
      "Không xóa được ngữ pháp."
    );
  }

  return {
    success: true,
  };
}


async function getReviewQueue(
  limit = 30
) {
  const safeLimit =
    Math.max(
      1,
      Math.min(
        100,
        Number(limit) || 30
      )
    );

  const response =
    await authorizedBackendFetch(
      `${BACKEND_REVIEW_DUE_URL}?limit=${safeLimit}`,
      {
        method: "GET",

        headers: {
          Accept:
            "application/json",
        },
      }
    );

  const payload =
    await parseBackendJson(
      response
    );

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Không tải được hàng đợi ôn tập (${response.status}).`
    );
  }

  return payload;
}

async function getPracticeReviewQueue(
  limit = 30
) {
  const safeLimit =
    Math.max(
      1,
      Math.min(
        100,
        Number(limit) || 30
      )
    );

  const response =
    await authorizedBackendFetch(
      `${BACKEND_REVIEW_PRACTICE_URL}?limit=${safeLimit}`,
      {
        method: "GET",

        headers: {
          Accept:
            "application/json",
        },
      }
    );

  const payload =
    await parseBackendJson(
      response
    );

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Không tải được bộ ôn tự do (${response.status}).`
    );
  }

  return payload;
}

async function getReviewStats() {
  const response =
    await authorizedBackendFetch(
      BACKEND_REVIEW_STATS_URL,
      {
        method: "GET",

        headers: {
          Accept:
            "application/json",
        },
      }
    );

  const payload =
    await parseBackendJson(
      response
    );

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Không tải được thống kê ôn tập (${response.status}).`
    );
  }

  return payload;
}

async function answerReviewItem(
  answer
) {
  const response =
    await authorizedBackendFetch(
      BACKEND_REVIEW_ANSWER_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json; charset=utf-8",

          Accept:
            "application/json",
        },

        body:
          JSON.stringify(
            answer || {}
          ),
      }
    );

  const payload =
    await parseBackendJson(
      response
    );

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Không chấm được đáp án ôn tập (${response.status}).`
    );
  }

  return payload;
}

async function getLearningDashboard() {
  const response =
    await authorizedBackendFetch(
      BACKEND_LEARNING_DASHBOARD_URL,
      {
        method: "GET",

        headers: {
          Accept:
            "application/json",
        },
      }
    );

  const payload =
    await parseBackendJson(
      response
    );

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Không tải được Learning Dashboard (${response.status}).`
    );
  }

  return payload;
}

async function listTranslationProfiles() {
  const response =
    await authorizedBackendFetch(
      BACKEND_PROFILES_URL,
      {
        method: "GET",

        headers: {
          Accept:
            "application/json",
        },
      }
    );

  const payload =
    await parseBackendJson(
      response
    );

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Không tải được Profiles (${response.status}).`
    );
  }

  return Array.isArray(payload)
    ? payload
    : [];
}

async function createTranslationProfile(
  profile
) {
  const response =
    await authorizedBackendFetch(
      BACKEND_PROFILES_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json; charset=utf-8",

          Accept:
            "application/json",
        },

        body:
          JSON.stringify(
            profile || {}
          ),
      }
    );

  const payload =
    await parseBackendJson(
      response
    );

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Không tạo được Profile (${response.status}).`
    );
  }

  return payload;
}

async function updateTranslationProfile(
  profileId,
  profile
) {
  const cleanId =
    Number(profileId);

  const response =
    await authorizedBackendFetch(
      `${BACKEND_PROFILES_URL}/${cleanId}`,
      {
        method: "PUT",

        headers: {
          "Content-Type":
            "application/json; charset=utf-8",

          Accept:
            "application/json",
        },

        body:
          JSON.stringify(
            profile || {}
          ),
      }
    );

  const payload =
    await parseBackendJson(
      response
    );

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Không cập nhật được Profile (${response.status}).`
    );
  }

  clearTranslationContext(
    cleanId
  );

  return payload;
}

async function deleteTranslationProfile(
  profileId
) {
  const cleanId =
    Number(profileId);

  const response =
    await authorizedBackendFetch(
      `${BACKEND_PROFILES_URL}/${cleanId}`,
      {
        method: "DELETE",

        headers: {
          Accept:
            "application/json",
        },
      }
    );

  if (!response.ok) {
    const payload =
      await parseBackendJson(
        response
      );

    throw new Error(
      payload?.error ||
      "Không thể xóa Profile."
    );
  }

  clearTranslationContext(
    cleanId
  );

  if (
    activeTranslationProfile?.id ===
    cleanId
  ) {
    activeTranslationProfile =
      null;
  }

  return {
    success: true,
  };
}

async function setDefaultTranslationProfile(
  profileId
) {
  const cleanId =
    Number(profileId);

  const response =
    await authorizedBackendFetch(
      `${BACKEND_PROFILES_URL}/${cleanId}/default`,
      {
        method: "PUT",

        headers: {
          Accept:
            "application/json",
        },
      }
    );

  const payload =
    await parseBackendJson(
      response
    );

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      "Không thể đặt Profile mặc định."
    );
  }

  return payload;
}

function setActiveTranslationProfile(
  profile
) {
  if (!profile) {
    activeTranslationProfile =
      null;

    return {
      success: true,
      profile: null,
    };
  }

  activeTranslationProfile = {
    id:
      Number(profile.id),

    name:
      String(
        profile.name || ""
      ),

    updatedAt:
      String(
        profile.updatedAt ||
        ""
      ),

    contextLines:
      Number(
        profile.contextLines ||
        0
      ),
  };

  return {
    success: true,
    profile:
      activeTranslationProfile,
  };
}


async function ensureActiveTranslationProfile() {
  if (
    activeTranslationProfile &&
    Number.isFinite(
      Number(activeTranslationProfile.id)
    ) &&
    Number(activeTranslationProfile.id) > 0
  ) {
    return activeTranslationProfile;
  }

  /*
   * Global shortcuts run in the Electron main process and can fire before
   * the React renderer has synchronized its selected Profile over IPC.
   * Recover from that race by resolving the user's default Profile here.
   */
  const profiles =
    await listTranslationProfiles();

  if (!profiles.length) {
    throw new Error(
      "Chưa có Translation Profile. Hãy tạo một Profile trước khi dịch."
    );
  }

  const selected =
    profiles.find(
      (profile) =>
        Boolean(profile?.defaultProfile)
    ) ||
    profiles[0];

  setActiveTranslationProfile(
    selected
  );

  console.log(
    "ACTIVE TRANSLATION PROFILE RESTORED:",
    {
      id:
        activeTranslationProfile?.id,
      name:
        activeTranslationProfile?.name,
      defaultProfile:
        Boolean(selected?.defaultProfile),
    }
  );

  return activeTranslationProfile;
}


async function getDeviceSessions() {
  const response =
    await authorizedBackendFetch(
      BACKEND_DEVICES_URL,
      {
        method: "GET",

        headers: {
          Accept:
            "application/json",
        },
      }
    );

  const payload =
    await parseBackendJson(
      response
    );

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Không tải được danh sách thiết bị (${response.status}).`
    );
  }

  return Array.isArray(payload)
    ? payload
    : [];
}

async function revokeDeviceSession(
  sessionId
) {
  const cleanId =
    Number(sessionId);

  if (
    !Number.isInteger(cleanId) ||
    cleanId <= 0
  ) {
    throw new Error(
      "Session ID không hợp lệ."
    );
  }

  const response =
    await authorizedBackendFetch(
      `${BACKEND_DEVICES_URL}/${cleanId}`,
      {
        method: "DELETE",

        headers: {
          Accept:
            "application/json",
        },
      }
    );

  if (!response.ok) {
    const payload =
      await parseBackendJson(
        response
      );

    throw new Error(
      payload?.error ||
      "Không thể thu hồi thiết bị."
    );
  }

  return {
    success: true,
  };
}


const OCR_OUTPUT_MARKER = "__OCR_JSON__";
const fsSync = require("fs");
const fs = require("fs/promises");
const crypto = require("crypto");

const translationCache = new Map();

const translationInFlight = new Map();

let translationCachePath = null;

const MAX_CACHE_ITEMS = 500;

let ocrWorker = null;
let ocrWorkerReady = false;

let ocrReadyPromise = null;
let resolveOcrReady = null;
let rejectOcrReady = null;

let nextOcrRequestId = 1;


const pendingOcrRequests = new Map();

// ======================================================
// GLOBAL VARIABLES
// ======================================================

let mainWindow = null;

let tray = null;
let isQuitting = false;

let pendingScreenshot = null;

let selectorIsOpen = false;
let isProcessingSelection = false;
let isFullScreenProcessing = false;
let isMangaSessionProcessing = false;

// ======================================================
// HELPERS
// ======================================================

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function sendToMainWindow(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(channel, payload);
}


const DEFAULT_SHORTCUTS = {
  translate:
    "CommandOrControl+Shift+Q",

  panel:
    "CommandOrControl+Shift+W",

  panelNext:
    "CommandOrControl+Shift+Y",

  study:
    "CommandOrControl+Shift+E",
};

const DEFAULT_STUDY_PREFERENCES = {
  level:
    "AUTO",

  autoSaveVocabulary:
    false,

  autoSaveGrammar:
    false,
};

const DEFAULT_OVERLAY_PREFERENCES = {
  autoHide:
    true,

  opacity:
    0.96,

  fontScale:
    1,
};

let shortcutSettings = {
  ...DEFAULT_SHORTCUTS,
};

let studyPreferences = {
  ...DEFAULT_STUDY_PREFERENCES,
};

let overlayPreferences = {
  ...DEFAULT_OVERLAY_PREFERENCES,
};

let onboardingCompleted =
  false;

let legacyPreferenceMigration =
  false;

function getDesktopPreferencesPath() {
  return path.join(
    app.getPath("userData"),
    "config",
    "app-preferences.json"
  );
}

function normalizeShortcut(
  value,
  fallback
) {
  let clean =
    String(
      value || ""
    ).trim();

  if (!clean) {
    return fallback;
  }

  /*
   * Cho phép user nhập Ctrl+Shift+X
   * nhưng lưu theo Electron accelerator đa nền tảng.
   */
  clean =
    clean.replace(
      /(^|\+)ctrl(?=\+|$)/gi,
      "$1CommandOrControl"
    );

  clean =
    clean.replace(
      /(^|\+)control(?=\+|$)/gi,
      "$1CommandOrControl"
    );

  return clean;
}

function shortcutDisplay(
  accelerator
) {
  return String(
    accelerator || ""
  )
    .replace(
      /CommandOrControl/gi,
      process.platform === "darwin"
        ? "Cmd"
        : "Ctrl"
    );
}

function normalizeBoolean(
  value,
  fallback
) {
  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }

  return fallback;
}

function normalizeNumber(
  value,
  fallback,
  min,
  max
) {
  const numeric =
    Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(
    max,
    Math.max(
      min,
      numeric
    )
  );
}

function normalizeStudyPreferences(
  next
) {
  return {
    level:
      normalizeStudyLevel(
        next?.level
      ),

    autoSaveVocabulary:
      normalizeBoolean(
        next?.autoSaveVocabulary,
        DEFAULT_STUDY_PREFERENCES
          .autoSaveVocabulary
      ),

    autoSaveGrammar:
      normalizeBoolean(
        next?.autoSaveGrammar,
        DEFAULT_STUDY_PREFERENCES
          .autoSaveGrammar
      ),
  };
}

function normalizeOverlayPreferences(
  next
) {
  return {
    autoHide:
      normalizeBoolean(
        next?.autoHide,
        DEFAULT_OVERLAY_PREFERENCES
          .autoHide
      ),

    opacity:
      normalizeNumber(
        next?.opacity,
        DEFAULT_OVERLAY_PREFERENCES
          .opacity,
        0.65,
        1
      ),

    fontScale:
      normalizeNumber(
        next?.fontScale,
        DEFAULT_OVERLAY_PREFERENCES
          .fontScale,
        0.8,
        1.4
      ),
  };
}

function applyRuntimePreferences() {
  currentStudyLevel =
    studyPreferences.level;

  currentStudyAutoSaveVocabulary =
    studyPreferences
      .autoSaveVocabulary;

  currentStudyAutoSaveGrammar =
    studyPreferences
      .autoSaveGrammar;

  setTranslationOverlayPreferences({
    opacity:
      overlayPreferences.opacity,

    fontScale:
      overlayPreferences.fontScale,
  });

  setFullScreenOverlayPreferences({
    opacity:
      overlayPreferences.opacity,

    fontScale:
      overlayPreferences.fontScale,
  });
}

async function loadDesktopPreferences() {
  const preferencesPath =
    getDesktopPreferencesPath();

  legacyPreferenceMigration =
    false;

  try {
    const content =
      await fs.readFile(
        preferencesPath,
        "utf8"
      );

    const data =
      JSON.parse(content);

    shortcutSettings = {
      translate:
        normalizeShortcut(
          data?.shortcuts
            ?.translate,
          DEFAULT_SHORTCUTS
            .translate
        ),

      panel:
        normalizeShortcut(
          data?.shortcuts
            ?.panel,
          DEFAULT_SHORTCUTS
            .panel
        ),

      panelNext:
        normalizeShortcut(
          data?.shortcuts
            ?.panelNext,
          DEFAULT_SHORTCUTS
            .panelNext
        ),

      study:
        normalizeShortcut(
          data?.shortcuts
            ?.study,
          DEFAULT_SHORTCUTS
            .study
        ),
    };

    if (data?.study) {
      studyPreferences =
        normalizeStudyPreferences(
          data.study
        );
    } else {
      legacyPreferenceMigration =
        true;

      studyPreferences = {
        ...DEFAULT_STUDY_PREFERENCES,
      };
    }

    overlayPreferences =
      normalizeOverlayPreferences(
        data?.overlay
      );

    onboardingCompleted =
      Boolean(
        data?.onboardingCompleted
      );
  } catch (error) {
    if (
      error?.code !==
      "ENOENT"
    ) {
      console.warn(
        "APP PREFERENCES LOAD ERROR:",
        error
      );
    }

    shortcutSettings = {
      ...DEFAULT_SHORTCUTS,
    };

    studyPreferences = {
      ...DEFAULT_STUDY_PREFERENCES,
    };

    overlayPreferences = {
      ...DEFAULT_OVERLAY_PREFERENCES,
    };

    onboardingCompleted =
      false;

    legacyPreferenceMigration =
      true;
  }

  applyRuntimePreferences();

  return getAppPreferences();
}

async function saveDesktopPreferences() {
  const preferencesPath =
    getDesktopPreferencesPath();

  await fs.mkdir(
    path.dirname(
      preferencesPath
    ),
    {
      recursive: true,
    }
  );

  await fs.writeFile(
    preferencesPath,
    JSON.stringify(
      {
        version: 3,

        shortcuts: {
          ...shortcutSettings,
        },

        study: {
          ...studyPreferences,
        },

        overlay: {
          ...overlayPreferences,
        },

        onboardingCompleted,
      },
      null,
      2
    ),
    "utf8"
  );

  legacyPreferenceMigration =
    false;
}

function getShortcutSettings() {
  return {
    translate:
      shortcutSettings
        .translate,

    panel:
      shortcutSettings
        .panel,

    panelNext:
      shortcutSettings
        .panelNext,

    study:
      shortcutSettings
        .study,

    translateDisplay:
      shortcutDisplay(
        shortcutSettings
          .translate
      ),

    panelDisplay:
      shortcutDisplay(
        shortcutSettings
          .panel
      ),

    panelNextDisplay:
      shortcutDisplay(
        shortcutSettings
          .panelNext
      ),

    studyDisplay:
      shortcutDisplay(
        shortcutSettings
          .study
      ),
  };
}

function getAppPreferences() {
  return {
    version: 3,

    legacyMigrationNeeded:
      legacyPreferenceMigration,

    shortcuts:
      getShortcutSettings(),

    study: {
      ...studyPreferences,
    },

    overlay: {
      ...overlayPreferences,
    },

    onboardingCompleted,
  };
}

async function updateAppPreferences(
  next
) {
  const previousShortcuts = {
    ...shortcutSettings,
  };

  const previousStudy = {
    ...studyPreferences,
  };

  const previousOverlay = {
    ...overlayPreferences,
  };

  const previousOnboarding =
    onboardingCompleted;

  try {
    if (next?.shortcuts) {
      await updateShortcutSettings(
        next.shortcuts
      );
    }

    if (next?.study) {
      studyPreferences =
        normalizeStudyPreferences({
          ...studyPreferences,
          ...next.study,
        });
    }

    if (next?.overlay) {
      overlayPreferences =
        normalizeOverlayPreferences({
          ...overlayPreferences,
          ...next.overlay,
        });
    }

    if (
      Object.prototype.hasOwnProperty.call(
        next || {},
        "onboardingCompleted"
      )
    ) {
      onboardingCompleted =
        Boolean(
          next.onboardingCompleted
        );
    }

    applyRuntimePreferences();

    if (
      next?.overlay
    ) {
      if (
        !overlayPreferences.autoHide
      ) {
        stopOverlayLifecycle();
      } else {
        const overlayState =
          getTranslationOverlayState();

        const fullScreenOverlayState =
          getFullScreenOverlayState();

        if (
          (
            overlayState.visible &&
            !overlayState.pinned
          ) ||
          (
            fullScreenOverlayState.visible &&
            !fullScreenOverlayState.pinned
          )
        ) {
          startOverlayLifecycle(
            activeOverlayTargetWindow ||
            pendingTargetWindow
          );
        }
      }
    }

    await saveDesktopPreferences();

    return getAppPreferences();
  } catch (error) {
    if (
      next?.shortcuts
    ) {
      unregisterAppShortcuts(
        shortcutSettings
      );

      shortcutSettings = {
        ...previousShortcuts,
      };

      tryRegisterAppShortcuts(
        shortcutSettings
      );
    }

    studyPreferences = {
      ...previousStudy,
    };

    overlayPreferences = {
      ...previousOverlay,
    };

    onboardingCompleted =
      previousOnboarding;

    applyRuntimePreferences();

    throw error;
  }
}

async function resetAppPreferences() {
  const keepOnboarding =
    onboardingCompleted;

  await updateShortcutSettings({
    ...DEFAULT_SHORTCUTS,
  });

  studyPreferences = {
    ...DEFAULT_STUDY_PREFERENCES,
  };

  overlayPreferences = {
    ...DEFAULT_OVERLAY_PREFERENCES,
  };

  onboardingCompleted =
    keepOnboarding;

  applyRuntimePreferences();
  await saveDesktopPreferences();

  return getAppPreferences();
}

async function runShortcutScan(
  mode,
  source =
    "shortcut"
) {
  console.log(
    "SCAN TRIGGER:",
    {
      mode,
      source,
    }
  );

  try {
    await ensureAuthenticated();
    ensureWorkspaceScanAllowed();

    if (mode === "panel") {
      await requireFreshDesktopFeatureCapability(
        "mangaPanel"
      );
    } else if (mode === "study") {
      await requireFreshDesktopFeatureCapability(
        "studyMode"
      );
    }

    /*
     * Hotkeys may be used before the renderer has finished loading Profiles.
     * Resolve one in the main process so Translate / Panel / Study all work
     * immediately after app start or session restore.
     */
    await ensureActiveTranslationProfile();

    await openScreenSelector(
      mode
    );
  } catch (error) {
    console.error(
      "SCAN TRIGGER ERROR:",
      error
    );

    if (
      mainWindow &&
      !mainWindow.isDestroyed()
    ) {
      mainWindow.show();
      mainWindow.focus();
    }

    sendToMainWindow(
      mode === "study"
        ? "study-result"
        : "scan-result",
      {
        success: false,

        mode,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      }
    );
  }
}

function triggerMangaSessionNextPage(
  source = "shortcut"
) {
  void runMangaSessionNextPage(
    source
  ).catch((error) => {
    console.error(
      "MANGA SESSION NEXT PAGE TRIGGER ERROR:",
      error
    );

    sendToMainWindow(
      "scan-result",
      {
        success: false,
        mode: "panel",
        session:
          getMangaPanelSessionState(),
        error:
          error instanceof Error
            ? error.message
            : String(error),
      }
    );

    if (
      mainWindow &&
      !mainWindow.isDestroyed()
    ) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function unregisterAppShortcuts(
  settings =
    shortcutSettings
) {
  for (
    const accelerator
    of [
      settings.translate,
      settings.panel,
      settings.panelNext,
      settings.study,
    ]
  ) {
    try {
      globalShortcut.unregister(
        accelerator
      );
    } catch {
    }
  }
}

function tryRegisterAppShortcuts(
  settings
) {
  const translateRegistered =
    globalShortcut.register(
      settings.translate,
      () => {
        void runShortcutScan(
          "translate",
          "global-shortcut"
        );
      }
    );

  if (!translateRegistered) {
    return {
      success: false,
      failed:
        settings.translate,
    };
  }

  const panelRegistered =
    globalShortcut.register(
      settings.panel,
      () => {
        void runShortcutScan(
          "panel",
          "global-shortcut"
        );
      }
    );

  if (!panelRegistered) {
    globalShortcut.unregister(
      settings.translate
    );

    return {
      success: false,
      failed:
        settings.panel,
    };
  }

  const panelNextRegistered =
    globalShortcut.register(
      settings.panelNext,
      () => {
        triggerMangaSessionNextPage(
          "global-shortcut"
        );
      }
    );

  if (!panelNextRegistered) {
    globalShortcut.unregister(
      settings.translate
    );
    globalShortcut.unregister(
      settings.panel
    );

    return {
      success: false,
      failed:
        settings.panelNext,
    };
  }

  const studyRegistered =
    globalShortcut.register(
      settings.study,
      () => {
        void runShortcutScan(
          "study",
          "global-shortcut"
        );
      }
    );

  if (!studyRegistered) {
    globalShortcut.unregister(
      settings.translate
    );
    globalShortcut.unregister(
      settings.panel
    );
    globalShortcut.unregister(
      settings.panelNext
    );

    return {
      success: false,
      failed:
        settings.study,
    };
  }

  return {
    success: true,
  };
}

function registerShortcuts() {
  unregisterAppShortcuts();

  let result =
    tryRegisterAppShortcuts(
      shortcutSettings
    );

  if (!result.success) {
    console.error(
      "GLOBAL SHORTCUT REGISTRATION FAILED:",
      result.failed
    );

    /*
     * Nếu file preference cũ chứa accelerator lỗi,
     * thử quay về defaults để app vẫn dùng được.
     */
    unregisterAppShortcuts(
      shortcutSettings
    );

    shortcutSettings = {
      ...DEFAULT_SHORTCUTS,
    };

    result =
      tryRegisterAppShortcuts(
        shortcutSettings
      );

    if (!result.success) {
      console.error(
        "DEFAULT GLOBAL SHORTCUT REGISTRATION FAILED:",
        result.failed
      );

      return false;
    }

    void saveDesktopPreferences()
      .catch(
        (error) => {
          console.warn(
            "SAVE DEFAULT SHORTCUTS ERROR:",
            error
          );
        }
      );
  }

  console.log(
    "TRANSLATE SHORTCUT:",
    shortcutDisplay(
      shortcutSettings.translate
    )
  );

  console.log(
    "PANEL SHORTCUT:",
    shortcutDisplay(
      shortcutSettings.panel
    )
  );

  console.log(
    "PANEL NEXT SHORTCUT:",
    shortcutDisplay(
      shortcutSettings.panelNext
    )
  );

  console.log(
    "STUDY SHORTCUT:",
    shortcutDisplay(
      shortcutSettings.study
    )
  );

  return true;
}

async function updateShortcutSettings(
  next
) {
  const candidate = {
    translate:
      normalizeShortcut(
        next?.translate,
        shortcutSettings.translate
      ),

    panel:
      normalizeShortcut(
        next?.panel,
        shortcutSettings.panel
      ),

    panelNext:
      normalizeShortcut(
        next?.panelNext,
        shortcutSettings.panelNext
      ),

    study:
      normalizeShortcut(
        next?.study,
        shortcutSettings.study
      ),
  };

  const shortcutValues = [
    candidate.translate,
    candidate.panel,
    candidate.panelNext,
    candidate.study,
  ].map(
    (value) =>
      value.toLowerCase()
  );

  if (
    new Set(shortcutValues).size !==
    shortcutValues.length
  ) {
    throw new Error(
      "Bốn phím Dịch nhanh, Quét khung truyện, Trang tiếp theo và Study phải khác nhau."
    );
  }

  const previous = {
    ...shortcutSettings,
  };

  unregisterAppShortcuts(
    previous
  );

  const result =
    tryRegisterAppShortcuts(
      candidate
    );

  if (!result.success) {
    unregisterAppShortcuts(
      candidate
    );

    shortcutSettings = {
      ...previous,
    };

    tryRegisterAppShortcuts(
      previous
    );

    throw new Error(
      `Không thể đăng ký phím tắt ${shortcutDisplay(result.failed)}. Có thể phím này đang được ứng dụng khác sử dụng.`
    );
  }

  shortcutSettings = {
    ...candidate,
  };

  await saveDesktopPreferences();

  if (tray) {
    tray.destroy();
    tray = null;
    createTray();
  }

  return getShortcutSettings();
}

async function waitForExternalForegroundSnapshot(
  timeoutMs =
    1000
) {
  const startedAt =
    Date.now();

  let lastExternal =
    null;

  while (
    Date.now() -
    startedAt <
    timeoutMs
  ) {
    const snapshot =
      getForegroundWindowSnapshot();

    if (
      snapshot &&
      Number(
        snapshot.processId
      ) !==
      Number(process.pid)
    ) {
      lastExternal = {
        ...snapshot,
      };

      /*
       * Một title rỗng vẫn là target hợp lệ
       * với game/app native, nên chỉ cần HWND + PID.
       */
      if (
        snapshot.hwnd &&
        snapshot.processId
      ) {
        return lastExternal;
      }
    }

    await delay(50);
  }

  return lastExternal;
}

function normalizeTrackedTitle(
  value
) {
  return String(
    value || ""
  )
    .replace(
      /^\(\d+\)\s*/,
      ""
    )
    .trim();
}

function sameTrackedWindow(
  target,
  current
) {
  if (
    !target ||
    !current
  ) {
    return false;
  }

  if (
    String(target.hwnd) !==
    String(current.hwnd)
  ) {
    return false;
  }

  if (
    Number(target.processId) !==
    Number(current.processId)
  ) {
    return false;
  }

  const targetTitle =
    normalizeTrackedTitle(
      target.title
    );

  const currentTitle =
    normalizeTrackedTitle(
      current.title
    );

  /*
   * Browser tab switch thường đổi title trong cùng HWND.
   * Nếu một trong hai title rỗng thì chỉ dùng HWND + PID.
   */
  if (
    targetTitle &&
    currentTitle &&
    targetTitle !==
    currentTitle
  ) {
    return false;
  }

  return true;
}

function stopOverlayLifecycle() {
  if (overlayLifecycleTimer) {
    clearInterval(
      overlayLifecycleTimer
    );

    overlayLifecycleTimer =
      null;
  }
}

function hideTranslationExperience(
  reason =
    "manual"
) {
  stopOverlayLifecycle();

  if (
    reason === "tray" ||
    reason === "manual"
  ) {
    setTranslationOverlayPinned(
      false
    );

    setFullScreenOverlayPinned(
      false
    );
  }

  hideSelectionTranslation();
  hideFullScreenTranslationOverlay();

  console.log(
    "TRANSLATION OVERLAY HIDDEN:",
    reason
  );
}

function startOverlayLifecycle(
  targetWindow
) {
  stopOverlayLifecycle();

  activeOverlayTargetWindow =
    targetWindow
      ? {
          ...targetWindow,
        }
      : null;

  if (
    process.platform !== "win32" ||
    !activeOverlayTargetWindow ||
    isTranslationOverlayPinned() ||
    isFullScreenOverlayPinned() ||
    !overlayPreferences.autoHide
  ) {
    return;
  }

  const startedAt =
    Date.now();

  let hasSeenTarget =
    false;

  overlayLifecycleTimer =
    setInterval(
      () => {
        if (
          isTranslationOverlayPinned() ||
          isFullScreenOverlayPinned()
        ) {
          return;
        }

        const current =
          getForegroundWindowSnapshot();

        if (!current) {
          return;
        }

        if (
          Number(current.processId) ===
          Number(process.pid)
        ) {
          return;
        }

        if (
          sameTrackedWindow(
            activeOverlayTargetWindow,
            current
          )
        ) {
          hasSeenTarget = true;
          return;
        }

        /*
         * Selection overlay / focus transition có thể tạm thời
         * là foreground. Chỉ bắt đầu auto-hide sau khi đã thấy
         * target thật quay lại ít nhất một lần.
         */
        if (!hasSeenTarget) {
          if (
            Date.now() -
            startedAt >
            3000
          ) {
            stopOverlayLifecycle();
          }

          return;
        }

        hideTranslationExperience(
          "foreground-window-or-browser-tab-changed"
        );
      },
      300
    );
}

function showTrackedSelectionTranslation(
  data
) {
  showSelectionTranslation(
    data
  );

  startOverlayLifecycle(
    pendingTargetWindow
  );
}

// ======================================================
// MAIN REACT WINDOW
// ======================================================

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();

    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,

    minWidth: 650,
    minHeight: 500,

    show: false,

    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),

      contextIsolation: true,
      nodeIntegration: false,

      /*
       * Main window thường bị hide trong lúc scan. Giữ renderer hoạt động
       * để tránh một số lỗi repaint/blank trên Windows khi show lại.
       */
      backgroundThrottling: false,
      paintWhenInitiallyHidden: true,
    },
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) {
        return;
      }

      console.error(
        "MAIN RENDERER LOAD FAILED:",
        {
          errorCode,
          errorDescription,
          validatedURL
        }
      );
    }
  );

  mainWindow.webContents.on(
    "render-process-gone",
    (_event, details) => {
      console.error(
        "MAIN RENDERER PROCESS GONE:",
        details
      );
    }
  );

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  } else {
    mainWindow.loadURL("http://localhost:5173");
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("focus", () => {
    void refreshAccountEntitlements({
      silent: true,
    });
  });

  mainWindow.on("close", (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();

    mainWindow.hide();

    console.log("MAIN WINDOW HIDDEN TO TRAY");
  });

  return mainWindow;
}

let mainRendererRecoveryRunning = false;

function loadMainRenderer(
  win
) {
  if (!win || win.isDestroyed()) {
    return Promise.resolve();
  }

  if (app.isPackaged) {
    return win.loadFile(
      path.join(
        __dirname,
        "..",
        "dist",
        "index.html"
      )
    );
  }

  return win.loadURL(
    "http://localhost:5173"
  );
}

function recoverMainRendererIfBlank(
  win
) {
  if (
    !win ||
    win.isDestroyed() ||
    mainRendererRecoveryRunning
  ) {
    return;
  }

  setTimeout(
    async () => {
      if (
        !win ||
        win.isDestroyed() ||
        win.webContents.isLoading()
      ) {
        return;
      }

      try {
        const health =
          await win.webContents.executeJavaScript(
            `(() => {
              const root = document.getElementById("root");
              return {
                readyState: document.readyState,
                rootExists: Boolean(root),
                rootLength: root?.innerHTML?.trim()?.length || 0,
                bodyLength: document.body?.innerHTML?.trim()?.length || 0,
                href: location.href
              };
            })()`,
            true
          );

        const blank =
          !health?.rootExists ||
          Number(health?.rootLength || 0) === 0;

        if (!blank) {
          return;
        }

        console.warn(
          "MAIN RENDERER BLANK - RECOVERING:",
          health
        );

        mainRendererRecoveryRunning = true;

        await loadMainRenderer(
          win
        );

        console.log(
          "MAIN RENDERER RECOVERED"
        );
      } catch (error) {
        console.error(
          "MAIN RENDERER HEALTH CHECK FAILED:",
          error
        );
      } finally {
        mainRendererRecoveryRunning = false;
      }
    },
    180
  );
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    const win =
      createWindow();

    recoverMainRendererIfBlank(
      win
    );

    return;
  }

  mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();

  /*
   * Bình thường không reload => giữ state UI.
   * Chỉ reload khi React #root thực sự rỗng/trắng.
   */
  recoverMainRendererIfBlank(
    mainWindow
  );
}

function createTray() {
  if (tray) {
    return tray;
  }

  const iconPath =
    getTrayIconPath();

  const trayIcon =
    nativeImage
      .createFromPath(
        iconPath
      )
      .resize({
        width: 20,
        height: 20,
      });

  if (trayIcon.isEmpty()) {
    console.error(
      "TRAY ICON NOT FOUND:",
      iconPath
    );

    return null;
  }

  tray = new Tray(
    trayIcon
  );

  tray.setToolTip(
    "AI Translator"
  );

  const contextMenu =
    Menu.buildFromTemplate([
      {
        label:
          "Mở AI Translator",

        click: () => {
          showMainWindow();
        },
      },

      {
        label:
          `Dịch nhanh (${shortcutDisplay(shortcutSettings.translate)})`,

        accelerator:
          shortcutSettings.translate,

        click: () => {
          void runShortcutScan(
            "translate",
            "tray"
          );
        },
      },

      {
        label:
          `Quét khung truyện (${shortcutDisplay(shortcutSettings.panel)})`,

        accelerator:
          shortcutSettings.panel,

        click: () => {
          void runShortcutScan(
            "panel",
            "tray"
          );
        },
      },

      {
        label:
          `Trang manga tiếp theo (${shortcutDisplay(shortcutSettings.panelNext)})`,

        accelerator:
          shortcutSettings.panelNext,

        click: () => {
          triggerMangaSessionNextPage(
            "tray"
          );
        },
      },

      {
        label:
          `Học câu (${shortcutDisplay(shortcutSettings.study)})`,

        accelerator:
          shortcutSettings.study,

        click: () => {
          void runShortcutScan(
            "study",
            "tray"
          );
        },
      },

      {
        label:
          isTranslationOverlayPinned()
            ? "Bỏ ghim bản dịch"
            : "Ghim bản dịch",

        click: () => {
          const pinned =
            toggleTranslationOverlayPinned();

          if (pinned) {
            stopOverlayLifecycle();
          } else {
            startOverlayLifecycle(
              activeOverlayTargetWindow
            );
          }

          if (tray) {
            tray.destroy();
            tray = null;
            createTray();
          }
        },
      },

      {
        label:
          "Ẩn bản dịch",

        click: () => {
          hideTranslationExperience(
            "tray"
          );
        },
      },

      {
        type:
          "separator",
      },

      {
        label:
          "Thoát",

        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);

  tray.setContextMenu(
    contextMenu
  );

  tray.on(
    "double-click",
    () => {
      showMainWindow();
    }
  );

  console.log(
    "SYSTEM TRAY READY"
  );

  return tray;
}

function getOcrDirectory() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "ocr");
  }

  return path.join(__dirname, "..", "ocr");
}
// ======================================================
// SCREEN SELECTOR
// ======================================================

async function openScreenSelector(
  requestedMode =
    currentWorkspaceMode
) {
  if (
    selectorIsOpen ||
    isProcessingSelection ||
    isMangaSessionProcessing
  ) {
    console.log("SELECTOR ALREADY OPEN OR MANGA SESSION BUSY");

    return;
  }

  pendingScanMode =
    requestedMode === "study"
      ? "study"
      : requestedMode === "panel"
        ? "panel"
        : "translate";

  if (pendingScanMode !== "study") {
    pendingTranslationSourceLanguage =
      currentTranslationSourceLanguage;
    pendingTranslationTargetLanguage =
      currentTranslationTargetLanguage;
  }

  selectorIsOpen = true;

  try {
    console.log(
      "MAIN RECEIVED OPEN SELECTOR:",
      pendingScanMode
    );

    /*
     * Ẩn toàn bộ UI của app trước screenshot.
     * Overlay dịch cũ cũng phải ẩn để không lọt vào OCR.
     */
    stopOverlayLifecycle();
    hideSelectionTranslation();
    hideFullScreenTranslationOverlay();

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
    }

    /*
     * Chờ Windows trả focus về browser/app nguồn.
     * Foreground tracker chạy liên tục nên snapshot này
     * không cần spawn PowerShell theo từng lần scan.
     */
    await delay(300);

    pendingTargetWindow =
      await waitForExternalForegroundSnapshot(
        1000
      );

    console.log(
      "SCAN TARGET WINDOW:",
      pendingTargetWindow
        ? {
            processName:
              pendingTargetWindow.processName,
            title:
              pendingTargetWindow.title,
          }
        : null
    );

    pendingScreenshot = await screenshot({
      format: "png",
    });

    console.log("FULL SCREENSHOT READY");

    createOverlay();
  } catch (error) {
    console.error("OPEN SELECTOR ERROR:", error);

    pendingScreenshot = null;
    selectorIsOpen = false;

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }

    throw error;
  }
}

// ======================================================
// CROP SELECTED AREA
// ======================================================
function getRuntimeDirectory() {
  const runtimeDirectory = path.join(app.getPath("userData"), "runtime");

  fsSync.mkdirSync(runtimeDirectory, {
    recursive: true,
  });

  return runtimeDirectory;
}

async function cropSelectedArea(
  selection,
  screenshotBuffer,
  options = {}
) {
  if (!screenshotBuffer) {
    throw new Error("Không tìm thấy ảnh màn hình để crop.");
  }

  const display = screen.getPrimaryDisplay();

  const metadata = await sharp(screenshotBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Không đọc được kích thước screenshot.");
  }

  /*
   * Xử lý Windows Display Scaling.
   *
   * Tọa độ overlay có thể tính theo logical pixels,
   * trong khi screenshot dùng physical pixels.
   */
  const scaleX = metadata.width / display.bounds.width;

  const scaleY = metadata.height / display.bounds.height;

  let left = Math.round(Number(selection.x) * scaleX);

  let top = Math.round(Number(selection.y) * scaleY);

  let width = Math.round(Number(selection.width) * scaleX);

  let height = Math.round(Number(selection.height) * scaleY);

  const cropPadding =
    Number.isFinite(
      Number(options?.padding)
    )
      ? Math.max(
          0,
          Math.min(
            60,
            Math.round(
              Number(options.padding)
            )
          )
        )
      : 30;

  left = Math.max(0, left - cropPadding);

  top = Math.max(0, top - cropPadding);

  width = Math.min(metadata.width - left, width + cropPadding * 2);

  height = Math.min(metadata.height - top, height + cropPadding * 2);

  if (width <= 0 || height <= 0) {
    throw new Error("Vùng chọn không hợp lệ.");
  }

  const imagePath = path.join(getRuntimeDirectory(), "selected.png");

  await sharp(screenshotBuffer)
    .extract({
      left,
      top,
      width,
      height,
    })
    .png()
    .toFile(imagePath);

  return {
    imagePath,
    scaleX,
    scaleY,
    padding: cropPadding,

    physicalCrop: {
      left,
      top,
      width,
      height,
    },

    logicalSelection: {
      x:
        Math.round(
          Number(selection.x) || 0
        ),
      y:
        Math.round(
          Number(selection.y) || 0
        ),
      width:
        Math.max(
          1,
          Math.round(
            Number(selection.width) || 1
          )
        ),
      height:
        Math.max(
          1,
          Math.round(
            Number(selection.height) || 1
          )
        ),
    },
  };
}

// ======================================================
// PYTHON OCR
// ======================================================

// ======================================================
// OPENAI TRANSLATION
// ======================================================


async function analyzeJapaneseForStudy(
  originalText,
  profile,
  context,
  studyLevel,
  autoSaveVocabulary,
  autoSaveGrammar
) {
  const text =
    String(originalText || "")
      .trim();

  if (!text) {
    throw new Error(
      "Văn bản OCR trống."
    );
  }

  let response;

  try {
    response =
      await authorizedBackendFetch(
        BACKEND_STUDY_ANALYZE_URL,
        {
          method: "POST",

          timeoutMs:
            STUDY_TIMEOUT_MS,

          headers: {
            "Content-Type":
              "application/json; charset=utf-8",

            Accept:
              "application/json",
          },

          body:
            JSON.stringify({
              text,

              profileId:
                profile?.id ||
                null,

              level:
                normalizeStudyLevel(
                  studyLevel
                ),

              autoSaveVocabulary:
                Boolean(
                  autoSaveVocabulary
                ),

              autoSaveGrammar:
                Boolean(
                  autoSaveGrammar
                ),

              context:
                Array.isArray(context)
                  ? context
                  : [],
            }),
        }
      );
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : String(error)
    );
  }

  const payload =
    await parseBackendJson(
      response
    );

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Study backend lỗi HTTP ${response.status}.`
    );
  }

  if (
    !payload?.success ||
    !payload?.analysis
  ) {
    throw new Error(
      payload?.error ||
      "Java backend không trả về Study Analysis."
    );
  }

  return payload;
}

async function translateText(
  originalText,
  profile,
  context,
  sourceLanguage,
  targetLanguage
) {
  const text =
    String(originalText || "")
      .trim();

  if (!text) {
    return {
      original: "",
      vietnamese: "",
    };
  }

  let response;

  try {
    response =
      await authorizedBackendFetch(
        BACKEND_TRANSLATE_URL,
        {
          method: "POST",

          timeoutMs:
            TRANSLATE_TIMEOUT_MS,

          headers: {
            "Content-Type":
              "application/json; charset=utf-8",

            Accept:
              "application/json",
          },

          body:
            JSON.stringify({
              text,

              profileId:
                profile?.id ||
                null,

              sourceLanguage:
                normalizeTranslationSourceLanguage(
                  sourceLanguage
                ),

              targetLanguage:
                normalizeTranslationTargetLanguage(
                  targetLanguage
                ),

              context:
                Array.isArray(context)
                  ? context
                  : [],
            }),
        }
      );
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : String(error)
    );
  }

  const payload =
    await parseBackendJson(
      response
    );

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Java backend lỗi HTTP ${response.status}.`
    );
  }

  if (
    !payload?.success ||
    !payload?.translation
  ) {
    throw new Error(
      payload?.error ||
      "Java backend không trả về kết quả dịch."
    );
  }

  return {
    original:
      payload.translation.original ||
      text,

    translatedText:
      payload.translation.translatedText ||
      payload.translation.vietnamese ||
      "",

    /* Legacy alias used by current renderer/overlay. */
    vietnamese:
      payload.translation.translatedText ||
      payload.translation.vietnamese ||
      "",

    sourceLanguage:
      payload.translation.sourceLanguage ||
      normalizeTranslationSourceLanguage(
        sourceLanguage
      ),

    targetLanguage:
      payload.translation.targetLanguage ||
      normalizeTranslationTargetLanguage(
        targetLanguage
      ),

    profile:
      payload.profile ||
      null,

    performance:
      payload.performance ||
      null,
  };
}


async function translateBatchBlocks(
  blocks,
  options = {}
) {
  await ensureAuthenticated();

  const profile =
    await ensureActiveTranslationProfile();

  const sourceLanguage =
    normalizeTranslationSourceLanguage(
      options?.sourceLanguage ??
      currentTranslationSourceLanguage
    );

  const targetLanguage =
    normalizeTranslationTargetLanguage(
      options?.targetLanguage ??
      currentTranslationTargetLanguage
    );

  const requestedPurpose =
    String(
      options?.purpose ||
      "GENERAL"
    )
      .trim()
      .toUpperCase();

  const supportedPurposes = new Set([
    "GENERAL",
    "MANGA",
    "NOVEL",
    "NOVEL_EPUB",
    "PDF_TEXT",
    "PDF_OCR",
  ]);

  const purpose = supportedPurposes.has(requestedPurpose)
    ? requestedPurpose
    : "GENERAL";

  const normalizedBlocks =
    (Array.isArray(blocks)
      ? blocks
      : [])
      .map((block, index) => ({
        id:
          String(
            block?.id ||
            `block-${index + 1}`
          ).trim(),
        text:
          normalizeTranslationText(
            block?.text
          ),
      }))
      .filter(
        (block) =>
          block.id &&
          block.text
      );

  if (!normalizedBlocks.length) {
    throw new Error(
      "Không có text block để dịch."
    );
  }

  const context =
    Array.isArray(
      options?.context
    )
      ? options.context
          .slice(-10)
          .map((item) => ({
            ...item,
          }))
      : getCurrentTranslationContext(
          profile,
          sourceLanguage,
          targetLanguage
        );

  let response;

  try {
    response =
      await authorizedBackendFetch(
        BACKEND_TRANSLATE_BATCH_URL,
        {
          method: "POST",

          timeoutMs:
            BATCH_TRANSLATE_TIMEOUT_MS,

          headers: {
            "Content-Type":
              "application/json; charset=utf-8",

            Accept:
              "application/json",
          },

          body:
            JSON.stringify({
              profileId:
                profile?.id ||
                null,

              purpose,

              sourceLanguage,
              targetLanguage,

              context:
                Array.isArray(context)
                  ? context
                  : [],

              blocks:
                normalizedBlocks,
            }),
        }
      );
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : String(error)
    );
  }

  const payload =
    await parseBackendJson(
      response
    );

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Batch translation backend lỗi HTTP ${response.status}.`
    );
  }

  if (
    !payload?.success ||
    !Array.isArray(
      payload?.translations
    )
  ) {
    throw new Error(
      payload?.error ||
      "Java backend không trả về batch translations."
    );
  }

  return {
    ...payload,
    sourceLanguage,
    targetLanguage,
  };
}

function novelReaderOwnerWindow() {
  return (
    mainWindow &&
    !mainWindow.isDestroyed()
      ? mainWindow
      : undefined
  );
}

function pdfOcrCacheDir() {
  return path.join(
    app.getPath("userData"),
    "pdf-ocr-cache"
  );
}

async function pdfOcrFileIdentity(filePathValue) {
  const filePath = path.resolve(String(filePathValue || ""));
  const stat = await fs.stat(filePath);
  const identity = `${filePath}\n${stat.size}\n${stat.mtime.toISOString()}`;
  const key = crypto
    .createHash("sha256")
    .update(identity, "utf8")
    .digest("hex");
  return {
    filePath,
    sizeBytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    key,
  };
}

async function loadPdfOcrCache(filePathValue) {
  const identity = await pdfOcrFileIdentity(filePathValue);
  const cachePath = path.join(pdfOcrCacheDir(), `${identity.key}.json`);
  try {
    const raw = await fs.readFile(cachePath, "utf8");
    const parsed = JSON.parse(raw);
    if (
      parsed?.version !== 1 ||
      parsed?.modifiedAt !== identity.modifiedAt ||
      Number(parsed?.sizeBytes) !== identity.sizeBytes
    ) {
      return {
        identity,
        cachePath,
        cache: {
          version: 1,
          modifiedAt: identity.modifiedAt,
          sizeBytes: identity.sizeBytes,
          pages: {},
        },
      };
    }
    return {
      identity,
      cachePath,
      cache: {
        version: 1,
        modifiedAt: identity.modifiedAt,
        sizeBytes: identity.sizeBytes,
        pages:
          parsed.pages && typeof parsed.pages === "object"
            ? parsed.pages
            : {},
      },
    };
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn("PDF OCR CACHE READ:", error?.message || error);
    }
    return {
      identity,
      cachePath,
      cache: {
        version: 1,
        modifiedAt: identity.modifiedAt,
        sizeBytes: identity.sizeBytes,
        pages: {},
      },
    };
  }
}

async function savePdfOcrCache(cacheState) {
  await fs.mkdir(pdfOcrCacheDir(), { recursive: true });
  const temporary = `${cacheState.cachePath}.tmp`;
  await fs.writeFile(
    temporary,
    JSON.stringify(cacheState.cache),
    "utf8"
  );
  await fs.rename(temporary, cacheState.cachePath);
}

function mergePdfOcrCachedBlocks(cache, pageCount = 0) {
  const pages = Object.entries(cache?.pages || {})
    .map(([pageNumber, value]) => ({
      pageNumber: Number(pageNumber),
      blocks: Array.isArray(value?.blocks) ? value.blocks : [],
      ocrAt: Number(value?.ocrAt || 0),
    }))
    .filter((page) => Number.isFinite(page.pageNumber) && page.pageNumber > 0)
    .sort((a, b) => a.pageNumber - b.pageNumber);

  const blocks = [];
  for (const page of pages) {
    for (const block of page.blocks) {
      const text = String(block?.text || "").trim();
      if (!text) continue;
      blocks.push({
        ...block,
        id:
          String(block?.id || "").trim() ||
          `pdf-ocr-p${page.pageNumber}-b${blocks.length + 1}`,
        index: blocks.length,
        text,
        heading: false,
        pageNumber: page.pageNumber,
        sourcePath: `page:${page.pageNumber}`,
        ocrSource: true,
      });
    }
  }

  return {
    blocks,
    chapters: pages
      .filter((page) => page.blocks.some((block) => String(block?.text || "").trim()))
      .map((page) => {
        const index = blocks.findIndex((block) => block.pageNumber === page.pageNumber);
        return {
          label: `Trang ${page.pageNumber}`,
          index: Math.max(0, index),
          pageNumber: page.pageNumber,
          sourcePath: `page:${page.pageNumber}`,
        };
      }),
    ocrPages: pages.map((page) => page.pageNumber),
    pageCount: Number(pageCount || 0),
  };
}

async function attachPdfOcrCache(payload) {
  if (payload?.file?.format !== "PDF_OCR") return payload;
  const cacheState = await loadPdfOcrCache(payload.file.path);
  const merged = mergePdfOcrCachedBlocks(
    cacheState.cache,
    payload?.metadata?.pageCount
  );
  return {
    ...payload,
    blocks: merged.blocks,
    chapters: merged.chapters,
    metadata: {
      ...(payload.metadata || {}),
      pageCount: merged.pageCount || payload?.metadata?.pageCount || 0,
      ocrPages: merged.ocrPages,
      ocrPageCount: merged.ocrPages.length,
    },
  };
}

async function readNovelDocumentPath(
  filePathValue,
  requestedFormat = null
) {
  await ensureAuthenticated();
  await refreshAccountEntitlements({
    silent: true,
  });

  const payload = await readDocumentPath(
    filePathValue,
    {
      requestedFormat,
      requireCapability:
        requireDesktopFeatureCapability,
    }
  );

  return attachPdfOcrCache(payload);
}

async function openNovelDocumentFiles(
  requestedFormat
) {
  await ensureAuthenticated();
  await refreshAccountEntitlements({
    silent: true,
  });

  const payload = await openDocumentFiles({
    dialog,
    ownerWindow:
      novelReaderOwnerWindow(),
    requestedFormat,
    requireCapability:
      requireDesktopFeatureCapability,
  });

  if (requestedFormat === "PDF_OCR") {
    if (Array.isArray(payload?.files)) {
      const files = [];
      for (const item of payload.files) {
        files.push(await attachPdfOcrCache(item));
      }
      return {
        ...files[0],
        files,
        errors: payload.errors || [],
      };
    }
    return attachPdfOcrCache(payload);
  }

  return payload;
}

async function ocrNovelPdfPages(
  filePathValue,
  startPageValue = 1,
  countValue = 3
) {
  await ensureAuthenticated();
  await requireFreshDesktopFeatureCapability("pdfOcrReader");

  const documentPayload = await readDocumentPath(
    filePathValue,
    {
      requestedFormat: "PDF_OCR",
      requireCapability:
        requireDesktopFeatureCapability,
    }
  );

  const pageCount = Math.max(
    1,
    Number(documentPayload?.metadata?.pageCount || 1)
  );
  const startPage = Math.max(
    1,
    Math.min(pageCount, Number(startPageValue) || 1)
  );
  const count = Math.max(1, Math.min(4, Number(countValue) || 3));
  const endPage = Math.min(pageCount, startPage + count - 1);
  const cacheState = await loadPdfOcrCache(filePathValue);
  const pdfBuffer = await fs.readFile(cacheState.identity.filePath);
  let processed = 0;
  let cacheHits = 0;
  const failures = [];

  for (let pageNumber = startPage; pageNumber <= endPage; pageNumber += 1) {
    const cached = cacheState.cache.pages[String(pageNumber)];
    if (Array.isArray(cached?.blocks) && cached.blocks.length) {
      cacheHits += 1;
      continue;
    }

    let temporaryPath = null;
    try {
      const rendered = await extractPdfPagePng(pdfBuffer, pageNumber);
      const temporaryName = `ai-translator-pdf-ocr-${process.pid}-${Date.now()}-${pageNumber}.png`;
      temporaryPath = path.join(os.tmpdir(), temporaryName);
      await fs.writeFile(temporaryPath, rendered.png);

      const rawOcr = await requestOcr(temporaryPath);
      const cleanOcr = cleanOcrResult(rawOcr);
      const blocks = ocrResultToPageBlocks(
        cleanOcr,
        pageNumber,
        rendered.width,
        rendered.height
      );

      cacheState.cache.pages[String(pageNumber)] = {
        blocks,
        ocrAt: Date.now(),
        lineCount: Array.isArray(cleanOcr?.lines) ? cleanOcr.lines.length : 0,
      };
      processed += 1;
    } catch (error) {
      failures.push({
        pageNumber,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (temporaryPath) {
        await fs.unlink(temporaryPath).catch(() => {});
      }
    }
  }

  await savePdfOcrCache(cacheState);
  const merged = mergePdfOcrCachedBlocks(cacheState.cache, pageCount);
  return {
    success: true,
    file: documentPayload.file,
    document: documentPayload.file,
    blocks: merged.blocks,
    chapters: merged.chapters,
    metadata: {
      ...(documentPayload.metadata || {}),
      pageCount,
      ocrPages: merged.ocrPages,
      ocrPageCount: merged.ocrPages.length,
    },
    ocr: {
      startPage,
      endPage,
      requestedPages: endPage - startPage + 1,
      processed,
      cacheHits,
      failures,
    },
  };
}

// Legacy wrappers are intentionally kept during the Reader refactor so an
// older renderer build can still talk to a newer Electron main process.
async function readNovelTxtPath(filePathValue) {
  return readNovelDocumentPath(
    filePathValue,
    "TXT"
  );
}

async function openNovelTxtFile() {
  return openNovelDocumentFiles(
    "TXT"
  );
}

async function readNovelEpubPath(filePathValue) {
  return readNovelDocumentPath(
    filePathValue,
    "EPUB"
  );
}

async function openNovelEpubFile() {
  return openNovelDocumentFiles(
    "EPUB"
  );
}

async function translateNovelBlocks(
  payload
) {
  await ensureAuthenticated();

  const route =
    getTranslationRouteForFormat(
      payload?.format || "TXT"
    );

  await requireFreshDesktopFeatureCapability(
    route.capability
  );

  const blocks =
    Array.isArray(payload?.blocks)
      ? payload.blocks.slice(0, 8)
      : [];

  return translateBatchBlocks(
    blocks,
    {
      purpose: route.purpose,
      sourceLanguage:
        payload?.sourceLanguage,
      targetLanguage:
        payload?.targetLanguage,
      context:
        Array.isArray(
          payload?.context
        )
          ? payload.context.slice(-10)
          : [],
    }
  );
}

async function applyOverlayCorrectionLocally(
  correction
) {
  const sourceText =
    normalizeTranslationText(
      correction?.sourceText
    );

  const correctedTranslation =
    String(
      correction?.correctedTranslation || ""
    ).trim();

  const sourceLanguage =
    normalizeTranslationSourceLanguage(
      correction?.sourceLanguage
    );

  const targetLanguage =
    normalizeTranslationTargetLanguage(
      correction?.targetLanguage
    );

  const profileId =
    correction?.profileId ??
    activeTranslationProfile?.id ??
    null;

  let cacheChanged = false;

  for (
    const [key, value]
    of translationCache.entries()
  ) {
    const sameSource =
      normalizeTranslationText(
        value?.original
      ) === sourceText;

    const sameSourceLanguage =
      normalizeTranslationSourceLanguage(
        value?.sourceLanguage
      ) === sourceLanguage;

    const sameTargetLanguage =
      normalizeTranslationTargetLanguage(
        value?.targetLanguage
      ) === targetLanguage;

    const cachedProfileId =
      value?.profile?.id ??
      null;

    const sameProfile =
      profileId == null ||
      cachedProfileId == null ||
      String(cachedProfileId) ===
        String(profileId);

    if (
      sameSource &&
      sameSourceLanguage &&
      sameTargetLanguage &&
      sameProfile
    ) {
      translationCache.delete(key);
      cacheChanged = true;
    }
  }

  if (cacheChanged) {
    await saveTranslationCache();
  }

  const contextProfile =
    profileId != null
      ? { id: profileId }
      : activeTranslationProfile;

  const contextKey =
    getProfileContextKey(
      contextProfile,
      sourceLanguage,
      targetLanguage
    );

  const contextItems =
    getCurrentTranslationContext(
      contextProfile,
      sourceLanguage,
      targetLanguage
    );

  let contextChanged = false;

  const nextContext =
    contextItems.map((item) => {
      if (
        normalizeTranslationText(
          item?.original
        ) !== sourceText
      ) {
        return item;
      }

      contextChanged = true;

      return {
        ...item,
        translatedText:
          correctedTranslation,
        vietnamese:
          correctedTranslation,
      };
    });

  if (contextChanged) {
    translationContextByProfile.set(
      contextKey,
      nextContext
    );
  }

  if (
    mangaPanelSession &&
    String(
      mangaPanelSession.profileId ?? ""
    ) === String(profileId ?? "") &&
    mangaPanelSession.sourceLanguage ===
      sourceLanguage &&
    mangaPanelSession.targetLanguage ===
      targetLanguage
  ) {
    const sessionItems =
      getMangaPanelSessionContext();

    let sessionChanged = false;

    const nextSessionItems =
      sessionItems.map((item) => {
        if (
          normalizeTranslationText(
            item?.original
          ) !== sourceText
        ) {
          return item;
        }

        sessionChanged = true;

        return {
          ...item,
          translatedText:
            correctedTranslation,
          vietnamese:
            correctedTranslation,
        };
      });

    if (sessionChanged) {
      mangaPanelSession.context =
        nextSessionItems.slice(-10);
      mangaPanelSession.lastUsedAt =
        Date.now();
      notifyMangaSessionInspectorRefresh();
    }
  }
}

async function submitOverlayTranslationCorrection(
  correction
) {
  await ensureAuthenticated();

  const profile =
    await ensureActiveTranslationProfile();

  const sourceText =
    normalizeTranslationText(
      correction?.sourceText
    );

  const aiTranslation =
    String(
      correction?.aiTranslation || ""
    ).trim();

  const correctedTranslation =
    String(
      correction?.correctedTranslation || ""
    ).trim();

  if (!sourceText) {
    throw new Error(
      "Không có văn bản nguồn để lưu bản sửa."
    );
  }

  if (!aiTranslation) {
    throw new Error(
      "Không có bản dịch hiện tại để so sánh."
    );
  }

  if (!correctedTranslation) {
    throw new Error(
      "Bản sửa không được để trống."
    );
  }

  if (
    aiTranslation ===
    correctedTranslation
  ) {
    return {
      success: true,
      unchanged: true,
      memoryUpdated: false,
      correctedTranslation,
    };
  }

  const sourceLanguage =
    normalizeTranslationSourceLanguage(
      correction?.sourceLanguage
    );

  const targetLanguage =
    normalizeTranslationTargetLanguage(
      correction?.targetLanguage
    );

  const profileId =
    correction?.profileId ??
    profile?.id ??
    null;

  const response =
    await authorizedBackendFetch(
      BACKEND_TRANSLATION_FEEDBACK_URL,
      {
        method: "POST",
        timeoutMs:
          BACKEND_TIMEOUT_MS,
        headers: {
          "Content-Type":
            "application/json; charset=utf-8",
          Accept:
            "application/json",
        },
        body:
          JSON.stringify({
            profileId,
            sourceText,
            aiTranslation,
            correctedTranslation,
            sourceLanguage,
            targetLanguage,
            provider:
              String(
                correction?.provider || ""
              ).trim() || null,
            model:
              String(
                correction?.model || ""
              ).trim() || null,
            requestId:
              String(
                correction?.requestId || ""
              ).trim() || null,
            allowModelImprovement:
              false,
          }),
      }
    );

  const payload =
    await parseBackendJson(
      response
    );

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      `Lưu bản sửa lỗi HTTP ${response.status}.`
    );
  }

  await applyOverlayCorrectionLocally({
    ...correction,
    profileId,
    sourceText,
    sourceLanguage,
    targetLanguage,
    correctedTranslation,
  });

  updateFullScreenOverlayItemText(
    correction?.itemId,
    correctedTranslation,
    {
      source: "PERSONAL_MEMORY",
    }
  );

  return {
    ...payload,
    success:
      payload?.success !== false,
    correctedTranslation,
  };
}

async function translateWithCache(
  originalText,
  options = {}
) {
  await ensureAuthenticated();

  const normalizedText =
    normalizeTranslationText(
      originalText
    );

  if (!normalizedText) {
    return {
      original: "",
      vietnamese: "",
    };
  }

  const profile =
    activeTranslationProfile;

  const sourceLanguage =
    normalizeTranslationSourceLanguage(
      options?.sourceLanguage ??
      currentTranslationSourceLanguage
    );

  const targetLanguage =
    normalizeTranslationTargetLanguage(
      options?.targetLanguage ??
      currentTranslationTargetLanguage
    );

  const context =
    getCurrentTranslationContext(
      profile,
      sourceLanguage,
      targetLanguage
    );

  const cacheKey =
    createTranslationCacheKey(
      normalizedText,
      profile,
      context,
      sourceLanguage,
      targetLanguage
    );

  const cached =
    translationCache.get(
      cacheKey
    );

  if (cached) {
    translationCache.delete(
      cacheKey
    );

    translationCache.set(
      cacheKey,
      cached
    );

    console.log(
      "TRANSLATION CACHE HIT"
    );

    rememberTranslationContext(
      profile,
      cached,
      sourceLanguage,
      targetLanguage
    );

    return cached;
  }

  const pending =
    translationInFlight.get(
      cacheKey
    );

  if (pending) {
    console.log(
      "TRANSLATION REQUEST REUSED"
    );

    return pending;
  }

  console.log(
    "TRANSLATION CACHE MISS"
  );

  const translationPromise =
    translateText(
      normalizedText,
      profile,
      context,
      sourceLanguage,
      targetLanguage
    )
    .then(
      async (result) => {
        const cacheValue = {
          original:
            normalizedText,

          translatedText:
            result.translatedText ||
            result.vietnamese ||
            "",

          vietnamese:
            result.translatedText ||
            result.vietnamese ||
            "",

          sourceLanguage,
          targetLanguage,

          profile:
            result.profile ||
            null,

          createdAt:
            Date.now(),
        };

        translationCache.set(
          cacheKey,
          cacheValue
        );

        limitTranslationCache();

        await saveTranslationCache();

        rememberTranslationContext(
          profile,
          cacheValue,
          sourceLanguage,
          targetLanguage
        );

        return cacheValue;
      }
    )
    .finally(() => {
      translationInFlight.delete(
        cacheKey
      );
    });

  translationInFlight.set(
    cacheKey,
    translationPromise
  );

  return translationPromise;
}

function rectMetrics(box) {
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
  };
}

function unionBoxes(leftBox, rightBox) {
  const left = rectMetrics(leftBox);
  const right = rectMetrics(rightBox);

  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  const rightEdge = Math.max(left.right, right.right);
  const bottomEdge = Math.max(left.bottom, right.bottom);

  return {
    x,
    y,
    width: rightEdge - x,
    height: bottomEdge - y,
  };
}

function overlapLength(aStart, aEnd, bStart, bEnd) {
  return Math.max(
    0,
    Math.min(aEnd, bEnd) -
      Math.max(aStart, bStart)
  );
}

function distanceBetweenRanges(aStart, aEnd, bStart, bEnd) {
  if (aEnd < bStart) {
    return bStart - aEnd;
  }

  if (bEnd < aStart) {
    return aStart - bEnd;
  }

  return 0;
}

function shouldMergeOcrBox(groupBox, entryBox) {
  const group = rectMetrics(groupBox);
  const entry = rectMetrics(entryBox);

  const xOverlap = overlapLength(
    group.x,
    group.right,
    entry.x,
    entry.right
  );

  const yOverlap = overlapLength(
    group.y,
    group.bottom,
    entry.y,
    entry.bottom
  );

  const xGap = distanceBetweenRanges(
    group.x,
    group.right,
    entry.x,
    entry.right
  );

  const yGap = distanceBetweenRanges(
    group.y,
    group.bottom,
    entry.y,
    entry.bottom
  );

  const minWidth = Math.max(
    1,
    Math.min(group.width, entry.width)
  );

  const minHeight = Math.max(
    1,
    Math.min(group.height, entry.height)
  );

  const horizontalOverlapRatio =
    xOverlap / minWidth;

  const verticalOverlapRatio =
    yOverlap / minHeight;

  const groupVertical =
    group.height > group.width * 1.25;

  const entryVertical =
    entry.height > entry.width * 1.25;

  /*
   * Manga Nhật thường được OCR thành nhiều cột dọc trong cùng bubble.
   * Gộp các cột nằm cạnh nhau khi chúng chồng nhau đáng kể theo trục Y.
   */
  const adjacentVerticalColumns =
    (groupVertical || entryVertical) &&
    verticalOverlapRatio >= 0.22 &&
    xGap <= Math.max(
      34,
      Math.min(group.height, entry.height) * 0.22
    );

  /*
   * Text ngang / nhiều dòng: gộp khi cùng cột và khoảng cách dọc nhỏ.
   */
  const adjacentHorizontalLines =
    horizontalOverlapRatio >= 0.28 &&
    yGap <= Math.max(
      30,
      Math.min(group.height, entry.height) * 0.75
    );

  return (
    adjacentVerticalColumns ||
    adjacentHorizontalLines
  );
}

function mergeNearbyBoxes(
  entries,
  options = {}
) {
  if (!entries.length) {
    return [];
  }

  const maxGroupWidth =
    Number.isFinite(Number(options.maxGroupWidth))
      ? Math.max(1, Number(options.maxGroupWidth))
      : Number.POSITIVE_INFINITY;

  const maxGroupHeight =
    Number.isFinite(Number(options.maxGroupHeight))
      ? Math.max(1, Number(options.maxGroupHeight))
      : Number.POSITIVE_INFINITY;

  const maxItems =
    Number.isFinite(Number(options.maxItems))
      ? Math.max(1, Math.round(Number(options.maxItems)))
      : 10;

  const groups = [];

  for (const entry of entries) {
    let bestGroup = null;
    let bestUnion = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const group of groups) {
      if (group.items.length >= maxItems) {
        continue;
      }

      if (!shouldMergeOcrBox(group.box, entry.box)) {
        continue;
      }

      const union = unionBoxes(
        group.box,
        entry.box
      );

      if (
        union.width > maxGroupWidth ||
        union.height > maxGroupHeight
      ) {
        continue;
      }

      const g = rectMetrics(group.box);
      const e = rectMetrics(entry.box);
      const distance = Math.hypot(
        g.centerX - e.centerX,
        g.centerY - e.centerY
      );

      if (distance < bestDistance) {
        bestDistance = distance;
        bestGroup = group;
        bestUnion = union;
      }
    }

    if (bestGroup) {
      bestGroup.items.push(entry);
      bestGroup.box = bestUnion;
    } else {
      groups.push({
        items: [entry],
        box: {
          ...entry.box,
        },
      });
    }
  }

  return groups.map((group) => {
    const verticalCount =
      group.items.filter(
        (item) =>
          Number(item.box.height) >
          Number(item.box.width) * 1.25
      ).length;

    const vertical =
      verticalCount >=
      Math.ceil(group.items.length / 2);

    const orderedItems = [
      ...group.items,
    ].sort((left, right) => {
      if (vertical) {
        const xDiff =
          Number(right.box.x) -
          Number(left.box.x);

        if (Math.abs(xDiff) > 12) {
          return xDiff;
        }

        return (
          Number(left.box.y) -
          Number(right.box.y)
        );
      }

      const yDiff =
        Number(left.box.y) -
        Number(right.box.y);

      if (Math.abs(yDiff) > 12) {
        return yDiff;
      }

      return (
        Number(left.box.x) -
        Number(right.box.x)
      );
    });

    return {
      originalLines:
        orderedItems.map(
          (item) => item.line
        ),

      score:
        orderedItems.reduce(
          (sum, item) =>
            sum + (Number(item.score) || 0),
          0
        ) /
        Math.max(1, orderedItems.length),

      vertical,
      itemCount: orderedItems.length,

      box: {
        ...group.box,
      },
    };
  });
}

function containsCjkText(text) {
  return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(
    String(text || "")
  );
}

function shouldUseJapaneseReadingOrder(
  sourceLanguage,
  entries = []
) {
  const normalized =
    normalizeTranslationSourceLanguage(
      sourceLanguage
    );

  if (normalized === "JA") {
    return true;
  }

  if (normalized !== "AUTO") {
    return false;
  }

  /*
   * AUTO mode: Hiragana/Katakana là tín hiệu mạnh đây là manga Nhật.
   * Nhờ vậy user không phải đổi AUTO -> JA chỉ để có reading order đúng.
   */
  return entries.some(
    (entry) =>
      /[\u3040-\u30ff]/u.test(
        String(
          entry?.line ||
          ""
        )
      )
  );
}

function isLikelyPanelNoise(
  entry,
  panelWidth,
  panelHeight
) {
  const text =
    String(entry?.line || "").trim();

  if (!text) {
    return true;
  }

  const compact =
    text.replace(/\s+/g, "");

  /* URL / watermark / page number thường không phải thoại manga. */
  if (
    /(?:https?:\/\/|www\.|\.(?:com|net|org|jp|io)\b)/iu.test(compact) ||
    /^\d{1,5}$/u.test(compact)
  ) {
    return true;
  }

  const score =
    Number(entry?.score || 0);

  if (
    score > 0 &&
    score < 0.30
  ) {
    return true;
  }

  const box =
    rectMetrics(entry?.box);

  const nearLeft =
    box.x < panelWidth * 0.12;

  const nearRight =
    box.right > panelWidth * 0.88;

  const tallMarginColumn =
    box.height > panelHeight * 0.48 &&
    box.width < panelWidth * 0.20 &&
    (nearLeft || nearRight);

  if (tallMarginColumn) {
    return true;
  }

  const nearBottom =
    box.y > panelHeight * 0.90;

  const mostlyAscii =
    /^[\x20-\x7e\s]+$/u.test(text);

  if (
    nearBottom &&
    mostlyAscii &&
    !containsCjkText(text)
  ) {
    return true;
  }

  return false;
}

async function buildFullScreenOcrBlocks(
  screenshotBuffer,
  ocrResult,
  sourceLanguage
) {
  const metadata =
    await sharp(
      screenshotBuffer
    ).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(
      "Không đọc được kích thước full-screen screenshot."
    );
  }

  const display =
    screen.getPrimaryDisplay();

  const scaleX =
    metadata.width /
    Math.max(
      1,
      display.bounds.width
    );

  const scaleY =
    metadata.height /
    Math.max(
      1,
      display.bounds.height
    );

  const entries = [];

  const lines =
    Array.isArray(ocrResult?.lines)
      ? ocrResult.lines
      : [];

  const scores =
    Array.isArray(ocrResult?.scores)
      ? ocrResult.scores
      : [];

  const boxes =
    Array.isArray(ocrResult?.boxes)
      ? ocrResult.boxes
      : [];

  for (
    let index = 0;
    index < lines.length;
    index++
  ) {
    const line =
      String(
        lines[index] || ""
      ).trim();

    const box =
      boxes[index];

    if (!line || !box) {
      continue;
    }

    const x =
      Number(box.x);
    const y =
      Number(box.y);
    const width =
      Number(box.width);
    const height =
      Number(box.height);

    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) {
      continue;
    }

    entries.push({
      line,
      score:
        Number(
          scores[index] || 0
        ),
      box: {
        x,
        y,
        width,
        height,
      },
    });
  }

  entries.sort(
    (left, right) => {
      const rowTolerance =
        Math.max(
          24,
          Math.min(
            80,
            Math.max(
              left.box.height,
              right.box.height
            ) * 1.25
          )
        );

      if (
        Math.abs(
          left.box.y -
          right.box.y
        ) <= rowTolerance
      ) {
        const japaneseOrder =
          normalizeTranslationSourceLanguage(
            sourceLanguage
          ) === "JA";

        return japaneseOrder
          ? right.box.x - left.box.x
          : left.box.x - right.box.x;
      }

      return (
        left.box.y -
        right.box.y
      );
    }
  );

  const merged =
    mergeNearbyBoxes(
      entries
    );

  merged.sort(
    (left, right) => {
      const rowTolerance =
        Math.max(
          30,
          Math.min(
            100,
            Math.max(
              left.box.height,
              right.box.height
            )
          )
        );

      if (
        Math.abs(
          left.box.y -
          right.box.y
        ) <= rowTolerance
      ) {
        const japaneseOrder =
          normalizeTranslationSourceLanguage(
            sourceLanguage
          ) === "JA";

        return japaneseOrder
          ? right.box.x - left.box.x
          : left.box.x - right.box.x;
      }

      return (
        left.box.y -
        right.box.y
      );
    }
  );

  if (merged.length > 80) {
    throw new Error(
      `Màn hình có ${merged.length} vùng chữ. ` +
      "Batch hiện giới hạn 80 vùng; hãy dùng chọn vùng hoặc giảm nội dung hiển thị."
    );
  }

  const blocks =
    merged
      .map(
        (group, index) => {
          const text =
            group.originalLines
              .map((line) =>
                String(line || "").trim()
              )
              .filter(Boolean)
              .join("\n");

          const physicalBox = {
            x:
              Number(group.box.x),
            y:
              Number(group.box.y),
            width:
              Number(group.box.width),
            height:
              Number(group.box.height),
          };

          const logicalBox = {
            x:
              Math.round(
                display.bounds.x +
                physicalBox.x / scaleX
              ),
            y:
              Math.round(
                display.bounds.y +
                physicalBox.y / scaleY
              ),
            width:
              Math.max(
                1,
                Math.round(
                  physicalBox.width /
                  scaleX
                )
              ),
            height:
              Math.max(
                1,
                Math.round(
                  physicalBox.height /
                  scaleY
                )
              ),
          };

          return {
            id:
              `screen-${index + 1}`,
            order:
              index,
            text,
            physicalBox,
            logicalBox,
          };
        }
      )
      .filter(
        (block) =>
          block.text
      );

  return {
    blocks,
    display: {
      id:
        display.id,
      bounds:
        display.bounds,
      scaleFactor:
        display.scaleFactor,
      screenshotWidth:
        metadata.width,
      screenshotHeight:
        metadata.height,
      scaleX,
      scaleY,
    },
  };
}


async function buildPanelOcrBlocks(
  cropResult,
  ocrResult,
  sourceLanguage
) {
  const display =
    screen.getPrimaryDisplay();

  const scaleX =
    Math.max(
      0.0001,
      Number(
        cropResult?.scaleX
      ) || 1
    );

  const scaleY =
    Math.max(
      0.0001,
      Number(
        cropResult?.scaleY
      ) || 1
    );

  const cropLeft =
    Number(
      cropResult
        ?.physicalCrop
        ?.left
    ) || 0;

  const cropTop =
    Number(
      cropResult
        ?.physicalCrop
        ?.top
    ) || 0;

  const entries = [];

  const lines =
    Array.isArray(
      ocrResult?.lines
    )
      ? ocrResult.lines
      : [];

  const scores =
    Array.isArray(
      ocrResult?.scores
    )
      ? ocrResult.scores
      : [];

  const boxes =
    Array.isArray(
      ocrResult?.boxes
    )
      ? ocrResult.boxes
      : [];

  for (
    let index = 0;
    index < lines.length;
    index++
  ) {
    const line =
      String(
        lines[index] || ""
      ).trim();

    const box =
      boxes[index];

    if (!line || !box) {
      continue;
    }

    const x =
      Number(box.x);
    const y =
      Number(box.y);
    const width =
      Number(box.width);
    const height =
      Number(box.height);

    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) {
      continue;
    }

    entries.push({
      ocrIndex:
        index,
      line,
      score:
        Number(
          scores[index] || 0
        ),
      box: {
        x,
        y,
        width,
        height,
      },
    });
  }

  const panelPhysicalWidth =
    Math.max(
      1,
      Number(
        cropResult
          ?.physicalCrop
          ?.width
      ) ||
      Number(
        cropResult
          ?.physicalCrop
          ?.right
      ) - cropLeft ||
      1
    );

  const panelPhysicalHeight =
    Math.max(
      1,
      Number(
        cropResult
          ?.physicalCrop
          ?.height
      ) ||
      Number(
        cropResult
          ?.physicalCrop
          ?.bottom
      ) - cropTop ||
      1
    );

  const filteredEntries =
    entries.filter(
      (entry) =>
        !isLikelyPanelNoise(
          entry,
          panelPhysicalWidth,
          panelPhysicalHeight
        )
    );

  const japaneseReadingOrder =
    shouldUseJapaneseReadingOrder(
      sourceLanguage,
      filteredEntries
    );

  filteredEntries.sort(
    (left, right) => {
      const rowTolerance =
        Math.max(
          24,
          Math.min(
            80,
            Math.max(
              left.box.height,
              right.box.height
            ) * 1.25
          )
        );

      if (
        Math.abs(
          left.box.y -
          right.box.y
        ) <= rowTolerance
      ) {
        return japaneseReadingOrder
          ? right.box.x -
              left.box.x
          : left.box.x -
              right.box.x;
      }

      return (
        left.box.y -
        right.box.y
      );
    }
  );

  const mergeOptions = {
    /*
     * Fallback của Smart OCR Grouping.
     * Chặn chain-merge chạy suốt mép trang.
     */
    maxGroupWidth:
      Math.max(
        120,
        panelPhysicalWidth * 0.42
      ),

    maxGroupHeight:
      Math.max(
        150,
        panelPhysicalHeight * 0.36
      ),

    maxItems: 8,
  };

  function groupDetectedBubble(
    detected
  ) {
    const items =
      Array.isArray(
        detected?.entries
      )
        ? [...detected.entries]
        : [];

    const verticalCount =
      items.filter(
        (item) =>
          Number(item.box.height) >
          Number(item.box.width) * 1.25
      ).length;

    const vertical =
      verticalCount >=
      Math.ceil(
        items.length / 2
      );

    const orderedItems =
      items.sort(
        (left, right) => {
          if (vertical) {
            const xDiff =
              Number(
                right.box.x
              ) -
              Number(
                left.box.x
              );

            if (
              Math.abs(xDiff) > 12
            ) {
              return japaneseReadingOrder
                ? xDiff
                : -xDiff;
            }

            return (
              Number(
                left.box.y
              ) -
              Number(
                right.box.y
              )
            );
          }

          const yDiff =
            Number(
              left.box.y
            ) -
            Number(
              right.box.y
            );

          if (
            Math.abs(yDiff) > 12
          ) {
            return yDiff;
          }

          return (
            Number(
              left.box.x
            ) -
            Number(
              right.box.x
            )
          );
        }
      );

    return {
      originalLines:
        orderedItems.map(
          (item) =>
            item.line
        ),

      score:
        orderedItems.reduce(
          (sum, item) =>
            sum +
            (Number(item.score) || 0),
          0
        ) /
        Math.max(
          1,
          orderedItems.length
        ),

      vertical,
      itemCount:
        orderedItems.length,

      box: {
        ...detected.box,
      },

      detectionSource:
        "SPEECH_BUBBLE",

      bubbleConfidence:
        Number(
          detected.confidence || 0
        ),
    };
  }

  let bubbleDetection = {
    groups: [],
    unassignedEntries:
      filteredEntries,
    diagnostics: {
      enabled: true,
      reliable: false,
      candidateCount: 0,
      bubbleCount: 0,
      assignedCount: 0,
      totalEntries:
        filteredEntries.length,
      coverage: 0,
    },
  };

  try {
    bubbleDetection =
      await detectMangaSpeechBubbles({
        imagePath:
          cropResult?.imagePath,
        entries:
          filteredEntries,
      });
  } catch (error) {
    console.warn(
      "MANGA BUBBLE DETECTOR FALLBACK:",
      error instanceof Error
        ? error.message
        : String(error)
    );
  }

  const detectedGroups =
    Array.isArray(
      bubbleDetection?.groups
    )
      ? bubbleDetection.groups
          .map(
            groupDetectedBubble
          )
          .filter(
            (group) =>
              group.originalLines.length
          )
      : [];

  const fallbackEntries =
    detectedGroups.length
      ? (
          Array.isArray(
            bubbleDetection
              ?.unassignedEntries
          )
            ? bubbleDetection
                .unassignedEntries
            : []
        )
      : filteredEntries;

  const fallbackGroups =
    mergeNearbyBoxes(
      fallbackEntries,
      mergeOptions
    ).map(
      (group) => ({
        ...group,
        detectionSource:
          "OCR_GROUP",
        bubbleConfidence:
          0,
      })
    );

  const merged = [
    ...detectedGroups,
    ...fallbackGroups,
  ];

  console.log(
    "MANGA BUBBLE DETECTION:",
    {
      ...bubbleDetection
        ?.diagnostics,
      used:
        detectedGroups.length > 0,
      detectedGroups:
        detectedGroups.length,
      fallbackGroups:
        fallbackGroups.length,
      finalGroups:
        merged.length,
    }
  );

  merged.sort(
    (left, right) => {
      const rowTolerance =
        Math.max(
          30,
          Math.min(
            100,
            Math.max(
              left.box.height,
              right.box.height
            )
          )
        );

      if (
        Math.abs(
          left.box.y -
          right.box.y
        ) <= rowTolerance
      ) {
        return japaneseReadingOrder
          ? right.box.x -
              left.box.x
          : left.box.x -
              right.box.x;
      }

      return (
        left.box.y -
        right.box.y
      );
    }
  );

  if (merged.length > 50) {
    throw new Error(
      `Khung truyện có ${merged.length} vùng chữ. ` +
      "Hãy chọn một khung/trang truyện nhỏ hơn."
    );
  }

  function panelBoxToLogicalBox(
    inputBox
  ) {
    const box = {
      x:
        Number(
          inputBox?.x
        ) || 0,
      y:
        Number(
          inputBox?.y
        ) || 0,
      width:
        Math.max(
          1,
          Number(
            inputBox?.width
          ) || 1
        ),
      height:
        Math.max(
          1,
          Number(
            inputBox?.height
          ) || 1
        ),
    };

    return {
      x:
        Math.round(
          display.bounds.x +
          (
            cropLeft +
            box.x
          ) /
            scaleX
        ),
      y:
        Math.round(
          display.bounds.y +
          (
            cropTop +
            box.y
          ) /
            scaleY
        ),
      width:
        Math.max(
          1,
          Math.round(
            box.width /
            scaleX
          )
        ),
      height:
        Math.max(
          1,
          Math.round(
            box.height /
            scaleY
          )
        ),
    };
  }

  const filteredOcrIndexes =
    new Set(
      filteredEntries.map(
        (entry) =>
          entry.ocrIndex
      )
    );

  /*
   * Batch 09.1: giữ geometry chẩn đoán riêng khỏi translation blocks.
   * Debug overlay chỉ dùng để nhìn detector, không thay đổi OCR/AI payload.
   */
  const debugGeometry = {
    diagnostics: {
      ...bubbleDetection
        ?.diagnostics,
      used:
        detectedGroups.length > 0,
      detectedGroups:
        detectedGroups.length,
      fallbackGroups:
        fallbackGroups.length,
      finalGroups:
        merged.length,
    },

    ocrBoxes:
      filteredEntries.map(
        (entry, index) => ({
          id:
            `ocr-${index + 1}`,
          text:
            String(
              entry.line ||
              ""
            ),
          score:
            Number(
              entry.score || 0
            ),
          logicalBox:
            panelBoxToLogicalBox(
              entry.box
            ),
        })
      ),

    ignoredOcrBoxes:
      entries
        .filter(
          (entry) =>
            !filteredOcrIndexes.has(
              entry.ocrIndex
            )
        )
        .map(
          (entry, index) => ({
            id:
              `ignored-${index + 1}`,
            text:
              String(
                entry.line ||
                ""
              ),
            score:
              Number(
                entry.score || 0
              ),
            logicalBox:
              panelBoxToLogicalBox(
                entry.box
              ),
          })
        ),

    speechBubbles:
      detectedGroups.map(
        (group, index) => ({
          id:
            `bubble-${index + 1}`,
          confidence:
            Number(
              group
                .bubbleConfidence ||
              0
            ),
          logicalBox:
            panelBoxToLogicalBox(
              group.box
            ),
        })
      ),

    fallbackGroups:
      fallbackGroups.map(
        (group, index) => ({
          id:
            `fallback-${index + 1}`,
          logicalBox:
            panelBoxToLogicalBox(
              group.box
            ),
        })
      ),
  };

  const blocks =
    merged
      .map(
        (group, index) => {
          const text =
            group.originalLines
              .map(
                (line) =>
                  String(
                    line || ""
                  ).trim()
              )
              .filter(Boolean)
              .join("\n");

          const relativePhysicalBox = {
            x:
              Number(
                group.box.x
              ),
            y:
              Number(
                group.box.y
              ),
            width:
              Number(
                group.box.width
              ),
            height:
              Number(
                group.box.height
              ),
          };

          const physicalBox = {
            x:
              cropLeft +
              relativePhysicalBox.x,
            y:
              cropTop +
              relativePhysicalBox.y,
            width:
              relativePhysicalBox.width,
            height:
              relativePhysicalBox.height,
          };

          const logicalBox = {
            x:
              Math.round(
                display.bounds.x +
                physicalBox.x /
                  scaleX
              ),
            y:
              Math.round(
                display.bounds.y +
                physicalBox.y /
                  scaleY
              ),
            width:
              Math.max(
                1,
                Math.round(
                  physicalBox.width /
                    scaleX
                )
              ),
            height:
              Math.max(
                1,
                Math.round(
                  physicalBox.height /
                    scaleY
                )
              ),
          };

          return {
            id:
              `panel-${index + 1}`,
            order:
              index,
            text,
            physicalBox,
            logicalBox,
            verticalSource:
              Boolean(
                group.vertical
              ),
            detectionSource:
              group
                .detectionSource ||
              "OCR_GROUP",
            bubbleConfidence:
              Number(
                group
                  .bubbleConfidence ||
                0
              ),
          };
        }
      )
      .filter(
        (block) =>
          block.text
      );

  return {
    blocks,

    display: {
      id:
        display.id,
      bounds:
        display.bounds,
      scaleFactor:
        display.scaleFactor,
      scaleX,
      scaleY,
    },

    viewportBounds: {
      ...cropResult
        .logicalSelection,
    },

    debugGeometry,

    bubbleDetection: {
      ...bubbleDetection
        ?.diagnostics,
      used:
        detectedGroups.length > 0,
      detectedGroups:
        detectedGroups.length,
      fallbackGroups:
        fallbackGroups.length,
      finalGroups:
        blocks.length,
    },
  };
}

async function processMangaPanelTranslation({
  cropResult,
  ocrResult,
  loadingToken = null,
  sourceLanguage =
    currentTranslationSourceLanguage,
  targetLanguage =
    currentTranslationTargetLanguage,
  targetWindow = null,
  startNewSession = false,
} = {}) {
  await requireFreshDesktopFeatureCapability(
    startNewSession
      ? "mangaPanel"
      : "mangaSession",
    { notify: false }
  );

  const panelStartedAt =
    performance.now();

  const profile =
    await ensureActiveTranslationProfile();

  const source =
    normalizeTranslationSourceLanguage(
      sourceLanguage
    );

  const target =
    normalizeTranslationTargetLanguage(
      targetLanguage
    );

  if (startNewSession) {
    beginMangaPanelSession({
      selection:
        cropResult?.logicalSelection,
      profile,
      sourceLanguage:
        source,
      targetLanguage:
        target,
      targetWindow,
    });
  } else {
    ensureMangaPanelSessionCompatible(
      profile,
      source,
      target
    );
  }

  if (loadingToken != null) {
    updateTranslationLoading(
      loadingToken,
      {
        message:
          "Đang nhận diện speech bubble…",
        detail:
          `Manga Session · Trang ${Math.max(1, (mangaPanelSession?.pageNumber || 0) + 1)}`,
      }
    );
  }

  const layout =
    await buildPanelOcrBlocks(
      cropResult,
      ocrResult,
      source
    );

  if (!layout.blocks.length) {
    throw new Error(
      "Không tìm thấy vùng chữ trong khung truyện đã chọn."
    );
  }

  if (loadingToken != null) {
    updateTranslationLoading(
      loadingToken,
      {
        message:
          `Đang dịch ${layout.blocks.length} khung chữ…`,
        detail:
          `${source} → ${target} · Session context ${getMangaPanelSessionContext().length}/10`,
      }
    );
  }

  const batch =
    await translateBatchBlocks(
      layout.blocks.map(
        (block) => ({
          id:
            block.id,
          text:
            block.text,
        })
      ),
      {
        purpose:
          "MANGA",
        sourceLanguage:
          source,
        targetLanguage:
          target,
        context:
          getMangaPanelSessionContext(),
      }
    );

  const translatedById =
    new Map(
      batch.translations.map(
        (item) => [
          String(item.id),
          item,
        ]
      )
    );

  const translatedBlocks =
    layout.blocks.map(
      (block) => {
        const translated =
          translatedById.get(
            block.id
          );

        if (!translated) {
          throw new Error(
            `Backend thiếu bản dịch cho ${block.id}.`
          );
        }

        const translatedText =
          translated.translatedText ||
          translated.vietnamese ||
          "";

        const result = {
          ...block,
          original:
            block.text,
          translatedText,
          vietnamese:
            translatedText,
          source:
            translated.source ||
            "AI",
        };

        rememberTranslationContext(
          profile,
          {
            original:
              block.text,
            translatedText,
            vietnamese:
              translatedText,
          },
          source,
          target
        );

        rememberMangaPanelSessionContext(
          {
            original:
              block.text,
            translatedText,
            vietnamese:
              translatedText,
          }
        );

        return result;
      }
    );

  const sessionState =
    completeMangaPanelSessionPage(
      targetWindow
    );

  if (loadingToken != null) {
    updateTranslationLoading(
      loadingToken,
      {
        message:
          "Đang dựng khung dịch…",
        detail:
          `Trang ${sessionState?.pageNumber || 1} · ${translatedBlocks.length} vùng · Overlay`,
      }
    );
  }

  const overlayResult =
    showFullScreenTranslationOverlay({
      display:
        layout.display,
      viewportBounds:
        layout.viewportBounds,
      debugGeometry:
        layout.debugGeometry,
      blocks:
        translatedBlocks,
      sourceLanguage:
        source,
      targetLanguage:
        target,
      profileId:
        batch.profile?.id ??
        profile?.id ??
        null,
      ai:
        batch.ai ||
        null,
      mode:
        "panel",
      session:
        sessionState,
    });

  if (
    overlayResult?.success
  ) {
    startOverlayLifecycle(
      targetWindow
    );
  }

  const memoryHits =
    Number(
      batch.summary
        ?.memoryHits ||
      0
    );

  const aiBlocks =
    Number(
      batch.summary
        ?.aiBlocks ||
      0
    );

  const aggregateOriginal =
    translatedBlocks
      .map(
        (block) =>
          block.original
      )
      .filter(Boolean)
      .join("\n\n");

  const aggregateTranslation =
    translatedBlocks
      .map(
        (block) =>
          block.translatedText
      )
      .filter(Boolean)
      .join("\n\n");

  const panelResult = {
    success: true,
    mode:
      "panel",

    session:
      sessionState,

    ocr: {
      ...ocrResult,
      blockCount:
        translatedBlocks.length,
      bubbleDetection:
        layout.bubbleDetection,
    },

    blocks:
      translatedBlocks,

    translation: {
      original:
        aggregateOriginal,
      translatedText:
        aggregateTranslation,
      vietnamese:
        aggregateTranslation,

      profile:
        batch.profile ||
        null,

      ai:
        batch.ai ||
        null,

      performance:
        batch.performance ||
        null,
    },

    batch: {
      profile:
        batch.profile ||
        null,
      ai:
        batch.ai ||
        null,
      summary:
        batch.summary ||
        null,
      performance:
        batch.performance ||
        null,
    },

    overlay: {
      visible:
        Boolean(
          overlayResult?.success
        ),
      blockCount:
        translatedBlocks.length,
    },

    performance: {
      totalMs:
        Math.round(
          performance.now() -
          panelStartedAt
        ),
    },
  };

  sendToMainWindow(
    "scan-result",
    panelResult
  );

  console.log(
    "PANEL TRANSLATION READY:",
    {
      sessionId:
        sessionState?.id,
      pageNumber:
        sessionState?.pageNumber,
      contextItems:
        sessionState?.contextItems,
      blocks:
        translatedBlocks.length,
      memoryHits,
      aiBlocks,
      overlay:
        Boolean(
          overlayResult?.success
        ),
    }
  );

  return panelResult;
}

async function runMangaSessionNextPage(
  source = "shortcut"
) {
  console.log(
    "MANGA SESSION NEXT PAGE TRIGGER:",
    {
      source,
      session:
        getMangaPanelSessionState(),
    }
  );

  if (
    selectorIsOpen ||
    isProcessingSelection ||
    isFullScreenProcessing ||
    isMangaSessionProcessing
  ) {
    throw new Error(
      "AI Translator đang xử lý một lần quét khác."
    );
  }

  await ensureAuthenticated();
  ensureWorkspaceScanAllowed();
  await requireFreshDesktopFeatureCapability(
    "mangaSession"
  );

  const profile =
    await ensureActiveTranslationProfile();

  const sourceLanguage =
    normalizeTranslationSourceLanguage(
      currentTranslationSourceLanguage
    );

  const targetLanguage =
    normalizeTranslationTargetLanguage(
      currentTranslationTargetLanguage
    );

  const session =
    ensureMangaPanelSessionCompatible(
      profile,
      sourceLanguage,
      targetLanguage
    );

  const selection = {
    ...session.selection,
  };

  const nextPageNumber =
    session.pageNumber + 1;

  const mainWasVisible =
    Boolean(
      mainWindow &&
      !mainWindow.isDestroyed() &&
      mainWindow.isVisible()
    );

  let loadingToken = null;

  isMangaSessionProcessing = true;

  try {
    stopOverlayLifecycle();
    hideSelectionTranslation();
    hideFullScreenTranslationOverlay();
    closeOverlay();

    if (
      mainWindow &&
      !mainWindow.isDestroyed()
    ) {
      mainWindow.hide();
    }

    /*
     * Không hiện Loading trước screenshot để OCR không bắt nhầm HUD.
     */
    await delay(220);

    pendingTargetWindow =
      await waitForExternalForegroundSnapshot(
        900
      ) ||
      session.targetWindow ||
      null;

    const screenshotBuffer =
      await screenshot({
        format: "png",
      });

    loadingToken =
      showTranslationLoading({
        mode: "panel",
        selection,
        message:
          `Đang quét trang ${nextPageNumber}…`,
        detail:
          `Manga Session · ${shortcutDisplay(shortcutSettings.panelNext)}`,
      });

    const cropResult =
      await cropSelectedArea(
        selection,
        screenshotBuffer,
        {
          padding: 8,
        }
      );

    updateTranslationLoading(
      loadingToken,
      {
        message:
          `Đang nhận diện chữ trang ${nextPageNumber}…`,
        detail:
          "OCR · PaddleOCR · vùng quét đã lưu",
      }
    );

    const ocrStartedAt =
      performance.now();

    const rawOcrResult =
      await requestOcr(
        cropResult.imagePath
      );

    const ocrResult =
      cleanOcrResult(
        rawOcrResult
      );

    console.log(
      "MANGA SESSION OCR TIME:",
      `${Math.round(performance.now() - ocrStartedAt)}ms`
    );

    const panelResult =
      await processMangaPanelTranslation({
        cropResult,
        ocrResult,
        loadingToken,
        sourceLanguage,
        targetLanguage,
        targetWindow:
          pendingTargetWindow,
        startNewSession: false,
      });

    closeTranslationLoading(
      loadingToken
    );
    loadingToken = null;

    markMangaContinuousPageTranslated();

    return {
      success: true,
      mode: "panel-next",
      session:
        panelResult.session ||
        getMangaPanelSessionState(),
    };
  } catch (error) {
    console.error(
      "MANGA SESSION NEXT PAGE ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    if (loadingToken != null) {
      updateTranslationLoading(
        loadingToken,
        {
          message:
            `Không thể dịch trang ${nextPageNumber}`,
          detail:
            message,
        }
      );

      await delay(1200);

      closeTranslationLoading(
        loadingToken
      );
      loadingToken = null;
    }

    sendToMainWindow(
      "scan-result",
      {
        success: false,
        mode: "panel",
        session:
          getMangaPanelSessionState(),
        error:
          message,
      }
    );

    if (
      mainWasVisible &&
      mainWindow &&
      !mainWindow.isDestroyed()
    ) {
      mainWindow.show();
      mainWindow.focus();
    }

    return {
      success: false,
      mode: "panel-next",
      session:
        getMangaPanelSessionState(),
      error:
        message,
    };
  } finally {
    isMangaSessionProcessing = false;
  }
}

async function runFullScreenTranslation(
  options = {}
) {
  if (
    isFullScreenProcessing ||
    isMangaSessionProcessing
  ) {
    throw new Error(
      isMangaSessionProcessing
        ? "Manga Session đang xử lý trang tiếp theo."
        : "Full Screen Translation đang xử lý."
    );
  }

  await ensureAuthenticated();
  ensureWorkspaceScanAllowed();

  await ensureActiveTranslationProfile();

  setTranslationLanguages(
    options
  );

  isFullScreenProcessing = true;

  let fullScreenOverlayShown =
    false;

  let loadingToken =
    null;

  const startedAt =
    performance.now();

  try {
    stopOverlayLifecycle();
    hideSelectionTranslation();
    closeFullScreenTranslationOverlay();
    closeOverlay();

    if (
      mainWindow &&
      !mainWindow.isDestroyed()
    ) {
      mainWindow.hide();
    }

    await delay(300);

    pendingTargetWindow =
      await waitForExternalForegroundSnapshot(
        1000
      );

    const screenshotBuffer =
      await screenshot({
        format: "png",
      });

    const imagePath =
      path.join(
        getRuntimeDirectory(),
        "full-screen.png"
      );

    await fs.writeFile(
      imagePath,
      screenshotBuffer
    );

    loadingToken =
      showTranslationLoading({
        mode: "full-screen",
        displayId:
          screen.getPrimaryDisplay().id,
        message:
          "Đang nhận diện chữ toàn màn hình…",
        detail:
          "OCR · PaddleOCR",
      });

    const ocrStartedAt =
      performance.now();

    const rawOcrResult =
      await requestOcr(
        imagePath
      );

    const ocrResult =
      cleanOcrResult(
        rawOcrResult
      );

    const ocrMs =
      Math.round(
        performance.now() -
        ocrStartedAt
      );

    const layout =
      await buildFullScreenOcrBlocks(
        screenshotBuffer,
        ocrResult,
        currentTranslationSourceLanguage
      );

    if (!layout.blocks.length) {
      throw new Error(
        "Không tìm thấy vùng chữ đủ độ tin cậy trên màn hình."
      );
    }

    updateTranslationLoading(
      loadingToken,
      {
        message:
          `Đang dịch ${layout.blocks.length} vùng chữ…`,
        detail:
          `${currentTranslationSourceLanguage} → ${currentTranslationTargetLanguage} · Batch AI`,
      }
    );

    const translateStartedAt =
      performance.now();

    const batch =
      await translateBatchBlocks(
        layout.blocks.map(
          (block) => ({
            id:
              block.id,
            text:
              block.text,
          })
        ),
        {
          sourceLanguage:
            currentTranslationSourceLanguage,
          targetLanguage:
            currentTranslationTargetLanguage,
        }
      );

    const translateMs =
      Math.round(
        performance.now() -
        translateStartedAt
      );

    const translatedById =
      new Map(
        batch.translations.map(
          (item) => [
            String(item.id),
            item,
          ]
        )
      );

    const translatedBlocks =
      layout.blocks.map(
        (block) => {
          const translated =
            translatedById.get(
              block.id
            );

          if (!translated) {
            throw new Error(
              `Backend thiếu bản dịch cho ${block.id}.`
            );
          }

          const translatedText =
            translated.translatedText ||
            translated.vietnamese ||
            "";

          const result = {
            ...block,
            original:
              block.text,
            translatedText,
            vietnamese:
              translatedText,
            source:
              translated.source ||
              "AI",
          };

          rememberTranslationContext(
            activeTranslationProfile,
            {
              original:
                block.text,
              translatedText,
              vietnamese:
                translatedText,
            },
            currentTranslationSourceLanguage,
            currentTranslationTargetLanguage
          );

          return result;
        }
      );

    const result = {
      success: true,
      mode:
        "full-screen",
      sourceLanguage:
        currentTranslationSourceLanguage,
      targetLanguage:
        currentTranslationTargetLanguage,
      display:
        layout.display,
      ocr: {
        ...ocrResult,
        blockCount:
          translatedBlocks.length,
      },
      blocks:
        translatedBlocks,
      batch: {
        profile:
          batch.profile ||
          null,
        ai:
          batch.ai ||
          null,
        summary:
          batch.summary ||
          null,
        performance:
          batch.performance ||
          null,
      },
      performance: {
        ocrMs,
        translateMs,
        totalMs:
          Math.round(
            performance.now() -
            startedAt
          ),
      },

      overlay: {
        visible:
          true,
        blockCount:
          translatedBlocks.length,
      },
    };

    updateTranslationLoading(
      loadingToken,
      {
        message:
          "Đang dựng các khung dịch…",
        detail:
          `${translatedBlocks.length} vùng · Overlay`,
      }
    );

    const overlayResult =
      showFullScreenTranslationOverlay({
        display:
          layout.display,
        blocks:
          translatedBlocks,
        sourceLanguage:
          currentTranslationSourceLanguage,
        targetLanguage:
          currentTranslationTargetLanguage,
        profileId:
          batch.profile?.id ??
          activeTranslationProfile?.id ??
          null,
        ai:
          batch.ai ||
          null,
      });

    fullScreenOverlayShown =
      Boolean(
        overlayResult?.success
      );

    result.overlay = {
      visible:
        fullScreenOverlayShown,

      blockCount:
        Number(
          overlayResult?.blockCount ||
          translatedBlocks.length
        ),
    };

    if (
      fullScreenOverlayShown
    ) {
      startOverlayLifecycle(
        pendingTargetWindow
      );
    }

    console.log(
      "FULL SCREEN TRANSLATION READY:",
      {
        blocks:
          translatedBlocks.length,
        memoryHits:
          batch.summary?.memoryHits ||
          0,
        aiBlocks:
          batch.summary?.aiBlocks ||
          0,
        ocrMs,
        translateMs,
        totalMs:
          result.performance.totalMs,
      }
    );

    return result;
  } finally {
    if (loadingToken != null) {
      closeTranslationLoading(
        loadingToken
      );
    }

    isFullScreenProcessing = false;

    if (
      !fullScreenOverlayShown &&
      mainWindow &&
      !mainWindow.isDestroyed()
    ) {
      mainWindow.show();
      mainWindow.focus();
    }
  }
}

function rejectAllOcrRequests(error) {
  for (const pending of pendingOcrRequests.values()) {
    clearTimeout(pending.timeout);

    pending.reject(error);
  }

  pendingOcrRequests.clear();
}

function handleOcrWorkerMessage(line) {
  if (!line.startsWith(OCR_OUTPUT_MARKER)) {
    /*
     * Đây là log thường từ PaddleOCR.
     */
    console.log("OCR WORKER LOG:", line);

    return;
  }

  const jsonText = line.slice(OCR_OUTPUT_MARKER.length);

  let message;

  try {
    message = JSON.parse(jsonText);
  } catch (error) {
    console.error("OCR WORKER JSON ERROR:", error, jsonText);

    return;
  }

  if (message.type === "ready") {
    ocrWorkerReady = true;

    console.log("OCR WORKER READY");

    if (resolveOcrReady) {
      resolveOcrReady();
    }

    resolveOcrReady = null;
    rejectOcrReady = null;

    return;
  }

  if (message.type !== "result") {
    return;
  }

  const requestId = String(message.id);

  const pending = pendingOcrRequests.get(requestId);

  if (!pending) {
    console.warn("OCR REQUEST NOT FOUND:", requestId);

    return;
  }

  clearTimeout(pending.timeout);

  pendingOcrRequests.delete(requestId);

  if (!message.success) {
    pending.reject(new Error(message.error || "OCR worker thất bại."));

    return;
  }

  pending.resolve(message.result);
}

async function requestOcr(imagePath) {
  /*
   * Chờ PaddleOCR tải model hoàn tất.
   */
  await startOcrWorker();

  if (!ocrWorker || ocrWorker.killed || !ocrWorkerReady) {
    throw new Error("OCR worker không hoạt động.");
  }

  const requestId = String(nextOcrRequestId++);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingOcrRequests.delete(requestId);

      reject(new Error("OCR xử lý quá thời gian."));
    }, 60000);

    pendingOcrRequests.set(requestId, {
      resolve,
      reject,
      timeout,
    });

    const request = {
      id: requestId,
      action: "ocr",
      imagePath,
    };

    const payload = JSON.stringify(request) + "\n";

    ocrWorker.stdin.write(payload, "utf8", (error) => {
      if (!error) {
        return;
      }

      clearTimeout(timeout);

      pendingOcrRequests.delete(requestId);

      reject(error);
    });
  });
}

function normalizeTranslationText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function createTranslationCacheKey(
  text,
  profile,
  context,
  sourceLanguage,
  targetLanguage
) {
  const userId =
    currentUser?.id ||
    "anonymous";

  const profileIdentity =
    profile?.id
      ? `${profile.id}:${profile.updatedAt || ""}`
      : "default";

  const contextIdentity =
    JSON.stringify(
      Array.isArray(context)
        ? context
        : []
    );

  const languageIdentity =
    `${normalizeTranslationSourceLanguage(
      sourceLanguage
    )}->${normalizeTranslationTargetLanguage(
      targetLanguage
    )}`;

  const translationEngine =
    `java-backend-v6.5:${BACKEND_BASE_URL}:user:${userId}:profile:${profileIdentity}:language:${languageIdentity}`;

  return crypto
    .createHash("sha256")
    .update(
      `${translationEngine}
${contextIdentity}
${text}`,
      "utf8"
    )
    .digest("hex");
}

async function loadTranslationCache() {
  translationCachePath = path.join(
    app.getPath("userData"),
    "translation-cache.json",
  );

  try {
    const content = await fs.readFile(translationCachePath, "utf8");

    const entries = JSON.parse(content);

    if (!Array.isArray(entries)) {
      return;
    }

    for (const entry of entries) {
      if (!entry || typeof entry.key !== "string" || !entry.value) {
        continue;
      }

      translationCache.set(entry.key, entry.value);
    }

    console.log("TRANSLATION CACHE LOADED:", translationCache.size);
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      console.error("LOAD TRANSLATION CACHE ERROR:", error);
    }
  }
}

async function saveTranslationCache() {
  if (!translationCachePath) {
    return;
  }

  try {
    const entries = Array.from(translationCache.entries()).map(
      ([key, value]) => ({
        key,
        value,
      }),
    );

    await fs.writeFile(
      translationCachePath,
      JSON.stringify(entries, null, 2),
      "utf8",
    );
  } catch (error) {
    console.error("SAVE TRANSLATION CACHE ERROR:", error);
  }
}

function limitTranslationCache() {
  while (translationCache.size > MAX_CACHE_ITEMS) {
    const oldestKey = translationCache.keys().next().value;

    if (!oldestKey) {
      break;
    }

    translationCache.delete(oldestKey);
  }
}

// ======================================================
// IPC: OPEN SELECTOR
// ======================================================

ipcMain.handle(
  "open-selector",
  async (_event, options) => {
    await ensureAuthenticated();
    ensureWorkspaceScanAllowed();

    if (
      options &&
      typeof options === "object"
    ) {
      setTranslationLanguages(
        options
      );
    }

    await openScreenSelector(
      "translate"
    );
  }
);


ipcMain.handle(
  "translation:panel",
  async (_event, options) => {
    await ensureAuthenticated();
    ensureWorkspaceScanAllowed();
    await requireFreshDesktopFeatureCapability(
      "mangaPanel"
    );

    if (
      options &&
      typeof options === "object"
    ) {
      setTranslationLanguages(
        options
      );
    }

    await openScreenSelector(
      "panel"
    );

    return {
      success: true,
      selecting: true,
    };
  }
);


ipcMain.handle(
  "translation:panel-next",
  async () => {
    return runMangaSessionNextPage(
      "renderer"
    );
  }
);


ipcMain.handle(
  "translation:manga-continuous-toggle",
  async (_event, enabled) => {
    const nextEnabled = Boolean(enabled);

    if (nextEnabled) {
      await ensureAuthenticated();
      await requireFreshDesktopFeatureCapability(
        "continuousManga"
      );
    }

    return setMangaContinuousEnabled(
      nextEnabled
    );
  }
);

ipcMain.handle(
  "translation:manga-continuous-pause",
  async () => {
    return toggleMangaContinuousPause();
  }
);

ipcMain.handle(
  "translation:feature-capabilities",
  async () => {
    return getDesktopFeatureCapabilities();
  }
);

ipcMain.handle(
  "translation:manga-session-state",
  async () => {
    return getMangaPanelSessionState();
  }
);

ipcMain.handle(
  "translation:manga-session-end",
  async () => {
    return endMangaPanelSession(
      "renderer"
    );
  }
);

ipcMain.handle(
  "translation:manga-session-details",
  async () => {
    return getMangaPanelSessionDetails();
  }
);

ipcMain.handle(
  "translation:manga-session-reset-chapter",
  async () => {
    if (
      selectorIsOpen ||
      isProcessingSelection ||
      isFullScreenProcessing ||
      isMangaSessionProcessing
    ) {
      throw new Error(
        "AI Translator đang xử lý. Hãy đợi lần quét hiện tại hoàn tất."
      );
    }

    return resetMangaPanelSessionChapter();
  }
);

ipcMain.handle(
  "translation:manga-session-inspector-toggle",
  async () => {
    if (!mangaPanelSession) {
      return {
        success: false,
        visible: false,
        error:
          "Chưa có Manga Session đang hoạt động.",
      };
    }

    return toggleMangaSessionInspector();
  }
);

ipcMain.handle(
  "translation:manga-session-inspector-close",
  async () => {
    return closeMangaSessionInspector();
  }
);


ipcMain.handle(
  "translation:full-screen",
  async (_event, options) => {
    return runFullScreenTranslation(
      options
    );
  }
);


ipcMain.handle(
  "full-screen-overlay:get-state",
  async () => {
    return getFullScreenOverlayState();
  }
);


ipcMain.handle(
  "full-screen-overlay:get-payload",
  async () => {
    return getFullScreenOverlayPayload();
  }
);


ipcMain.handle(
  "full-screen-overlay:toggle-pin",
  async () => {
    const pinned =
      toggleFullScreenOverlayPinned();

    if (pinned) {
      stopOverlayLifecycle();
    } else if (
      !isFullScreenOverlayEditing()
    ) {
      startOverlayLifecycle(
        activeOverlayTargetWindow ||
        pendingTargetWindow
      );
    }

    return getFullScreenOverlayState();
  }
);


ipcMain.handle(
  "full-screen-overlay:toggle-edit",
  async () => {
    const editing =
      toggleFullScreenOverlayEditing();

    /*
     * Khi kéo bubble, foreground window sẽ là overlay của chính app.
     * Tạm dừng auto-hide để overlay không tự biến mất giữa thao tác.
     */
    if (editing) {
      stopOverlayLifecycle();
    } else if (
      !isFullScreenOverlayPinned()
    ) {
      startOverlayLifecycle(
        activeOverlayTargetWindow ||
        pendingTargetWindow
      );
    }

    return getFullScreenOverlayState();
  }
);


ipcMain.handle(
  "full-screen-overlay:toggle-debug",
  async () => {
    toggleFullScreenOverlayDebug();

    return getFullScreenOverlayState();
  }
);


ipcMain.handle(
  "full-screen-overlay:set-text-input-active",
  async (_event, active) => {
    setFullScreenOverlayTextInputActive(
      Boolean(active)
    );

    return getFullScreenOverlayState();
  }
);


ipcMain.handle(
  "full-screen-overlay:reset-layout",
  async () => {
    return resetFullScreenOverlayLayout();
  }
);


ipcMain.handle(
  "full-screen-overlay:save-correction",
  async (_event, correction) => {
    return submitOverlayTranslationCorrection(
      correction
    );
  }
);


ipcMain.on(
  "full-screen-overlay:close",
  () => {
    stopMangaContinuousMode(
      "overlay-close",
      false
    );

    stopOverlayLifecycle();

    setFullScreenOverlayPinned(
      false
    );

    closeFullScreenTranslationOverlay();

    showMainWindow();
  }
);


ipcMain.handle(
  "study:open-selector",
  async (_event, options) => {
    await ensureAuthenticated();
    ensureWorkspaceScanAllowed();
    await requireFreshDesktopFeatureCapability(
      "studyMode"
    );

    if (
      options &&
      typeof options === "object"
    ) {
      if (options.level) {
        setStudyLevel(
          options.level
        );
      }

      if (
        Object.prototype.hasOwnProperty.call(
          options,
          "autoSaveVocabulary"
        )
      ) {
        setStudyAutoSaveVocabulary(
          options.autoSaveVocabulary
        );
      }

      if (
        Object.prototype.hasOwnProperty.call(
          options,
          "autoSaveGrammar"
        )
      ) {
        setStudyAutoSaveGrammar(
          options.autoSaveGrammar
        );
      }
    } else if (options) {
      /*
       * Backward compatibility:
       * v6.3 renderer gửi trực tiếp level string.
       */
      setStudyLevel(
        options
      );
    }

    await openScreenSelector(
      "study"
    );
  }
);

ipcMain.handle(
  "workspace:set-mode",
  (_event, mode) => {
    return setWorkspaceMode(
      mode
    );
  }
);

ipcMain.handle(
  "translation:set-languages",
  (_event, options) => {
    return setTranslationLanguages(
      options
    );
  }
);

ipcMain.handle(
  "study:set-level",
  (_event, level) => {
    return setStudyLevel(
      level
    );
  }
);


ipcMain.handle(
  "study:set-auto-save-vocabulary",
  (_event, value) => {
    return setStudyAutoSaveVocabulary(
      value
    );
  }
);


ipcMain.handle(
  "study:set-auto-save-grammar",
  (_event, value) => {
    return setStudyAutoSaveGrammar(
      value
    );
  }
);


ipcMain.handle(
  "workspace:set-scan-guard",
  (_event, reason) => {
    return setWorkspaceScanGuard(
      reason
    );
  }
);

// ======================================================
// IPC: SELECTION COMPLETE
// ======================================================

function cleanOcrResult(ocrResult) {
  const cleanLines = [];
  const cleanScores = [];
  const cleanBoxes = [];

  const lines = ocrResult.lines || [];

  const scores = ocrResult.scores || [];

  const boxes = ocrResult.boxes || [];

  for (let index = 0; index < lines.length; index++) {
    const text = String(lines[index] || "").trim();

    const score = Number(scores[index] || 0);

    const box = boxes[index];

    if (!text) {
      continue;
    }

    const width = Number(box?.width || 0);

    const height = Number(box?.height || 0);

    const area = width * height;

    const numericOnly = /^[0-9０-９]+$/.test(text);

    const tinyBox = width < 15 || height < 15 || area < 300;

    /*
     * Loại kết quả độ tin cậy quá thấp.
     */
    if (score < 0.6) {
      console.log("OCR NOISE REMOVED:", {
        text,
        score,
        box,
      });

      continue;
    }

    /*
     * Loại chuỗi toàn số nằm trong box cực nhỏ.
     * Đây thường là furigana bị nhận sai.
     */
    if (numericOnly && tinyBox) {
      console.log("TINY NUMBER REMOVED:", {
        text,
        score,
        box,
      });

      continue;
    }

    cleanLines.push(text);
    cleanScores.push(score);
    cleanBoxes.push(box);
  }

  return {
    ...ocrResult,

    text: cleanLines.join("\n"),

    lines: cleanLines,

    scores: cleanScores,

    boxes: cleanBoxes,
  };
}

ipcMain.on("selection-complete", async (_event, selection) => {
  if (isProcessingSelection) {
    console.log("DUPLICATE SELECTION IGNORED");

    return;
  }

  if (!pendingScreenshot) {
    console.log("SELECTION IGNORED: NO SCREENSHOT");

    return;
  }

  isProcessingSelection = true;
  selectorIsOpen = false;

  /*
   * Chuyển screenshot vào biến cục bộ,
   * ngăn sự kiện khác sử dụng lại ảnh này.
   */
  const screenshotBuffer = pendingScreenshot;

  pendingScreenshot = null;

  console.log("SELECTED AREA:", selection);

  const scanMode =
    pendingScanMode;

  let loadingToken =
    null;

  let keepLoadingAfterSelection =
    false;

  try {
    closeOverlay();

    loadingToken =
      showTranslationLoading({
        mode: scanMode,
        selection,
        message:
          "Đang chuẩn bị vùng ảnh…",
        detail:
          scanMode === "study"
            ? "Study Mode"
            : scanMode === "panel"
              ? "Manga Panel"
              : "Quick Translate",
      });

    const cropResult =
      await cropSelectedArea(
        selection,
        screenshotBuffer,
        {
          padding:
            scanMode === "panel"
              ? 8
              : 30,
        }
      );

    const imagePath = cropResult.imagePath;

    console.log("IMAGE SAVED:", imagePath);

    updateTranslationLoading(
      loadingToken,
      {
        message:
          "Đang nhận diện chữ…",
        detail:
          "OCR · PaddleOCR",
      }
    );

    const ocrStartedAt = performance.now();

    const rawOcrResult = await requestOcr(imagePath);

    console.log("RAW OCR RESULT:", rawOcrResult);

    const ocrResult = cleanOcrResult(rawOcrResult);

    console.log("CLEAN OCR RESULT:", ocrResult);

    console.log(
      "OCR TIME:",
      `${Math.round(performance.now() - ocrStartedAt)}ms`,
    );

    console.log("OCR RESULT:", ocrResult);

    if (scanMode === "panel") {
      await processMangaPanelTranslation({
        cropResult,
        ocrResult,
        loadingToken,
        sourceLanguage:
          pendingTranslationSourceLanguage,
        targetLanguage:
          pendingTranslationTargetLanguage,
        targetWindow:
          pendingTargetWindow,
        startNewSession: true,
      });

      closeTranslationLoading(
        loadingToken
      );
      loadingToken = null;

      return;
    }

    if (scanMode === "study") {
      const scanId =
        crypto.randomUUID();

      const studyFlowStartedAt =
        performance.now();

      const profile =
        activeTranslationProfile;

      const context =
        getCurrentTranslationContext(
          profile,
          "JA",
          "VI"
        );

      const levelSnapshot =
        currentStudyLevel;

      const autoSaveSnapshot =
        currentStudyAutoSaveVocabulary;

      const autoSaveGrammarSnapshot =
        currentStudyAutoSaveGrammar;

      /*
       * Start 2 requests concurrently.
       *
       * - /translate: fast path for overlay.
       * - /study/analyze: background rich analysis.
       *
       * Study promise gets a rejection observer immediately
       * so Node never treats an early rejection as unhandled
       * while we are waiting for the fast translation.
       */
      updateTranslationLoading(
        loadingToken,
        {
          message:
            "Đang dịch và phân tích Study…",
          detail:
            "JA → VI · Dịch nhanh + phân tích song song",
        }
      );

      const studyPromise =
        analyzeJapaneseForStudy(
          ocrResult.text,
          profile,
          context,
          levelSnapshot,
          autoSaveSnapshot,
          autoSaveGrammarSnapshot
        );

      studyPromise.catch(
        () => {}
      );

      const fastStartedAt =
        performance.now();

      let translation;

      try {
        translation =
          await translateWithCache(
          ocrResult.text,
          {
            sourceLanguage: "JA",
            targetLanguage: "VI",
          }
        );
      } catch (fastError) {
        /*
         * Fallback:
         * Nếu fast translation lỗi nhưng Study vẫn chạy được,
         * dùng translation từ Study response thay vì mất toàn bộ kết quả.
         */
        console.warn(
          "FAST TRANSLATE FAILED, WAITING STUDY FALLBACK:",
          fastError
        );

        const fallbackStudy =
          await studyPromise;

        const analysis =
          fallbackStudy.analysis;

        translation = {
          original:
            analysis.original ||
            ocrResult.text ||
            "",

          translatedText:
            analysis.translation ||
            "",

          vietnamese:
            analysis.translation ||
            "",

          sourceLanguage: "JA",
          targetLanguage: "VI",

          profile:
            fallbackStudy.profile ||
            null,

          performance:
            fallbackStudy.performance ||
            null,
        };

        rememberTranslationContext(
          profile,
          translation,
          "JA",
          "VI"
        );

        showTrackedSelectionTranslation({
          x: selection.x,
          y: selection.y,
          width: selection.width,
          height: selection.height,
          original:
            translation.original,
          text:
            translation.vietnamese,
        });

        const fallbackResult = {
          success: true,
          mode: "study",
          scanId,
          ocr: ocrResult,
          translation,
          study:
            fallbackStudy,
          performance: {
            desktopStudyFlowMs:
              Math.round(
                performance.now() -
                studyFlowStartedAt
              ),
            fallback:
              true,
          },
        };

        sendToMainWindow(
          "study-fast-result",
          fallbackResult
        );

        sendToMainWindow(
          "study-result",
          fallbackResult
        );

        console.log(
          "PERF desktop study-fallback",
          {
            scanId,
            totalMs:
              Math.round(
                performance.now() -
                studyFlowStartedAt
              ),
            backend:
              fallbackStudy.performance ||
              null,
          }
        );

        return;
      }

      const fastMs =
        Math.round(
          performance.now() -
          fastStartedAt
        );

      const visibleMs =
        Math.round(
          performance.now() -
          studyFlowStartedAt
        );

      /*
       * User sees this immediately, without waiting
       * for grammar/vocabulary analysis.
       */
      showTrackedSelectionTranslation({
        x: selection.x,
        y: selection.y,
        width: selection.width,
        height: selection.height,
        original:
          translation.original ||
          ocrResult.text ||
          "",
        text:
          translation.vietnamese ||
          "",
      });

      const fastResult = {
        success: true,
        mode: "study",
        phase: "translation-ready",
        scanId,
        ocr: ocrResult,
        translation,
        study: null,
        performance: {
          fastTranslateMs:
            fastMs,
          visibleMs,
          backendTranslate:
            translation.performance ||
            null,
        },
      };

      sendToMainWindow(
        "study-fast-result",
        fastResult
      );

      updateTranslationLoading(
        loadingToken,
        {
          message:
            "Bản dịch đã hiện · đang phân tích Study…",
          detail:
            "Từ vựng · ngữ pháp · JLPT",
        }
      );

      keepLoadingAfterSelection =
        true;

      console.log(
        "PERF desktop study-fast",
        {
          scanId,
          fastTranslateMs:
            fastMs,
          visibleMs,
          backend:
            translation.performance ||
            null,
        }
      );

      /*
       * Full Study completion is detached from the selection handler.
       * isProcessingSelection can be released after the fast popup,
       * so user may scan the next sentence while analysis continues.
       */
      studyPromise
        .then(
          (studyResult) => {
            const fullMs =
              Math.round(
                performance.now() -
                studyFlowStartedAt
              );

            const result = {
              success: true,
              mode: "study",
              phase: "analysis-ready",
              scanId,
              ocr: ocrResult,
              translation,
              study:
                studyResult,
              performance: {
                fastTranslateMs:
                  fastMs,
                fullStudyMs:
                  fullMs,
                backendTranslate:
                  translation.performance ||
                  null,
                backendStudy:
                  studyResult.performance ||
                  null,
              },
            };

            sendToMainWindow(
              "study-result",
              result
            );

            closeTranslationLoading(
              loadingToken
            );

            console.log(
              "PERF desktop study-full",
              {
                scanId,
                fastTranslateMs:
                  fastMs,
                fullStudyMs:
                  fullMs,
                backendStudy:
                  studyResult.performance ||
                  null,
              }
            );
          }
        )
        .catch(
          (error) => {
            console.error(
              "BACKGROUND STUDY ERROR:",
              error
            );

            sendToMainWindow(
              "study-result",
              {
                success: false,
                mode: "study",
                phase:
                  "analysis-error",
                background:
                  true,
                scanId,
                ocr: ocrResult,
                translation,
                error:
                  error instanceof Error
                    ? error.message
                    : String(error),
              }
            );

            closeTranslationLoading(
              loadingToken
            );
          }
        );

      console.log(
        "STUDY FAST OVERLAY READY"
      );
    } else {
      console.time(
        "TRANSLATION TIME"
      );

      const translationStartedAt =
        performance.now();

      updateTranslationLoading(
        loadingToken,
        {
          message:
            "Đang dịch vùng đã chọn…",
          detail:
            `${pendingTranslationSourceLanguage} → ${pendingTranslationTargetLanguage} · AI`,
        }
      );

      const translation =
        await translateWithCache(
          ocrResult.text,
          {
            sourceLanguage:
              pendingTranslationSourceLanguage,
            targetLanguage:
              pendingTranslationTargetLanguage,
          }
        );

      console.log(
        "TRANSLATION TIME:",
        `${Math.round(
          performance.now() -
          translationStartedAt
        )}ms`,
      );

      console.timeEnd(
        "TRANSLATION TIME"
      );

      console.log(
        "TRANSLATION RESULT:",
        translation
      );

      showTrackedSelectionTranslation({
        x: selection.x,
        y: selection.y,

        width: selection.width,
        height: selection.height,

        original:
          ocrResult.text || "",

        text:
          translation.vietnamese ||
          "",
      });

      const scanResult = {
        success: true,
        mode: "translate",
        ocr: ocrResult,
        translation,
      };

      sendToMainWindow(
        "scan-result",
        scanResult
      );

      console.log(
        "TRANSLATION OVERLAY READY"
      );

      closeTranslationLoading(
        loadingToken
      );
      loadingToken = null;
    }
  } catch (error) {
    console.error("SCAN ERROR:", error);

    const errorResult = {
      success: false,

      error: error instanceof Error ? error.message : String(error),
    };

    sendToMainWindow(
      pendingScanMode === "study"
        ? "study-result"
        : "scan-result",
      errorResult
    );

    /*
     * V6.9.1: không mở Result Popup kể cả khi lỗi.
     * App chính vẫn nhận scan-result/study-result để hiển thị trạng thái
     * khi user quay lại cửa sổ AI Translator.
     */
  } finally {
    if (
      !keepLoadingAfterSelection &&
      loadingToken != null
    ) {
      closeTranslationLoading(
        loadingToken
      );
    }

    isProcessingSelection = false;
    selectorIsOpen = false;
  }
});

ipcMain.handle(
  "backend:get-status",
  async () => {
    return getBackendStatus();
  }
);

ipcMain.handle(
  "backend:get-config",
  () => {
    return {
      baseUrl:
        BACKEND_BASE_URL,
      translateUrl:
        BACKEND_TRANSLATE_URL,
      healthUrl:
        BACKEND_HEALTH_URL,
    };
  }
);


ipcMain.handle(
  "auth:get-status",
  async () => {
    return getDesktopAuthStatus();
  }
);

ipcMain.handle(
  "auth:login",
  async (_event, credentials) => {
    return loginDesktop(
      credentials?.email,
      credentials?.password
    );
  }
);

ipcMain.handle(
  "auth:register",
  async (_event, credentials) => {
    return registerDesktop(
      credentials?.email,
      credentials?.password
    );
  }
);

ipcMain.handle(
  "auth:refresh",
  async () => {
    const success =
      await refreshDesktopSession();

    return {
      success,
      ...(await getDesktopAuthStatus()),
    };
  }
);

ipcMain.handle(
  "auth:logout",
  async () => {
    return logoutDesktop();
  }
);

ipcMain.handle(
  "auth:get-social-providers",
  async () => {
    return getSocialProvidersDesktop();
  }
);

ipcMain.handle(
  "auth:social-login",
  async (_event, provider) => {
    return socialLoginDesktop(
      provider
    );
  }
);

ipcMain.handle(
  "account:get-identities",
  async () => {
    return getAccountIdentitiesDesktop();
  }
);

ipcMain.handle(
  "account:link-identity",
  async (_event, provider) => {
    return linkSocialIdentityDesktop(
      provider
    );
  }
);

ipcMain.handle(
  "account:get-entitlements",
  async () => {
    return refreshAccountEntitlements();
  }
);

ipcMain.handle(
  "account:activate-license",
  async (_event, licenseKey) => {
    return activateDesktopLicense(
      licenseKey
    );
  }
);

ipcMain.handle(
  "auth:get-devices",
  async () => {
    return getDeviceSessions();
  }
);

ipcMain.handle(
  "auth:revoke-device",
  async (_event, sessionId) => {
    return revokeDeviceSession(
      sessionId
    );
  }
);


ipcMain.handle(
  "novel:list-formats",
  async () => {
    return {
      success: true,
      formats: listDocumentFormats(),
    };
  }
);

ipcMain.handle(
  "novel:open-document",
  async (_event, format) => {
    return openNovelDocumentFiles(
      format
    );
  }
);

ipcMain.handle(
  "novel:read-document",
  async (_event, filePath, format) => {
    return readNovelDocumentPath(
      filePath,
      format
    );
  }
);

ipcMain.handle(
  "novel:ocr-pdf-pages",
  async (_event, filePath, startPage, count) => {
    return ocrNovelPdfPages(
      filePath,
      startPage,
      count
    );
  }
);


ipcMain.handle(
  "novel:open-txt",
  async () => {
    return openNovelTxtFile();
  }
);

ipcMain.handle(
  "novel:read-txt",
  async (_event, filePath) => {
    return readNovelTxtPath(
      filePath
    );
  }
);

ipcMain.handle(
  "novel:open-epub",
  async () => {
    return openNovelEpubFile();
  }
);

ipcMain.handle(
  "novel:read-epub",
  async (_event, filePath) => {
    return readNovelEpubPath(
      filePath
    );
  }
);

ipcMain.handle(
  "novel:translate-batch",
  async (_event, payload) => {
    return translateNovelBlocks(
      payload
    );
  }
);


ipcMain.handle(
  "profiles:list",
  async () => {
    return listTranslationProfiles();
  }
);

ipcMain.handle(
  "profiles:create",
  async (_event, profile) => {
    return createTranslationProfile(
      profile
    );
  }
);

ipcMain.handle(
  "profiles:update",
  async (
    _event,
    profileId,
    profile
  ) => {
    return updateTranslationProfile(
      profileId,
      profile
    );
  }
);

ipcMain.handle(
  "profiles:delete",
  async (_event, profileId) => {
    return deleteTranslationProfile(
      profileId
    );
  }
);

ipcMain.handle(
  "profiles:set-default",
  async (_event, profileId) => {
    return setDefaultTranslationProfile(
      profileId
    );
  }
);

ipcMain.handle(
  "translation:set-active-profile",
  (_event, profile) => {
    return setActiveTranslationProfile(
      profile
    );
  }
);

ipcMain.handle(
  "translation:clear-context",
  (_event, profileId) => {
    clearTranslationContext(
      profileId
    );

    return {
      success: true,
    };
  }
);


ipcMain.handle(
  "vocabulary:list",
  async (_event, filters) => {
    return listVocabulary(
      filters
    );
  }
);

ipcMain.handle(
  "vocabulary:stats",
  async () => {
    return getVocabularyStats();
  }
);

ipcMain.handle(
  "vocabulary:save",
  async (_event, item) => {
    return saveVocabulary(
      item
    );
  }
);

ipcMain.handle(
  "vocabulary:update",
  async (
    _event,
    vocabularyId,
    patch
  ) => {
    return updateVocabulary(
      vocabularyId,
      patch
    );
  }
);

ipcMain.handle(
  "vocabulary:delete",
  async (
    _event,
    vocabularyId
  ) => {
    return deleteVocabulary(
      vocabularyId
    );
  }
);


ipcMain.handle(
  "grammar:list",
  async (_event, filters) => {
    return listGrammar(
      filters
    );
  }
);

ipcMain.handle(
  "grammar:stats",
  async () => {
    return getGrammarStats();
  }
);

ipcMain.handle(
  "grammar:save",
  async (_event, item) => {
    return saveGrammar(
      item
    );
  }
);

ipcMain.handle(
  "grammar:update",
  async (
    _event,
    grammarId,
    patch
  ) => {
    return updateGrammar(
      grammarId,
      patch
    );
  }
);

ipcMain.handle(
  "grammar:delete",
  async (
    _event,
    grammarId
  ) => {
    return deleteGrammar(
      grammarId
    );
  }
);


ipcMain.handle(
  "review:due",
  async (_event, limit) => {
    return getReviewQueue(
      limit
    );
  }
);

ipcMain.handle(
  "review:practice",
  async (_event, limit) => {
    return getPracticeReviewQueue(
      limit
    );
  }
);

ipcMain.handle(
  "review:stats",
  async () => {
    return getReviewStats();
  }
);

ipcMain.handle(
  "review:answer",
  async (_event, answer) => {
    return answerReviewItem(
      answer
    );
  }
);


ipcMain.handle(
  "learning:dashboard",
  async () => {
    return getLearningDashboard();
  }
);


ipcMain.handle(
  "shortcuts:get",
  async () => {
    return getShortcutSettings();
  }
);

ipcMain.handle(
  "shortcuts:update",
  async (_event, next) => {
    return updateShortcutSettings(
      next
    );
  }
);


ipcMain.handle(
  "app-preferences:get",
  async () => {
    return getAppPreferences();
  }
);

ipcMain.handle(
  "app-preferences:update",
  async (_event, next) => {
    return updateAppPreferences(
      next
    );
  }
);

ipcMain.handle(
  "app-preferences:reset",
  async () => {
    return resetAppPreferences();
  }
);

ipcMain.handle(
  "translation-overlay:get-state",
  async () => {
    return getTranslationOverlayState();
  }
);

ipcMain.handle(
  "translation-overlay:toggle-pin",
  async () => {
    const pinned =
      toggleTranslationOverlayPinned();

    if (pinned) {
      stopOverlayLifecycle();
    } else {
      startOverlayLifecycle(
        activeOverlayTargetWindow
      );
    }

    if (tray) {
      tray.destroy();
      tray = null;
      createTray();
    }

    return getTranslationOverlayState();
  }
);

ipcMain.on(
  "translation-overlay:close",
  () => {
    stopOverlayLifecycle();
    setTranslationOverlayPinned(
      false
    );

    closeSelectionTranslation();
  }
);

function getTrayIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "assets", "tray.png");
  }

  return path.join(__dirname, "assets", "tray.png");
}

// ======================================================
// OPTIONAL: FULL SCREEN CAPTURE
// ======================================================

ipcMain.handle("capture-screen", async () => {
  const image = await screenshot({
    format: "png",
  });

  return image.toString("base64");
});

// ======================================================
// GLOBAL SHORTCUTS
// ======================================================
// registerShortcuts() được định nghĩa ở phần helpers vì
// Settings có thể re-register accelerator lúc runtime.

function startOcrWorker() {
  /*
   * Worker đã sẵn sàng.
   */
  if (ocrWorker && !ocrWorker.killed && ocrWorkerReady) {
    return Promise.resolve();
  }

  /*
   * Worker đang khởi động.
   * Trả lại Promise cũ để các request cùng chờ.
   */
  if (ocrWorker && !ocrWorker.killed && ocrWorkerReadyPromise) {
    return ocrWorkerReadyPromise;
  }

  const ocrDirectory = getOcrDirectory();

  const pythonPath = path.join(ocrDirectory, ".venv", "Scripts", "python.exe");

  const workerPath = path.join(ocrDirectory, "worker.py");
  ocrWorkerReady = false;

  ocrWorkerReadyPromise = new Promise((resolve, reject) => {
    resolveOcrWorkerReady = resolve;

    rejectOcrWorkerReady = reject;
  });

  ocrWorker = spawn(pythonPath, ["-X", "utf8", workerPath], {
    windowsHide: true,

    stdio: ["pipe", "pipe", "pipe"],

    env: {
      ...process.env,

      PYTHONUTF8: "1",

      PYTHONIOENCODING: "utf-8",

      PYTHONUNBUFFERED: "1",
    },
  });

  console.log("OCR WORKER STARTING...");

  const lineReader = readline.createInterface({
    input: ocrWorker.stdout,
    crlfDelay: Infinity,
  });

  lineReader.on("line", (line) => {
    /*
     * Log thường của PaddleOCR.
     */
    if (!line.startsWith(OCR_OUTPUT_MARKER)) {
      if (line.trim()) {
        console.log("OCR WORKER LOG:", line);
      }

      return;
    }

    const jsonText = line.slice(OCR_OUTPUT_MARKER.length);

    let message;

    try {
      message = JSON.parse(jsonText);
    } catch (error) {
      console.error("OCR WORKER JSON ERROR:", error, jsonText);

      return;
    }

    /*
     * Worker tải model hoàn tất.
     */
    if (message.type === "ready") {
      ocrWorkerReady = true;

      console.log("OCR WORKER READY");

      if (resolveOcrWorkerReady) {
        resolveOcrWorkerReady();
      }

      resolveOcrWorkerReady = null;
      rejectOcrWorkerReady = null;

      return;
    }

    /*
     * Nhận kết quả OCR.
     */
    if (message.type === "result") {
      const requestId = String(message.id);

      const pending = pendingOcrRequests.get(requestId);

      if (!pending) {
        console.warn("OCR REQUEST NOT FOUND:", requestId);

        return;
      }

      clearTimeout(pending.timeout);

      pendingOcrRequests.delete(requestId);

      if (!message.success) {
        pending.reject(new Error(message.error || "OCR worker thất bại."));

        return;
      }

      pending.resolve(message.result);
    }
  });

  ocrWorker.stderr.on("data", (data) => {
    const output = data.toString("utf8");

    if (output.trim()) {
      console.log("OCR WORKER STDERR:", output);
    }
  });

  ocrWorker.on("error", (error) => {
    console.error("OCR WORKER ERROR:", error);

    ocrWorkerReady = false;

    if (rejectOcrWorkerReady) {
      rejectOcrWorkerReady(error);
    }

    for (const pending of pendingOcrRequests.values()) {
      clearTimeout(pending.timeout);

      pending.reject(error);
    }

    pendingOcrRequests.clear();
  });

  ocrWorker.on("close", (code) => {
    console.log("OCR WORKER CLOSED:", code);

    const error = new Error(`OCR worker đã dừng, mã ${code}.`);

    if (!ocrWorkerReady && rejectOcrWorkerReady) {
      rejectOcrWorkerReady(error);
    }

    for (const pending of pendingOcrRequests.values()) {
      clearTimeout(pending.timeout);

      pending.reject(error);
    }

    pendingOcrRequests.clear();

    ocrWorker = null;
    ocrWorkerReady = false;
    ocrWorkerReadyPromise = null;

    resolveOcrWorkerReady = null;
    rejectOcrWorkerReady = null;
  });

  return ocrWorkerReadyPromise;
}

// ======================================================
// ELECTRON LIFECYCLE
// ======================================================

app.whenReady().then(async () => {
  await removeLegacyDesktopApiKey();
  await ensureDeviceId();

  const restoredSession =
    await restoreDesktopSession();

  console.log(
    "AUTH SESSION RESTORED:",
    restoredSession
  );

  await loadTranslationCache();
  await loadDesktopPreferences();

  startForegroundWindowTracker();

  createWindow();
  createTray();
  registerShortcuts();

  const backendStatus =
    await getBackendStatus();

  console.log(
    "JAVA BACKEND:",
    backendStatus
  );

  startOcrWorker()
    .then(() => {
      console.log("PADDLEOCR LOADED");
    })
    .catch((error) => {
      console.error("OCR WORKER START FAILED:", error);
    });
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("will-quit", () => {
  isQuitting = true;

  globalShortcut.unregisterAll();

  stopOverlayLifecycle();
  stopForegroundWindowTracker();

  if (ocrWorker && !ocrWorker.killed) {
    try {
      ocrWorker.stdin.write(
        JSON.stringify({
          action: "shutdown",
        }) + "\n",
      );
    } catch {
      // Worker đã đóng.
    }

    ocrWorker.kill();
    ocrWorker = null;
  }

  if (tray) {
    tray.destroy();
    tray = null;
  }
});

app.on("window-all-closed", () => {
  /*
   * Không thoát vì ứng dụng
   * tiếp tục chạy trong System Tray.
   */
});
app.on("before-quit", () => {
  isQuitting = true;
});
