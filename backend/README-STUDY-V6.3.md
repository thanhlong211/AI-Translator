# AI Translator Backend v6.3 — Study Engine

## Phạm vi v6.3

Bản này thêm **Study Analyzer** nhưng CHƯA tự động lưu Vocabulary vào MySQL.

Mục tiêu là cố định cấu trúc JSON trước:

```text
Japanese OCR text
      ↓
POST /api/v1/study/analyze
      ↓
Translation Profile
      ↓
Study Prompt Builder
      ↓
OpenAI
      ↓
JSON parser + validator
      ↓
StudyAnalyzeResponse
```

## Không cần Flyway migration mới

v6.3 không tạo bảng mới.

Các bảng Profile của v6.2 vẫn được sử dụng để Study Mode hiểu:

- Style
- Context
- Honorific
- Character Rules
- Glossary
- Custom Instructions

## Swagger

Mở:

```text
http://localhost:8080/swagger-ui.html
```

Login → copy `accessToken` → **Authorize**.

Sau đó mở nhóm:

```text
Study
```

và chạy:

```text
POST /api/v1/study/analyze
```

### Request test N4

```json
{
  "text": "学校へ行かなければならない。",
  "profileId": 1,
  "level": "N4",
  "context": []
}
```

`profileId` có thể để `null`; backend sẽ dùng Default Profile.

## Response mục tiêu

Response có dạng:

```json
{
  "success": true,
  "analysis": {
    "original": "学校へ行かなければならない。",
    "reading": "がっこう へ いかなければ ならない。",
    "romaji": "gakkou e ikanakereba naranai.",
    "translation": "Tôi phải đi đến trường.",
    "sentenceSummary": "Câu diễn tả nghĩa vụ phải đi đến trường.",
    "sentenceParts": [
      {
        "text": "学校へ",
        "reading": "がっこう へ",
        "romaji": "gakkou e",
        "role": "Cụm chỉ đích đến",
        "meaning": "đến trường",
        "explanation": "学校 là địa điểm; へ đánh dấu hướng di chuyển."
      }
    ],
    "grammar": [
      {
        "pattern": "～なければならない",
        "jlptLevel": "N4",
        "meaning": "phải làm...",
        "matchedText": "行かなければならない",
        "explanation": "Mẫu diễn tả nghĩa vụ hoặc việc bắt buộc phải làm."
      }
    ],
    "vocabulary": [
      {
        "surface": "学校",
        "dictionaryForm": "学校",
        "reading": "がっこう",
        "romaji": "gakkou",
        "meaning": "trường học",
        "partOfSpeech": "Danh từ",
        "jlptLevel": "N5",
        "note": ""
      },
      {
        "surface": "行かなければ",
        "dictionaryForm": "行く",
        "reading": "いく",
        "romaji": "iku",
        "meaning": "đi",
        "partOfSpeech": "Động từ",
        "jlptLevel": "N5",
        "note": "Trong câu đang ở dạng 行かなければ."
      }
    ],
    "notes": []
  },
  "profile": {
    "id": 1,
    "name": "Default",
    "style": "MANGA",
    "updatedAt": "..."
  },
  "studyLevel": "N4"
}
```

Kết quả AI thực tế có thể khác câu chữ, nhưng JSON structure phải giữ nguyên.

## Study Level

Supported:

```text
AUTO
N5
N4
N3
N2
N1
```

- `AUTO`: AI tự điều chỉnh mức giải thích.
- `N4`: giải thích hướng đến người học N4.
- Nếu câu có grammar cao hơn level đã chọn, AI vẫn phân tích và ghi level tương ứng.

## JSON safety

Study Engine yêu cầu AI trả JSON-only.

Backend vẫn có lớp bảo vệ:

```text
OpenAI output
  ↓
extract JSON object
  ↓
Jackson parse
  ↓
StudyAnalysisValidator
```

Nếu AI trả JSON hỏng:

```text
HTTP 502
```

```json
{
  "success": false,
  "error": "AI trả về Study JSON không hợp lệ. Hãy thử phân tích lại."
}
```

Backend không đẩy raw AI response xuống client.

## Privacy

v6.3:

```text
Study sentence → OpenAI → response
```

Không ghi:

- câu manga vào MySQL,
- reading vào MySQL,
- grammar vào MySQL,
- vocabulary vào MySQL.

Bước kế tiếp mới thêm `user_vocabulary` với cơ chế user kiểm soát Auto-save.
