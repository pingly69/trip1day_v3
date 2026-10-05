# App Instructions: trip1day_v3 (AGENTS.md)

## 1. ROLE ของแอปนี้
- เป็น **Requester Mobile WebApp** ทำงานผ่าน LINE LIFF บน Cloudflare Workers (`trip1day-app`)
- หน้าที่: ให้พนักงานลงทะเบียนโปรไฟล์, บันทึกขอเบิกค่าเดินทางประจำวัน, คำนวณระยะทางและเงินชดเชย, แคช Master Data บน LocalStorage 24 ชม., และรัน Cron Maintenance ดูแลฐานข้อมูล

## 2. ขอบเขตงาน (Scope)
- **อนุญาต:** แก้ไขเฉพาะไฟล์ภายในโฟลเดอร์ `trip1day_v3/` เท่านั้น
- **ห้าม:** แตะต้องหรือแก้ไขไฟล์ใน `trip1day_Route_v3/` หรือ `trip1day_approve_v3/` เด็ดขาด

## 3. Stack และ Convention ที่ใช้อยู่จริง
- **Backend Runtime:** Cloudflare Workers (TypeScript 5.6.2, `@cloudflare/workers-types` ^5.20260919.1, `wrangler` ^4.135.0)
- **Frontend:** Vanilla HTML5, CSS3, ES6 JavaScript, LINE LIFF SDK v2 (LIFF ID: `2009016720-k0zSXOrx`)
- **API Response:** ใช้ `snake_case` ทั้งหมด ผ่าน helper `buildSuccess()` และ `buildError()` (`src/utils/response.ts`)
- **Database Timezone:** บันทึกเวลาด้วย `datetime('now', '+7 hours')` (เวลาไทย) เสมอ (`src/routes/transactions.ts:265`)
- **JSON Field Convention:** ทริปย่อยใน `trip_details` ต้องใช้คีย์ `dest` (ห้ามใช้ `destination`) และ `route_name`

## 4. Entity ที่แอปนี้แตะได้และข้อจำกัด
- `transactions`:
  * **C/R/U/D เฉพาะรายการตนเอง** (`req_line_user_id = userId`)
  * ป้องกันซ้ำด้วย Unique Index `(req_date, req_line_user_id, site_id)`
  * รายการที่สถานะเป็น `APPROVED` แล้ว **ห้ามแก้ไขหรือลบเด็ดขาด** (`LOCKED_TRANSACTION`)
- `users_profile`: Read ข้อมูลตนเอง, Auto-upsert `car_no` และ `requester_name` ล่าสุดเมื่อ submit
- `master_site`, `master_routes`, `approve_users`, `rate_car`, `master_config`: **Read Only (ห้าม INSERT/UPDATE/DELETE)**

## 5. คำสั่ง Dev / Build / Test จริง
- **คำสั่ง Dev:** `npm run dev` (`wrangler dev --remote`) หรือ `npm run dev:local` (`wrangler dev`)
- **คำสั่ง Typecheck:** `npm run typecheck` (`tsc --noEmit`)
- **คำสั่ง Deploy:** `npm run deploy` (`wrangler deploy`) -> `https://trip1day-app.pingly69.workers.dev`
- **คำสั่ง Test:** ไม่มี (ยังไม่มี Test runner)

## 6. Definition of Done (DoD)
ก่อนรายงานว่าแก้ไขงานในแอปนี้เสร็จสิ้น ต้องผ่านเกณฑ์ต่อไปนี้:
1. รัน `npm run typecheck` ในโฟลเดอร์ `trip1day_v3` แล้วได้ **Exit Code 0 (Zero Errors)**
2. ฟิลด์ใน API Response ยังคงเป็น `snake_case` ไม่หลุดเป็น camelCase หรือ PascalCase
3. หากมีการแก้ฟิลด์ใน `transactions` หรือ `users_profile` ต้องแจ้งเตือนให้ Deploy อีก 2 แอปตาม Impact Matrix

## 7. หนี้ทางเทคนิค (ยังไม่แก้)
- ใน `package.json` ไม่มีสคริปต์ชื่อ `build` มีเฉพาะ `typecheck`
- ตัวแปร `LINE_CHANNEL_ACCESS_TOKEN` ประกาศไว้ใน `src/config.ts` แต่ยังไม่ได้กำหนดค่าใน `wrangler.toml`

## 8. ข้อที่ยังไม่แน่ใจ — รอยืนยัน
- [ ] นโยบายการลบข้อมูลเก่าอัตโนมัติใน `src/services/maintenance.ts` ปัจจุบัน `RETENTION_DAYS = 0` (ปิดการลบ)
