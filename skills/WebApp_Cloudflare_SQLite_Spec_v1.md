# เอกสารข้อกำหนดระบบ (System Requirements Specification) — Cloudflare Workers & D1 Production (ver.3.0)
**ชื่อโครงการ:** ระบบบันทึกเบิกค่าเดินทาง (Mileage Reimbursement System ver.3.0)  
**Platform:** LINE LIFF (Mobile-first Web App) — Cloudflare Workers + D1 Database (Single Project)  
**วันที่จัดทำ/อัปเดต:** 19 กันยายน 2026  
**สถานะ:** ใช้งานจริงบน Production (Deployed & Verified)  
**Production URL:** `https://trip1day-app.pingly69.workers.dev`  
**LINE LIFF ID:** `2009016720-k0zSXOrx`  
**Database Name / ID:** `IMG_DB` (`4db03e65-cc9d-458e-81f7-b8119669dd17`) (เดิมคือ `Trip1Day-db`)

---

> **บันทึกสรุปการพัฒนา (Production Release Notes ver.3.0):**
> ระบบนี้ได้ทำการย้าย (Migration) จาก **Google Apps Script (GAS) + Google Sheets** เดิม สู่สถาปัตยกรรม **Cloudflare Workers (TypeScript) + Cloudflare D1 (SQLite) + Static Assets** เสร็จสมบูรณ์แล้ว โดยมีการปรับปรุงจากข้อกำหนดเบื้องต้น ดังนี้:
> 1. **รวมเป็น Single Project:** ใช้ Cloudflare Workers Static Assets (`public/`) เสิร์ฟทั้งหน้าเว็บและ API ภายใต้โดเมนเดียวกัน (`trip1day-app.pingly69.workers.dev`) ทำให้ไม่มีปัญหา CORS และ Deploy ในคำสั่งเดียว
> 2. **ระบบ 24-Hour LocalStorage Cache (ประหยัด Quota D1):** ข้อมูล Master Data (Sites, Routes, Approvers, Rates, Config) ถูกแคชลงใน LocalStorage ของอุปกรณ์ 24 ชั่วโมง พร้อมปุ่ม **"🔄 ซิงค์ข้อมูล"** บนหน้าจอเพื่อดึงข้อมูลสดเมื่อต้องการ
> 3. **การควบคุม Query Quota อย่างเข้มงวด:** คำสั่ง `GET /api/transactions?date=YYYY-MM-DD` กรองด้วย `req_date` และ `line_uid` ของผู้ใช้เสมอผ่าน Index และส่งข้อมูลเต็มกลับมาในครั้งเดียว ทำให้การแตะดู/แก้ไขรายการไม่ต้องยิง Query ซ้ำ
> 4. **ปลดล็อกระยะทาง (KM Limit):** ยกเลิกเงื่อนไขจำกัดระยะทาง 500 กม. ผู้ใช้สามารถบันทึกระยะทางจริงได้อิสระ (ต้องมากกว่า 0 กม.)
> 5. **รองรับการใช้งานทั้งบนมือถือและ PC:** 
>    - บนมือถือ (LINE App): ยืนยันตัวตนอัตโนมัติผ่าน LINE LIFF
>    - บน PC (Desktop Browser): มีแบนเนอร์ให้กด **"ล็อกอิน LINE"** เพื่อสแกน QR Code เชื่อมต่อบัญชีจริง และมี Dev Mock Mode สำหรับทดสอบหน้าจอ
> 6. **การปรับแต่ง UI เพื่อผู้สูงอายุและผู้ใช้ iPhone (Presbyopia):** ใช้ฟอนต์ไทย **Prompt** ตัวอักษรคมชัด ขนาดเริ่มต้น ≥ 16px (ป้องกัน Safari ซูมอัตโนมัติ), ปุ่มสัมผัสขนาดใหญ่ ≥ 48px, และกำกับ `ver.3.0` พร้อม Meta tag `no-cache`
> 7. **เพิ่ม API ลบรายการ (`DELETE /api/transactions/:id`):** ผู้ใช้สามารถลบรายการสถานะ `PENDING`, `DRAFT`, หรือ `REJECTED` ได้ (รายการที่ `APPROVED` แล้วจะถูกล็อกห้ามลบเด็ดขาด)
> 8. **สร้าง Profile ผู้ใช้ใหม่อัตโนมัติ (Seamless Auto-Register):** บันทึกชื่อและทะเบียนรถลงตาราง `users_profile` ทันทีเมื่อมีการส่งข้อมูลรายการแรก

