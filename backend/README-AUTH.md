# AI Translator Backend v4 — MySQL + JWT Authentication + Swagger

## Mục tiêu

```text
Register/Login
    ↓
MySQL users
    ↓
BCrypt password hash
    ↓
JWT access token (HS256)
    ↓
Swagger Authorize
    ↓
GET /api/v1/me
POST /api/v1/translate
```

`/api/v1/translate` hiện đã bị khóa. Request không có Bearer token sẽ nhận HTTP 401.
Mỗi translation usage event được gắn với `user_id` đang đăng nhập.

## 1. Tạo JWT secret cho development

Trong PowerShell:

```powershell
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$bytes = New-Object byte[] 32
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
$rng.Dispose()
```

Copy kết quả Base64. Đây là JWT secret development; không commit vào Git.

## 2. IntelliJ Run Configuration

Run → Edit Configurations → AiTranslatorBackendApplication → Environment variables:

```text
OPENAI_API_KEY=...
DB_USERNAME=ai_translator
DB_PASSWORD=...
JWT_SECRET_BASE64=<chuỗi Base64 vừa tạo>
```

## 3. Start backend

Flyway tự chạy:

```text
V1__init_commercial_schema.sql
V2__add_user_role.sql
```

## 4. Swagger

Mở:

```text
http://localhost:8080/swagger-ui.html
```

### Register

`POST /api/v1/auth/register`

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

Response chứa `accessToken`.

### Swagger Authorize

Nhấn **Authorize** ở góc trên Swagger và paste **chỉ access token**.
Nếu Swagger yêu cầu format đầy đủ thì dùng `Bearer <token>` theo UI đang hiển thị.

### Me

`GET /api/v1/me`

Phải trả user đang đăng nhập.

### Translation

`POST /api/v1/translate`

```json
{
  "text": "こんにちは"
}
```

Phải dịch thành công và ghi `translation_usage_events.user_id` bằng id tài khoản.

### Login

`POST /api/v1/auth/login`

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

## 5. Kiểm tra bảo mật cơ bản

- Password trong MySQL là BCrypt hash, không phải plaintext.
- JWT secret chỉ ở environment của server.
- `/translate` không còn public.
- JWT hết hạn mặc định sau 60 phút.
- Tài khoản status khác `ACTIVE` bị từ chối.
- Manga/dialogue text vẫn không được lưu vào MySQL usage table.

## Chưa làm trong v4

- Refresh token
- Logout/revoke session
- Device management
- Quota enforcement
- Subscription enforcement
- Electron Login UI

Bước sau v4: refresh token + Electron login + safeStorage token.
