# 📘 ข้อกำหนดการเชื่อมต่อและใช้งานฐานข้อมูล Cloudflare D1
## โครงการ: Trip1Day Mileage Reimbursement System (ฐานข้อมูลกลาง)

> **วัตถุประสงค์ของเอกสาร:**  
> ใช้เป็นเอกสารอ้างอิงและคำสั่งเริ่มต้น (Specification & Contract) สำหรับส่งต่อให้ทีมพัฒนาหรือ AI Assistant ในการสร้าง/ย้ายอีก **2 ระบบ** ที่ต้องใช้ฐานข้อมูล `IMG_DB` (เดิมคือ `Trip1Day-db`) ร่วมกัน ได้แก่:
> 1. **ระบบที่ 1:** แอพบันทึกขอเบิกค่าเดินทาง (Requester / LIFF App)
> 2. **ระบบที่ 2:** แอพและระบบอนุมัติค่าเดินทาง (Approver Web App / Line Bot)

---

## 1. ข้อมูลการเชื่อมต่อฐานข้อมูล Cloudflare D1 (Production)

ทั้ง 2 โปรเจกต์ใหม่ที่จะสร้างบน Cloudflare Workers หรือ Cloudflare Pages ให้ระบุ Binding ในไฟล์ `wrangler.toml` ดังนี้:

```toml
[[d1_databases]]
binding = "IMG_DB"
database_name = "IMG_DB"
database_id = "4db03e65-cc9d-458e-81f7-b8119669dd17"
```

* **Cloudflare Account ID:** `f9bc011eeec351846c11f6aefacded76`
* **Database Name:** `IMG_DB`
* **Database ID (UUID):** `4db03e65-cc9d-458e-81f7-b8119669dd17`
* **Region:** `APAC` (Singapore `SIN`)
* **จำนวนตารางทั้งหมด:** 7 ตารางหลัก

---

## 2. ข้อมูลเฉพาะสำหรับ "ระบบที่ 1: แอพบันทึกขอเบิกค่าเดินทาง (Requester)"

### 2.1 ตารางที่ต้องอ่าน (Read Operations)
1. **`users_profile`**: อ่านข้อมูลผู้ใช้ตาม LINE User ID
   ```sql
   SELECT line_uid, requester_name, car_no, group_car, emp_no 
   FROM users_profile 
   WHERE line_uid = ?;
   ```
   * ถ้าพบ: ให้ Auto-fill ชื่อ, ทะเบียนรถเริ่มต้น, กลุ่มเรต (1 หรือ 2), และรหัสพนักงาน
   * ถ้าไม่พบ: ให้ขึ้นฟอร์มให้กรอกเพื่อสร้าง Profile ใหม่

2. **`master_site`**: อ่านรายชื่อไซต์งานที่เปิดใช้งานอยู่
   ```sql
   SELECT site_id, site_name 
   FROM master_site 
   WHERE active = 1 
   ORDER BY site_name;
   ```

3. **`master_routes`**: อ่านเส้นทางมาตรฐานตามไซต์ที่เลือก
   ```sql
   SELECT route_id, route_name, origin, destination, distance_km 
   FROM master_routes 
   WHERE site_id = ? AND active = 1 
   ORDER BY route_name;
   ```

4. **`rate_car`**: อ่านอัตราค่าเดินทาง (บาท/กม.) ที่มีผลบังคับใช้ ณ วันที่เดินทาง (`req_date`)
   ```sql
   SELECT group_car1, group_car2 
   FROM rate_car 
   WHERE dt_date <= ? 
   ORDER BY dt_date DESC 
   LIMIT 1;
   ```

5. **`approve_users`**: อ่านรายชื่อผู้อนุมัติสำหรับ Dropdown
   ```sql
   SELECT approve_request, line_uid 
   FROM approve_users 
   WHERE active = 1 
   ORDER BY id;
   ```

6. **`master_config`**: อ่านค่าคงที่ระบบ (เช่น flat_rate)
   ```sql
   SELECT value FROM master_config WHERE key = 'flat_rate';
   ```

