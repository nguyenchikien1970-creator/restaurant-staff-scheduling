# Bugfix 1 Opening Hours Report

Ngày thực hiện: 10/06/2026

## 1. Lỗi đã sửa

Đã sửa lỗi ca ngắn có thể bắt đầu trước giờ mở cửa theo từng ngày.

Trường hợp điển hình:

- Thứ 7 hoặc Chủ nhật mở cửa lúc `14:00`.
- `lunchPeakStart` là `12:00`.
- Thuật toán cũ có thể tạo ca bắt đầu lúc `12:00`.

Sau bản sửa, giờ bắt đầu lấy từ giờ cao điểm được kẹp để không sớm hơn giờ mở cửa của đúng ngày đó.

Đồng thời, chức năng kiểm tra lịch đã có thêm cảnh báo lỗi khi lịch cũ hoặc lịch sửa thủ công:

- Bắt đầu trước giờ mở cửa.
- Kết thúc sau giờ đóng cửa.

## 2. File đã sửa

- `src/lib/utils.ts`
- `BUGFIX_1_OPENING_HOURS_REPORT.md`

Không sửa data model, optimizer, quy tắc ca tối thiểu, dependency hoặc file lưu trữ dữ liệu.

## 3. Logic trước khi sửa

Trong `generateSmartSchedule()`:

1. `startDate` ban đầu được tính đúng từ `openTimeDate`.
2. Với ca ngắn dưới 4 giờ, `startDate` có thể bị thay bằng `lunchPeakStart` hoặc `dinnerPeakStart`.
3. Candidate chỉ được kiểm tra không sau `closeTimeDate`.
4. Candidate không được kiểm tra có trước `openTimeDate` hay không.

Vì vậy giờ cao điểm `12:00` có thể ghi đè giờ mở cửa ngày cuối tuần là `14:00`.

`analyzeScheduleWarnings()` cũng chưa phát hiện ca nằm ngoài giờ mở/đóng cửa theo ngày.

## 4. Logic sau khi sửa

Với candidate từ `lunchPeakStart` hoặc `dinnerPeakStart`:

1. Nếu candidate sớm hơn `openTimeDate`, dùng `openTimeDate`.
2. Chỉ dùng candidate đã kẹp khi candidate không sau `closeTimeDate`.
3. `endDate` tiếp tục được giới hạn tại `closeTimeDate` bằng logic hiện có.
4. Nếu thời gian còn lại không tạo được ca hợp lệ, ca tiếp tục bị bỏ bằng kiểm tra an toàn hiện có.

Validator lịch bổ sung loại cảnh báo `outside_hours`:

- Báo lỗi nếu có ca bắt đầu trước giờ mở cửa theo ngày.
- Báo lỗi nếu có ca kết thúc sau giờ đóng cửa theo ngày.

## 5. Lệnh đã chạy

```bash
npm run lint
npm run build
```

Ngoài ra đã chạy:

```bash
git diff --check
```

Không chạy `npm install` và không cài package mới.

## 6. Kết quả lint/build

- `npm run lint`: **PASS**
- `npm run build`: **PASS**
- `git diff --check`: **PASS**

Build hoàn tất với Vite 6.4.1. Vite vẫn cảnh báo một số bundle lớn hơn 500 kB; cảnh báo này đã nằm ngoài phạm vi lỗi giờ mở cửa.

Project chưa có script test tự động trong `package.json`, nên chưa chạy được regression test bằng `npm test`.

## 7. Rủi ro còn lại

- Lịch cũ trong `localStorage` không được tự động sửa; chức năng kiểm tra giờ đây chỉ cảnh báo.
- Lịch được copy từ tháng trước hoặc sửa thủ công vẫn có thể chứa giờ ngoài khung cho đến khi người dùng kiểm tra và chỉnh lại.
- App hiện giả định giờ mở và đóng cửa nằm trong cùng một ngày; ca qua nửa đêm chưa nằm trong phạm vi bản sửa.
- Chưa có automated test cho trường hợp cuối tuần mở `14:00`, peak bắt đầu `12:00`.
- Cảnh báo bundle lớn vẫn còn nhưng không ảnh hưởng trực tiếp đến logic xếp ca.

## 8. Việc cần sửa tiếp theo

Lỗi ca dưới 2 giờ vẫn còn và chưa được sửa trong bước này.

Các bước tiếp theo nên được tách riêng:

1. Chốt phạm vi nhân viên áp dụng ca tối thiểu 2 giờ.
2. Đồng bộ quy tắc 120 phút giữa bộ tạo lịch, optimizer và validator.
3. Bổ sung automated regression tests cho giờ mở cửa và thời lượng ca tối thiểu.
4. Kiểm tra lịch cũ theo từng tháng trước khi có bất kỳ sửa dữ liệu hàng loạt nào.
