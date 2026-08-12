# AI Translator Backend v3 - MySQL

## Architecture

```text
Electron OCR
   -> Spring Boot
   -> OpenAI
   -> MySQL usage metadata
```

MySQL is now the persistent store for the commercial backend.

## 1. Create database and development user

Open MySQL Workbench (or MySQL command line) and run:

```text
mysql/setup-dev.sql
```

Before running it, replace:

```text
CHANGE_ME_WITH_A_STRONG_PASSWORD
```

with your own local database password.

## 2. IntelliJ Run Configuration

Run -> Edit Configurations -> AiTranslatorBackendApplication -> Environment variables

Set:

```text
OPENAI_API_KEY=<your OpenAI server key>
DB_USERNAME=ai_translator
DB_PASSWORD=<your MySQL password>
```

Optional:

```text
DB_URL=jdbc:mysql://localhost:3306/ai_translator?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&allowPublicKeyRetrieval=true&useSSL=false
```

Do not commit these secrets.

## 3. Start backend

Run `AiTranslatorBackendApplication` in IntelliJ.

Flyway automatically runs:

```text
src/main/resources/db/migration/V1__init_commercial_schema.sql
```

and creates:

```text
users
subscriptions
translation_usage_events
flyway_schema_history
```

Hibernate is configured with `ddl-auto=validate`, so Flyway remains the only owner of schema changes.

## 4. Swagger UI

Open:

```text
http://localhost:8080/swagger-ui.html
```

### Check MySQL

Open:

```text
System
GET /api/v1/system/database
```

Click **Try it out -> Execute**.

Expected shape:

```json
{
  "connected": true,
  "product": "MySQL",
  "version": "8.x",
  "database": "ai_translator",
  "translationUsageEvents": 0
}
```

### Test translation

Use:

```text
Translation
POST /api/v1/translate
```

Body:

```json
{
  "text": "こんにちは"
}
```

After a successful translation, call `GET /api/v1/system/database` again.
`translationUsageEvents` should increase by 1.

## Privacy decision

`translation_usage_events` stores only:

- model name
- source character count
- translated character count
- success state
- timestamp
- future user_id

It does NOT store the OCR text or translated manga/dialogue.

## Next phase

The schema already contains `users` and `subscriptions` so the next patch can add:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/me
JWT / refresh token
quota per subscription
```
