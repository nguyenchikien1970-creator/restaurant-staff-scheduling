# Vercel Preview Report

## 1. Trạng thái trước preview
- Đã hoàn thành toàn bộ test (Local & E2E Logic Test: 9/9 PASS).
- Codebase sạch sẽ, cấu trúc ổn định.
- Branch hiện tại: `main`.
- Chưa commit, chưa push.

## 2. Lệnh đã chạy
```bash
git status
npm run lint
npm run build
git diff --check
npx vercel deploy
```

## 3. Kết quả lint/build
- `npm run lint`: **PASS** (Không có lỗi TypeScript).
- `npm run build`: **PASS** (Build Vite thành công `/dist`).
- `git diff --check`: **PASS** (Không có lỗi whitespace/conflict marker).

## 4. Preview URL
**URL**: [https://restaurant-staff-scheduling-64rxkwc27-chi-kien-nguyens-projects.vercel.app](https://restaurant-staff-scheduling-64rxkwc27-chi-kien-nguyens-projects.vercel.app)

## 5. Những gì cần test thủ công
Để đảm bảo UI/UX hoạt động tốt, vui lòng truy cập URL trên và test:
- **Test giờ mở cửa cuối tuần**: Chọn thứ 7 / Chủ nhật, mở cửa 14:00, chạy sinh lịch tự động và kiểm tra xem có ca nào bắt đầu trước 14:00 không.
- **Test ca tối thiểu 2 giờ**: Sinh lịch tự động và xem có xuất hiện ca nào dưới 120 phút không.
- **Test nhập tay**: Cố tình sửa tay một ca thành 90 phút và lưu, xem cảnh báo lỗi màu cam có hiện ra không.
- **Chức năng tối ưu**: Bấm "Tối ưu" khi có ca bị lỗi và xem thuật toán có xử lý mượt mà trên giao diện không.
- **Hiển thị di động**: Kiểm tra độ responsive trên thiết bị di động.

## 6. Có deploy production không?
- **Không.** Lệnh deploy chạy không có cờ `--prod`. Vercel chỉ tạo ra một bản **Preview Deployment** hoàn toàn cô lập, không ảnh hưởng tới bản Production hiện tại.

## 7. Có commit/push không?
- **Không.** Quá trình này chỉ đẩy source code lên Vercel để build Preview. Lịch sử Git local không thay đổi, không tạo commit mới và không push bất kỳ code nào lên repository (GitHub).

## 8. Kết luận
- **Sẵn sàng kiểm tra**: Bản Preview đã hoạt động và phản ánh chính xác các logic bugfix 1 & 2.
- **Bước tiếp theo**: Vui lòng test thủ công trên trình duyệt. Nếu tất cả đều hoàn hảo, chúng ta sẽ tiến hành commit các thay đổi (kèm báo cáo) và thực hiện deploy production.
