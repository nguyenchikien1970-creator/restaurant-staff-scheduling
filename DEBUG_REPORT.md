# DEBUG REPORT

Ngày audit: 10/06/2026
Phạm vi: Chỉ phân tích lỗi xếp ca trước giờ mở cửa và ca ngắn dưới 2 giờ. Không sửa mã nguồn.

## 1. Tóm tắt kết luận

Đã xác định được nguyên nhân trực tiếp có thể tái tạo từ mã nguồn cho hiện tượng trong ảnh:

1. Với ca ngắn, bộ tạo lịch có thể ghi đè giờ bắt đầu theo `lunchPeakStart` mặc định là `12:00`.
2. Khi ghi đè, chương trình chỉ kiểm tra giờ bắt đầu không sau giờ đóng cửa, nhưng không kiểm tra giờ bắt đầu có trước giờ mở cửa theo ngày hay không.
3. Vì vậy, nếu Thứ 7 hoặc Chủ nhật mở cửa lúc `14:00` nhưng `lunchPeakStart` vẫn là `12:00`, chương trình vẫn có thể tạo ca từ `12:00`.
4. Bộ tạo lịch chính đang cho phép ca tối thiểu 60 phút và đặt mục tiêu ca tối thiểu 90 phút. Quy tắc 2 giờ chỉ xuất hiện một phần trong optimizer, không được áp dụng nhất quán khi tạo lịch.
5. Chức năng “Kiểm tra lỗi” hiện không cảnh báo ca trước giờ mở cửa hoặc ca dưới 2 giờ.

Mức độ tổng thể: **Critical đối với business logic xếp lịch**, dù build và TypeScript lint đều pass.

## 2. Công nghệ và cấu trúc app

- Frontend: React 19 + TypeScript.
- Build tool: Vite 6.
- CSS: Tailwind CSS 4.
- Backend hiện tại: Không có backend runtime trong mã nguồn đang dùng.
- Lưu trữ: `localStorage`.
- Deploy: Vercel, project `restaurant-staff-scheduling`.
- Import/export: JSON backup, Excel và PDF.
- Repository: `https://github.com/nguyenchikien1970-creator/restaurant-staff-scheduling.git`.
- Branch hiện tại: `main`, đồng bộ với `origin/main`.
- Stable tag hiện tại: `v1.1.0-pdf-export`.

Các file chính:

- `src/lib/utils.ts`: Tạo lịch, tối ưu lịch, tính giờ và phân tích cảnh báo.
- `src/components/RestaurantSettings.tsx`: Cài giờ mở/đóng cửa theo từng ngày.
- `src/App.tsx`: Gọi tạo lịch, tối ưu, kiểm tra lỗi và lưu lịch.
- `src/hooks/useLocalData.ts`: Đọc/ghi cấu hình và lịch trong `localStorage`.
- `src/types.ts`: Data model.
- `src/components/DailyOverview.tsx`: Hiển thị tổng quan theo ngày.

## 3. Bằng chứng từ ảnh

Ảnh ngày Chủ nhật `26.04.2026` cho thấy:

- Có nhân viên bắt đầu lúc `12:00`, `12:30`, `13:00`, `13:15`, `13:30`.
- Có ca `12:30–14:15`, tổng `1.8h`.
- Có ca `13:00–14:30`, tổng `1.5h`.
- Điều này phù hợp với hai lỗi trong thuật toán hiện tại: lấy giờ cao điểm `12:00` thay cho giờ mở cửa theo ngày và cho phép ca ngắn dưới 2 giờ.

Ảnh không chứa màn hình cấu hình của ngày đó, nên việc Chủ nhật đã được lưu đúng là `14:00` cần được xác nhận bằng dữ liệu `localStorage` hoặc backup JSON. Tuy nhiên, mã nguồn hiện tại đủ để tạo đúng kiểu lỗi này khi giờ mở cửa là `14:00` và `lunchPeakStart` là `12:00`.

## 4. Lỗi chính và root cause

### Critical 1: Ca ngắn có thể bắt đầu trước giờ mở cửa

File: `src/lib/utils.ts`, khoảng dòng 580–605.

Luồng xử lý:

- Ban đầu `startDate` được tính từ `openTimeDate`, là giờ mở cửa đúng theo ngày.
- Với ca dưới 4 giờ, `startDate` sau đó được thay bằng `lunchPeakStart` hoặc `dinnerPeakStart`.
- `lunchPeakStart` mặc định là `12:00`.
- Điều kiện hiện tại chỉ kiểm tra `candidate <= closeTimeDate`.
- Không có điều kiện `candidate >= openTimeDate`.

Kết quả: Ngày mở lúc `14:00` vẫn có thể nhận ca bắt đầu lúc `12:00`.

