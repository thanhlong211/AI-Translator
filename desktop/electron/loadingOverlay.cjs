const {
  BrowserWindow,
  screen
} = require("electron");

const path = require("path");

let loadingWindow = null;
let loadingState = null;
let loadingToken = 0;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function resolveDisplayForState(state = {}) {
  const selection = state.selection;

  if (
    selection &&
    Number.isFinite(Number(selection.x)) &&
    Number.isFinite(Number(selection.y))
  ) {
    return screen.getDisplayNearestPoint({
      x: Math.round(Number(selection.x) + Math.max(0, Number(selection.width) || 0) / 2),
      y: Math.round(Number(selection.y) + Math.max(0, Number(selection.height) || 0) / 2),
    });
  }

  const displayId = String(state.displayId ?? "");
  const exact = screen
    .getAllDisplays()
    .find((display) => String(display.id) === displayId);

  return exact || screen.getPrimaryDisplay();
}

function resolveBounds(state = {}) {
  const display = resolveDisplayForState(state);
  const workArea = display.workArea;
  const width = 310;
  const height = 74;
  const selection = state.selection;

  let x = workArea.x + Math.round((workArea.width - width) / 2);
  let y = workArea.y + 18;

  if (
    selection &&
    Number.isFinite(Number(selection.x)) &&
    Number.isFinite(Number(selection.y)) &&
    Number(selection.width) > 0 &&
    Number(selection.height) > 0
  ) {
    const selectedX = Number(selection.x);
    const selectedY = Number(selection.y);
    const selectedWidth = Number(selection.width);
    const selectedHeight = Number(selection.height);

    x = selectedX + Math.round((selectedWidth - width) / 2);

    const above = selectedY - height - 10;
    const below = selectedY + selectedHeight + 10;

    if (above >= workArea.y) {
      y = above;
    } else if (below + height <= workArea.y + workArea.height) {
      y = below;
    } else {
      y = selectedY + 10;
    }
  }

  return {
    x: clamp(
      Math.round(x),
      workArea.x,
      Math.max(workArea.x, workArea.x + workArea.width - width)
    ),
    y: clamp(
      Math.round(y),
      workArea.y,
      Math.max(workArea.y, workArea.y + workArea.height - height)
    ),
    width,
    height,
  };
}

function serializeState(state) {
  return JSON.stringify({
    mode: String(state?.mode || "translate"),
    message: String(state?.message || "Đang xử lý…"),
    detail: String(state?.detail || ""),
  });
}

async function pushState() {
  if (
    !loadingWindow ||
    loadingWindow.isDestroyed() ||
    !loadingState ||
    loadingWindow.webContents.isLoading()
  ) {
    return;
  }

  try {
    await loadingWindow.webContents.executeJavaScript(
      `window.setTranslationLoadingState?.(${serializeState(loadingState)});`,
      true
    );
  } catch (error) {
    console.warn("LOADING HUD UPDATE FAILED:", error?.message || error);
  }
}

function createLoadingWindow() {
  const win = new BrowserWindow({
    ...resolveBounds(loadingState || {}),
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
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
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, "screen-saver");
  win.setIgnoreMouseEvents(true, { forward: true });

  win.loadFile(
    path.join(__dirname, "loadingOverlay.html")
  ).then(() => {
    if (win.isDestroyed()) {
      return;
    }

    win.setBounds(resolveBounds(loadingState || {}));
    win.showInactive();
    void pushState();
  }).catch((error) => {
    console.error("LOADING HUD LOAD FAILED:", error);
  });

  win.on("closed", () => {
    if (loadingWindow === win) {
      loadingWindow = null;
    }
  });

  return win;
}

function showTranslationLoading(state = {}) {
  loadingToken += 1;

  loadingState = {
    ...state,
    token: loadingToken,
  };

  if (!loadingWindow || loadingWindow.isDestroyed()) {
    loadingWindow = createLoadingWindow();
  } else {
    loadingWindow.setBounds(resolveBounds(loadingState));
    loadingWindow.showInactive();
    void pushState();
  }

  return loadingToken;
}

function updateTranslationLoading(token, patch = {}) {
  if (!loadingState || token !== loadingState.token) {
    return false;
  }

  loadingState = {
    ...loadingState,
    ...patch,
    token,
  };

  if (loadingWindow && !loadingWindow.isDestroyed()) {
    loadingWindow.setBounds(resolveBounds(loadingState));
    loadingWindow.showInactive();
    void pushState();
  }

  return true;
}

function closeTranslationLoading(token) {
  if (
    token != null &&
    loadingState &&
    token !== loadingState.token
  ) {
    return false;
  }

  loadingState = null;

  if (loadingWindow && !loadingWindow.isDestroyed()) {
    loadingWindow.close();
  }

  loadingWindow = null;
  return true;
}

module.exports = {
  showTranslationLoading,
  updateTranslationLoading,
  closeTranslationLoading,
};
