import { PGlite } from "@electric-sql/pglite";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = await PGlite.create();

const schema = `
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null, phone text,
  role text not null check (role in ('passenger','driver')),
  vehicle_seats integer not null default 4 check (vehicle_seats between 1 and 10),
  created_at timestamptz not null default now()
);
create table public.ride_groups (
  id uuid primary key default gen_random_uuid(),
  leader_id uuid not null references public.profiles(id),
  target_passengers integer not null check (target_passengers between 1 and 10),
  status text not null default 'forming'
    check (status in ('forming','sent_to_driver','accepted','completed','cancelled')),
  driver_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz, accepted_at timestamptz, completed_at timestamptz
);
create table public.ride_requests (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references public.profiles(id),
  group_id uuid references public.ride_groups(id) on delete set null,
  origin_text text not null, destination_text text not null,
  origin_lat double precision not null, origin_lng double precision not null,
  destination_lat double precision not null, destination_lng double precision not null,
  target_passengers integer not null check (target_passengers between 1 and 10),
  status text not null default 'searching'
    check (status in ('searching','matched','sent_to_driver','accepted','completed','cancelled')),
  created_at timestamptz not null default now()
);
create table public.ride_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.ride_groups(id) on delete cascade,
  ride_request_id uuid not null references public.ride_requests(id) on delete cascade,
  passenger_id uuid not null references public.profiles(id) on delete cascade,
  party_size integer not null default 1 check (party_size between 1 and 10),
  confirmed boolean not null default false,
  joined_at timestamptz not null default now(),
  unique(group_id, passenger_id), unique(group_id, ride_request_id)
);
`;

await db.exec(schema);
await db.exec(readFileSync(join(__dirname, "functions.sql"), "utf8"));
await db.exec(readFileSync(join(__dirname, "procedures.sql"), "utf8"));

const steps = [];
const cols = (r) => ({ columns: r.fields.map((f) => f.name), rows: r.rows });
const clean = (e) => (e.message || String(e)).replace(/^error:\s*/i, "").split("\n")[0];
async function q(sql) { return cols(await db.query(sql)); }
async function call(sql) {
  try { return { result: cols(await db.query(sql)) }; }
  catch (e) { return { error: clean(e) }; }
}

const G_A = "aaaaaaaa-0000-0000-0000-000000000001";
const G_C = "cccccccc-0000-0000-0000-000000000001";
const G_B = "bbbbbbbb-0000-0000-0000-000000000001";
const P1 = "11111111-1111-1111-1111-000000000001";
const P3 = "11111111-1111-1111-1111-000000000003";
const P4 = "11111111-1111-1111-1111-000000000004";
const D1 = "11111111-1111-1111-1111-0000000000d1";

await db.exec(`
insert into public.profiles (id, name, role, vehicle_seats) values
 ('${P1}','สมชาย (หัวหน้ากลุ่ม A)','passenger',4),
 ('11111111-1111-1111-1111-000000000002','สมหญิง (สมาชิก A)','passenger',4),
 ('${P3}','มานะ (หัวหน้ากลุ่ม C)','passenger',4),
 ('${P4}','ปิติ (หัวหน้ากลุ่ม B)','passenger',4),
 ('${D1}','วิชัย (คนขับ)','driver',4);

insert into public.ride_groups (id, leader_id, target_passengers, status) values
 ('${G_A}','${P1}',4,'forming'),
 ('${G_C}','${P3}',3,'forming'),
 ('${G_B}','${P4}',2,'forming');

insert into public.ride_requests
 (id, passenger_id, group_id, origin_text, destination_text,
  origin_lat, origin_lng, destination_lat, destination_lng, target_passengers, status)
values
 ('aaaa1111-0000-0000-0000-000000000001','${P1}','${G_A}','หน้ามหาวิทยาลัยพะเยา','ตลาดพะเยา',19.0302,99.8962,19.0305,99.8895,4,'matched'),
 ('cccc1111-0000-0000-0000-000000000001','${P3}','${G_C}','ประตู 2 ม.พะเยา','บิ๊กซีพะเยา',19.0320,99.8980,19.0330,99.8920,3,'matched'),
 ('bbbb1111-0000-0000-0000-000000000001','${P4}','${G_B}','อำเภอแม่ใจ','ตัวเมืองพะเยา',19.0600,99.9300,19.0700,99.9400,2,'matched');

insert into public.ride_group_members (group_id, ride_request_id, passenger_id, party_size) values
 ('${G_A}','aaaa1111-0000-0000-0000-000000000001','${P1}',3),
 ('${G_C}','cccc1111-0000-0000-0000-000000000001','${P3}',1),
 ('${G_B}','bbbb1111-0000-0000-0000-000000000001','${P4}',1);
`);

