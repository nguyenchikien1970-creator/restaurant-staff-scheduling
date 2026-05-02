# Quy Tắc & Thuật Toán — Hệ Thống Xếp Lịch Nhà Hàng Đức

> **Blueprint** để build App xếp lịch nhân sự nhà hàng tại Đức.
> Phiên bản: 5.0 — Tháng 4/2026

---

## 1. Kiến Trúc Tổng Quan

```mermaid
graph TD
    A[Input: NV + Config] --> B[Pre-calculate]
    B --> C[Day-by-Day Loop]
    C --> D[Select Employees]
    D --> E[Assign Shifts]
    E --> F[Track Minutes]
    F --> C
    C --> G[Output: DailyEntry[]]
    G --> H[Optimizer Multi-pass]
    H --> G
    G --> I[Warning Analyzer]
    G --> J[Excel Export DATEV]
    G --> K[Print Weekly Grid]
    G --> L[Daily Overview Calendar]
```

### Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth)
- **Deploy**: Vercel
- **Libraries**: date-fns, xlsx, lucide-react

---

## 2. Data Model

### Employee
```typescript
{
  id: string;              // UUID
  name: string;            // Tên NV
  personnelNumber: string; // Mã số NV
  weeklyHours: number;     // Giờ/tuần theo hợp đồng (VD: 10, 20, 40)
  contractType?: 'Vollzeit' | 'Teilzeit' | 'Minijob'; // Auto-derived
  isActive?: boolean;      // default true
}
```

### RestaurantConfig
```typescript
{
  openTime: string;         // "12:00"
  closeTime: string;        // "23:00"
  minStaff: number;         // Số NV tối thiểu/ca (N)
  closedDays: number[];     // [1] = đóng cửa thứ Hai (0=CN..6=T7)
  daySchedules?: Record<number, DayScheduleConfig>; // Giờ riêng mỗi ngày
  bundesland?: string;      // Bang Đức (cho Feiertage)
  lunchPeakHeadcount?: number;   // NV trưa (default: N+2)
  dinnerPeakHeadcount?: number;  // NV tối (default: N+2)
  baselineHeadcount?: number;    // NV giờ thường (default: N)
  closingHeadcount?: number;     // NV giờ đóng cửa (default: 2)

  // ── Phase 5: Busy Days & Peak Hours ──
  busyDays?: number[];           // Ngày đông khách (0=CN..6=T7), VD: [0, 6] = CN+T7
  lunchPeakStart?: string;       // "12:00" — giờ cao điểm trưa bắt đầu
  lunchPeakEnd?: string;         // "15:00" — giờ cao điểm trưa kết thúc
  dinnerPeakStart?: string;      // "18:00" — giờ cao điểm tối bắt đầu
  dinnerPeakEnd?: string;        // "21:00" — giờ cao điểm tối kết thúc
}
```

### DailyEntry (Output cho mỗi NV mỗi ngày)
```typescript
{
  employeeId: string;
  date: string;           // "2026-04-15"
  startTime: string;      // "12:00"
  pauseMinutes: number;   // 30
  endTime: string;        // "20:30"
  absenceCode: '' | 'K' | 'U' | 'UU' | 'F' | 'SA' | 'SU';
  remark: string;         // "Ngày lễ (Feiertag)" hoặc "Nghỉ phép"
}
```

### Absence Codes (chuẩn DATEV Đức)
| Code | Đức | Việt |
|------|-----|------|
| K | Krank | Nghỉ bệnh |
| U | Urlaub | Nghỉ phép (có lương) |
| UU | Unbezahlter Urlaub | Nghỉ không lương |
| F | Feiertag | Ngày lễ |
| SA | Stundenweise abwesend | Vắng theo giờ |
| SU | Stundenweise Urlaub | Phép theo giờ |

---

## 3. Thuật Toán Xếp Lịch — 10 Quy Tắc

### QUY TẮC 1: Mục Tiêu Tháng (Monthly Target)

```
monthlyTarget = weeklyHours × 4.33 (tuần/tháng)
```

VD: NV 40h/tuần → 173.2h/tháng, NV 10h/tuần → 43.3h/tháng

### QUY TẮC 2: Phân Bổ Đều (Even Distribution)

**QUAN TRỌNG NHẤT** — Giờ phải chia đều qua TẤT CẢ ngày trong tháng.

