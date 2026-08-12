# Backend V6.6 — Review / SRS

## Mục tiêu

Vocabulary và Grammar đã lưu giờ có lịch ôn.

```text
Save Vocabulary / Grammar
         ↓
      due_at = now
         ↓
   Review Queue
         ↓
AGAIN / HARD / GOOD / EASY
         ↓
   schedule next due
```

## Flyway

V6.6 thêm:

```text
V7__add_review_srs.sql
```

V7 bổ sung vào cả:

```text
user_vocabulary
user_grammar
```

các field:

```text
due_at
interval_days
ease_factor
repetitions
lapse_count
last_reviewed_at
```

và tạo:

```text
review_events
```

`review_events` chỉ lưu metadata ôn tập, không lưu câu manga.

## API

```text
GET  /api/v1/review/due?limit=30
GET  /api/v1/review/stats
POST /api/v1/review/answer
```

### Due queue

```json
{
  "items": [
    {
      "itemType": "VOCABULARY",
      "itemId": 1,
      "primaryText": "学校",
      "reading": "がっこう",
      "romaji": "gakkou",
      "answer": "trường học",
      "detail": "Danh từ",
      "jlptLevel": "N5",
      "dueAt": "2026-08-06T..."
    }
  ],
  "totalDue": 12,
  "vocabularyDue": 8,
  "grammarDue": 4
}
```

### Chấm card

```json
{
  "itemType": "VOCABULARY",
  "itemId": 1,
  "grade": "GOOD"
}
```

Grade:

```text
AGAIN
HARD
GOOD
EASY
```

## Scheduler V6.6

Đây là SRS cơ bản, deterministic và không gọi AI.

```text
AGAIN
→ due +10 phút
→ repetitions = 0
→ lapse_count +1

HARD
→ khoảng 1 ngày hoặc interval × 1.2

GOOD
→ 1 ngày
→ 3 ngày
→ sau đó interval × ease factor

EASY
→ 3 ngày
→ 7 ngày
→ sau đó interval × ease × 1.3
```

Ease factor được giới hạn:

```text
1.30 → 3.00
```

Sau đủ lượt trả lời tốt:

```text
status → KNOWN
```

Nếu `AGAIN`:

```text
status → LEARNING
```

## Privacy

Review Events chỉ lưu:

```text
user_id
item_type
item_id
grade
interval trước/sau
ease trước/sau
timestamp
```

Không lưu screenshot, source sentence hay context.
