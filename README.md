# Batch 13.2 — Novel Library + Reading Progress + Bookmark

Branch: `feature/batch-13-2-novel-reader-ux`

## Scope

- Chọn nhiều file TXT cùng lúc (`multiSelections`).
- Novel Library local tối đa 50 file.
- Continue Reading mở lại file trực tiếp theo path local, không cần file picker.
- Mỗi novel lưu riêng: progress, chapter hiện tại, bookmark, source/target language, Translation Profile và Reader theme/preferences.
- Recent list tự xếp novel vừa mở lên đầu.
- Tìm kiếm Library theo tên/chapter.
- Tìm trong novel ở cả nguyên văn và bản dịch, có Previous/Next.
- Bookmark từng đoạn, jump nhanh tới bookmark.
- Gỡ khỏi Library không xóa file TXT gốc trên máy.
- Không upload toàn bộ novel lên backend; translation pipeline giữ nguyên.
- Không thay backend API dịch, entitlement, DB hoặc Flyway.

## Files changed

- `desktop/electron/main.cjs`
- `desktop/electron/preload.cjs`
- `desktop/src/pages/NovelReaderPage.tsx`
- `desktop/src/index.css`

## Test nhanh

1. Dùng account PRO/MANGA_PLUS.
2. Novel TXT → `+ Thêm TXT`.
3. Chọn cùng lúc:
   - `samples/novel-library-a.txt`
   - `samples/novel-library-b.txt`
   - `samples/novel-library-c.txt`
4. Library phải hiện 3 card.
5. Mở A → dịch vài đoạn → bookmark một đoạn → đổi target language/profile/theme nếu muốn.
6. Mở B → đọc/dịch tới vị trí khác.
7. Bấm `Tiếp tục` ở A → phải quay lại đúng progress; bookmark và setting A vẫn còn.
8. Dùng `Tìm trong novel` và Previous/Next.
9. Gỡ C → C biến mất khỏi Library nhưng file trên ổ đĩa vẫn còn.
10. Restart Desktop → Library vẫn còn; bấm Continue Reading mở lại không cần chọn file.

## Validation

- `node --check desktop/electron/main.cjs` PASS
- `node --check desktop/electron/preload.cjs` PASS
- TypeScript isolated compile for `NovelReaderPage.tsx` PASS
- No Flyway migration
- No backend translation change