```
Step 1: Tính số ngày làm việc khả dụng cho mỗi NV
  availableDays = tổng ngày nhà hàng mở - ngày nghỉ phép NV
  availableDays = min(availableDays, 5 ngày/tuần × số tuần)

Step 2: Tính target mỗi ngày
  dailyTarget = monthlyTarget / availableDays

VD: 10h/tuần → 43.3h/tháng ÷ 20 ngày = 2h10/ngày
VD: 40h/tuần → 173.2h/tháng ÷ 20 ngày = 8h40/ngày
```

> ⚠ **KHÔNG dồn giờ**: Nếu target 2h/ngày thì NV làm 2h/ngày × 20 ngày,
> KHÔNG được làm 10h × 4 ngày rồi nghỉ 16 ngày.

### QUY TẮC 3: Chọn Nhân Viên — Nợ Tương Đối (Relative Debt)

Mỗi ngày, chọn NV theo **% nợ còn lại**, không phải nợ tuyệt đối:

```
pctRemaining = (monthlyTarget - minutesAssigned) / monthlyTarget
```

Sắp xếp giảm dần: NV có % nợ cao nhất → ưu tiên xếp trước.

> ⚠ **Tại sao không dùng nợ tuyệt đối?**
> NV 40h luôn có nợ tuyệt đối > NV 10h → NV 10h sẽ không bao giờ được chọn.
> Nợ tương đối: 50% của 40h = 50% của 10h → công bằng.

### QUY TẮC 4: Đảm Bảo Đều Người Mỗi Ngày (Consistent Daily Headcount)

```
QUAN TRỌNG: Số NV phải ĐỀU mỗi ngày trong tháng, không được 16 ngày đầu rồi 4 ngày cuối.

Pre-calculate:
  totalOpenDays = số ngày nhà hàng mở trong tháng
  totalEmployeeDays = Σ empWorkDays (tất cả NV)
  avgDailyHeadcount = totalEmployeeDays ÷ totalOpenDays

  normalDayHeadcount = max(minStaff, avgDailyHeadcount)
  busyDayHeadcount = min(totalEmployees, max(avgDailyHeadcount + 2, peakHeadcount))

Mỗi ngày: chọn đúng targetHeadcount NV (không phải ALL NV có nợ)
  → Ngày thường: normalDayHeadcount NV
  → Ngày đông 🔥: busyDayHeadcount NV

VD: 16 NV × 20 ngày / 25 ngày mở = 13 NV/ngày (đều suốt tháng)
    Ngày đông: 15 NV/ngày (+2)
```

### QUY TẮC 5: Giới Hạn Ngày/Tuần — Relaxation cho Ngày Đông

```
Mặc định: max 5 ngày/tuần (ArbZG)

Nếu ngày cuối tuần (VD: CN) không đủ targetHeadcount:
  → Tự động nới giới hạn lên 6 ngày/tuần cho ngày đó
  → Kéo thêm NV đã làm 5 ngày vào
  → ĐẢM BẢO mọi ngày đều đủ người

Algorithm (2-step):
  Step 1: Chọn NV có < 5 ngày → nếu đủ → dùng ✅
  Step 2: Nếu thiếu → nới lên < 6 ngày → kéo thêm NV ✅
```

> ⚠ **Tại sao cần?** NV làm T2-T7 = 5 ngày → CN chỉ còn 4 NV.
> Không thể để nhà hàng thiếu nhân sự ngày cuối tuần.

### QUY TẮC 6: Ngày Đông Khách & Giờ Cao Điểm (Busy Days & Peak Hours)

```
KH tự chọn ngày đông khách trong Cài Đặt (VD: T6🔥, T7🔥, CN🔥)
KH tự chọn giờ cao điểm: Trưa (12:00-15:00), Tối (18:00-21:00)

→ Ngày đông: xếp NHIỀU NV hơn (busyDayHeadcount)
→ Ca ngắn (<4h): Start vào đúng giờ cao điểm (lunchPeakStart hoặc dinnerPeakStart)
→ Warning analyzer: kiểm tra coverage dựa trên giờ peak KH cài đặt

Mỗi nhà hàng KHÁC NHAU:
  - Nhà hàng A: T6+T7 đông, trưa 11:30-14:00, tối 18:00-21:00
  - Nhà hàng B: T3+T5 đông, trưa 12:00-15:00, tối 19:00-22:00
```

### QUY TẮC 7: Nghỉ Phép Tự Động (2 ngày/tháng)