Commit đưa logic này vào: `c533c06` ngày 02/05/2026.

### Critical 2: Quy tắc ca tối thiểu 2 giờ không nhất quán

File: `src/lib/utils.ts`.

Các quy tắc đang mâu thuẫn:

- Khoảng dòng 581: `targetNetMinutes` có mức tối thiểu 90 phút.
- Khoảng dòng 618: Chỉ bỏ ca nếu tổng thời gian dưới 60 phút.
- Khoảng dòng 1022: Optimizer có thể tạo ca từ 90 phút.
- Khoảng dòng 1091 và 1160–1175: Một phần cân bằng giờ dùng mức tối thiểu 120 phút.
- Khoảng dòng 1282: Ca mới trong một nhánh khác của optimizer yêu cầu tối thiểu 120 phút.
- `SCHEDULING-ALGORITHM-BLUEPRINT.md` vẫn ghi ca tối thiểu 1 giờ.

Kết quả: Tạo lịch ban đầu vẫn sinh ca 1.5 giờ hoặc 1.75 giờ. Bấm tối ưu cũng không đảm bảo tất cả ca cũ dưới 2 giờ được sửa.

### Medium 1: Bộ kiểm tra lỗi không phát hiện hai vi phạm

File: `src/lib/utils.ts`, hàm `validateRow()` và `analyzeScheduleWarnings()`.

Hiện không có kiểm tra:

- `startTime < openTime` theo đúng ngày trong tuần.
- `endTime > closeTime`.
- Ca của nhóm nhân viên được áp dụng có tổng thời gian dưới 120 phút.

Vì vậy lịch sai có thể không hiện cảnh báo khi người dùng bấm “Kiểm tra lỗi”.

### Medium 2: Lịch cũ không tự cập nhật khi đổi giờ mở cửa

File: `src/App.tsx` và `src/hooks/useLocalData.ts`.

- Thay đổi cấu hình chỉ lưu `restaurantConfig`.
- Các ca đã lưu trong `restaurant_entries_[month]_[year]` không được kiểm tra hoặc điều chỉnh lại.
- Chức năng copy tháng trước sao chép nguyên giờ cũ sang tháng mới mà không đối chiếu giờ mở cửa theo thứ trong tuần.
- Người dùng cũng có thể sửa giờ bằng tay mà không có ràng buộc theo giờ mở cửa.

Do đó cần phân biệt:

1. Lịch được tạo mới sau khi đã lưu giờ mở cửa `14:00`.
2. Lịch cũ được tạo trước khi đổi cấu hình.
3. Lịch được copy từ tháng trước hoặc sửa thủ công.

### Low: Timeline tổng quan dùng giờ mặc định thay vì giờ theo ngày

File: `src/components/DailyOverview.tsx`, khoảng dòng 237–269.

Timeline lấy `config.openTime` và `config.closeTime` toàn cục, không lấy `daySchedules[dow]`. Đây chủ yếu là lỗi hiển thị, không phải nguyên nhân trực tiếp tạo ca `12:00`.

## 5. Phạm vi quy tắc “Teilzeit ít giờ”

Data model hiện có `contractType`: `Vollzeit`, `Teilzeit`, `Minijob`.

Hàm tự phân loại hiện tại:

- Từ 35 giờ/tuần: `Vollzeit`.
- Từ 10 đến dưới 35 giờ/tuần: `Teilzeit`.
- Dưới 10 giờ/tuần: `Minijob`.

Yêu cầu “Teilzeit ít giờ làm trong tháng” chưa có ngưỡng số giờ cụ thể trong data model. Trước khi sửa cần chốt một trong hai cách:

1. Áp dụng ca tối thiểu 2 giờ cho mọi nhân viên `Teilzeit`.
2. Áp dụng cho `Teilzeit` có số giờ tuần/tháng dưới một ngưỡng cụ thể.

Khuyến nghị an toàn: Quy tắc ca tối thiểu 2 giờ nên áp dụng cho mọi ca tự động của tất cả nhân viên, trừ khi nghiệp vụ có ngoại lệ rõ ràng. Nếu chỉ áp dụng cho Teilzeit, phải dùng `contractType` thực tế và không suy đoán bằng số giờ tháng.

## 6. Cách sửa đề xuất

### Nhóm sửa 1: Chặn ca ngoài giờ mở cửa

Phạm vi nhỏ:

- Khi chọn giờ cao điểm cho ca ngắn, kẹp giờ bắt đầu trong khoảng giờ mở cửa và giờ đóng cửa theo ngày.
- Không dùng `lunchPeakStart` nếu giờ này sớm hơn giờ mở cửa ngày đó.
- Thêm cảnh báo cho ca bắt đầu trước mở cửa hoặc kết thúc sau đóng cửa.
- Không tự động sửa dữ liệu lịch cũ ở bước này.