---

## 1. ภาพรวมสถาปัตยกรรมระบบ (Architecture Overview)

```
+------------------------------------------------------------------------+
|  Cloudflare Worker: trip1day-app (Domain: trip1day-app.workers.dev)    |
|                                                                        |
|  [Static Assets: /public]                [API Endpoints: /api/*]       |
|  - index.html (Prompt Font, ver.3.0)     - GET  /api/config            |
|  - config.js                             - GET  /api/master (24H Cache)|
|  - css/styles.css (Glassmorphism Dark)   - GET  /api/profile           |
|  - js/app.js, day_summary.js,            - GET  /api/transactions     |
|       trip_form.js, trip_card.js,        - POST /api/transactions     |
|       cache.js (24H LocalStorage),       - DELETE /api/transactions/:id|
|       api.js, validation.js                                            |
+------------------------------------------------------------------------+
                               |
                               | D1 Binding: env.IMG_DB / env.DB
                               v
+------------------------------------------------------------------------+
|  Cloudflare D1 (SQLite Database: IMG_DB)                              |
|  - users_profile       - master_site            - master_routes        |
|  - master_config       - rate_car               - approve_users        |
|  - transactions (Indexed: date_user, date_user_site, req_date)        |
+------------------------------------------------------------------------+
```

### 1.1 การเปรียบเทียบระบบเดิม vs ระบบใหม่

| ด้าน | เดิม (GAS) | ใหม่ (Cloudflare Workers ver.3.0) |
|---|---|---|
| Runtime | Google Apps Script | Cloudflare Workers (TypeScript) |
| Database | Google Sheets | Cloudflare D1 (SQLite APAC/SIN) |
| API Protocol | `google.script.run` (RPC) | REST API (JSON over HTTPS) |
| Frontend Hosting | GitHub Pages / GAS HTML | Cloudflare Workers Static Assets (`public/`) |
| Domain / Origin | คนละ Domain กับ API | Same Origin (`trip1day-app.pingly69.workers.dev`) |
| Master Data Cache | CacheService / Memory (หายเมื่อปิด) | **LocalStorage 24 ชั่วโมง** พร้อมปุ่มกดซิงค์ข้อมูล |
| Transaction Query | อ่าน Sheet ทั้งหมด | Parameterized SQL กรอง `date` + `user` ผ่าน Index |
| Authentication | ส่ง UID ลอยๆ | ตรวจสอบ LINE Token บน Mobile / รองรับ QR Code และ Mock บน PC |
| Concurrency | `LockService.getScriptLock()` | SQLite Transactions (`BEGIN IMMEDIATE`) |
| Deletion | Script ลบแถวใน Sheet | `DELETE /api/transactions/:id` (ป้องกันรายการ APPROVED) |

---

## 2. โครงสร้างฐานข้อมูล SQLite (Cloudflare D1: `IMG_DB`)

### 2.1 Table: `users_profile`
```sql
CREATE TABLE IF NOT EXISTS users_profile (
  line_uid          TEXT NOT NULL PRIMARY KEY,  -- LINE User ID
  requester_name    TEXT NOT NULL,              -- ชื่อ-นามสกุล ผู้ขอเบิก
  car_no            TEXT NOT NULL DEFAULT '',   -- ทะเบียนรถเริ่มต้น/ล่าสุด
  group_car         INTEGER NOT NULL DEFAULT 1, -- กลุ่มอัตราค่าเดินทาง (1=group_car1, 2=group_car2)
  emp_no            TEXT NOT NULL DEFAULT '',   -- รหัสพนักงาน
  created_at        TEXT NOT NULL DEFAULT (datetime('now', '+7 hours')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now', '+7 hours'))
);
```

