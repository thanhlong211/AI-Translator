const {
    BrowserWindow,
    screen
} = require("electron");

const path = require("path");

let translateWindow = null;
let controlsWindow = null;
let overlayPinned = false;

let overlayPreferences = {
    opacity: 0.96,
    fontScale: 1
};

function safeBounds(data) {
    return {
        x: Math.round(
            Number(data?.x) || 0
        ),

        y: Math.round(
            Number(data?.y) || 0
        ),

        width: Math.max(
            120,
            Math.round(
                Number(data?.width) || 120
            )
        ),

        height: Math.max(
            70,
            Math.round(
                Number(data?.height) || 70
            )
        )
    };
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
                ? Math.min(
                    1,
                    Math.max(
                        0.65,
                        opacity
                    )
                )
                : 0.96,

        fontScale:
            Number.isFinite(fontScale)
                ? Math.min(
                    1.4,
                    Math.max(
                        0.8,
                        fontScale
                    )
                )
                : 1
    };
}

function notifyOverlayPreferences() {
    const preferences = {
        ...overlayPreferences
    };

    if (
        translateWindow &&
        !translateWindow.isDestroyed() &&
        !translateWindow.webContents.isLoading()
    ) {
        translateWindow.webContents.send(
            "translation-overlay-preferences",
            preferences
        );
    }

    return preferences;
}

function setTranslationOverlayPreferences(
    next
) {
    overlayPreferences =
        normalizeOverlayPreferences(
            next
        );

    notifyOverlayPreferences();

    return {
        ...overlayPreferences
    };
}

function createTranslateWindow(data) {
    const bounds =
        safeBounds(data);

    translateWindow =
        new BrowserWindow({
            ...bounds,

            show: false,
            frame: false,
            transparent: true,

            alwaysOnTop: true,
            skipTaskbar: true,
            resizable: false,
            movable: false,
            focusable: false,

            webPreferences: {
                preload:
                    path.join(
                        __dirname,
                        "preload.cjs"
                    ),

                contextIsolation: true,
                nodeIntegration: false
            }
        });

    translateWindow
        .setAlwaysOnTop(
            true,
            "floating"
        );

    /*
     * Bubble dịch vẫn click-through.
     * Pin/Close nằm ở một controls window nhỏ riêng.
     */
    translateWindow
        .setIgnoreMouseEvents(
            true
        );

    translateWindow.loadFile(
        path.join(
            __dirname,
            "translate.html"
        )
    );

    translateWindow.on(
        "closed",
        () => {
            translateWindow = null;

            if (
                controlsWindow &&
                !controlsWindow.isDestroyed()
            ) {
                controlsWindow.close();
            }

            controlsWindow = null;
        }
    );

    return translateWindow;
}

function controlsBounds(
    translationBounds
) {
    const width = 70;
    const height = 28;
    const gap = 6;

    /*
     * Controls KHÔNG được đè lên vùng dịch.
     *
     * Thứ tự ưu tiên:
     * 1. Trên bubble
     * 2. Dưới bubble
     * 3. Bên phải
     * 4. Bên trái
     *
     * Dùng display gần bubble nhất thay vì PrimaryDisplay,
     * nên vẫn hoạt động đúng với multi-monitor.
     */
    const display =
        screen.getDisplayNearestPoint({
            x:
                translationBounds.x +
                Math.round(
                    translationBounds.width / 2
                ),

            y:
                translationBounds.y +
                Math.round(
                    translationBounds.height / 2
                )
        });

    const workArea =
        display.workArea;

    const preferredX =
        Math.min(
            workArea.x +
                workArea.width -
                width,

            Math.max(
                workArea.x,
                translationBounds.x +
                    translationBounds.width -
                    width
            )
        );

    const aboveY =
        translationBounds.y -
        gap -
        height;

    if (
        aboveY >=
        workArea.y
    ) {
        return {
            x:
                preferredX,

            y:
                aboveY,

            width,
            height
        };
    }

    const belowY =
        translationBounds.y +
        translationBounds.height +
        gap;

    if (
        belowY +
            height <=
        workArea.y +
            workArea.height
    ) {
        return {
            x:
                preferredX,

            y:
                belowY,

            width,
            height
        };
    }

    const rightX =
        translationBounds.x +
        translationBounds.width +
        gap;

    if (
        rightX +
            width <=
        workArea.x +
            workArea.width
    ) {
        return {
            x:
                rightX,

            y:
                Math.min(
                    workArea.y +
                        workArea.height -
                        height,

                    Math.max(
                        workArea.y,
                        translationBounds.y
                    )
                ),

            width,
            height
        };
    }

    const leftX =
        translationBounds.x -
        gap -
        width;

    if (
        leftX >=
        workArea.x
    ) {
        return {
            x:
                leftX,

            y:
                Math.min(
                    workArea.y +
                        workArea.height -
                        height,

                    Math.max(
                        workArea.y,
                        translationBounds.y
                    )
                ),

            width,
            height
        };
    }

    /*
     * Trường hợp cực hiếm: bubble chiếm gần hết workArea.
     * Vẫn đặt controls trong workArea nhưng ưu tiên vị trí
     * có khoảng trống lớn nhất; không thay đổi bounds bubble.
     */
    return {
        x:
            workArea.x +
            workArea.width -
            width,

        y:
            workArea.y,

        width,
        height
    };
}