Rủi ro: Thấp đến trung bình. Chạm business logic nhưng không đổi data model.

### Nhóm sửa 2: Áp dụng ca tối thiểu 2 giờ

Chỉ thực hiện sau khi xác nhận phạm vi nhân viên:

- Dùng một hằng số/rule duy nhất là 120 phút.
- Áp dụng nhất quán trong tạo lịch, optimizer và validator.
- Không rút ngắn ca xuống dưới 120 phút.
- Nếu phần giờ còn thiếu nhỏ hơn 120 phút, không tạo ca ngắn; chuyển giờ sang ca/ngày khác phù hợp.

Rủi ro: Trung bình. Có thể thay đổi phân bổ giờ tháng và số ngày làm.

### Nhóm sửa 3: Bảo vệ dữ liệu cũ

- Không tự động rewrite toàn bộ lịch đã lưu.
- Thêm audit/cảnh báo cho lịch hiện có.
- Trước khi có chức năng sửa hàng loạt, yêu cầu tải backup JSON.
- Nếu cần sửa lịch cũ, thực hiện theo tháng và có preview danh sách ca bị ảnh hưởng.

Rủi ro: Cao nếu tự động thay đổi dữ liệu; cần phê duyệt riêng.

## 7. Thứ tự sửa đề xuất

1. Sửa riêng lỗi ca bắt đầu trước giờ mở cửa và bổ sung test hồi quy.
2. Chạy build, lint và kiểm thử lịch cuối tuần mở `14:00`.
3. Xác nhận quy tắc Teilzeit và ngưỡng áp dụng.
4. Sửa riêng quy tắc ca tối thiểu 2 giờ, kèm test cho tạo lịch và optimizer.
5. Thêm cảnh báo cho dữ liệu cũ; chưa tự động sửa dữ liệu.
6. Test Vercel Preview trước khi merge vào `main`.

## 8. Kết quả kiểm tra đã chạy

### Dependency

- `node_modules` đã tồn tại.
- `npm ls --depth=0`: pass.
- Không chạy `npm install` vì không thiếu dependency và không có thay đổi package.

### Build

Lệnh:

```bash
npm run build
```

Kết quả: **Pass**.

Ghi chú: Vite cảnh báo bundle chính lớn hơn 500 kB. Đây là cảnh báo hiệu năng, không liên quan trực tiếp đến lỗi xếp lịch.

### Lint / TypeScript

Lệnh:

```bash
npm run lint
```

Kết quả: **Pass**.

Script `lint` hiện chỉ chạy `tsc --noEmit`, chưa có ESLint.

### Test tự động

- `package.json` không có script `test`.
- Không tìm thấy Vitest, Jest, Playwright hoặc Cypress.
- Vì vậy chưa có regression test tự động cho thuật toán xếp lịch.

### Runtime

Lệnh:

```bash
npm run dev
```

Kết quả: Vite khởi động thành công tại `http://localhost:3000/`, trạng thái `ready` sau 182 ms, không có lỗi server log.

Giới hạn môi trường audit: HTTP request từ tiến trình kiểm tra khác không kết nối được tới dev server trong sandbox, nên chưa xác nhận đầy đủ thao tác UI/browser.

## 9. Lệnh cần chạy lại sau khi sửa

```bash
npm run lint
npm run build
npm run dev
```

Sau khi bổ sung test cho thuật toán:

```bash
npm test
```

Các ca kiểm thử bắt buộc:

1. Chủ nhật mở `14:00`, đóng `23:00`, lunch peak `12:00`: không ca nào bắt đầu trước `14:00`.
2. Thứ 7 mở `14:00`: mọi ca được kẹp trong giờ mở/đóng cửa của Thứ 7.
3. Nhân viên thuộc phạm vi Teilzeit ít giờ: không có ca dưới 120 phút.
4. Optimizer không tạo mới hoặc rút ngắn ca xuống dưới 120 phút.
5. Lịch cũ có ca `12:00` trong ngày mở `14:00`: bộ kiểm tra phải báo lỗi.
6. Copy tháng trước: bộ kiểm tra phải phát hiện ca không phù hợp với thứ/ngày mới.

## 10. Trạng thái Git và an toàn dữ liệu

- Không xóa file.
- Không sửa mã nguồn.
- Không cài package.
- Không đổi data model.
- Không thay đổi `localStorage`.
- Không commit, push, deploy hoặc merge.
- File duy nhất được tạo trong audit: `DEBUG_REPORT.md`.
- Working tree trước audit đã có thư mục untracked `AI_PROJECT_GOVERNANCE_TEMPLATE/`; thư mục này không bị thay đổi.
