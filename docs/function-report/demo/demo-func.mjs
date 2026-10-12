import { PGlite } from "@electric-sql/pglite";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = await PGlite.create();

const schema = `
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
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
  origin_text text not null,
  destination_text text not null,
  origin_lat double precision not null,
  origin_lng double precision not null,
  destination_lat double precision not null,
  destination_lng double precision not null,
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
  unique(group_id, passenger_id),
  unique(group_id, ride_request_id)
);
`;

const funcSql = readFileSync(join(__dirname, "functions.sql"), "utf8");
await db.exec(schema);
await db.exec(funcSql);

const steps = [];
const push = (o) => steps.push(o);
const q = async (sql) => {
  const r = await db.query(sql);
  return { columns: r.fields.map((f) => f.name), rows: r.rows };
};

// ---------- seed ----------
await db.exec(`
insert into public.profiles (id, name, role, vehicle_seats) values
 ('11111111-1111-1111-1111-000000000001','สมชาย (หัวหน้ากลุ่ม A)','passenger',4),
 ('11111111-1111-1111-1111-000000000002','สมหญิง (สมาชิก A)','passenger',4),
 ('11111111-1111-1111-1111-000000000003','มานะ (หัวหน้ากลุ่ม C)','passenger',4),
 ('11111111-1111-1111-1111-000000000004','ปิติ (หัวหน้ากลุ่ม B)','passenger',4),
 ('11111111-1111-1111-1111-0000000000d1','วิชัย (คนขับ)','driver',4);

insert into public.ride_groups (id, leader_id, target_passengers, status) values
 ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-000000000001',4,'forming'),
 ('cccccccc-0000-0000-0000-000000000001','11111111-1111-1111-1111-000000000003',3,'forming'),
 ('bbbbbbbb-0000-0000-0000-000000000001','11111111-1111-1111-1111-000000000004',2,'forming');

insert into public.ride_requests
 (id, passenger_id, group_id, origin_text, destination_text,
  origin_lat, origin_lng, destination_lat, destination_lng, target_passengers, status)
values
 ('aaaa1111-0000-0000-0000-000000000001','11111111-1111-1111-1111-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
  'หน้ามหาวิทยาลัยพะเยา','ตลาดพะเยา', 19.0302, 99.8962, 19.0305, 99.8895, 4, 'matched'),
 ('cccc1111-0000-0000-0000-000000000001','11111111-1111-1111-1111-000000000003','cccccccc-0000-0000-0000-000000000001',
  'ประตู 2 ม.พะเยา','บิ๊กซีพะเยา', 19.0320, 99.8980, 19.0330, 99.8920, 3, 'matched'),
 ('bbbb1111-0000-0000-0000-000000000001','11111111-1111-1111-1111-000000000004','bbbbbbbb-0000-0000-0000-000000000001',
  'อำเภอแม่ใจ','ตัวเมืองพะเยา', 19.0600, 99.9300, 19.0700, 99.9400, 2, 'matched');

insert into public.ride_group_members (group_id, ride_request_id, passenger_id, party_size) values
 ('aaaaaaaa-0000-0000-0000-000000000001','aaaa1111-0000-0000-0000-000000000001','11111111-1111-1111-1111-000000000001',3),
 ('cccccccc-0000-0000-0000-000000000001','cccc1111-0000-0000-0000-000000000001','11111111-1111-1111-1111-000000000003',1),
 ('bbbbbbbb-0000-0000-0000-000000000001','bbbb1111-0000-0000-0000-000000000001','11111111-1111-1111-1111-000000000004',1);
`);

// ---------- context ----------
push({
  no: 1,
  title: "ข้อมูลตั้งต้น — กลุ่มที่กำลังรวมคน (status = forming)",
  sql: `select g.id, p.name as leader, g.target_passengers as target,
       public.group_passenger_total(g.id) as current, r.origin_text, r.destination_text
from public.ride_groups g
join public.profiles p on p.id = g.leader_id
join public.ride_requests r on r.group_id = g.id
where g.status = 'forming'
order by g.id;`,
  result: await q(`select
       left(g.id::text, 8) as group_id, p.name as leader, g.target_passengers as target,
       public.group_passenger_total(g.id) as current, r.origin_text, r.destination_text
     from public.ride_groups g
     join public.profiles p on p.id = g.leader_id
     join public.ride_requests r on r.group_id = g.id
     where g.status = 'forming'
     order by g.id;`),
});