```
Mỗi NV được auto-assign 2 ngày nghỉ phép (U):
  - 1 ngày trong nửa đầu tháng (ngày 8-15, T2-T5)
  - 1 ngày trong nửa sau tháng (ngày 16-23, T2-T5)
  - Phân bổ xoay vòng để NV không trùng ngày nghỉ
```

### QUY TẮC 8: Luật Lao Động Đức (ArbZG)

| Quy định | Giá trị |
|----------|---------|
| Max giờ NET/ngày | 10 tiếng |
| Max giờ GROSS/ngày | 10 tiếng |
| Nghỉ bắt buộc nếu > 6h | 30 phút |
| Nghỉ bắt buộc nếu > 8h30 (510 min gross) | 45 phút |
| Thời gian nghỉ giữa 2 ca | ≥ 11 tiếng |
| Max ngày làm/tuần (bình thường) | 5 ngày |
| Max ngày làm/tuần (ngày đông khách) | 6 ngày |
| Ca tối thiểu | 1 tiếng (60 min gross) |

```
Áp dụng trong code:
  if (actualGross > 510) pause = 45;
  else if (actualGross > 360) pause = 30;
  else pause = 0;

  if (actualGross < 60) → không xếp ca (quá ngắn)
```

### QUY TẮC 9: Ngày Lễ Đức (Feiertage)

```
Nhà hàng ở Đức VẪN MỞ CỬA ngày lễ.
→ NV vẫn được xếp ca bình thường
→ Chỉ thêm remark "Ngày lễ (Feiertag)" cho payroll
→ Để tính Feiertagszuschlag (phụ cấp ngày lễ)

Feiertage tự động tính bằng:
  - 9 ngày lễ quốc gia (cố định + Easter-based)
  - Ngày lễ riêng theo Bundesland (16 bang)
  - Easter = Anonymous Gregorian algorithm
```

### QUY TẮC 10: Minijob Compliance (< 10h/tuần)

```
Giới hạn Minijob Đức: 556€/tháng
Lương tối thiểu: 12.82€/h

monthlyIncome = actualHours × 12.82
if monthlyIncome > 556 → ⚠ WARNING: Vượt giới hạn Minijob
```

---

## 4. Pipeline Xếp Lịch (Step-by-Step)

```
INPUT: month, year, employees[], config

──────────────────────────────────────
PHASE A: PRE-CALCULATION
──────────────────────────────────────

1. Tạo danh sách ngày trong tháng
2. Tính metadata mỗi ngày: dow, openTime, closeTime, isRestaurantClosed, isoWeek
3. Tính Feiertage cho năm + bundesland
4. Auto-assign 2 ngày nghỉ phép cho mỗi NV
5. Tính empWorkDays = số ngày khả dụng mỗi NV
6. Tính empDailyTarget = monthlyTarget ÷ empWorkDays
7. Tính consistent daily headcount:
   totalOpenDays = ngày mở cửa trong tháng
   totalEmployeeDays = Σ empWorkDays
   avgDailyHeadcount = totalEmployeeDays ÷ totalOpenDays
   normalDayHeadcount = max(minStaff, avgDailyHeadcount)
   busyDayHeadcount = min(totalEmployees, max(avg+2, peakHeadcount))
8. Init tracking: minutesAssigned = 0, weekDayCount = {}

──────────────────────────────────────
PHASE B: DAY-BY-DAY ASSIGNMENT
──────────────────────────────────────

for each day in month:
  1. Init DailyEntry cho tất cả NV (blank row)
  2. Mark vacation days (U) và holiday remarks
  3. If nhà hàng đóng cửa → skip, push empty entries

  4. Determine target headcount:
     if busyDays.has(dow) → targetHeadcount = busyDayHeadcount
     else → targetHeadcount = normalDayHeadcount

  5. FILTER available employees (2-step):
     Step 1: NV chưa nghỉ phép + < 5 ngày/tuần
     Step 2: Nếu thiếu targetHeadcount → nới lên < 6 ngày/tuần

  6. RANK by relative debt (% remaining):
     sort descending by (target - assigned) / target

  7. SELECT top targetHeadcount employees (consistent daily count)

  8. For each selected employee:
     a. targetNet = empDailyTarget (pre-calculated, đều mỗi ngày)
     b. Clamp: min 90 phút, max 600 phút
     c. Stagger start: mỗi NV cách nhau 15 phút
     d. Short shifts (< 4h): alternate giữa lunchPeakStart và dinnerPeakStart
     e. Calculate gross = targetNet + estimatedPause
     f. Cap at closeTime
     g. If gross < 60 min → SKIP (quá ngắn)
     h. Apply pause: >510min=45, >360min=30, else=0
     i. Update minutesAssigned += netWorked
     j. Update weekDayCount++

──────────────────────────────────────
PHASE C: OUTPUT
──────────────────────────────────────

Return DailyEntry[] — 1 entry per employee per day
```