// S1 context
steps.push({
  no: 1,
  title: "สถานะเริ่มต้นของกลุ่มทั้งหมด (ก่อนเรียก procedure)",
  sql: `select left(id::text, 8) as group_id, status, driver_id, created_at\nfrom public.ride_groups order by id;`,
  result: await q(`select left(id::text, 8) as group_id, status, driver_id is not null as has_driver, created_at
                   from public.ride_groups order by id;`),
  note: "ทุกกลุ่มยังไม่มีคนขับ (has_driver = false)",
});

// S2 CALL accept A
const acceptA = await call(`CALL public.sp_accept_ride_group('${G_A}'::uuid, '${D1}'::uuid);`);
steps.push({ no: 2, title: "CALL sp_accept_ride_group(กลุ่ม A, คนขับ) — สำเร็จ", sql: `call public.sp_accept_ride_group(\n  '${G_A}'::uuid,   -- กลุ่ม A\n  '${D1}'::uuid     -- คนขับ\n);`, ...acceptA });

// S3 verify A + events
steps.push({
  no: 3,
  title: "ตรวจผลหลัง CALL — กลุ่ม A ถูกมอบหมายคนขับ + บันทึก event แล้ว",
  sql: `select left(id::text,8) as group_id, status, driver_id is not null as has_driver\nfrom public.ride_groups where id = '${G_A}';\n\nselect event, detail from public.ride_group_events where group_id = '${G_A}';`,
  result: await q(`select left(id::text,8) as group_id, status, driver_id is not null as has_driver
                   from public.ride_groups where id = '${G_A}';`),
  result2: await q(`select event, detail from public.ride_group_events where group_id = '${G_A}';`),
  note: "procedure ทำงานหลายคำสั่ง (ตรวจ + update + insert log) ในคําสั่งเดียว",
});

// S4 CALL accept A again -> error
const acceptAgain = await call(`CALL public.sp_accept_ride_group('${G_A}'::uuid, '${D1}'::uuid);`);
steps.push({ no: 4, title: "CALL sp_accept_ride_group(กลุ่ม A ซ้ำ) — ถูกปฏิเสธ", sql: `call public.sp_accept_ride_group('${G_A}'::uuid, '${D1}'::uuid);`, ...acceptAgain, note: "กลุ่มสถานะ accepted แล้ว จึงรับงานซ้ำไม่ได้" });

// S5 CALL accept C by passenger -> error
const acceptPassenger = await call(`CALL public.sp_accept_ride_group('${G_C}'::uuid, '${P3}'::uuid);`);
steps.push({ no: 5, title: "CALL sp_accept_ride_group(กลุ่ม C, ผู้โดยสาร) — ถูกปฏิเสธ", sql: `call public.sp_accept_ride_group(\n  '${G_C}'::uuid,   -- กลุ่ม C\n  '${P3}'::uuid     -- เป็นผู้โดยสาร ไม่ใช่คนขับ\n);`, ...acceptPassenger, note: "procedure ตรวจ role ของผู้ใช้ก่อนมอบหมายงาน" });

