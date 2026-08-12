# Backend V6.7.1 — Review Practice / Re-review

## Vấn đề cũ

`GET /api/v1/review/due` chỉ trả card có `due_at <= now`.
Sau khi trả lời SRS, `due_at` được đẩy sang tương lai nên reload queue không thể hiện card vừa học.
Đây là hành vi đúng của SRS nhưng không đáp ứng nhu cầu ôn lại ngay.

## Hai chế độ

### SRS thật

```text
GET /api/v1/review/due
POST /api/v1/review/answer
practice=false
```

Đúng/sai cập nhật counters, mastery, due_at, interval, ease factor và review_events.

### Practice / Ôn lại

Endpoint mới:

```text
GET /api/v1/review/practice?limit=30
```

Không phụ thuộc due_at. Queue ưu tiên `WEAK → LEARNING → NEW → FAMILIAR → MASTERED`, sau đó ưu tiên accuracy thấp / sai nhiều.

Trả lời:

```json
{
  "itemType": "VOCABULARY",
  "itemId": 12,
  "selectedOptionId": "VOCABULARY:19",
  "responseTimeMs": 2200,
  "practice": true
}
```

Khi `practice=true`, backend chỉ chấm đáp án và trả feedback. Backend KHÔNG gọi scheduler, KHÔNG đổi due_at, KHÔNG tăng correct/wrong counters, KHÔNG đổi correct_streak và KHÔNG ghi review_events.

`ReviewAnswerResponse` thêm field:

```json
"practice": true
```

## Database

Không có migration mới. Giữ V1 ... V8.

## Giữ nguyên

Structured Outputs fix V6.6.3 và Learning Dashboard V6.7 vẫn được giữ nguyên.
