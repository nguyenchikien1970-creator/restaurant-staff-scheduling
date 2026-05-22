# Release Notes — v1.0.1-stable

## Thông Tin Phát Hành

| Mục | Chi tiết |
|-----|----------|
| **Phiên bản** | v1.0.1-stable |
| **Ngày phát hành** | 2026-05-22 |
| **Tag** | `v1.0.1-stable` |
| **Commit** | `2f4f04d6783577551fd8d14bc7a4174e7d494c97` |
| **Branch** | `main` |

---

## Các Thay Đổi Chính

### 1. Build Configuration & Dependencies (`a6742fb`)

- **Di chuyển build tool plugins** (`@tailwindcss/vite`, `@vitejs/plugin-react`) từ `dependencies` sang `devDependencies`.
- **Xóa `vite` duplicate** khỏi `dependencies` (giữ lại ở `devDependencies`).
- **Xóa dependencies không sử dụng**: `dotenv`, `@types/express`, `tsx`, `autoprefixer`.
- **Thêm type definitions**: `@types/react`, `@types/react-dom` vào `devDependencies`.
- **Thêm `"include": ["src"]`** trong `tsconfig.json` để giới hạn scope TypeScript.
- **Xóa `GEMINI_API_KEY` define** khỏi `vite.config.ts` — key không được sử dụng trong source code, tránh rủi ro rò rỉ vào client bundle.

### 2. DailyOverview Closure Logic (`2f4f04d`)

- **DailyOverview.tsx**: Thay `(config.closedDays || []).includes(dow)` bằng `isDayClosed(config, dow)`.
- Đảm bảo nhất quán với `analyzeScheduleWarnings()` và `optimizeSchedule()` đã dùng `isDayClosed()`.
- `isDayClosed()` ưu tiên `daySchedules` (hệ thống mới) rồi mới fallback về `closedDays` (legacy).

### 3. Employee ID Generation (`2f4f04d`)

- **StaffManagement.tsx**: Thay `Math.random().toString(36).substr(2, 9)` bằng `crypto.randomUUID()`.
- Nhất quán với `useLocalData.ts` đã dùng `crypto.randomUUID()`.
- Loại bỏ sử dụng `String.prototype.substr()` (deprecated).

### 4. Encoding Comment Cleanup (`2f4f04d`)

- **vite.config.ts**: Sửa comment bị mojibake (`modifyâ€"file` → `modify. File`).
- Nguyên nhân: ký tự em-dash `—` bị double-encode (UTF-8 → Latin-1 → UTF-8).

---

## Kiểm Tra Đã Pass

| Kiểm tra | Kết quả | Ghi chú |
|----------|---------|---------|
| `npm install` | ✅ Pass | Thêm 3, xóa 31 packages |
| `npm run build` | ✅ Pass | Build 1.88s, output `dist/` |
| `npm run lint` (tsc --noEmit) | ✅ Pass | 0 TypeScript errors |
| Local app test (`npm run dev`) | ✅ Pass | http://localhost:3000/ — Vite v6.4.1 |
| Production Vercel deploy | ✅ Pass | Auto-deploy từ `main` |
| Import dữ liệu cũ (localStorage) | ✅ Pass | Backward compatible |

---

## Không Thay Đổi

- ❌ App.tsx — giữ nguyên
- ❌ Business logic (scheduling, optimization) — giữ nguyên
- ❌ UI/UX — giữ nguyên
- ❌ Hooks (useLocalData) — giữ nguyên
- ❌ Lib (utils.ts) — giữ nguyên
- ❌ Dữ liệu người dùng — không xóa, không migrate

---

## Rollback

Nếu cần rollback về phiên bản này:

```bash
# Rollback về v1.0.1-stable
git checkout v1.0.1-stable

# Hoặc reset branch main về tag này
git reset --hard v1.0.1-stable
git push origin main --force
```

Nếu cần rollback về phiên bản trước đó (trước khi sửa):

```bash
# Rollback về commit trước nhóm 1
git reset --hard 0fdabf2
git push origin main --force
```
