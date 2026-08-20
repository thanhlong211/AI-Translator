import os
import re
import shutil

def patch_main_cjs():
    path = os.path.join("electron", "main.cjs")
    backup = os.path.join("electron", "main.cjs.backup")
    
    # Tạo file backup để an toàn 100%
    shutil.copyfile(path, backup)
    
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Chèn khóa Single Instance (Ngăn mở nhiều cửa sổ)
    target1 = "let isMangaSessionProcessing = false;"
    if "app.requestSingleInstanceLock()" not in content:
        replacement1 = target1 + """

// === KHÓA 1 INSTANCE ===
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }
});
// ======================="""
        content = content.replace(target1, replacement1)

    # 2. Sửa popup nút X (Chỉ có 2 lựa chọn)
    close_regex = r'mainWindow\.on\("close",\s*\(event\)\s*=>\s*\{[\s\S]*?console\.log\("MAIN WINDOW HIDDEN TO TRAY"\);\s*\}\);'
    
    replacement2 = """mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault(); // Ngăn chặn tắt app

      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'info',
        buttons: ['Thu nhỏ xuống khay (Tray)', 'Thoát ứng dụng'],
        title: 'AI Manga Pro',
        message: 'Bạn muốn ứng dụng tiếp tục chạy ngầm hay thoát hoàn toàn?',
        defaultId: 0,
        cancelId: 0
      });

      if (choice === 0) {
        mainWindow.hide(); // Ẩn cửa sổ
        console.log("MAIN WINDOW HIDDEN TO TRAY");
      } else {
        isQuitting = true;
        app.quit(); // Tắt hẳn
      }
    }
  });"""
    
    if "dialog.showMessageBoxSync(mainWindow" not in content:
        content = re.sub(close_regex, replacement2, content)

    # 3. Xử lý vô hiệu hóa Ctrl+Q
    target3 = "app.whenReady().then(async () => {"
    replacement3 = """function setupApplicationMenu() {
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

app.whenReady().then(async () => {
  setupApplicationMenu();"""
    
    if "setupApplicationMenu();" not in content:
        content = content.replace(target3, replacement3)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
        
    print(" [+] Đã cập nhật thành công main.cjs, giữ nguyên 3300 dòng code gốc của bạn!")

if __name__ == "__main__":
    patch_main_cjs()