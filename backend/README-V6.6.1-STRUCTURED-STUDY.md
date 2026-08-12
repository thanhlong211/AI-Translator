# Backend V6.6.1 — Structured Study Output Fix

## Lỗi đã xử lý

Trước V6.6.1, Study Mode làm:

```text
prompt yêu cầu JSON
→ model trả raw text
→ extract `{ ... }`
→ ObjectMapper.readValue(...)
```

Chỉ cần JSON bị thiếu dấu quote/comma hoặc output bị nhiễu là:

```text
AI trả về Study JSON không hợp lệ.
```

## Fix

V6.6.1 dùng **Responses API Structured Outputs** của `openai-java 4.42.0`:

```java
StructuredResponseCreateParams<StudyStructuredOutput> params =
    ResponseCreateParams.builder()
        .input(prompt)
        .text(StudyStructuredOutput.class)
        .model(studyModel)
        .build();
```

Sau đó SDK trả trực tiếp `StudyStructuredOutput` thay vì raw JSON string.

## Kết quả

Đã bỏ khỏi StudyService:

```text
ObjectMapper
extractJsonObject(...)
parseStudyJson(...)
code-fence stripping
manual JSON parsing
```

Validator nghiệp vụ vẫn giữ nguyên để normalize:

```text
JLPT
max sentenceParts
max grammar
max vocabulary
required Vietnamese translation
```

## Prompt

Schema JSON literal dài cũng được bỏ khỏi prompt vì API đã gửi JSON Schema riêng.
Điều này vừa giảm input token vừa tránh prompt schema và Java schema lệch nhau.

## Privacy / Logging

Không log raw Study output.

Nếu Structured Output gặp lỗi, log chỉ chứa:

```text
requestId
exception class
message đã giới hạn độ dài
```

## Database

Không có Flyway migration mới.

V1–V7 giữ nguyên.

## Desktop

Không cần sửa Desktop V6.6.
Response `/api/v1/study/analyze` bên ngoài vẫn giữ cùng contract.

## Test

Swagger:

```text
POST /api/v1/study/analyze
```

```json
{
  "text": "学校へ行かなければならない。",
  "profileId": 1,
  "level": "N4",
  "autoSaveVocabulary": true,
  "autoSaveGrammar": true,
  "context": []
}
```

Chạy lặp lại nhiều câu để xác nhận không còn lỗi parse raw JSON.