### 2.2 Table: `master_site`
```sql
CREATE TABLE IF NOT EXISTS master_site (
  site_id    TEXT NOT NULL PRIMARY KEY,  -- รหัส ERP / รหัสไซต์งาน
  site_name  TEXT NOT NULL,              -- ชื่อไซต์งาน
  active     INTEGER NOT NULL DEFAULT 1  -- 1=ใช้งาน, 0=ปิดใช้งาน
);

CREATE INDEX IF NOT EXISTS idx_master_site_active_name
  ON master_site (active, site_name);
```

### 2.3 Table: `master_routes`
```sql
CREATE TABLE IF NOT EXISTS master_routes (
  route_id      TEXT NOT NULL PRIMARY KEY,
  site_id       TEXT NOT NULL,           -- รหัสไซต์งานที่สังกัด
  route_name    TEXT NOT NULL,           -- ชื่อเส้นทางมาตรฐาน
  origin        TEXT NOT NULL DEFAULT '',
  destination   TEXT NOT NULL DEFAULT '',
  distance_km   REAL NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_master_routes_site_active
  ON master_routes (site_id, active);
```

### 2.4 Table: `master_config`
```sql
CREATE TABLE IF NOT EXISTS master_config (
  key    TEXT NOT NULL PRIMARY KEY,
  value  TEXT NOT NULL
);
-- ข้อมูลตั้งต้น: flat_rate (150), max_trips_per_day (10), min_trips_per_day (1)
```

### 2.5 Table: `rate_car`
```sql
CREATE TABLE IF NOT EXISTS rate_car (
  dt_date     TEXT NOT NULL PRIMARY KEY,  -- วันที่มีผลบังคับใช้ (YYYY-MM-DD)
  group_car1  REAL NOT NULL,              -- อัตรา บาท/กม. สำหรับกลุ่ม 1
  group_car2  REAL NOT NULL DEFAULT 0    -- อัตรา บาท/กม. สำหรับกลุ่ม 2
);

CREATE INDEX IF NOT EXISTS idx_rate_car_date_desc
  ON rate_car (dt_date DESC);
```

### 2.6 Table: `approve_users`
```sql
CREATE TABLE IF NOT EXISTS approve_users (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  approve_request  TEXT NOT NULL,             -- ชื่อผู้อนุมัติสำหรับแสดงใน Dropdown
  line_profile     TEXT NOT NULL DEFAULT '',
  line_uid         TEXT NOT NULL DEFAULT '',
  active           INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_approve_users_active
  ON approve_users (active);
```