---

## 5. Multi-Pass Optimizer

```
Mục đích: Cải thiện accuracy từ ~95% lên 98-99%

Algorithm:
  maxPasses = 20
  bestAccuracy = current
  bestEntries = current

  for pass = 1 to maxPasses:
    newEntries = generateSmartSchedule()  // tạo lịch mới
    newAccuracy = calculateAvgAccuracy(newEntries)

    if newAccuracy > bestAccuracy:
      bestAccuracy = newAccuracy
      bestEntries = newEntries
    else:
      break  // converged — không cải thiện thêm

  return bestEntries

Accuracy formula per employee:
  target = weeklyHours × 4.33
  actual = SUM(netWorked for all days)
  accuracy = 100 - abs(target - actual) / target × 100
```

---

## 6. Warning Analyzer (Kiểm Tra Lỗi)

Sau khi tạo lịch, scan toàn bộ entries để phát hiện:

| # | Loại | Severity | Điều kiện |
|---|------|----------|-----------|
| 1 | Ngày trống | 🔴 error | activeWorkers = 0 trên ngày mở cửa |
| 2 | Thiếu người | 🔴 error | activeWorkers < minStaff |
| 3 | Thiếu peak | 🟡 warning | < lunchPeak trong lunchPeakStart–lunchPeakEnd hoặc < dinnerPeak trong dinnerPeakStart–dinnerPeakEnd |

> Peak hours dùng config KH chọn (không hardcode).
> Skip: Ngày nhà hàng đóng cửa (Ruhetag) → không check.
> KHÔNG skip: Ngày lễ → nhà hàng vẫn mở → vẫn check.

---

## 7. Daily Overview (Lịch Tổng Quát)

### Tab thứ 4 — Tagesübersicht

```
Hiển thị lịch theo ngày (thay vì theo NV):

1. Mini Calendar Grid:
   - Lưới tháng, mỗi ô = 1 ngày
   - Số NV làm mỗi ngày
   - Màu: 🟢 đủ người | 🟡 ít | 🔴 không có ai | ⬜ đóng cửa
   - 🇩🇪 flag cho ngày lễ

2. Day Detail (bấm vào ngày):
   - 3 cards: Đi làm, Vắng mặt, Tổng giờ
   - Bảng NV đi làm: Tên, Giờ vào, Nghỉ, Giờ ra, Giờ NET
   - Badges NV vắng mặt: Tên + (K/U/UU/F)
   - Timeline visualization: thanh thời gian cho mỗi NV

3. Navigation: nút < > chuyển ngày
```

---

## 8. Accuracy Tracking

### Per-Employee Accuracy
```
target = weeklyHours × 4.33 × 60  (phút/tháng)
actual = Σ netWorked across all days
accuracy% = 100 - |target - actual| / target × 100
```

### Badge Colors
| Accuracy | Badge | Meaning |
|----------|-------|---------|
| ≥ 98% | 🟢 Green | Xuất sắc |
| 95-97% | 🟡 Yellow | Chấp nhận |
| < 95% | 🔴 Red | Cần tối ưu |

### Overview Table
Bảng tổng quan tất cả NV:
- Giờ/tuần hợp đồng, target tháng, actual, chênh lệch, accuracy%
- Số ngày U (phép) và K (bệnh)

---

## 9. Excel Export (chuẩn DATEV)

Mỗi nhân viên = 1 sheet riêng. Cấu trúc cột:

| Cột | Nội dung |
|-----|----------|
| A | Ngày (DD.MM.YYYY) |
| B | Thứ (Mo, Di, Mi...) |
| C | Giờ bắt đầu (HH:MM) |
| D | Nghỉ giải lao (phút) |
| E | Giờ kết thúc (HH:MM) |
| F | Tổng giờ (HH:MM) |
| G | Tổng giờ (decimal) |
| H | Absence code (K/U/UU/F) |
| I | Ghi chú |

