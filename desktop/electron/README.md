# Batch 08.3.2 — Windows Overlay First-Paint + Main Window Stability

Áp dụng trên **Batch 08.3.1** hiện tại.

## Sửa 2 lỗi

### 1. Lần quét đầu chỉ hiện thanh controls, chưa thấy bubble

Thay đổi:
- `paintWhenInitiallyHidden: true` đặt đúng ở cấp `BrowserWindow`.
- Overlay/controls tắt `backgroundThrottling`.
- Overlay chờ `ready-to-show` (first paint) trước khi show/push payload.
- Renderer tự pull payload nhiều lần trong vài trăm ms nếu IPC đầu bị miss.
- Bảo vệ callback `closed` của window cũ để không xóa state của overlay mới.

### 2. Quay lại main Electron bị trắng

Thay đổi:
- Trong lúc screenshot trên Windows, main window dùng `minimize()` thay vì `hide()`.
  Restore/minimize là lifecycle native ổn định hơn khi đang dùng transparent always-on-top windows.
- `paintWhenInitiallyHidden` của main window được chuyển ra đúng cấp BrowserWindow.
- Health-check main renderer có retry. Không reload ngay ở lần check đầu.
- Bổ sung log cho `preload-error`, `render-process-gone`, `unresponsive`,
  và console error của React renderer.

## File thay

Copy vào `frontend/electron/`:

- `main.cjs`
- `preload.cjs`
- `fullScreenOverlay.cjs`
- `fullScreenOverlay.html`
- `fullScreenControls.html`

`preload.cjs` và `fullScreenControls.html` không thay logic trong batch này nhưng được kèm để giữ bộ file đồng bộ.

## Test

1. Thoát app hoàn toàn.
2. Khởi động lại app.
3. Không scan thử trước.
4. Mở manga.
5. Nhấn `Ctrl + Shift + W`.
6. Kéo khung truyện.
7. Ngay lần đầu phải thấy bubble + controls.
8. Bật `✥`, kéo vài bubble, rồi bấm `✥` để xong.
9. Bấm `×`.
10. Main AI Translator phải restore bình thường, không trắng.

Nếu main vẫn trắng, gửi các log mới có prefix:

- `MAIN RENDERER CONSOLE ERROR`
- `MAIN PRELOAD ERROR`
- `MAIN RENDERER PROCESS GONE`
- `MAIN RENDERER BLANK CHECK`
- `MAIN RENDERER STILL BLANK AFTER RELOAD`

Các log này sẽ cho biết lỗi nằm ở React/preload/renderer process thay vì tiếp tục đoán từ BrowserWindow.