### 2.7 Table: `transactions` *(ตารางหลัก)*
```sql
CREATE TABLE IF NOT EXISTS transactions (
  transaction_id    TEXT NOT NULL PRIMARY KEY,  -- UUID v4 เช่น TX-xxxxxxxx-xxxx-...
  req_name          TEXT NOT NULL,
  req_line_user_id  TEXT NOT NULL,              -- LINE User ID ของผู้บันทึก
  req_date          TEXT NOT NULL,              -- YYYY-MM-DD (Asia/Bangkok)
  plate_no          TEXT NOT NULL DEFAULT '',   -- ทะเบียนรถ
  site_id           TEXT NOT NULL,              -- รหัส SITE งาน
  site_name         TEXT NOT NULL,              -- ชื่อ SITE งาน (Denormalized)
  travel_purpose    TEXT NOT NULL DEFAULT '',   -- วัตถุประสงค์การเดินทาง
  image_url         TEXT NOT NULL DEFAULT '',   -- รูปภาพแนบ (ถ้ามี)
  total_km          REAL NOT NULL DEFAULT 0,    -- ระยะทางรวม คำนวณโดย Backend เสมอ
  toll_fee          REAL NOT NULL DEFAULT 0,    -- ค่าทางด่วน
  park_fee          REAL NOT NULL DEFAULT 0,    -- ค่าที่จอดรถ
  flat_rate_fee     REAL NOT NULL DEFAULT 0,    -- ค่ารถเหมาประจำวัน (150 บาท)
  net_total         REAL NOT NULL DEFAULT 0,    -- ยอดเบิกสุทธิ คำนวณโดย Backend เสมอ
  approver          TEXT NOT NULL DEFAULT '',   -- ชื่อผู้อนุมัติ
  status            TEXT NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('DRAFT','PENDING','APPROVED','REJECTED')),
  approve_datetime  TEXT,                        -- วันที่เวลาอนุมัติ (YYYY-MM-DD HH:MM:SS)
  trip_details      TEXT NOT NULL DEFAULT '[]',  -- JSON Array ของเส้นทาง
  created_at        TEXT NOT NULL DEFAULT (datetime('now', '+7 hours')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now', '+7 hours'))
);

-- บังคับกฎ 1 คน + 1 วัน + 1 Site = 1 รายการ
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_date_user_site
  ON transactions (req_date, req_line_user_id, site_id);

-- เร่งความเร็วคำสั่งค้นหารายการประจำวัน
CREATE INDEX IF NOT EXISTS idx_transactions_date_user
  ON transactions (req_date, req_line_user_id);

-- ใช้สำหรับ Daily Maintenance
CREATE INDEX IF NOT EXISTS idx_transactions_req_date
  ON transactions (req_date);
```

---

## 3. ข้อกำหนด UI/UX (Mobile-first & High-Legibility ver.3.0)

### 3.1 การปรับแต่งเพื่อผู้ใหญ่และผู้มีสายตายาว (Presbyopia Design Guidelines)
1. **Typography:**
   - ใช้ Google Font **Prompt** สำหรับภาษาไทย
   - ขนาดตัวอักษรพื้นฐาน (Base Font Size): **16px**
   - ช่องกรอกข้อมูล (Inputs) และ Dropdown: ขนาดตัวอักษร 16px และความสูงสัมผัส 50px (ป้องกัน iOS Safari ซูมเข้าอัตโนมัติ)
   - ป้ายตัวเลขเงินและระยะทาง: ขนาดใหญ่ 20–26px คมชัด
2. **Contrast & Aesthetics:**
   - ดีไซน์แนวทาง **Elevated Dark Glassmorphism** (พื้นหลัง Dark Gradient `#0f172a`, การ์ดโปร่งแสง `rgba(30, 41, 59, 0.82)` พร้อม Backdrop Blur 14px)
   - ข้อความสีขาว `#ffffff` และเทาสว่าง `#cbd5e1` ชัดเจนตัดกับพื้นหลัง
   - ป้ายสถานะสีสดใสและมีขอบชัดเจน: เขียว `🟢 อนุมัติแล้ว`, เหลือง `🟡 รออนุมัติ`, แดง `🔴 ปฏิเสธ`
3. **Touch Targets:**
   - ทุกปุ่มและช่องเลือก Dropdown มีความสูงขั้นต่ำ ≥ 48–52px

### 3.2 หน้ารายการสรุปประจำวัน (Day Summary Screen)
- **Top Header Bar:** ไอคอนรถ 🚗 + ชื่อ "ระบบเบิกค่าเดินทาง" + ป้ายกำกับเวอร์ชัน `ver.3.0`
- **User Pill:** แสดงชื่อผู้ใช้งาน + ทะเบียนรถ + สถานะการเชื่อมต่อ LINE
- **แบนเนอร์ LINE บน PC:** หากเปิดใช้งานบนคอมพิวเตอร์และยังไม่ได้ล็อกอิน จะแสดงแถบสีเขียวพร้อมปุ่ม **"ล็อกอิน LINE"** เพื่อสแกน QR Code เข้าสู่ระบบจริง
- **การเลือกวันที่:** Date Picker (Default วันนี้เวลาไทย `Asia/Bangkok`)
- **ปุ่ม "🔄 ซิงค์ข้อมูล":** อยู่ที่มุมขวาบน สำหรับกด Refresh ดึง Master Data ใหม่มาทับ LocalStorage Cache ทันที
- **List รายการเบิก:** แสดงการ์ดแยกตาม Site งาน พร้อมจำนวนเส้นทาง, ระยะทางรวม, ยอดเงิน, และสถานะ
- **ปุ่มลบรายการ (🗑️):** แสดงเฉพาะรายการที่สถานะไม่ใช่ `APPROVED` (มี Modal ยืนยันก่อนลบ)
- **ปุ่ม "+ เพิ่ม Site ใหม่":** กดเพื่อเปิดฟอร์มบันทึกข้อมูล

