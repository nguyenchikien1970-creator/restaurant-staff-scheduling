# Bugfix 2 Minimum Shift Report

## 1. Lỗi đã sửa

- Hệ thống có thể tự động tạo ca ngắn 60, 75, 90 hoặc 105 phút.
- Một số nhánh optimizer có thể tạo ca mới hoặc rút ngắn ca xuống dưới 120 phút GROSS.
- Quy tắc pause trong optimizer có thể gán 30 phút nghỉ cho cả ca ngắn.
- Ca dưới 2 giờ do người dùng nhập tay hoặc tồn tại trong lịch cũ chưa có cảnh báo thống nhất.

## 2. Quy tắc nghiệp vụ sau sửa

- Mọi ca mới do hệ thống tự động tạo phải có GROSS shift span tối thiểu 120 phút.
- Các nhánh optimizer không tạo ca mới và không rút ngắn ca xuống dưới 120 phút GROSS.
- Ca không đủ 120 phút sau khi giới hạn theo giờ đóng cửa sẽ bị bỏ qua.
- Ca 120 phút không có pause tự động.
- Người dùng vẫn có thể lưu ca thủ công dưới 120 phút, nhưng `validateRow` trả về cảnh báo.
- Lịch cũ không bị tự động sửa; `analyzeScheduleWarnings` chỉ tạo cảnh báo cấp ngày.

## 3. File đã sửa

- `src/lib/utils.ts`
  - Thêm `MIN_AUTO_SHIFT_MINUTES = 120`.
  - Thêm helper `calculateGrossShiftMinutes`.
  - Áp dụng giới hạn 120 phút cho tạo lịch tự động và optimizer.
  - Sửa quy tắc pause.
  - Thêm cảnh báo cho ca dưới 2 giờ.
- `src/i18n.tsx`
  - Thêm bản dịch tiếng Việt và tiếng Đức cho `warning.shiftUnder2h`.
- `BUGFIX_2_MIN_SHIFT_REPORT.md`
  - Báo cáo thay đổi và kết quả kiểm tra.

## 4. Logic trước khi sửa

- Các nhánh tạo ca sử dụng nhiều ngưỡng khác nhau như 60, 90 và 120 phút.
- `generateSmartSchedule` có thể giữ lại ca chỉ dài 60 phút.
- Một số chiến lược optimizer chấp nhận ca mới từ 90 phút.
- Logic pause dùng `gross > 510 ? 45 : 30`, nên ca ngắn cũng có thể nhận 30 phút pause.
- Validator chưa cảnh báo riêng cho ca dưới 2 giờ.

## 5. Logic sau khi sửa

- Dùng một hằng số chung: `MIN_AUTO_SHIFT_MINUTES = 120`.
- GROSS được tính bằng khoảng thời gian từ `startTime` đến `endTime`, không trừ pause.
- `generateSmartSchedule` chỉ ghi ca nếu GROSS đạt tối thiểu 120 phút sau khi đã giới hạn theo giờ mở/đóng cửa.
- Các nhánh tạo ca mới trong optimizer bỏ qua kết quả dưới 120 phút.
- Nhánh rút ngắn ca giữ sàn 120 phút GROSS.
- Quy tắc pause là:
  - Trên 510 phút: 45 phút.
  - Trên 360 phút đến 510 phút: 30 phút.
  - Tối đa 360 phút: 0 phút.
- `validateRow` thêm warning `warning.shiftUnder2h` nhưng không chặn lưu.
- `analyzeScheduleWarnings` gom các ca active từ 1 đến 119 phút thành một cảnh báo `short_shift` theo ngày.

## 6. Những gì không thay đổi

- Không đổi data model.
- Không sửa cấu trúc hoặc key của localStorage.
- Không tự động sửa lịch cũ.
- Không thay đổi logic giờ mở cửa của Bugfix 1.
- Không cài package mới.
- Không commit, push hoặc deploy.

## 7. Lệnh đã chạy

```bash
npm run lint
npm run build
git diff --check
```

Project không có script `test` trong `package.json`, vì vậy không chạy `npm test`.

## 8. Kết quả kiểm tra

- `npm run lint`: PASS (`tsc --noEmit`).
- `npm run build`: PASS.
- `git diff --check`: PASS.
- Build còn cảnh báo sẵn có về bundle lớn hơn 500 kB; cảnh báo này không phát sinh từ quy tắc ca tối thiểu.
- Chưa có automated test suite để kiểm thử hồi quy logic lập lịch.

## 9. Rủi ro còn lại

- Việc bỏ qua ca tự động dưới 120 phút có thể làm giảm coverage ở các khoảng mở cửa ngắn hoặc gần giờ đóng cửa.
- Quy tắc mới có thể thay đổi cách optimizer phân bổ tổng giờ tháng giữa các nhân viên.
- Các ca cũ hoặc ca nhập tay dưới 120 phút vẫn tồn tại theo yêu cầu nghiệp vụ và chỉ được cảnh báo.
- Cần kiểm tra UI để bảo đảm cảnh báo cấp dòng và cấp ngày hiển thị đúng ở cả tiếng Việt và tiếng Đức.
- TODO: Nếu sau kiểm thử thực tế cần ưu tiên kéo dài ca hiện hữu thay vì bỏ coverage gap, nên xử lý trong một thay đổi optimizer riêng, không gộp vào Bugfix 2.

## 10. Test thủ công cần làm

- Chủ nhật mở 14:00, đóng 23:00: không có ca bắt đầu trước 14:00.
- Mở 14:00, đóng 15:30: không tạo ca 90 phút.
- Mở 14:00, đóng 16:00: có thể tạo ca 120 phút.
- Ca 120 phút phải có pause bằng 0.
- Người dùng nhập tay ca 90 phút: vẫn lưu được nhưng có cảnh báo.
- Lịch cũ có ca 90 phút: không tự sửa và có cảnh báo khi phân tích lỗi.
- Optimizer không tạo ca 60, 90 hoặc 105 phút.
