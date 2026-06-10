# Minimum Shift Rule Plan

Ngày lập kế hoạch: 10/06/2026
Phạm vi: Chỉ phân tích và lập kế hoạch. Chưa sửa mã nguồn.

## 1. Mục tiêu nghiệp vụ

Áp dụng một quy tắc thống nhất cho tất cả nhân viên:

- Mọi ca do hệ thống tự động tạo mới phải có thời lượng ca tối thiểu 2 giờ.
- Mọi nhánh optimizer tạo ca mới hoặc rút ngắn ca không được tạo kết quả dưới 2 giờ.
- Người dùng vẫn được phép nhập hoặc sửa thủ công ca dưới 2 giờ, nhưng giao diện phải hiển thị cảnh báo.
- Lịch cũ không bị tự động thay đổi; hệ thống chỉ audit và cảnh báo.
- Không thay đổi data model hoặc cấu trúc dữ liệu trong `localStorage`.

Quy tắc nên được đo bằng **GROSS shift span**:

```text
grossShiftMinutes = endTime - startTime
grossShiftMinutes >= 120
```

Lý do dùng GROSS:

- Các kiểm tra hiện có trong generator và optimizer đang dùng `actualGross`, `gross` và `minGross`.
- Thời lượng ca là khoảng nhân viên có mặt từ lúc bắt đầu đến lúc kết thúc.
- Pause là quy tắc riêng và không nên làm thay đổi định nghĩa độ dài ca.

Tuy nhiên, ca ngắn `<= 6 giờ` phải có pause mặc định bằng `0`. Nếu optimizer vẫn tự gán pause 30 phút cho ca 2 giờ, UI sẽ hiển thị chỉ 1,5 giờ NET dù ca GROSS đã đủ 2 giờ.

## 2. Quy tắc đề xuất

### Ca tự động

1. Hệ thống chỉ ghi một ca tự động nếu GROSS đạt ít nhất 120 phút.
2. Nếu giờ đóng cửa làm phần thời gian còn lại dưới 120 phút, bỏ ca thay vì lưu ca ngắn.
3. Nếu optimizer cần lấp một khoảng trống ngắn hơn 120 phút:
   - Ưu tiên kéo dài ca hiện có trong giới hạn an toàn.
   - Nếu phải tạo ca mới, mở rộng khoảng ca trong giới hạn giờ mở/đóng cửa để đạt 120 phút.
   - Nếu không thể đạt 120 phút, không tạo ca mới.
4. Khi rút ngắn ca, kết quả cuối cùng phải còn ít nhất 120 phút GROSS.
5. Khi tạo ca đúng 120 phút, pause phải là 0 vì chưa vượt 6 giờ.

### Ca thủ công

1. Không chặn input và không tự sửa.
2. Cho phép lưu ca dưới 120 phút.
3. `validateRow()` phải thêm warning, ví dụ `warning.shiftUnder2h`.
4. Cảnh báo xuất hiện ngay trong bảng chấm công của nhân viên.

### Lịch cũ

1. Không tự kéo dài, xóa hoặc phân bổ lại.
2. `processEntries()` và `validateRow()` cảnh báo ở cấp từng dòng.
3. `analyzeScheduleWarnings()` cảnh báo ở cấp ngày để nút “Kiểm tra lỗi” phát hiện được.

## 3. Các vị trí code liên quan

Có **20 vị trí logic liên quan trong 4 file mã nguồn**, trong đó 17 vị trí nằm trong `src/lib/utils.ts`. Ngoài ra có 1 vị trí tài liệu thuật toán cần cập nhật sau khi code được duyệt.

