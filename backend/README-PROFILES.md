# AI Translator Backend v6.2 — Translation Profiles

## Mục tiêu

```text
User
  ↓
Translation Profile
  ├─ Style
  ├─ Context Lines
  ├─ Honorific
  ├─ Custom Instructions
  ├─ Characters
  └─ Glossary
  ↓
Prompt Builder
  ↓
OpenAI
```

## Flyway

Khi chạy backend v6.2, Flyway tự chạy:

```text
V4__add_translation_profiles.sql
```

Tạo:

```text
translation_profiles
profile_characters
profile_glossary
```

## Swagger

Mở:

```text
http://localhost:8080/swagger-ui.html
```

Login → copy accessToken → **Authorize**.

### 1. Lấy profiles

```text
GET /api/v1/profiles
```

Nếu user chưa có profile, backend tự tạo:

```text
Default
Style: MANGA
Context: 5
Keep honorifics: true
```

### 2. Tạo profile Frieren

`POST /api/v1/profiles`

```json
{
  "name": "Frieren",
  "style": "MANGA",
  "contextLines": 5,
  "keepHonorifics": true,
  "customInstruction": "Dịch hội thoại tự nhiên. Không tự tiện Việt hóa tên riêng.",
  "characters": [
    {
      "name": "Frieren",
      "aliases": ["フリーレン"],
      "rule": "Frieren xưng tôi. Không tự động gọi Frieren là cô."
    },
    {
      "name": "Fern",
      "aliases": ["フェルン"],
      "rule": "Fern nói lịch sự và gọi Frieren là sư phụ khi phù hợp."
    }
  ],
  "glossary": [
    {
      "source": "魔力",
      "target": "Ma lực",
      "note": "Không dùng năng lượng ma thuật."
    }
  ]
}
```

### 3. Dịch bằng profile

`POST /api/v1/translate`

```json
{
  "text": "魔力が足りない",
  "profileId": 2,
  "context": [
    {
      "original": "前のセリフ",
      "vietnamese": "Câu thoại trước"
    }
  ]
}
```

Backend sẽ:

```text
profileId
→ kiểm tra profile thuộc user
→ lấy Style
→ lấy Custom Instructions
→ Character rules
→ Glossary
→ chỉ lấy số contextLines đã cấu hình
→ build prompt
→ OpenAI
```

## API Profile

```text
GET    /api/v1/profiles
GET    /api/v1/profiles/{id}
POST   /api/v1/profiles
PUT    /api/v1/profiles/{id}
PUT    /api/v1/profiles/{id}/default
DELETE /api/v1/profiles/{id}
```

Không thể xóa profile Default cho tới khi đặt một profile khác làm mặc định.

## Privacy

Profile lưu rules/glossary do user chủ động tạo.

Translation usage vẫn chỉ lưu metadata; backend không tự lưu nội dung manga vào usage table.
