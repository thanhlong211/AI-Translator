# Backend v6.4.2 — Performance

## Thay đổi

Không có Flyway migration mới.

### 1. Performance tracing

`/translate` log:

```text
PERF translate requestId=...
chars=...
profileMs=...
promptMs=...
openAiMs=...
persistenceMs=...
totalMs=...
```

`/study/analyze` log:

```text
PERF study requestId=...
chars=...
context=...
parts=...
grammar=...
vocabulary=...
profileMs=...
promptMs=...
openAiMs=...
parseMs=...
persistenceMs=...
totalMs=...
```

Không log nội dung OCR.

Response cũng có:

```json
"performance": {
  "requestId": "ab12cd34",
  "profileMs": 12,
  "promptMs": 1,
  "openAiMs": 4200,
  "parseMs": 5,
  "persistenceMs": 18,
  "totalMs": 4238
}
```

### 2. Study output budget

Prompt yêu cầu tối đa:

```text
sentenceParts  <= 12
grammar        <= 6
vocabulary     <= 15
notes          <= 3
```

Validator backend cũng dùng đúng các giới hạn này.

Mục tiêu là giảm lượng output AI phải sinh, thay vì sinh rất dài rồi mới cắt ở Java.

### 3. Stable prompt prefix

Các rule và JSON schema cố định nằm ở đầu prompt.
Profile/context/source nằm sau phần static prefix.

### 4. Timeout

Backend không ép timeout 5-10 giây.

Desktop v6.4.2 dùng:

```text
Translate: 15s
Study:     30s
```

Khi deploy reverse proxy, cấu hình upstream timeout của Study > 30s.

## Cách benchmark

Test 20-50 câu, ghi lại:

```text
translate openAiMs / totalMs
study openAiMs / totalMs
```

Nếu `openAiMs` chiếm gần toàn bộ totalMs thì bottleneck không nằm ở Java/MySQL.