| File | Khu vực logic | Giá trị hiện tại | Vai trò | Đề xuất |
|---|---|---:|---|---|
| `src/lib/utils.ts` | `generateAutoFillEntries()`, khoảng dòng 108–145 | Không có ngưỡng | Sao chép `startTime`/`endTime` vào nhiều ngày | Hàm hiện không được gọi trong app. Nếu giữ lại, coi đây là đường tạo tự động và không tạo ca dưới 120 phút; không đổi input thủ công |
| `src/lib/utils.ts` | `calculateWorkedMinutes()`, khoảng dòng 148–158 | Phép tính duration NET | Tính thời lượng sau pause | Giữ nguyên; dùng phép tính riêng theo GROSS cho quy tắc ca tối thiểu |
| `src/lib/utils.ts` | `validateRow()`, khoảng dòng 180–203 | Chưa có 120 | Cảnh báo từng dòng nhập tay/lịch cũ | Thêm warning khi GROSS > 0 và < `MIN_AUTO_SHIFT_MINUTES`; không chặn lưu |
| `src/lib/utils.ts` | `processEntries()`, khoảng dòng 235–253 | Gọi `validateRow()` | Đưa warning ra UI | Giữ luồng hiện tại; warning mới tự đi qua đây |
| `src/lib/utils.ts` | `generateSmartSchedule()`, `targetNetMinutes`, khoảng dòng 580–581 | Min 90, max 600 | Đặt mục tiêu NET cho ca ban đầu | Đổi mức sàn từ 90 sang 120; nên cân nhắc đổi tên biến hoặc ghi chú vì hằng số là GROSS còn biến đang là NET |
| `src/lib/utils.ts` | `generateSmartSchedule()`, kiểm tra sau khi cap `endDate`, khoảng dòng 609–623 | Bỏ ca khi `actualGross < 60` | Cổng cuối trước khi ghi ca | Đổi ngưỡng sang `MIN_AUTO_SHIFT_MINUTES`; đây là guard bắt buộc vì cap giờ đóng cửa có thể làm ca ngắn lại |
| `src/lib/utils.ts` | `generateSmartSchedule()`, closing staff, khoảng dòng 636–675 | Chỉ kéo dài ca | Bảo đảm có người đến giờ đóng cửa | Không cần đổi sang 120 vì nhánh chỉ kéo dài. Nên giữ regression test để chắc chắn không làm ca ngắn đi |
| `src/lib/utils.ts` | `analyzeScheduleWarnings()`, khoảng dòng 698–878 | Chưa kiểm tra 120 | Kiểm tra lỗi toàn lịch theo ngày | Thêm alert type như `short_shift`; cảnh báo nếu bất kỳ active worker nào có GROSS < 120 |
| `src/lib/utils.ts` | `optimizeSchedule()`, `getShiftInfo()`, khoảng dòng 912–920 | Tính `gross` và `net` | Nguồn dữ liệu cho optimizer | Giữ nguyên; dùng `gross` làm chuẩn so với hằng số |
| `src/lib/utils.ts` | Optimizer FIX 1 zero staff, khoảng dòng 978–997 | Không có min guard; pause mặc định 30 | Tạo ca mới khi ngày không có người | Chỉ tạo nếu `shiftLength >= 120`; pause theo quy tắc `>510:45`, `>360:30`, còn lại `0` |
| `src/lib/utils.ts` | Optimizer FIX 2 Strategy A, khoảng dòng 1003–1038 | Khoảng nối ±60 phút | Kéo dài ca hiện có để lấp gap | Không thay `60` thành 120 vì đây là cửa sổ tìm ca gần gap, không phải minimum shift; nhánh chỉ kéo dài |
| `src/lib/utils.ts` | Optimizer FIX 2 Strategy B, khoảng dòng 1039–1065 | `>= 90` | Tạo ca mới cho nhân viên đang nghỉ | Đổi sang `>= MIN_AUTO_SHIFT_MINUTES`; nếu gap ngắn, thử mở rộng an toàn trong giờ mở cửa trước khi bỏ |
| `src/lib/utils.ts` | Optimizer FIX 3 below minStaff, khoảng dòng 1068–1092 | Không có min guard; pause mặc định 30 | Tạo ca mới để đủ số người | Chỉ ghi ca nếu `shiftLen >= 120`; pause phải là 0 cho ca `<=360` phút |
| `src/lib/utils.ts` | Optimizer FIX 4 closing staff, khoảng dòng 1094–1119 | Chỉ kéo dài ca | Kéo một ca đến giờ đóng cửa | Không cần đổi ngưỡng; nhánh không rút ngắn hoặc tạo ca mới |
| `src/lib/utils.ts` | Optimizer `correctPause()`, khoảng dòng 1130–1131 | `gross > 510 ? 45 : 30` | Tính pause sau tối ưu | Sửa thành `>510 ? 45 : >360 ? 30 : 0`; cần thiết để ca 120 phút không bị trừ 30 phút NET |
| `src/lib/utils.ts` | Optimizer shorten Strategy B, khoảng dòng 1186–1217 | `minGross = 120` | Không cho rút ngắn dưới 2 giờ | Thay magic number bằng `MIN_AUTO_SHIFT_MINUTES`; giữ hành vi hiện tại |
| `src/lib/utils.ts` | Optimizer extend Strategy A, khoảng dòng 1225–1265 | Bước mở rộng 15 phút | Kéo dài ca hiện có | Không đổi các bước 15 phút; nhánh chỉ kéo dài. Ca thủ công dưới 120 có thể được kéo dài nhưng không bắt buộc tự sửa |
| `src/lib/utils.ts` | Optimizer off-day Strategy B, khoảng dòng 1267–1328 | `gross >= 120` | Tạo ca mới trên ngày nghỉ | Thay magic number bằng `MIN_AUTO_SHIFT_MINUTES`; giữ guard 120 |
| `src/App.tsx` | Generate, optimize, check, copy và manual edit, khoảng dòng 155–245 và 310–326 | Không chặn ca ngắn | Điều phối dữ liệu từ tự động và thủ công | Không chặn manual edit/copy. Bảo đảm generate/optimize gọi analyzer; lịch copy được cảnh báo khi người dùng kiểm tra |
| `src/components/DailyEntriesTable.tsx` và `src/i18n.tsx` | Hiển thị warnings và bản dịch | Chưa có `warning.shiftUnder2h` | Hiển thị cảnh báo cho ca thủ công/lịch cũ | Thêm key Việt/Đức; giữ mức warning màu vàng, không biến thành lỗi chặn nhập |
| `SCHEDULING-ALGORITHM-BLUEPRINT.md` | Quy tắc 8 và pipeline, khoảng dòng 205–223, 334–342 | 60 và 90 phút | Tài liệu chuẩn thuật toán | Sau khi code được duyệt, cập nhật minimum shift thành 120 phút và mô tả phân biệt auto/manual |