### 3.3 หน้าฟอร์มบันทึกเบิกค่าเดินทาง (Reimbursement Form)
- **การล็อก SITE:** เมื่อเป็นรายการที่มีอยู่แล้ว (`currentTxId` มีค่า) หรือสถานะเป็น `APPROVED` ช่องเลือก SITE จะถูกล็อก Read-only
- **การ์ดเส้นทาง Dynamic (Trip Cards):**
  - ตัวเลือกเส้นทาง: แสดงเส้นทางมาตรฐานตาม SITE ที่เลือก + ตัวเลือกสุดท้าย "📍 ระบุเส้นทางเอง (Custom)"
  - ถ้าเลือกเส้นทางมาตรฐาน (Fix): ต้นทาง, ปลายทาง, ระยะทาง จะล็อกอัตโนมัติพร้อมไอคอน 🔒
  - ถ้าเลือก "ระบุเส้นทางเอง" (Custom): กรอกต้นทาง, ปลายทาง, และระยะทางได้อิสระ
  - **ตัวสลับ "เที่ยวเดียว" / "ไปกลับ":**
    - เส้นทางมาตรฐาน (Fix) + ไปกลับ → แสดงป้าย `🔁 ไปกลับ ×2` (Backend คำนวณ km × 2)
    - เส้นทางระบุเอง (Custom) + ไปกลับ → แสดงป้าย `🔁 ไปกลับ` (Backend ไม่คูณซ้ำ ผู้ใช้กรอกยอดรวมตามจริง)
  - **การปลดล็อกระยะทาง:** **ไม่มีการจำกัดเพดาน 500 กม.** สามารถกรอกระยะทางจริงได้ตามต้องการ (ต้อง > 0 กม.)
- **ค่าธรรมเนียมและค่ารถ:**
  - ค่าทางด่วน, ค่าที่จอดรถ (เรียก Keypad ตัวเลข `inputmode="decimal"`)
  - สวิตช์เปิด/ปิด "ค่ารถ" (Flat rate 150 บาท)
- **กล่องคำนวณเงิน:** แสดงสรุป ระยะทางรวม, อัตราเบิก (บาท/กม.), ค่ารถ, และยอดเบิกสุทธิ
- **Sticky Summary Bar:** แถบสรุปยอดเงินและระยะทางรวมลอยติดขอบล่าง พร้อมปุ่ม **"💾 บันทึกขอเบิก"** ตลอดเวลา

---

## 4. ข้อกำหนด Backend API (Cloudflare Workers REST API)

### 4.1 `GET /api/config` — รับค่า Config และสถานะระบบ
- **Auth:** ไม่ต้องมี Token (Public)
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "liff_id": "2009016720-k0zSXOrx",
      "app_version": "v3.0",
      "environment": "production",
      "allow_dev_mock": true
    }
  }
  ```

### 4.2 `GET /api/master` — ข้อมูล Master สำหรับ 24H LocalStorage Cache
- **Auth:** ตรวจสอบ LINE Token หรือ Dev Mock
- **แคชบนเครื่อง:** Frontend เก็บลง `localStorage` คีย์ `trip1day_master_cache_v3` นาน 24 ชั่วโมง
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "sites": [{ "site_id": "HO", "site_name": "Head Office" }],
      "routes": [{ "route_id": "RT-01", "site_id": "HO", "route_name": "...", "origin": "...", "destination": "...", "distance_km": 25.5 }],
      "approvers": ["พี่ดุ๋ย", "ผู้จัดการ A"],
      "rates": [{ "dt_date": "2026-06-26", "group_car1": 4.8, "group_car2": 4.8 }],
      "config": { "flat_rate": 150, "max_trips": 10, "min_trips": 1 }
    }
  }
  ```

