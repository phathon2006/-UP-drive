import { PGlite } from "@electric-sql/pglite";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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
  confirmed_at timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz
);

create table public.driver_locations (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  heading double precision,
  speed double precision,
  accuracy double precision,
  updated_at timestamptz not null default now(),
  unique(driver_id)
);
`;

const triggerSql = readFileSync(join(__dirname, "trigger.sql"), "utf8");

await db.exec(schema);
await db.exec(triggerSql);

const steps = [];
const push = (o) => steps.push(o);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function q(sql) {
  const r = await db.query(sql);
  return { columns: r.fields.map((f) => f.name), rows: r.rows };
}

// seed
await db.exec(`
insert into public.profiles (id, name, phone, role, vehicle_seats) values
 ('11111111-1111-1111-1111-111111111111','สมชาย ผู้โดยสาร','0811111111','passenger',4),
 ('22222222-2222-2222-2222-222222222222','สมหญิง ผู้โดยสาร','0822222222','passenger',4),
 ('33333333-3333-3333-3333-333333333333','วิชัย คนขับ','0833333333','driver',4);
`);

const GROUP = "aaaaaaaa-1111-1111-1111-111111111111";

// STEP 1 - create group as leader
await db.exec(`
insert into public.ride_groups (id, leader_id, target_passengers, status)
values ('${GROUP}','11111111-1111-1111-1111-111111111111', 4, 'forming');
`);
push({
  no: 1,
  title: "สร้างกลุ่มใหม่ (status = forming)",
  sql: `insert into public.ride_groups (id, leader_id, target_passengers, status)\nvalues ('${GROUP}', '<leader>', 4, 'forming');`,
  result: await q(`select status, driver_id, confirmed_at, accepted_at, completed_at
                   from public.ride_groups where id = '${GROUP}';`),
});

// STEP 2 - forming -> sent_to_driver
await sleep(1200);
await db.exec(`
update public.ride_groups set status = 'sent_to_driver' where id = '${GROUP}';
`);
push({
  no: 2,
  title: "เปลี่ยนสถานะเป็น sent_to_driver (สมาชิกยืนยันครบ)",
  sql: `update public.ride_groups\nset status = 'sent_to_driver'\nwhere id = '${GROUP}';`,
  result: await q(`select status, confirmed_at, accepted_at, completed_at
                   from public.ride_groups where id = '${GROUP}';`),
});

// STEP 3 - assign driver + accept
await sleep(1200);
await db.exec(`
update public.ride_groups
set driver_id = '33333333-3333-3333-3333-333333333333',
    status = 'accepted'
where id = '${GROUP}';
`);
push({
  no: 3,
  title: "คนขับรับงาน -> assigned driver + status = accepted",
  sql: `update public.ride_groups\nset driver_id = '<driver>', status = 'accepted'\nwhere id = '${GROUP}';`,
  result: await q(`select status, driver_id, confirmed_at, accepted_at, completed_at
                   from public.ride_groups where id = '${GROUP}';`),
});

// STEP 4 - completed
await sleep(1200);
await db.exec(`
update public.ride_groups set status = 'completed' where id = '${GROUP}';
`);
push({
  no: 4,
  title: "เดินทางเสร็จ -> status = completed",
  sql: `update public.ride_groups\nset status = 'completed'\nwhere id = '${GROUP}';`,
  result: await q(`select status, confirmed_at, accepted_at, completed_at
                   from public.ride_groups where id = '${GROUP}';`),
});

// STEP 5 - idempotent: update unrelated column, timestamps unchanged
const before5 = await q(`select confirmed_at, accepted_at, completed_at
                         from public.ride_groups where id = '${GROUP}';`);
await db.exec(`update public.ride_groups set target_passengers = 3 where id = '${GROUP}';`);
const after5 = await q(`select confirmed_at, accepted_at, completed_at
                        from public.ride_groups where id = '${GROUP}';`);
push({
  no: 5,
  title: "แก้ไขฟิลด์อื่น (target_passengers) ไม่เปลี่ยนสถานะ => เวลาเดิมไม่ถูกเขียนทับ",
  sql: `update public.ride_groups set target_passengers = 3 where id = '${GROUP}';`,
  result: after5,
  unchanged: JSON.stringify(before5.rows[0]) === JSON.stringify(after5.rows[0]),
});

// STEP 6 - enforcement trigger
const GROUP2 = "bbbbbbbb-2222-2222-2222-222222222222";
await db.exec(`insert into public.ride_groups (id, leader_id, target_passengers, status)
               values ('${GROUP2}','22222222-2222-2222-2222-222222222222', 2, 'forming');`);
let enforceError = null;
try {
  await db.exec(`update public.ride_groups set status = 'accepted' where id = '${GROUP2}';`);
} catch (e) {
  enforceError = e.message;
}
push({
  no: 6,
  title: "พยายามตั้ง accepted โดยไม่มีคนขับ => ถูก trigger บล็อก",
  sql: `update public.ride_groups\nset status = 'accepted'\nwhere id = '${GROUP2}';`,
  error: enforceError,
  result: await q(`select status, driver_id from public.ride_groups where id = '${GROUP2}';`),
});

// STEP 7 - driver_locations touch
await db.exec(`
insert into public.driver_locations (driver_id, latitude, longitude, updated_at)
values ('33333333-3333-3333-3333-333333333333', 16.0, 100.0, now() - interval '1 hour');
`);
const before7 = await q(`select latitude, longitude, updated_at from public.driver_locations
                         where driver_id = '33333333-3333-3333-3333-333333333333';`);
await db.exec(`update public.driver_locations
               set latitude = 19.0288, longitude = 99.8950
               where driver_id = '33333333-3333-3333-3333-333333333333';`);
const after7 = await q(`select latitude, longitude, updated_at from public.driver_locations
                        where driver_id = '33333333-3333-3333-3333-333333333333';`);
push({
  no: 7,
  title: "อัปเดตตำแหน่งคนขับ => updated_at อัปเดตให้อัตโนมัติ",
  sql: `update public.driver_locations\nset latitude = 19.0288, longitude = 99.8950\nwhere driver_id = '<driver>';`,
  before: before7,
  result: after7,
});

// list triggers
const triggers = await q(`
  select event_object_table as table_name,
         trigger_name,
         action_timing,
         event_manipulation
  from information_schema.triggers
  where trigger_schema = 'public'
  order by event_object_table, trigger_name, event_manipulation;
`);

const out = { db: "PostgreSQL 16 (PGlite / WASM)", steps, triggers };
writeFileSync(join(__dirname, "results.json"), JSON.stringify(out, null, 2), "utf8");

// console preview
for (const s of steps) {
  console.log("\n=== STEP " + s.no + ": " + s.title + " ===");
  console.log(s.sql);
  if (s.error) console.log("ERROR: " + s.error);
  const r = s.result || s.before;
  if (r) {
    console.log(r.columns.join(" | "));
    for (const row of r.rows) console.log(r.columns.map((c) => row[c]).join(" | "));
  }
  if (s.unchanged !== undefined) console.log("timestamps unchanged: " + s.unchanged);
}
console.log("\n=== TRIGGERS ===");
for (const t of triggers.rows) console.log(`${t.table_name}.${t.trigger_name} [${t.action_timing} ${t.event_manipulation}]`);

await db.close();
console.log("\nDONE -> results.json");