function createControlsWindow(
    translationBounds
) {
    controlsWindow =
        new BrowserWindow({
            ...controlsBounds(
                translationBounds
            ),

            show: false,
            frame: false,
            transparent: true,

            alwaysOnTop: true,
            skipTaskbar: true,
            resizable: false,
            movable: false,
            minimizable: false,
            maximizable: false,

            webPreferences: {
                preload:
                    path.join(
                        __dirname,
                        "preload.cjs"
                    ),

                contextIsolation: true,
                nodeIntegration: false
            }
        });

    controlsWindow
        .setAlwaysOnTop(
            true,
            "floating"
        );

    controlsWindow.loadFile(
        path.join(
            __dirname,
            "translateControls.html"
        )
    );

    controlsWindow.on(
        "closed",
        () => {
            controlsWindow = null;
        }
    );

    return controlsWindow;
}

function updateControlsBounds(
    translationBounds
) {
    if (
        !controlsWindow ||
        controlsWindow.isDestroyed()
    ) {
        return;
    }

    controlsWindow.setBounds(
        controlsBounds(
            translationBounds
        )
    );
}

function notifyOverlayState() {
    const state = {
        pinned:
            overlayPinned,

        visible:
            Boolean(
                translateWindow &&
                !translateWindow.isDestroyed() &&
                translateWindow.isVisible()
            )
    };

    if (
        controlsWindow &&
        !controlsWindow.isDestroyed() &&
        !controlsWindow.webContents.isLoading()
    ) {
        controlsWindow.webContents.send(
            "translation-overlay-state",
            state
        );
    }

    return state;
}

function showSelectionTranslation(data) {
    const bounds =
        safeBounds(data);

    let win =
        translateWindow;

    if (
        !win ||
        win.isDestroyed()
    ) {
        win =
            createTranslateWindow(
                data
            );

        win.webContents.once(
            "did-finish-load",
            () => {
                if (win.isDestroyed()) {
                    return;
                }

                win.webContents.send(
                    "translation-overlay-preferences",
                    overlayPreferences
                );

                win.webContents.send(
                    "selection-translation",
                    data
                );

                win.showInactive();
            }
        );
    } else {
        win.setBounds(bounds);

        win.webContents.send(
            "translation-overlay-preferences",
            overlayPreferences
        );

        win.webContents.send(
            "selection-translation",
            data
        );

        win.showInactive();
    }

    let controls =
        controlsWindow;

    if (
        !controls ||
        controls.isDestroyed()
    ) {
        controls =
            createControlsWindow(
                bounds
            );

        controls.webContents.once(
            "did-finish-load",
            () => {
                if (
                    controls.isDestroyed()
                ) {
                    return;
                }

                controls.showInactive();
                notifyOverlayState();
            }
        );
    } else {
        updateControlsBounds(
            bounds
        );

        controls.showInactive();
        notifyOverlayState();
    }
}

function hideSelectionTranslation() {
    if (
        translateWindow &&
        !translateWindow.isDestroyed()
    ) {
        translateWindow.hide();
    }

    if (
        controlsWindow &&
        !controlsWindow.isDestroyed()
    ) {
        controlsWindow.hide();
    }

    notifyOverlayState();
}

function closeSelectionTranslation() {
    if (
        translateWindow &&
        !translateWindow.isDestroyed()
    ) {
        translateWindow.close();
    }

    if (
        controlsWindow &&
        !controlsWindow.isDestroyed()
    ) {
        controlsWindow.close();
    }

    translateWindow = null;
    controlsWindow = null;
}

function setTranslationOverlayPinned(
    value
) {
    overlayPinned =
        Boolean(value);

    notifyOverlayState();

    return overlayPinned;
}

function toggleTranslationOverlayPinned() {
    return setTranslationOverlayPinned(
        !overlayPinned
    );
}

function isTranslationOverlayPinned() {
    return overlayPinned;
}

function getTranslationOverlayState() {
    return notifyOverlayState();
}

module.exports = {
    showSelectionTranslation,
    hideSelectionTranslation,
    closeSelectionTranslation,
    setTranslationOverlayPinned,
    toggleTranslationOverlayPinned,
    isTranslationOverlayPinned,
    getTranslationOverlayState,
    setTranslationOverlayPreferences
};
