# 🚗 Trip1Day Mileage Reimbursement System (v3.0)

> **Mobile LIFF WebApp on Cloudflare Workers & Cloudflare D1 Database**

ระบบบันทึกขอเบิกค่าเดินทางรายวัน (Trip1Day Mileage Reimbursement System ver. 3.0) พัฒนาขึ้นเพื่อทดแทนระบบเดิม โดยทำงานเป็น Mobile Web App ผ่าน LINE Front-end Framework (LIFF) บนสถาปัตยกรรม Serverless ของ Cloudflare Workers และฐานข้อมูล Cloudflare D1

---

## 🌟 จุดเด่นของระบบ (Key Features)

- **LINE LIFF Integration:** เข้าใช้งานผ่าน LINE ได้ทันที ตรวจสอบตัวตนอัตโนมัติด้วย LINE User ID
- **Auto-Fill Profile:** โหลดข้อมูลผู้ขอเบิก, ทะเบียนรถ, รหัสพนักงาน และกลุ่มเรตการเบิกอัตโนมัติจากฐานข้อมูล
- **Smart Master Data & Local Caching:** โหลดรายชื่อไซต์งานและเส้นทางมาตรฐาน พร้อมระบบแคชบนเบราว์เซอร์ ลดปริมาณการเรียก API
- **Dynamic Rate Calculation:** คำนวณเงินชดเชยค่าเดินทางตามระยะทางและอัตราเรตที่มีผลบังคับใช้ตามวันที่เดินทาง
- **Daily Trip Management:** สรุปรายการเดินทางประจำวัน เพิ่ม/ลบ/แก้ไข รายการเดินทางก่อนยืนยันบันทึก
- **Serverless & Edge Performance:** ทำงานบน Cloudflare Workers และ D1 (APAC - Singapore) รองรับความเร็วสูง Latency ต่ำ
- **Automated Maintenance:** มี Cron Trigger สำหรับการดูแลรักษาฐานข้อมูลประจำวัน

---

## 🛠️ Tech Stack

- **Backend:** Cloudflare Workers (TypeScript)
- **Database:** Cloudflare D1 (`IMG_DB`)
- **Frontend:** Mobile-first Vanilla HTML5, CSS3, JavaScript (ES6 Modules)
- **Framework & Libraries:**
  - LINE Front-end Framework (LIFF SDK v2)
  - Wrangler CLI (Cloudflare Developer Platform)

---

## 📂 โครงสร้างโปรเจกต์ (Project Structure)

```text
trip1day_v3/
├── public/                 # Frontend Static Assets
│   ├── css/
│   │   └── styles.css      # Custom Mobile-first Stylesheet
│   ├── js/
│   │   ├── api.js          # API Client Layer
│   │   ├── app.js          # Main App Controller & LIFF Init
│   │   ├── cache.js        # LocalStorage Caching Utility
│   │   ├── day_summary.js  # Day Summary Modal / View
│   │   ├── trip_card.js    # Trip Card UI Component
│   │   ├── trip_form.js    # Trip Entry Form Handler
│   │   └── validation.js   # Input Validation Rules
│   ├── config.js           # Client-side Runtime Configuration
│   └── index.html          # Main WebApp Entry Page
├── skills/                 # System & Database Specifications
│   ├── D1_DATABASE_INTEGRATION_SPEC.md
│   └── WebApp_Cloudflare_SQLite_Spec_v1.md
├── src/                    # Backend API (Cloudflare Workers)
│   ├── middleware/
│   │   └── auth.ts         # User Auth & LIFF Header Validation
│   ├── routes/
│   │   ├── config.ts       # Public Config Route
│   │   ├── master.ts       # Master Sites & Routes API
│   │   ├── profile.ts      # User Profile API
│   │   └── transactions.ts # Mileage Reimbursement Transactions API
│   ├── services/
│   │   ├── maintenance.ts  # Daily Cron Maintenance Service
│   │   ├── rateCalc.ts     # Mileage Rate Calculation Engine
│   │   └── validation.ts   # Backend Payload Validation
│   ├── utils/
│   │   ├── date.ts         # Date / Time Utilities
│   │   └── response.ts     # Standardized JSON Response Helpers
│   ├── config.ts           # Server Configuration Constants
│   └── index.ts            # Workers Fetch & Scheduled Event Handlers
├── package.json
├── tsconfig.json
├── wrangler.toml           # Cloudflare Workers & D1 Configuration
└── README.md
```

---

## 🚀 การติดตั้งและรันโปรเจกต์ (Getting Started)

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. รันในสภาพแวดล้อม Local Development
```bash
npm run dev
# หรือรันแบบ local offline
npm run dev:local
```

### 3. ตรวจสอบ Type
```bash
npm run typecheck
```

### 4. Deploy ไปยัง Cloudflare Workers
```bash
npm run deploy
```

---

## ⚙️ การตั้งค่า Environment Variables

กำหนดในไฟล์ `wrangler.toml` หรือผ่าน Cloudflare Dashboard / Wrangler Secret:

| Variable | Description |
|---|---|
| `ENVIRONMENT` | สภาพแวดล้อม (`production` / `development`) |
| `LIFF_ID` | LINE LIFF App ID |
| `ALLOW_DEV_MOCK` | อนุญาตให้ใช้ Mock User ในการทดสอบ Local (`true`/`false`) |
| `RETENTION_DAYS` | จำนวนวันที่เก็บข้อมูลก่อนทำความสะอาด (`0` = ปิด) |
| `MAINTENANCE_EMAIL_RECIPIENTS` | อีเมลสำหรับรับรายงานการซ่อมบำรุงประจำวัน |