// ---------- call 1: haversine_km ----------
push({
  no: 2,
  title: "เรียก FUNCTION 1: haversine_km() — วัดระยะทางจากจุดรับใหม่ไปยังแต่ละกลุ่ม",
  sql: `select * from (values
  ('จุดรับใหม่ -> กลุ่ม A', public.haversine_km(19.0295, 99.8955, 19.0302, 99.8962)),
  ('จุดรับใหม่ -> กลุ่ม C', public.haversine_km(19.0295, 99.8955, 19.0320, 99.8980)),
  ('จุดรับใหม่ -> กลุ่ม B', public.haversine_km(19.0295, 99.8955, 19.0600, 99.9300))
) as t(คู่พิกัด, ระยะทาง_km);`,
  result: await q(`select * from (values
    ('จุดรับใหม่ -> กลุ่ม A', public.haversine_km(19.0295, 99.8955, 19.0302, 99.8962)),
    ('จุดรับใหม่ -> กลุ่ม C', public.haversine_km(19.0295, 99.8955, 19.0320, 99.8980)),
    ('จุดรับใหม่ -> กลุ่ม B', public.haversine_km(19.0295, 99.8955, 19.0600, 99.9300))
  ) as t(pair, distance_km);`),
});

// ---------- call 2: group_passenger_total ----------
push({
  no: 3,
  title: "เรียก FUNCTION 2: group_passenger_total() — นับผู้โดยสารในแต่ละกลุ่ม",
  sql: `select
  public.group_passenger_total('aaaaaaaa-0000-0000-0000-000000000001') as group_a,
  public.group_passenger_total('cccccccc-0000-0000-0000-000000000001') as group_c,
  public.group_passenger_total('bbbbbbbb-0000-0000-0000-000000000001') as group_b,
  public.group_passenger_total('00000000-0000-0000-0000-000000000000') as group_ว่าง;`,
  result: await q(`select
    public.group_passenger_total('aaaaaaaa-0000-0000-0000-000000000001') as group_a,
    public.group_passenger_total('cccccccc-0000-0000-0000-000000000001') as group_c,
    public.group_passenger_total('bbbbbbbb-0000-0000-0000-000000000001') as group_b,
    public.group_passenger_total('00000000-0000-0000-0000-000000000000') as empty_group;`),
});

// ---------- call 3: find_candidate_groups ----------
const candidatesSql = `select * from public.find_candidate_groups(
  19.0295, 99.8955,   -- จุดรับของผู้โดยสารใหม่
  19.0300, 99.8900,   -- ปลายทางของผู้โดยสารใหม่
  4, 6                -- รัศมี จุดรับ 4 km / ปลายทาง 6 km
);`;
push({
  no: 4,
  title: "เรียก FUNCTION 3: find_candidate_groups() — คืนผลเป็นตารางกลุ่มที่ใกล้ที่สุด",
  sql: candidatesSql,
  result: await q(`select
      left(group_id::text, 8) as group_id,
      target_passengers as target,
      current_passengers as current,
      pickup_km, destination_km, score
    from public.find_candidate_groups(19.0295, 99.8955, 19.0300, 99.8900, 4, 6);`),
  note: "กลุ่ม B ถูกตัดออก เพราะจุดรับไกลเกิน 4 km / กลุ่มที่เหลือเรียงตาม score (น้อย = ใกล้กว่า)",
});

// ---------- call 4: tighter radius ----------
push({
  no: 5,
  title: "ปรับพารามิเตอร์รัศมีให้แคบลง (จุดรับ <= 0.3 km) — ผลลัพธ์เปลี่ยนตาม parameter",
  sql: `select group_id, pickup_km, score
from public.find_candidate_groups(19.0295, 99.8955, 19.0300, 99.8900, 0.3, 6);`,
  result: await q(`select left(group_id::text,8) as group_id, pickup_km, score
    from public.find_candidate_groups(19.0295, 99.8955, 19.0300, 99.8900, 0.3, 6);`),
  note: "เหลือเฉพาะกลุ่ม A เพราะกลุ่ม C อยู่ไกลเกิน 0.3 km",
});

// ---------- list functions ----------
const funcs = await q(`
  select p.proname as function_name,
         pg_get_function_arguments(p.oid) as arguments,
         pg_get_function_result(p.oid) as returns,
         l.lanname as language
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  where n.nspname = 'public'
  order by p.proname;
`);

const out = { db: "PostgreSQL 16 (PGlite / WASM)", steps, functions: funcs };
writeFileSync(join(__dirname, "results-func.json"), JSON.stringify(out, null, 2), "utf8");

for (const s of steps) {
  console.log(`\n=== STEP ${s.no}: ${s.title} ===`);
  const r = s.result;
  console.log(r.columns.join(" | "));
  for (const row of r.rows) console.log(r.columns.map((c) => row[c]).join(" | "));
}
console.log("\n=== FUNCTIONS ===");
for (const f of funcs.rows) console.log(`${f.function_name}(${f.arguments}) -> ${f.returns} [${f.language}]`);
await db.close();
console.log("\nDONE -> results-func.json");