### 4.3 `GET /api/profile` — ข้อมูลโปรไฟล์ผู้ใช้และวันที่ประเทศไทย
- **Auth:** ตรวจสอบ LINE Token หรือ Dev Mock
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "exists": true,
      "today_th": "2026-09-19",
      "profile": {
        "line_uid": "U123456789...",
        "requester_name": "สมชาย ใจดี",
        "car_no": "กข-1234",
        "group_car": 1,
        "emp_no": "M00050"
      }
    }
  }
  ```

### 4.4 `GET /api/transactions?date=YYYY-MM-DD` — รายการของวันที่เลือก (แบบเต็ม)
- **Auth:** ตรวจสอบ LINE Token หรือ Dev Mock
- **SQL Query:** กรองด้วย `WHERE req_date = ? AND req_line_user_id = ?` (O(1) ผ่าน Index)
- **Single-Fetch Design:** ส่งข้อมูลเต็มรวม `trip_details` เพื่อให้เปิดดู/แก้ไขได้ทันทีโดยไม่ต้อง Query ซ้ำ
- **Response:**
  ```json
  {
    "success": true,
    "data": [
      {
        "transaction_id": "TX-f3a0b07f-...",
        "req_name": "สมชาย ใจดี",
        "req_line_user_id": "U12345...",
        "req_date": "2026-09-19",
        "plate_no": "กข-1234",
        "site_id": "HO",
        "site_name": "Head Office",
        "travel_purpose": "ตรวจงาน",
        "image_url": "",
        "total_km": 50.0,
        "toll_fee": 50.0,
        "park_fee": 20.0,
        "flat_rate_fee": 150.0,
        "net_total": 460.0,
        "approver": "พี่ดุ๋ย",
        "status": "PENDING",
        "trip_count": 1,
        "trip_details": [
          {
            "trip_id": "t-001",
            "trip_no": 1,
            "type": "FIX",
            "trip_type": "ROUND_TRIP",
            "route_id": "RT-01",
            "route_name": "...",
            "origin": "...",
            "dest": "...",
            "km": 25.0
          }
        ]
      }
    ]
  }
  ```

### 4.5 `POST /api/transactions` — บันทึกหรือแก้ไขรายการ
- **Request Body:**
  ```json
  {
    "transaction_id": null,
    "req_name": "สมชาย ใจดี",
    "req_date": "2026-09-19",
    "plate_no": "กข-1234",
    "site_id": "HO",
    "travel_purpose": "ตรวจงาน",
    "image_url": "",
    "toll_fee": 50,
    "park_fee": 20,
    "use_flat_rate": true,
    "approver": "พี่ดุ๋ย",
    "trip_details": [...]
  }
  ```
- **Business Logic ขั้นตอนการทำงาน:**
  1. ตรวจสอบความถูกต้อง (Validation): ตรวจสอบชื่อ, วันที่, ไซต์งาน, ผู้อนุมัติ, จำนวนเส้นทาง, และระยะทาง (ต้อง > 0 กม.)
  2. คำนวณเงินและระยะทางใหม่บน Server เสมอ (ป้องกัน Client ดัดแปลงตัวเลข)
  3. ตรวจสอบ Duplicate Site Record: 1 ผู้ใช้ + 1 วัน + 1 Site บันทึกได้ 1 รายการเท่านั้น
  4. ตรวจสอบ Edit-Lock: หากมี `transaction_id` ส่งมาและสถานะเป็น `APPROVED` จะปฏิเสธด้วยรหัส `LOCKED_TRANSACTION`
  5. Auto-Register: หากผู้ใช้ยังไม่มีข้อมูลใน `users_profile` จะบันทึกสร้าง Profile ให้อัตโนมัติ

### 4.6 `DELETE /api/transactions/:transactionId` — ลบรายการ
- **สิทธิ์:** ลบได้เฉพาะรายการของผู้ใช้ตนเอง และสถานะต้องเป็น `DRAFT`, `PENDING`, หรือ `REJECTED`
- **การล็อก:** หากสถานะเป็น `APPROVED` จะปฏิเสธด้วยรหัส `LOCKED_TRANSACTION` ห้ามลบโดยเด็ดขาด

---

## 5. โครงสร้างซอร์สโค้ดของโปรเจกต์ (Project Codebase)

```
c:\Antigravity_Data\trip1day_v3/
├── package.json                   # dependencies: typescript, wrangler v4, workers-types
├── tsconfig.json                  # TypeScript target ES2022
├── wrangler.toml                  # Cloudflare binding & assets configuration
├── src/                           # Backend API (Cloudflare Workers)
│   ├── index.ts                   # Main Router, Asset Fetcher & Cron trigger
│   ├── config.ts                  # Env interface, error codes, app version
│   ├── middleware/
│   │   └── auth.ts                # LINE Access Token verification & Dev Mock handler
│   ├── routes/
│   │   ├── config.ts              # GET /api/config
│   │   ├── master.ts              # GET /api/master
│   │   ├── profile.ts             # GET /api/profile
│   │   └── transactions.ts        # GET, POST, DELETE /api/transactions
│   ├── services/
│   │   ├── rateCalc.ts            # Rate & fee calculation formulas
│   │   ├── validation.ts          # Server-side validation rules
│   │   └── maintenance.ts         # Cron daily maintenance
│   └── utils/
│       ├── date.ts                # Asia/Bangkok date & time utilities
│       └── response.ts            # Standard JSON response & CORS builder
└── public/                        # Frontend WebApp (Served via Cloudflare Assets)
    ├── index.html                 # App shell, meta no-cache, Prompt font
    ├── config.js                  # Client configuration (LIFF_ID, Cache TTL)
    ├── css/
    │   └── styles.css             # Elevated Dark Glassmorphism, Presbyopia-friendly
    └── js/
        ├── api.js                 # API client with token injector & toasts
        ├── cache.js               # 24H LocalStorage Master & Profile cache manager
        ├── validation.js          # Formatters & client-side validation
        ├── trip_card.js           # Dynamic trip card component
        ├── trip_form.js           # Reimbursement form & sticky summary bar
        ├── day_summary.js         # Day summary screen & sync button
        └── app.js                 # App lifecycle, state store, LINE login