// S6 CALL cancel C
const cancelC = await call(`CALL public.sp_cancel_ride_group('${G_C}'::uuid, '${P3}'::uuid, 'เปลี่ยนแผนการเดินทาง');`);
steps.push({ no: 6, title: "CALL sp_cancel_ride_group(กลุ่ม C) — ยกเลิกพร้อมระบุเหตุผล", sql: `call public.sp_cancel_ride_group(\n  '${G_C}'::uuid,              -- กลุ่ม C\n  '${P3}'::uuid,               -- ผู้สั่งยกเลิก\n  'เปลี่ยนแผนการเดินทาง'         -- เหตุผล\n);`, ...cancelC });

// S7 verify C cancelled
steps.push({
  no: 7,
  title: "ตรวจผลหลังยกเลิก — กลุ่ม C เป็น cancelled และมี event",
  sql: `select left(id::text,8) as group_id, status, driver_id\nfrom public.ride_groups where id = '${G_C}';\n\nselect event, detail from public.ride_group_events where group_id = '${G_C}';`,
  result: await q(`select left(id::text,8) as group_id, status, driver_id from public.ride_groups where id = '${G_C}';`),
  result2: await q(`select event, detail from public.ride_group_events where group_id = '${G_C}';`),
});

// S8 age group B
await db.query(`update public.ride_groups set created_at = now() - interval '5 hours' where id = '${G_B}';`);
steps.push({
  no: 8,
  title: "เตรียมทดสอบงานประจํา — ทําให้กลุ่ม B เก่ากว่า 1 ชั่วโมง",
  sql: `update public.ride_groups\n   set created_at = now() - interval '5 hours'\n where id = '${G_B}';`,
  result: await q(`select left(id::text,8) as group_id, status, created_at, now() - created_at as age
                   from public.ride_groups where id = '${G_B}';`),
  note: "จําลองกลุ่มที่ค้างรวมคนมานานเกินกําหนด",
});

// S9 CALL expire
const expire = await call(`CALL public.sp_expire_stale_groups('1 hour'::interval);`);
steps.push({ no: 9, title: "CALL sp_expire_stale_groups('1 hour') — งานประจําปิดกลุ่มที่ค้าง", sql: `call public.sp_expire_stale_groups('1 hour'::interval);`, ...expire, note: "ค่าที่คืนผ่าน INOUT parameter = จำนวนกลุ่มที่ถูกปิด" });

// S10 verify B
steps.push({
  no: 10,
  title: "ตรวจผล — กลุ่ม B ถูกปิดอัตโนมัติ + event log ทั้งหมด",
  sql: `select left(id::text,8) as group_id, status from public.ride_groups where id = '${G_B}';\n\nselect e.event, e.detail, left(e.group_id::text,8) as group_id\nfrom public.ride_group_events e order by e.id;`,
  result: await q(`select left(id::text,8) as group_id, status from public.ride_groups where id = '${G_B}';`),
  result2: await q(`select e.event, e.detail, left(e.group_id::text,8) as group_id from public.ride_group_events e order by e.id;`),
});

// list procedures
const procs = await q(`
  select p.proname as procedure_name,
         pg_get_function_arguments(p.oid) as arguments,
         l.lanname as language
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  where n.nspname = 'public' and p.prokind = 'p'
  order by p.proname;`);

const out = { db: "PostgreSQL 16 (PGlite / WASM)", steps, procedures: procs };
writeFileSync(join(__dirname, "results-proc.json"), JSON.stringify(out, null, 2), "utf8");

for (const s of steps) {
  console.log(`\n=== STEP ${s.no}: ${s.title} ===`);
  if (s.error) { console.log("ERROR: " + s.error); continue; }
  const r = s.result;
  console.log(r.columns.join(" | "));
  for (const row of r.rows) console.log(r.columns.map((c) => row[c]).join(" | "));
  if (s.result2) {
    console.log("--");
    console.log(s.result2.columns.join(" | "));
    for (const row of s.result2.rows) console.log(s.result2.columns.map((c) => row[c]).join(" | "));
  }
}
console.log("\n=== PROCEDURES ===");
for (const p of procs.rows) console.log(`${p.procedure_name}(${p.arguments}) [${p.language}]`);
await db.close();
console.log("\nDONE -> results-proc.json");