### Các giá trị không được đổi sang 120

Các số `60` sau không phải ngưỡng ca tối thiểu:

- Nhân/chia `60` để đổi giờ và phút.
- `660` phút nghỉ giữa hai ca.
- `600` phút giới hạn 10 giờ.
- Khoảng tìm ca gần gap `gap.from - 60` hoặc `gap.to + 60`.
- Mốc ngày lễ Easter `+60`.

Các số `90` hoặc `120` không liên quan trực tiếp:

- Góc xoay PDF hoặc giá trị màu, nếu có.
- `1200` phút là mốc 20:00 cho giờ ban đêm.

## 4. Hằng số đề xuất

Đặt gần đầu `src/lib/utils.ts`, sau phần import:

```typescript
export const MIN_AUTO_SHIFT_MINUTES = 120;
```

Tên hằng số nhấn mạnh đây là ràng buộc khi hệ thống tạo hoặc biến đổi ca tự động.

Để validator dùng cùng một chuẩn, có thể dùng chính hằng số này cho warning. Không cần thêm field vào `RestaurantConfig`, vì yêu cầu hiện tại là quy tắc cố định cho tất cả nhân viên.

Nên có helper nhỏ để tránh lặp:

```typescript
function calculateGrossShiftMinutes(startTime: string, endTime: string): number
```

Helper chỉ tính GROSS span và không trừ pause. Không dùng `calculateWorkedMinutes()` vì hàm đó trả về NET.

## 5. Cách áp dụng trong tạo lịch ban đầu

Trong `generateSmartSchedule()`:

1. Đổi sàn `targetNetMinutes` từ 90 thành 120 để ca mục tiêu không bắt đầu từ mức thấp hơn quy tắc.
2. Sau khi chọn peak start, kẹp giờ mở cửa và cap `endDate` tại giờ đóng cửa, tính lại `actualGross`.
3. Chỉ ghi `startTime`, `endTime`, pause và tracking khi:

```typescript
actualGross >= MIN_AUTO_SHIFT_MINUTES
```

4. Nếu `actualGross < 120`, giữ entry trống và không tăng:
   - `minutesAssigned`
   - `weekDayCount`
5. Không tự đẩy start trước giờ mở cửa hoặc end sau giờ đóng cửa để cố đủ 120 phút.
6. Giữ quy tắc peak, stagger, closing staff và giới hạn ngày/tuần nếu ca hợp lệ.

Lưu ý thiết kế: `targetNetMinutes` hiện là NET nhưng minimum shift được định nghĩa theo GROSS. Với ca dưới 6 giờ pause bằng 0 nên mức 120 trùng nhau. Không nên đổi toàn bộ mô hình NET/GROSS trong bugfix này.

## 6. Cách áp dụng trong optimizer

### Nhánh tạo ca mới

Áp dụng guard 120 phút cho:

1. FIX 1: ngày không có nhân viên.
2. FIX 2 Strategy B: gán nhân viên đang nghỉ để lấp gap.
3. FIX 3: bổ sung nhân viên khi dưới `minStaff`.
4. PHASE 4 Strategy B: chuyển ngày nghỉ thành ngày làm.

Mẫu logic:

```typescript
if (gross < MIN_AUTO_SHIFT_MINUTES) {
  return; // hoặc continue
}
```

### Nhánh rút ngắn ca

1. Dùng `MIN_AUTO_SHIFT_MINUTES` thay cho `minGross = 120`.
2. Sau khi tính `newEnd` hoặc `newStart`, kiểm tra GROSS cuối cùng trước khi ghi.
3. Không rút ngắn ca xuống 105, 90 hoặc 60 phút để đạt độ chính xác giờ tháng.

### Nhánh kéo dài ca

1. Không cần ép ca thủ công dưới 120 phút phải tự động dài ra.
2. Nếu optimizer đã chọn kéo dài ca đó vì thiếu giờ hoặc thiếu coverage, kết quả có thể trở thành hợp lệ.
3. Không xóa hay tự sửa toàn bộ ca ngắn có sẵn, vì chúng có thể là dữ liệu thủ công hoặc lịch cũ.

### Pause

Thống nhất helper pause:

```typescript
const correctPause = (gross: number) =>
  gross > 510 ? 45 :
  gross > 360 ? 30 :
  0;
```

Điều này ngăn ca 2 giờ tự động bị ghi pause 30 phút và chỉ còn 1,5 giờ NET.

## 7. Cách áp dụng trong validator / warning

### `validateRow()`

Thêm cảnh báo theo từng dòng:

```typescript
if (
  entry.startTime &&
  entry.endTime &&
  grossMinutes > 0 &&
  grossMinutes < MIN_AUTO_SHIFT_MINUTES
) {
  warnings.push('warning.shiftUnder2h');
}
```

Đây là warning, không phải validation error và không chặn `onChange`.

Thêm bản dịch:

- Việt: `Ca làm dưới 2 giờ`
- Đức: `Schicht kürzer als 2 Stunden`

### `analyzeScheduleWarnings()`

Thêm loại alert:

```typescript
type: 'short_shift'
```

Với mỗi ngày mở cửa:

1. Tìm active worker có GROSS từ 1 đến 119 phút.
2. Thêm một warning cấp ngày.
3. Có thể nêu số ca bị ảnh hưởng để tránh tạo nhiều alert trùng lặp.
4. Không tự sửa entries.

Mức đề xuất: `warning`, vì yêu cầu cho phép người dùng lưu ca thủ công dưới 2 giờ.

### UI

`DailyEntriesTable` đã hiển thị mọi `entry.warnings`; chỉ cần translation key mới. Không cần chặn input hoặc đổi data model.

## 8. Lịch cũ và dữ liệu thủ công

### Lịch cũ

- Giữ nguyên trong `localStorage`.
- Khi mở từng nhân viên, `processEntries()` hiển thị warning ở dòng ca ngắn.
- Khi bấm “Kiểm tra lỗi”, `analyzeScheduleWarnings()` hiển thị warning cấp ngày.
- Không tự chạy optimizer để sửa lịch cũ.

### Nhập và sửa thủ công

- `handleEntryChange()` tiếp tục lưu giá trị người dùng nhập.
- Không đặt `min` trên input time và không tự kéo dài `endTime`.
- Warning cập nhật theo dữ liệu đã nhập.

### Copy lịch

- Copy ngày trước và copy tháng trước giữ nguyên dữ liệu nguồn.
- Ca dưới 2 giờ được copy vẫn được lưu.
- Sau copy, analyzer nên được gọi hoặc người dùng bấm “Kiểm tra lỗi” để thấy cảnh báo.
- Không tự thay đổi lịch nguồn hoặc lịch đích.

## 9. Rủi ro khi sửa

### Rủi ro phân bổ giờ tháng

Có. Đây là rủi ro chính.

- Nhân viên ít giờ có `empDailyTarget` dưới 120 phút sẽ không còn được chia đều thành nhiều ca ngắn.
- Hệ thống phải phân bổ giờ vào ít ngày hơn hoặc chấp nhận chênh lệch mục tiêu lớn hơn.
- Accuracy tháng có thể giảm nếu optimizer không tìm được slot đủ 120 phút.
- Số người mỗi ngày có thể giảm nếu nhiều ca bị bỏ sau khi cap giờ đóng cửa.
- Cảnh báo thiếu người hoặc coverage gap có thể tăng.

