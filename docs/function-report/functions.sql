-- =========================================================
-- UP DRIVE V2 - SQL FUNCTIONS
-- ระบบแชร์รถ มหาวิทยาลัยพะเยา (กลุ่ม UP Drive)
-- รันบน PostgreSQL / Supabase
-- =========================================================

-- ---------------------------------------------------------
-- FUNCTION 1: haversine_km  (scalar function, ภาษา SQL)
--   คำนวณระยะทางระหว่างพิกัด 2 จุด หน่วยเป็นกิโลเมตร
--   ใช้สูตร Haversine เหมือนที่ฝั่งแอปเคยคำนวณเอง
-- ---------------------------------------------------------
create or replace function public.haversine_km(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
returns double precision
language sql
immutable
as $$
  select round(
    (
      6371 * 2 * asin(
        sqrt(
          power(sin(radians(lat2 - lat1) / 2), 2) +
          cos(radians(lat1)) * cos(radians(lat2)) *
          power(sin(radians(lng2 - lng1) / 2), 2)
        )
      )
    )::numeric,
    3
  )::double precision;
$$;


-- ---------------------------------------------------------
-- FUNCTION 2: group_passenger_total  (scalar function, ภาษา SQL)
--   นับจำนวนผู้โดยสารรวมของกลุ่ม (ผลรวม party_size ของสมาชิก)
--   ถ้ากลุ่มยังไม่มีสมาชิก จะคืนค่า 0
-- ---------------------------------------------------------
create or replace function public.group_passenger_total(
  p_group_id uuid
)
returns integer
language sql
stable
as $$
  select coalesce(sum(m.party_size), 0)::integer
  from public.ride_group_members m
  where m.group_id = p_group_id;
$$;


-- ---------------------------------------------------------
-- FUNCTION 3: find_candidate_groups  (table function, ภาษา SQL)
--   หา "กลุ่มที่กำลังรวมคน (forming)" ที่อยู่ใกล้คำขอเดินทางใหม่
--   แล้วคืนผลเป็นตาราง พร้อมคะแนน (ยิ่งน้อย = ยิ่งใกล้)
--   เกณฑ์เริ่มต้น: จุดรับ <= 4 km และปลายทาง <= 6 km
-- ---------------------------------------------------------
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
language sql
stable
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
