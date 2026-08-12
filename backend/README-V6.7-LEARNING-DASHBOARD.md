# Backend V6.7 — Learning Dashboard

## Mục tiêu

Biến dữ liệu Review/SRS thành dashboard học tập mà không bật lưu nội dung truyện.

Endpoint:

```text
GET /api/v1/learning/dashboard
```

JWT bắt buộc.

## Không có Flyway mới

V6.7 dùng dữ liệu đã có trong:

```text
review_events
user_vocabulary
user_grammar
```

Giữ nguyên migration:

```text
V1 ... V8
```

## Response

```json
{
  "overview": {
    "reviewed14Days": 42,
    "correct14Days": 34,
    "wrong14Days": 8,
    "accuracy14Days": 81,
    "activeDays14Days": 8,
    "currentStreakDays": 4,
    "weakItems": 6,
    "masteredItems": 13
  },
  "dailyActivity": [],
  "weakItems": [],
  "recentReviews": []
}
```

## Daily Activity

Trả đủ 14 ngày, kể cả ngày không review.

```json
{
  "date": "2026-08-06",
  "reviewed": 12,
  "correct": 10,
  "wrong": 2,
  "accuracyPercent": 83
}
```

Boundary ngày dùng:

```properties
app.learning.time-zone=${LEARNING_TIME_ZONE:Asia/Ho_Chi_Minh}
```

Có thể đổi trên production.

## Current streak

Nếu hôm nay đã học:

```text
tính từ hôm nay lùi về trước
```

Nếu hôm nay chưa học nhưng hôm qua có:

```text
streak vẫn được giữ trong ngày hôm nay
và tính từ hôm qua lùi về trước
```

## Weak Items

Weak item chỉ dùng quiz khách quan V6.6.2+:

```text
review_correct_count
review_wrong_count
correct_streak
```

Không dùng self-grade cũ.

Priority tăng khi sai nhiều:

```text
wrong nhiều → priority cao
wrong > correct → tăng thêm priority
correct streak → giảm priority
```

Dashboard trả tối đa 10 item ưu tiên nhất nhưng overview `weakItems`
là tổng số item yếu trong pool hiện tại.

## Recent Review

Tối đa 20 review trắc nghiệm gần nhất:

```text
item type
item id
primary text
correct / wrong
automatic SRS grade
response time
reviewed at
```

Không lưu source sentence mới.

## Privacy

Dashboard KHÔNG đọc/lưu:

```text
screenshot
OCR sentence
translation sentence
Study context
matched manga text
```

Nó chỉ tổng hợp metadata học tập đã tồn tại.

## Structured Study

V6.6.3 fix vẫn giữ:

```text
StudyStructuredOutput không dùng Swagger @Schema/@ArraySchema
```
