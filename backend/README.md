# AI Translator Backend

Backend thương mại đầu tiên cho AI Translator Desktop.

## Mục tiêu của bước này

Luồng hiện tại:

```text
Electron
  -> OCR local
  -> Java Spring Boot
  -> OpenAI
  -> JSON tiếng Việt
```

OpenAI API key chỉ nằm ở backend.

## Công nghệ

- Java 21
- Spring Boot 4.1.0
- Maven
- OpenAI Java SDK 4.42.0
- OpenAI Responses API
- Model mặc định: `gpt-4.1-mini`

## 1. Kiểm tra môi trường

```powershell
java -version
mvn -version
```

Khuyến nghị Java 21.

## 2. Chạy backend trên Windows

Cách an toàn hơn cho lúc development:

```powershell
.\run-dev.ps1
```

Script sẽ hỏi API key bằng ô nhập ẩn, đặt key vào biến môi trường của tiến trình hiện tại, chạy backend và xóa biến đó khi backend dừng.

Nếu PowerShell chặn script:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\run-dev.ps1
```

Không gửi API key vào chat và không commit key vào Git.

## 3. Kiểm tra health

Mở:

```text
http://localhost:8080/actuator/health
```

Kết quả mong đợi:

```json
{
  "status": "UP"
}
```

## 4. Test dịch

Mở PowerShell thứ hai:

```powershell
.\test-translate.ps1
```

Kết quả gần dạng:

```json
{
  "success": true,
  "translation": {
    "original": "こんにちは",
    "vietnamese": "Xin chào"
  }
}
```

Hoặc test thủ công:

```powershell
$body = @{
    text = "お前一人か？"
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri "http://localhost:8080/api/v1/translate" `
    -Method Post `
    -ContentType "application/json; charset=utf-8" `
    -Body $body
```

## 5. Endpoint hiện có

### POST `/api/v1/translate`

Request:

```json
{
  "text": "こんにちは"
}
```

Response:

```json
{
  "success": true,
  "translation": {
    "original": "こんにちは",
    "vietnamese": "Xin chào"
  }
}
```

### GET `/actuator/health`

Dùng kiểm tra backend đang hoạt động.

## Chưa làm ở bước này

Cố ý chưa thêm để test kiến trúc nhỏ trước:

- Login/JWT
- Database
- License
- Subscription
- Credits/quota
- Rate limit
- Prompt Profile
- Character database
- Glossary
- Context memory

Sau khi endpoint `/translate` chạy ổn, bước kế tiếp là sửa `electron/main.cjs` để Electron gọi `http://localhost:8080/api/v1/translate` thay vì gọi OpenAI trực tiếp.

Sau đó mới thêm authentication và quota.


## MySQL v3

See `README-MYSQL.md` for MySQL setup, Flyway and Swagger tests.


## v4 Authentication

Xem `README-AUTH.md` để test Register/Login/JWT/Swagger Authorize.


## v5 Authentication Sessions

Bản này bổ sung:

- JWT access token 15 phút
- Opaque refresh token 30 ngày
- Refresh token rotation
- MySQL `auth_sessions`
- Device session list/revoke
- Swagger endpoints `/auth/refresh`, `/auth/logout`, `/me/devices`

Xem `README-SESSIONS.md`.


## v6.2 Translation Profiles

Bổ sung:

- MySQL Translation Profiles
- Custom Instructions
- Translation Style
- Context Memory input
- Character Rules
- Glossary
- Prompt Builder
- Swagger CRUD `/api/v1/profiles`
- `/api/v1/translate` nhận `profileId` + `context`

Xem `README-PROFILES.md`.


## v6.3 Study Engine

Bổ sung:

```text
POST /api/v1/study/analyze
```

Trả structured analysis:

- translation
- hiragana reading
- romaji
- sentence parts
- grammar points
- vocabulary
- notes

Không có DB migration mới và chưa lưu Vocabulary.

Xem `README-STUDY-V6.3.md`.


## v6.4 Personal Vocabulary

Bổ sung:

- Flyway V5 `user_vocabulary`
- `NEW / LEARNING / KNOWN`
- Favorite
- Personal note
- Encounter count
- Search/filter/pagination
- Study `autoSaveVocabulary`
- Manual Save từ Study UI

Xem `README-VOCABULARY-V6.4.md`.


## v6.4.2 Performance

- PERF timing cho Translate/Study
- Study output budget nhỏ hơn
- Stable Study prompt prefix
- Không có DB migration mới

Xem `README-V6.4.2-PERFORMANCE.md`.


## v6.5 Learning Library

- Flyway V6 `user_grammar`
- Grammar CRUD/Stats
- Auto-save Grammar trong Study
- NEW / LEARNING / KNOWN
- Favorite / Note / Encounter count

Xem `README-V6.5-LEARNING-LIBRARY.md`.


## v6.6 Review / SRS

- Flyway V7 review scheduling
- Mixed Vocabulary + Grammar queue
- AGAIN / HARD / GOOD / EASY
- Review metadata history

Xem `README-V6.6-REVIEW-SRS.md`.

## v6.6.1 Structured Study Output

Study Engine chuyển từ raw JSON parsing sang OpenAI Responses API Structured Outputs.

Xem `README-V6.6.1-STRUCTURED-STUDY.md`.


## v6.6.2 MCQ Behavioral SRS

- 4 random answer choices
- Objective correct/wrong history
- Automatic SRS grade
- 5 mastery levels
- No self-rating buttons

Xem `README-V6.6.2-MCQ-SRS.md`.


## v6.6.3 Structured Schema Fix

- Remove Swagger `@Schema` / `@ArraySchema` from `StudyStructuredOutput`.
- Keep OpenAI local JSON Schema validation enabled.
- Preserve Study prompt limits and server-side validator.
- No DB migration.
- Desktop V6.6.2 remains compatible.

See `README-V6.6.3-STRUCTURED-SCHEMA-FIX.md`.


## v6.7 Learning Dashboard

- 14-day learning activity
- Objective accuracy
- Current study streak
- Weak-item ranking
- Mastered-item count
- Recent objective reviews
- No manga sentence history storage

Xem `README-V6.7-LEARNING-DASHBOARD.md`.


## v6.7.1 Review Practice

- Due SRS và Practice được tách riêng.
- Practice không thay dueAt / mastery / counters.
- Có thể ôn lại ngay sau khi hoàn thành phiên.
- Card sai trong Practice quay lại cuối phiên.
- Không có Flyway migration mới.

Xem `README-V6.7.1-REVIEW-PRACTICE.md`.


## v6.8 Production Hardening

- End-to-end `X-Request-Id`.
- Structured API errors.
- Readiness/liveness health probes.
- Safe retry only for GET/HEAD.
- No automatic retry for Translate/Study POST.
- No database migration.

Xem `README-V6.8-PRODUCTION-HARDENING.md`.
