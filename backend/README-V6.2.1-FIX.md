# AI Translator Backend v6.2.1 — Lazy Profile Fix

## Lỗi đã sửa

Khi `/api/v1/translate` resolve một Translation Profile, entity được trả ra khỏi `@Transactional` trước khi hai collection LAZY được load:

```text
TranslationProfile.characters
TranslationProfile.glossary
```

Sau đó `PromptBuilderService` truy cập collection khi Hibernate session đã đóng và gây:

```text
LazyInitializationException
```

## Cách sửa

`ProfileService.resolveProfile()` chủ động materialize `characters` và `glossary` **bên trong transaction** trước khi trả profile cho `TranslationService`.

Không đổi sang `FetchType.EAGER`, và không giữ DB transaction mở trong lúc gọi OpenAI.

## Fix phụ

`GlobalExceptionHandler` giờ xử lý riêng `HttpMessageNotReadableException`. JSON lỗi/truncated sẽ trả HTTP 400 gọn:

```json
{
  "success": false,
  "error": "JSON request không hợp lệ hoặc bị thiếu dữ liệu."
}
```

## Test

1. Run backend.
2. Swagger Login + Authorize.
3. `GET /api/v1/profiles`.
4. Chọn profile có hoặc không có Character/Glossary.
5. `POST /api/v1/translate`:

```json
{
  "text": "魔力が足りない",
  "profileId": 1,
  "context": []
}
```

Không còn `LazyInitializationException`.
