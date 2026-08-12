# Backend V6.5 — Learning Library

## Flyway

V6.5 thêm:

```text
V6__add_user_grammar.sql
```

Không sửa V1–V5 đã chạy trước đó.

Bảng mới:

```text
user_grammar
```

Unique:

```text
user_id + pattern
```

Ví dụ cùng user gặp:

```text
～なければならない
```

nhiều lần thì chỉ có một row và:

```text
encounter_count += 1
```

## Grammar API

```text
GET    /api/v1/grammar
GET    /api/v1/grammar/stats
POST   /api/v1/grammar
PATCH  /api/v1/grammar/{id}
DELETE /api/v1/grammar/{id}
```

Có:

```text
NEW
LEARNING
KNOWN
favorite
encounter_count
personal_note
```

## Study Auto-save

`POST /api/v1/study/analyze` nhận thêm:

```json
{
  "autoSaveVocabulary": true,
  "autoSaveGrammar": true
}
```

Response có:

```json
{
  "vocabularySync": {
    "autoSaved": true,
    "inserted": 2,
    "updated": 1,
    "skipped": 0
  },
  "grammarSync": {
    "autoSaved": true,
    "inserted": 1,
    "updated": 0,
    "skipped": 0
  }
}
```

## Privacy

Grammar Library lưu:

```text
pattern
JLPT
meaning
explanation
progress metadata
personal note
```

Không tự lưu:

```text
screenshot
full manga sentence
Study sentenceParts
context
matchedText/example sentence
```

`matchedText` chỉ tồn tại trong response Study hiện tại.

## TEXT mapping

Các field MySQL `TEXT` dùng:

```java
@JdbcTypeCode(SqlTypes.LONGVARCHAR)
@Column(columnDefinition = "TEXT")
```

để giữ fix Hibernate 7 / MySQL từ V6.4.1.
