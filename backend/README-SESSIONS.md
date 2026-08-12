# AI Translator Backend v5 — Refresh Token + Device Sessions

## Kiến trúc token

```text
Login/Register
    ↓
Access Token JWT (15 phút)
    +
Refresh Token opaque (30 ngày)
```

- Access token: client giữ trong RAM.
- Refresh token: Electron mã hóa bằng `safeStorage`.
- MySQL chỉ lưu `SHA-256(refresh token)`, không lưu token thật.
- Refresh token được **rotate** mỗi lần gọi `/auth/refresh`.

## Migration mới

Flyway tự chạy:

```text
V3__add_auth_sessions.sql
```

Tạo bảng:

```text
auth_sessions
```

## Swagger test

Mở:

```text
http://localhost:8080/swagger-ui.html
```

### 1. Register hoặc Login

`POST /api/v1/auth/login`

```json
{
  "email": "test@example.com",
  "password": "StrongPassword123!",
  "deviceId": "my-desktop-001",
  "deviceName": "My Windows PC"
}
```

Response có:

- `accessToken`
- `refreshToken`
- `expiresInSeconds`
- `refreshExpiresInSeconds`

### 2. Authorize

Copy `accessToken` → nút **Authorize** trong Swagger.

### 3. Refresh

`POST /api/v1/auth/refresh`

```json
{
  "refreshToken": "..."
}
```

Refresh token cũ bị thay thế bằng token mới.

### 4. Devices

Sau khi Authorize:

```text
GET /api/v1/me/devices
```

Có thể thu hồi:

```text
DELETE /api/v1/me/devices/{sessionId}
```

### 5. Logout

```text
POST /api/v1/auth/logout
```

với refresh token hiện tại.

> JWT access token đã phát hành vẫn có thể sống tối đa 15 phút.
> Vì vậy v5 giảm access token từ 60 phút xuống 15 phút.
> Bước production nâng cao có thể thêm access-token blacklist nếu cần thu hồi tức thời.