### 2.2 ตรวจสอบป้องกันการส่งเบิกซ้ำ (Duplicate Prevention)
ตามกฎของระบบ: **1 คน + 1 วัน + 1 ไซต์ = บันทึกได้ 1 รายการเท่านั้น**  
ต้องเช็คก่อน Insert หรือดักจับ SQLite Unique Constraint Error:
```sql
SELECT transaction_id FROM transactions 
WHERE req_date = ? AND req_line_user_id = ? AND site_id = ?;
```

### 2.3 ตารางที่ต้องเขียน (Write Operations)
1. **Insert ลง `transactions`**:
   ```sql
   INSERT INTO transactions (
     transaction_id, req_name, req_line_user_id, req_date,
     plate_no, site_id, site_name, travel_purpose, image_url,
     total_km, toll_fee, park_fee, flat_rate_fee, net_total,
     approver, status, approve_datetime, trip_details, created_at, updated_at
   ) VALUES (
     ?, ?, ?, ?,
     ?, ?, ?, ?, ?,
     ?, ?, ?, ?, ?,
     ?, 'PENDING', NULL, ?, datetime('now', '+7 hours'), datetime('now', '+7 hours')
   );
   ```
   * `transaction_id`: สร้างด้วย UUID v4 ขึ้นต้นด้วย `TX-` (เช่น `TX-` + `crypto.randomUUID()`)
   * `status`: เริ่มต้นเป็น `'PENDING'` (หรือ `'DRAFT'`)
   * `site_id`: รหัส ERP Code (ห้ามเป็น UUID)
   * `site_name`: Snapshot ชื่อไซต์ตอนบันทึก (Denormalized)
   * `trip_details`: JSON String เก็บรายละเอียดทริป เช่น:
     ```json
     [
       {"type": "FIX", "route_id": "RT-01", "name": "สำนักงานใหญ่ -> ไซต์ A", "km": 25.5},
       {"type": "CUSTOM", "name": "แวะรับอุปกรณ์", "km": 5.0}
     ]
     ```
   * ตัวเลขเงินและระยะทาง (`total_km`, `toll_fee`, `park_fee`, `flat_rate_fee`, `net_total`) ต้องส่งเป็น **Number (Float)**

2. **Update ทะเบียนรถล่าสุดใน `users_profile`**:
   ถ้าผู้ใช้เปลี่ยนทะเบียนรถในหน้าฟอร์ม ให้จำค่าล่าสุดไว้:
   ```sql
   UPDATE users_profile 
   SET car_no = ?, updated_at = datetime('now', '+7 hours') 
   WHERE line_uid = ?;
   ```

---

## 3. ข้อมูลเฉพาะสำหรับ "ระบบที่ 2: แอพ/ระบบอนุมัติค่าเดินทาง (Approver)"

### 3.1 ตารางที่ต้องอ่าน (Read Operations)
1. **ดึงรายการที่รออนุมัติ (`PENDING`)**:
   ```sql
   SELECT 
     t.transaction_id,
     t.req_name,
     t.req_line_user_id,
     t.req_date,
     t.plate_no,
     t.site_name,
     t.travel_purpose,
     t.image_url,
     t.total_km,
     t.toll_fee,
     t.park_fee,
     t.flat_rate_fee,
     t.net_total,
     t.approver,
     t.status,
     t.trip_details,
     t.created_at,
     u.emp_no
   FROM transactions t
   LEFT JOIN users_profile u ON t.req_line_user_id = u.line_uid
   WHERE t.status = 'PENDING'
     AND (? IS NULL OR t.approver = ?)
   ORDER BY t.created_at ASC;
   ```

### 3.2 ตารางที่ต้องเขียน (Write Operations)
1. **กรณีอนุมัติรายการ (Approve)**:
   ```sql
   UPDATE transactions 
   SET status = 'APPROVED',
       approve_datetime = datetime('now', '+7 hours'),
       updated_at = datetime('now', '+7 hours')
   WHERE transaction_id = ? AND status = 'PENDING';
   ```
   > ⚠️ **ข้อควรระวังสำคัญมาก:** ค่า `approve_datetime` ต้องบันทึกในรูปแบบ **`YYYY-MM-DD HH:MM:SS`** (เวลาไทย คั่นด้วยช่องว่าง ห้ามมีตัวอักษร `T`) ซึ่งคำสั่ง `datetime('now', '+7 hours')` ของ SQLite จะสร้างฟอร์แมตนี้ให้อัตโนมัติ

