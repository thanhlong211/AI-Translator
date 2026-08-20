const { app, BrowserWindow, ipcMain, dialog, Menu, Tray, nativeImage } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
let isQuitting = false;

// ==========================================
// 1. KHÓA ỨNG DỤNG - CHỈ CHO PHÉP MỞ 1 CỬA SỔ
// ==========================================
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', (event, commandLine, workingDirectory) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }
});

// ==========================================
// 2. KHỞI TẠO CỬA SỔ CHÍNH
// ==========================================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // ==========================================
  // 3. XỬ LÝ SỰ KIỆN BẤM TẮT (NÚT X) - CHỈ CÓ 2 LỰA CHỌN
  // ==========================================
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();

      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'question',
        buttons: ['Thu nhỏ xuống khay (Tray)', 'Thoát hoàn toàn'],
        title: 'Xác nhận tắt ứng dụng',
        message: 'Bạn muốn ứng dụng chạy ngầm hay thoát hoàn toàn?',
        defaultId: 0,
        cancelId: 0 // Nếu bấm nút X trên hộp thoại, mặc định sẽ chạy ngầm
      });

      if (choice === 0) {
        mainWindow.hide(); // Chạy ngầm
      } else if (choice === 1) {
        isQuitting = true;
        app.quit(); // Thoát hẳn
      }
    }
  });
}

// ==========================================
// 4. KHỞI TẠO SYSTEM TRAY (CHẠY NGẦM)
// ==========================================
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  
  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Mở AI Manga Pro', 
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      } 
    },
    { type: 'separator' },
    { 
      label: 'Thoát ứng dụng', 
      click: () => {
        isQuitting = true;
        app.quit();
      } 
    }
  ]);

  tray.setToolTip('AI Manga Pro - Đang chạy ngầm');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ==========================================
// 5. VÔ HIỆU HÓA CTRL+Q
// ==========================================
function setupApplicationMenu() {
  const template = [
    {
      label: 'App',
      submenu: [
        { 
          label: 'Quit', 
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            if (mainWindow && mainWindow.isVisible()) {
                mainWindow.close();
            } else {
                isQuitting = true;
                app.quit();
            }
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ==========================================
// VÒNG ĐỜI ỨNG DỤNG ELECTRON
// ==========================================
app.whenReady().then(() => {
  setupApplicationMenu();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit();
  }
});
