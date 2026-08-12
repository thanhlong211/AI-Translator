# Backend V6.6.3 — Structured Output Schema Fix

## Lỗi

Study Fast Translate vẫn chạy, nhưng background Study lỗi trước khi gọi OpenAI:

```text
Local validation failed for JSON schema derived from class
com.dangt.aitranslator.backend.study.StudyStructuredOutput

Use of 'default' is not supported here.
```

Các path lỗi thường gồm:

```text
#/properties/original
#/properties/reading
#/properties/grammar
#/properties/grammar/items
#/properties/grammar/items/properties/jlptLevel
#/properties/vocabulary
#/properties/notes
...
```

## Nguyên nhân

Project đang dùng:

```text
openai-java 4.42.0
springdoc-openapi 3.0.3
```

`StudyStructuredOutput` trước đây dùng:

```java
@Schema(...)
@ArraySchema(...)
```

OpenAI Java SDK có hỗ trợ đọc Swagger annotations khi derive JSON Schema.

Với springdoc/swagger annotation stack hiện tại, các annotation có thể làm schema
xuất hiện keyword:

```json
"default": ""
```

hoặc default tương tự dù code không chủ động khai báo.

OpenAI Structured Outputs chỉ hỗ trợ một subset JSON Schema và `default`
không được chấp nhận tại các vị trí đó. Local validator vì vậy chặn request
trước khi gửi tới OpenAI.

## Fix

`StudyStructuredOutput` giờ là DTO thuần:

```java
public class StudyStructuredOutput {
    public String original;
    public String reading;
    public String romaji;
    public String translation;
    public String sentenceSummary;

    public List<SentencePart> sentenceParts;
    public List<GrammarPoint> grammar;
    public List<VocabularyItem> vocabulary;
    public List<String> notes;
}
```

Không còn:

```java
@Schema
@ArraySchema
```

trên DTO này.

Không tắt:

```text
JsonSchemaLocalValidation
```

vì local validation rất hữu ích để bắt schema không tương thích trước production.

## Constraints vẫn còn

Việc bỏ annotation KHÔNG làm mất business limits.

Prompt vẫn yêu cầu:

```text
sentenceParts <= 12
grammar       <= 6
vocabulary    <= 15
notes         <= 3
```

Backend `StudyAnalysisValidator` vẫn cắt/normalize theo đúng giới hạn đó.

JLPT vẫn normalize:

```text
N5 / N4 / N3 / N2 / N1 / UNKNOWN
```

## Database

Không có Flyway migration mới.

Giữ nguyên:

```text
V1 ... V8
```

## Desktop

Không cần thay Desktop V6.6.2.

## Test

Restart backend, sau đó dùng:

```text
Ctrl+Shift+E
```

Kỳ vọng:

```text
PERF desktop study-fast ...
```

sau đó background Study phải hoàn thành:

```text
PERF study ...
PERF desktop study-full ...
```

và KHÔNG còn:

```text
Local validation failed for JSON schema
Use of 'default' is not supported here
```
