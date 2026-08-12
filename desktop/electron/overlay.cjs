const {
    BrowserWindow,
    screen
} = require("electron");

const path = require("path");

let overlayWindow = null;

function createOverlay() {
    console.log("CREATE OVERLAY");

    if (
        overlayWindow &&
        !overlayWindow.isDestroyed()
    ) {
        overlayWindow.focus();
        return overlayWindow;
    }

    const { bounds } =
        screen.getPrimaryDisplay();

    overlayWindow = new BrowserWindow({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,

        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,

        resizable: false,
        movable: false,
        fullscreenable: false,

        webPreferences: {
            preload: path.join(
                __dirname,
                "preload.cjs"
            ),

            contextIsolation: true,
            nodeIntegration: false
        }
    });

    overlayWindow.loadFile(
        path.join(
            __dirname,
            "overlay.html"
        )
    );

    overlayWindow.on(
        "closed",
        () => {
            overlayWindow = null;
        }
    );

    return overlayWindow;
}

function closeOverlay() {
    if (
        overlayWindow &&
        !overlayWindow.isDestroyed()
    ) {
        overlayWindow.close();
    }

    overlayWindow = null;
}

module.exports = {
    createOverlay,
    closeOverlay
};