2. **กรณีปฏิเสธรายการ (Reject)**:
   ```sql
   UPDATE transactions 
   SET status = 'REJECTED',
       approve_datetime = datetime('now', '+7 hours'),
       updated_at = datetime('now', '+7 hours')
   WHERE transaction_id = ? AND status = 'PENDING';
   ```

---

## 4. กฎเหล็กทางเทคนิค (Golden Rules & Gotchas ที่ต้องทราบ)

1. **รูปแบบ Date/Time ใน SQLite**:
   * `req_date`: ต้องเป็น **`YYYY-MM-DD`** เท่านั้น
   * `approve_datetime`: ต้องเป็น **`YYYY-MM-DD HH:MM:SS`** (คั่นด้วยช่องว่างเสมอ)
   * `created_at` / `updated_at`: ใช้ `datetime('now', '+7 hours')` หรือ ISO-8601
2. **ห้ามตั้ง Foreign Key บังคับที่ `transactions.site_id`**:
   * ใน Schema ออกแบบจงใจไม่ใส่ `REFERENCES master_site(site_id)` เพื่อให้ประวัติการเบิกจ่ายเก่าไม่สูญหายหากมีการลบหรือแก้ Site ในอนาคต
3. **Cascade Delete ใน `master_routes`**:
   * `master_routes` มี Foreign Key ชี้ไปที่ `master_site(site_id) ON DELETE CASCADE` ถ้าลบ Site เส้นทางทั้งหมดของ Site นั้นจะถูกลบอัตโนมัติ
4. **Unique Indexes**:
   * Site Name ห้ามซ้ำ: `idx_site_name_lower`
   * Route Name ภายใน Site เดียวกันห้ามซ้ำ: `idx_route_name_per_site` (คนละ Site ชื่อซ้ำกันได้)
   * 1 คน + 1 วัน + 1 Site = 1 Transaction: `idx_transactions_date_user_site`
5. **Data Types ของตัวเลข**:
   * ยอดเงินและระยะทางทั้งหมดเก็บเป็น **`REAL`** ใน SQLite ห้าม Save เป็น String เพื่อให้ระบบคำนวณและ Export Excel ได้อย่างถูกต้อง

---

## 5. สรุปโครงสร้างตาราง (Data Dictionary)

| # | ชื่อตาราง | Primary Key | คอลัมน์สำคัญ | วัตถุประสงค์ |
|---|---|---|---|---|
| 1 | **`users_profile`** | `line_uid` | `requester_name`, `car_no`, `group_car`, `emp_no` | เก็บประวัติและรหัสพนักงานของผู้ขอเบิก |
| 2 | **`master_site`** | `site_id` (ERP Code) | `site_name`, `active` (1/0) | ข้อมูลสถานที่/ไซต์งาน |
| 3 | **`master_routes`** | `route_id` | `site_id`, `route_name`, `distance_km`, `active` | เส้นทางมาตรฐานและระยะทาง กม. |
| 4 | **`master_config`** | `key` | `value` | ค่าคงที่ระบบ (เช่น flat_rate) |
| 5 | **`rate_car`** | `dt_date` | `group_car1`, `group_car2` | อัตราเบิกตามประเภทรถและวันที่มีผล |
| 6 | **`approve_users`** | `id` (AutoInc) | `approve_request`, `line_uid`, `active` | รายชื่อผู้อนุมัติ |
| 7 | **`transactions`** | `transaction_id` | `req_date`, `total_km`, `net_total`, `status`, `approve_datetime`, `trip_details` | ประวัติการขอเบิกและสถานะอนุมัติ |

---
*เอกสารนี้จัดทำและทดสอบความถูกต้องกับ Cloudflare D1 Production (`IMG_DB`) เรียบร้อยแล้ว (กันยายน 2026)*