Sheet "Übersicht" (Overview): Tổng hợp tất cả NV.
Sheet "Einstellungen" (Settings): Config nhà hàng.

---

## 10. Feiertage Calculator (Easter-based)

### Easter Algorithm (Anonymous Gregorian)
```
a = year % 19
b = floor(year / 100), c = year % 100
d = floor(b / 4), e = b % 4
f = floor((b + 8) / 25)
g = floor((b - f + 1) / 3)
h = (19*a + b - d - g + 15) % 30
i = floor(c / 4), k = c % 4
l = (32 + 2*e + 2*i - h - k) % 7
m = floor((a + 11*h + 22*l) / 451)
month = floor((h + l - 7*m + 114) / 31)
day = ((h + l - 7*m + 114) % 31) + 1
Easter = new Date(year, month-1, day)
```

### Ngày lễ quốc gia (tất cả bang)
| Ngày | Tên |
|------|-----|
| 01.01 | Neujahr |
| Easter - 2 | Karfreitag |
| Easter + 1 | Ostermontag |
| 01.05 | Tag der Arbeit |
| Easter + 39 | Christi Himmelfahrt |
| Easter + 50 | Pfingstmontag |
| 03.10 | Tag der Deutschen Einheit |
| 25.12 | 1. Weihnachtstag |
| 26.12 | 2. Weihnachtstag |

### Ngày lễ theo Bundesland
| Ngày | Tên | Bundesländer |
|------|-----|-------------|
| 06.01 | Heilige Drei Könige | BW, BY, ST |
| Easter + 60 | Fronleichnam | BW, BY, HE, NW, RP, SL |
| 15.08 | Mariä Himmelfahrt | BY, SL |
| 31.10 | Reformationstag | BB, MV, SN, ST, TH |
| 01.11 | Allerheiligen | BW, BY, NW, RP, SL |
| Buß- und Bettag | Wed before Nov 23 | SN |
| 08.03 | Internationaler Frauentag | BE |
| 20.09 | Weltkindertag | TH |

---

## 11. Database Schema (Supabase)

### restaurant_configs
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
company_name TEXT
open_time TEXT DEFAULT '12:00'
close_time TEXT DEFAULT '23:00'
min_staff INTEGER DEFAULT 1
closed_days INTEGER[] DEFAULT '{}'
day_schedules JSONB DEFAULT '{}'
lunch_peak_headcount INTEGER
dinner_peak_headcount INTEGER
baseline_headcount INTEGER
closing_headcount INTEGER
bundesland TEXT DEFAULT ''
busy_days INTEGER[] DEFAULT '{}'          -- Phase 5
lunch_peak_start TEXT DEFAULT '12:00'     -- Phase 5
lunch_peak_end TEXT DEFAULT '15:00'       -- Phase 5
dinner_peak_start TEXT DEFAULT '18:00'    -- Phase 5
dinner_peak_end TEXT DEFAULT '21:00'      -- Phase 5
UNIQUE(user_id)
```

### Security: Row Level Security (RLS)
```
Mỗi user chỉ thấy data của chính mình:
  SELECT/INSERT/UPDATE/DELETE WHERE auth.uid() = user_id
→ Multi-tenant an toàn cho 1000+ khách hàng
```

---

## 12. Tổng Kết — Nguyên Tắc Vàng

1. **Chia đều**: Giờ phải trải đều qua tháng, KHÔNG dồn vào đầu/cuối
2. **Đều người/ngày**: Số NV phải đều mỗi ngày (avgDailyHeadcount), không 16 → 4
3. **Không bỏ trống**: Mỗi ngày mở cửa PHẢI có ≥ minStaff người
4. **Công bằng**: Dùng nợ tương đối (%), không tuyệt đối
5. **Tuân luật**: Max 10h/ngày, 5 ngày/tuần (6 cho busy days), pause bắt buộc
6. **Nhà hàng mở lễ**: Feiertage = làm bình thường + ghi chú cho payroll
7. **Busy days linh hoạt**: Mỗi KH tự chọn ngày đông + giờ peak riêng
8. **Auto-relax**: Nếu cuối tuần thiếu người → nới 5→6 ngày/tuần tự động
9. **Convergence**: Optimizer chạy đến khi accuracy ≥ 98% hoặc không cải thiện
10. **DATEV-ready**: Excel export đúng chuẩn kế toán Đức
