# AI Translator Backend v6.4 — Personal Vocabulary

## Mục tiêu

Từ vựng phát hiện trong Study Mode giờ có thể được lưu theo từng account.

```text
Study Analyzer
   ↓
vocabulary[]
   ↓
autoSaveVocabulary?
   ├─ false → chỉ trả về UI
   └─ true  → upsert MySQL
                  ↓
            user_vocabulary
```

## Flyway

Backend v6.4 tự chạy:

```text
V5__add_user_vocabulary.sql
```

Tạo bảng:

```text
user_vocabulary
```

Các field chính:

```text
user_id
surface
dictionary_form
reading
romaji
meaning
part_of_speech
jlpt_level

learning_status
favorite
encounter_count
personal_note

first_seen_at
last_seen_at
```

Unique:

```text
user_id + dictionary_form + reading
```

Vì vậy cùng một user gặp `学校 / がっこう` nhiều lần sẽ không tạo nhiều row.

---

## Trạng thái học

```text
NEW
LEARNING
KNOWN
```

Từ mới Auto-save mặc định:

```text
NEW
```

---

## 1. Test Study Auto-save

Swagger:

```text
POST /api/v1/study/analyze
```

Body:

```json
{
  "text": "学校へ行かなければならない。",
  "profileId": 1,
  "level": "N4",
  "autoSaveVocabulary": true,
  "context": []
}
```

Response thêm:

```json
{
  "vocabularySync": {
    "autoSaved": true,
    "inserted": 2,
    "updated": 0,
    "skipped": 0
  }
}
```

Lần đầu một từ xuất hiện:

```text
encounter_count = 1
status = NEW
```

Phân tích lại một câu có cùng từ:

```text
encounter_count = 2
last_seen_at = now()
```

Không tạo duplicate.

Nếu:

```json
"autoSaveVocabulary": false
```

response:

```json
{
  "vocabularySync": {
    "autoSaved": false,
    "inserted": 0,
    "updated": 0,
    "skipped": 0
  }
}
```

---

## 2. Danh sách từ vựng

```text
GET /api/v1/vocabulary
```

Optional query:

```text
q
status
favorite
page
size
```

Ví dụ:

```text
GET /api/v1/vocabulary?status=NEW&page=0&size=50
```

Response:

```json
{
  "items": [
    {
      "id": 1,
      "surface": "行かなければ",
      "dictionaryForm": "行く",
      "reading": "いく",
      "romaji": "iku",
      "meaning": "đi",
      "partOfSpeech": "Động từ",
      "jlptLevel": "N5",
      "status": "NEW",
      "favorite": false,
      "encounterCount": 3,
      "personalNote": null
    }
  ],
  "totalItems": 1,
  "page": 0,
  "size": 50,
  "totalPages": 1
}
```

---

## 3. Stats

```text
GET /api/v1/vocabulary/stats
```

Ví dụ:

```json
{
  "total": 120,
  "newCount": 40,
  "learningCount": 55,
  "knownCount": 25,
  "favoriteCount": 10
}
```

---

## 4. Save thủ công từ Study UI

```text
POST /api/v1/vocabulary
```

```json
{
  "surface": "行かなければ",
  "dictionaryForm": "行く",
  "reading": "いく",
  "romaji": "iku",
  "meaning": "đi",
  "partOfSpeech": "Động từ",
  "jlptLevel": "N5",
  "recordEncounter": false
}
```

`recordEncounter=false` có nghĩa là user chỉ bấm **+ Lưu**;
không coi thao tác Save là một lần gặp mới.

---

## 5. Đánh dấu đang học / đã thuộc

```text
PATCH /api/v1/vocabulary/{id}
```

```json
{
  "status": "LEARNING",
  "favorite": true,
  "personalNote": "Ôn lại thể ない."
}
```

Sau khi thuộc:

```json
{
  "status": "KNOWN"
}
```

Các field để `null` sẽ giữ giá trị cũ.

---

## 6. Xóa

```text
DELETE /api/v1/vocabulary/{id}
```

Chỉ xóa từ thuộc chính account JWT hiện tại.

---

## Privacy

Backend v6.4 vẫn KHÔNG tự lưu:

```text
❌ screenshot
❌ cả câu manga
❌ sentence analysis
❌ grammar analysis
❌ context
```

Chỉ khi Auto-save bật, các **Vocabulary Item** đã được AI trích xuất mới được upsert vào `user_vocabulary`.
