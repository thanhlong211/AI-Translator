# Backend v6.4.1 — MySQL TEXT / Hibernate 7 Fix

## Lỗi

Startup dừng tại:

```text
Schema validation: wrong column type encountered in column [personal_note]
found [text (Types#LONGVARCHAR)]
but expecting [tinytext (Types#CLOB)]
```

## Nguyên nhân

Migration V5 tạo đúng:

```sql
personal_note TEXT NULL
```

Nhưng entity v6.4 dùng:

```java
@Lob
@Column(name = "personal_note")
private String personalNote;
```

Với Hibernate 7.4 + MySQL, `@Lob String` được suy ra là CLOB và dialect có thể kỳ vọng `TINYTEXT`.

Trong khi MySQL `TEXT` được JDBC report là `LONGVARCHAR`.

## Fix

Không đổi database xuống `TINYTEXT`.

Entity dùng explicit JDBC type:

```java
@JdbcTypeCode(SqlTypes.LONGVARCHAR)
@Column(
    name = "personal_note",
    columnDefinition = "TEXT"
)
private String personalNote;
```

`@Lob` được bỏ.

## Migration

Không có migration mới.

Nếu Flyway V5 đã chạy rồi thì giữ nguyên database.

Không:

```text
DROP DATABASE
DROP TABLE user_vocabulary
DELETE flyway_schema_history
```

## Test

Restart backend.

Expected:

```text
Flyway: schema up to date
Hibernate validation: OK
Application started
```

Sau đó Swagger test:

```text
GET /api/v1/vocabulary/stats
GET /api/v1/vocabulary
```

và:

```text
POST /api/v1/study/analyze
```

với:

```json
{
  "text": "学校へ行かなければならない。",
  "profileId": 1,
  "level": "N4",
  "autoSaveVocabulary": true,
  "context": []
}
```