### Rủi ro pause và NET hours

- Sửa `correctPause()` làm tăng NET hours của ca ngắn từng bị trừ sai 30 phút.
- Điều này có thể làm optimizer đánh giá một số nhân viên vượt target sớm hơn.
- Đây là thay đổi cần thiết để ca 2 giờ được phản ánh đúng, nhưng phải test accuracy tháng.

### Rủi ro dữ liệu

- Thấp nếu chỉ áp dụng cho ca tự động mới và warning.
- Cao nếu vô tình dùng optimizer để sửa hàng loạt lịch cũ; kế hoạch này không đề xuất hành vi đó.

### Rủi ro phạm vi

- Không cần đổi data model.
- Không cần package mới.
- Không cần migration.
- Logic tập trung chủ yếu trong `src/lib/utils.ts`.

## 10. Thứ tự sửa đề xuất

1. Tạo checkpoint/branch riêng cho Bugfix 2 sau khi trạng thái Bugfix 1 được xác nhận.
2. Thêm `MIN_AUTO_SHIFT_MINUTES` và helper tính GROSS.
3. Sửa `generateSmartSchedule()`:
   - Sàn mục tiêu 120.
   - Guard cuối 120 sau khi cap giờ đóng cửa.
4. Sửa các nhánh optimizer tạo ca mới.
5. Thay magic number 120 trong nhánh rút ngắn/off-day bằng hằng số.
6. Sửa `correctPause()` cho ca `<=6h` về 0.
7. Thêm warning trong `validateRow()` và translation Việt/Đức.
8. Thêm warning cấp ngày trong `analyzeScheduleWarnings()`.
9. Cập nhật blueprint sau khi implementation pass.
10. Chạy lint/build và test các kịch bản bắt buộc.
11. Chỉ xem xét preview deployment sau khi user duyệt; không merge hoặc deploy trực tiếp.

## 11. Test cases bắt buộc

### Tạo lịch ban đầu

1. `empDailyTarget = 90`: ca tự động phải dài ít nhất 120 phút hoặc không được tạo.
2. `empDailyTarget = 105`: không tạo ca 105 phút.
3. `empDailyTarget = 120`: tạo ca đúng 120 phút, pause 0, NET 120 phút.
4. Giờ mở `14:00`, đóng `15:30`: không tạo ca vì cửa sổ chỉ có 90 phút.
5. Giờ mở `14:00`, đóng `16:00`: được tạo ca đúng 120 phút.
6. Peak start gần giờ đóng cửa làm thời gian còn lại dưới 120: bỏ ca, không lùi trước giờ mở cửa.
7. Ca hợp lệ vẫn không kết thúc sau giờ đóng cửa.

### Optimizer

8. Zero staff với cửa sổ 90 phút: không tạo ca.
9. Coverage gap 60 phút: không tạo ca mới 90 phút; có thể kéo dài ca hiện có nếu hợp lệ.
10. Coverage gap có thể mở rộng trong giờ hoạt động thành 120 phút: tạo ca 120 phút.
11. Below `minStaff` với cửa sổ dưới 120 phút: không tạo ca ngắn.
12. Rút ngắn ca 3 giờ để cân bằng: không được rút dưới 2 giờ.
13. Off-day còn nợ 75 phút: không tạo ca 75/105 phút; chỉ tạo nếu có ca GROSS ít nhất 120 phút và việc vượt target nằm trong tolerance chấp nhận được.
14. Ca 120 phút qua optimizer vẫn có pause 0.

### Manual và lịch cũ

15. Người dùng nhập ca 90 phút: dữ liệu được giữ, có warning từng dòng.
16. Người dùng nhập ca 119 phút: dữ liệu được giữ, có warning.
17. Người dùng nhập ca 120 phút: không có warning ca ngắn.
18. Lịch cũ có ca 90 phút: không tự sửa khi load.
19. Bấm “Kiểm tra lỗi” với lịch cũ: có warning cấp ngày.
20. Copy tháng trước có ca ngắn: không tự sửa, vẫn cảnh báo.

### Regression

21. Bugfix 1 vẫn pass: không ca tự động nào bắt đầu trước giờ mở cửa.
22. Không ca tự động nào kết thúc sau giờ đóng cửa.
23. Pause 30 phút chỉ áp dụng khi GROSS > 360 phút; pause 45 phút khi GROSS > 510 phút.
24. Build và TypeScript lint pass.
