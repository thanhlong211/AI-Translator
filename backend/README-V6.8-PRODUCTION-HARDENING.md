# Backend V6.8 — Production Hardening

## Mục tiêu

Không thêm feature học mới. Bản này làm backend dễ vận hành hơn trước khi đóng gói/deploy.

## 1. Request ID xuyên suốt

Header:

```text
X-Request-Id
```

Desktop gửi UUID cho mỗi backend request.

Backend `RequestCorrelationFilter`:

```text
- nhận X-Request-Id hợp lệ
- nếu thiếu/sai format → tạo UUID mới
- đặt vào MDC
- trả lại cùng X-Request-Id trong response header
```

Log pattern:

```text
[requestId:...]
```

Translate và Study `performance.requestId` dùng cùng correlation ID thay vì tạo ID riêng.

## 2. Error contract

Error vẫn giữ field cũ:

```json
{
  "success": false,
  "error": "Dữ liệu không hợp lệ."
}
```

nên Desktop cũ không bị vỡ.

V6.8 bổ sung:

```json
{
  "code": "VALIDATION_ERROR",
  "status": 400,
  "requestId": "...",
  "timestamp": "..."
}
```

Một số code:

```text
MALFORMED_JSON
VALIDATION_ERROR
BAD_REQUEST
CONFLICT
UNAUTHORIZED
FORBIDDEN
AI_RESPONSE_FORMAT
INTERNAL_ERROR
```

401/403 từ Spring Security cũng dùng cùng shape.

## 3. Health / Readiness

Actuator:

```text
GET /actuator/health/liveness
GET /actuator/health/readiness
```

Readiness group gồm:

```text
readinessState
db
```

Desktop dùng readiness thay vì health tổng quát.

Không gọi OpenAI trong health check để tránh chi phí và tạo dependency giả.

## 4. Logging privacy

Request ID được log nhưng không thêm OCR text/source manga vào log.

Existing performance logs tiếp tục chỉ chứa:

```text
chars
counts
timings
requestId
```

## 5. Database

Không có Flyway migration mới.

Giữ nguyên:

```text
V1 ... V8
```

## 6. Compatibility

Giữ nguyên:

```text
Structured Study V6.6.3
MCQ SRS
Review Practice V6.7.1
Learning Dashboard V6.7
Vocabulary / Grammar
Profiles
Sessions
```

## Test Swagger

Có thể test endpoint bất kỳ rồi xem response header:

```text
X-Request-Id
```

Sau đó tìm cùng ID trong backend log.

Health:

```text
GET /actuator/health/readiness
```

Khi DB bình thường:

```json
{"status":"UP"}
```