```

---

## 6. ตัวแปรสภาพแวดล้อม (Environment Variables & Config)

กำหนดใน `wrangler.toml` (หรือแก้ไขผ่าน Cloudflare Dashboard ในส่วน **Worker -> Settings -> Variables and Secrets**):

| ตัวแปร | ค่าตัวอย่าง / ค่าเริ่มต้น | หน้าที่ |
|---|---|---|
| `LIFF_ID` | `2009016720-k0zSXOrx` | LINE LIFF ID ของระบบ (แก้บน Dashboard ได้ทันทีไม่ต้อง Deploy ซ้ำ) |
| `ENVIRONMENT` | `production` | โหมดการทำงาน |
| `ALLOW_DEV_MOCK` | `true` | เปิด/ปิดการรองรับโหมดทดสอบบนเบราว์เซอร์ PC |
| `RETENTION_DAYS` | `0` | จำนวนวันที่เก็บข้อมูลก่อนลบ (ตั้งเป็น 0 เพื่อปิดการลบอัตโนมัติ) |
| `MAINTENANCE_EMAIL_RECIPIENTS` | `pingly69@gmail.com,pingly69@outlook.com` | อีเมลรับไฟล์สำรองข้อมูล (CSV) ก่อนลบ |

---

## 7. คำสั่งการบริหารจัดการ (Commands & Operations)

```bash
# ตรวจสอบ TypeScript Types
npm run typecheck

# ทดสอบรัน Local Server
npm run dev

# Deploy ขึ้นสู่ Cloudflare Workers จริง
npm run deploy
```
