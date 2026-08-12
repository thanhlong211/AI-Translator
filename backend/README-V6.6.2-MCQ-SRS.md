# Backend V6.6.2 — Multiple-choice Behavioral SRS

## Mục tiêu

Bỏ việc bắt user tự chọn:

```text
AGAIN / HARD / GOOD / EASY
```

UI giờ hỏi trắc nghiệm 4 đáp án. Backend tự chấm đúng/sai và tự suy ra SRS grade.

## Flyway

Thêm:

```text
V8__add_review_quiz_mastery.sql
```

Cho `user_vocabulary` và `user_grammar`:

```text
review_correct_count
review_wrong_count
correct_streak
```

Cho `review_events`:

```text
question_type
is_correct
response_time_ms
```

Không sửa V1–V7.

## Queue

```text
GET /api/v1/review/due?limit=30
```

Mỗi item có:

```json
{
  "quizReady": true,
  "questionType": "MEANING",
  "options": [
    {
      "optionId": "VOCABULARY:10",
      "text": "trường học"
    },
    {
      "optionId": "VOCABULARY:22",
      "text": "công ty"
    },
    {
      "optionId": "VOCABULARY:31",
      "text": "bệnh viện"
    },
    {
      "optionId": "VOCABULARY:18",
      "text": "thư viện"
    }
  ],
  "masteryLevel": "LEARNING",
  "accuracyPercent": 67,
  "correctCount": 4,
  "wrongCount": 2,
  "correctStreak": 1
}
```

Correct option luôn nằm trong 4 lựa chọn, nhưng client không cần gửi grade.

Distractor:

```text
1 correct + 3 wrong
```

được lấy từ chính kho cá nhân của user.

Ưu tiên distractor cùng JLPT trước, sau đó mới lấy level khác.

Không gọi OpenAI để tạo câu hỏi Review.

## Answer

```text
POST /api/v1/review/answer
```

Body mới:

```json
{
  "itemType": "VOCABULARY",
  "itemId": 10,
  "selectedOptionId": "VOCABULARY:22",
  "responseTimeMs": 3200
}
```

Backend xác định:

```text
selected item id == current item id
→ correct

khác
→ wrong
```

Response:

```json
{
  "success": true,
  "correct": false,
  "automaticGrade": "AGAIN",
  "masteryLevel": "WEAK",
  "accuracyPercent": 42,
  "correctAnswer": "trường học"
}
```

## Mastery levels

```text
NEW
WEAK
LEARNING
FAMILIAR
MASTERED
```

Cách tính hiện tại:

```text
NEW
→ chưa có quiz khách quan

WEAK
→ accuracy < 50%
   hoặc wrong >= correct + 2

LEARNING
→ correct < 3
   hoặc streak < 2
   hoặc accuracy < 70%

MASTERED
→ correct >= 8
   và streak >= 5
   và accuracy >= 90%

FAMILIAR
→ các trường hợp còn lại
```

## Automatic SRS grade

```text
Sai
→ AGAIN

Đúng nhưng mastery yếu
→ HARD

Đúng ở LEARNING/FAMILIAR
→ GOOD

Đúng và MASTERED
→ EASY
```

Như vậy một card từng sai rất nhiều sẽ không nhảy xa chỉ vì user vừa chọn đúng một lần.

## Existing V6.6 history

Event cũ trước V8 là self-grade:

```text
AGAIN/HARD/GOOD/EASY
```

nên V6.6.2 KHÔNG dùng chúng để giả định đúng/sai.

Objective counters bắt đầu từ 0 sau V8.

## Khi kho quá nhỏ

Muốn tạo 4 đáp án chất lượng cần:

```text
ít nhất 4 nghĩa khác nhau
trong cùng loại item
```

Nếu chưa đủ:

```json
"quizReady": false
```

Desktop cho phép bỏ qua card đó; card không bị chấm và không thay lịch.

## Structured Study

Fix V6.6.1 Structured Outputs vẫn được giữ nguyên trong backend này.
