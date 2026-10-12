-- =========================================================
-- UP DRIVE V2 — สคริปต์ทดสอบ SQL FUNCTION
-- วิธีใช้: วางทั้งไฟล์ใน Supabase > SQL Editor แล้วกด Run
--         ผลจะออกเป็นตาราง (ดูข้อ 5-7 ของรายงานประกอบ)
-- =========================================================

-- ---------------------------------------------------------
-- 0) สร้าง Function ให้พร้อม (เนื้อหาเหมือนใน functions.sql)
-- ---------------------------------------------------------
create or replace function public.haversine_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns double precision
language sql immutable
as $$
  select round((
    6371 * 2 * asin(
      sqrt(
        power(sin(radians(lat2 - lat1) / 2), 2) +
        cos(radians(lat1)) * cos(radians(lat2)) *
        power(sin(radians(lng2 - lng1) / 2), 2)
      )
    )
  )::numeric, 3)::double precision;
$$;

create or replace function public.group_passenger_total(p_group_id uuid)
returns integer
language sql stable
as $$
  select coalesce(sum(m.party_size), 0)::integer
  from public.ride_group_members m
  where m.group_id = p_group_id;
$$;

create or replace function public.find_candidate_groups(
  p_origin_lat double precision,
  p_origin_lng double precision,
  p_dest_lat double precision,
  p_dest_lng double precision,
  p_max_pickup_km double precision default 4,
  p_max_dest_km double precision default 6
)
returns table (
  group_id uuid,
  leader_id uuid,
  target_passengers integer,
  current_passengers integer,
  pickup_km double precision,
  destination_km double precision,
  score double precision
)
language sql stable
as $$
  select
    g.id,
    g.leader_id,
    g.target_passengers,
    public.group_passenger_total(g.id),
    public.haversine_km(p_origin_lat, p_origin_lng, r.origin_lat, r.origin_lng),
    public.haversine_km(p_dest_lat, p_dest_lng, r.destination_lat, r.destination_lng),
    public.haversine_km(p_origin_lat, p_origin_lng, r.origin_lat, r.origin_lng)
      + public.haversine_km(p_dest_lat, p_dest_lng, r.destination_lat, r.destination_lng)
  from public.ride_groups g
  join public.ride_requests r on r.group_id = g.id
  where g.status = 'forming'
    and public.haversine_km(p_origin_lat, p_origin_lng, r.origin_lat, r.origin_lng)
        <= p_max_pickup_km
    and public.haversine_km(p_dest_lat, p_dest_lng, r.destination_lat, r.destination_lng)
        <= p_max_dest_km
  order by 7 asc;
$$;


-- ---------------------------------------------------------
-- 1) ทดสอบ haversine_km()  — วัดระยะทางจากจุดรับใหม่ไปแต่ละกลุ่ม
-- ---------------------------------------------------------
select * from (values
  ('จุดรับใหม่ -> กลุ่ม A', public.haversine_km(19.0295, 99.8955, 19.0302, 99.8962)),
  ('จุดรับใหม่ -> กลุ่ม C', public.haversine_km(19.0295, 99.8955, 19.0320, 99.8980)),
  ('จุดรับใหม่ -> กลุ่ม B', public.haversine_km(19.0295, 99.8955, 19.0600, 99.9300))
) as t(pair, distance_km);


-- ---------------------------------------------------------
-- 2) ทดสอบ group_passenger_total() — นับผู้โดยสารรวมของกลุ่ม
--    (ส่ง group id ของกลุ่มที่ต้องการ ถ้าไม่พบจะได้ 0)
-- ---------------------------------------------------------
select
  public.group_passenger_total(id) as passengers,
  id as group_id,
  status
from public.ride_groups
where status = 'forming'
order by id;


-- ---------------------------------------------------------
-- 3) ทดสอบ find_candidate_groups() — หากลุ่มใกล้คำขอใหม่
--    เปลี่ยนตัวเลข 4 ตัวแรกได้ตามพิกัดทดสอบ
-- ---------------------------------------------------------
select
  left(group_id::text, 8) as group_id,
  target_passengers,
  current_passengers,
  pickup_km,
  destination_km,
  score
from public.find_candidate_groups(
  19.0295, 99.8955,   -- จุดรับของผู้โดยสารใหม่
  19.0300, 99.8900,   -- ปลายทางของผู้โดยสารใหม่
  4, 6                -- รัศมี จุดรับ 4 km / ปลายทาง 6 km
);


-- ---------------------------------------------------------
-- 4) ทดสอบปรับ parameter รัศมีให้แคบลง
-- ---------------------------------------------------------
select left(group_id::text, 8) as group_id, pickup_km, score
from public.find_candidate_groups(19.0295, 99.8955, 19.0300, 99.8900, 0.3, 6);


-- ---------------------------------------------------------
-- 5) ตรวจรายการ SQL Function ทั้งหมดในฐานข้อมูล
-- ---------------------------------------------------------
select p.proname as function_name,
       pg_get_function_arguments(p.oid) as arguments,
       pg_get_function_result(p.oid) as returns,
       l.lanname as language
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
order by p.proname;
