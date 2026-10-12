-- =========================================================
-- UP DRIVE V2 — สคริปต์ทดสอบ STORED PROCEDURE
-- วิธีใช้: วางทั้งไฟล์ใน Supabase > SQL Editor แล้วกด Run
--         ผลจะออกเป็นตาราง (ดูข้อ 6 - 8 ของรายงานประกอบ)
-- =========================================================

-- ---------------------------------------------------------
-- 0) สร้างตาราง log และ procedure ให้พร้อม
--    (เนื้อหาเหมือนใน procedures.sql)
-- ---------------------------------------------------------
create table if not exists public.ride_group_events (
  id bigserial primary key,
  group_id uuid not null references public.ride_groups(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  event text not null,
  detail text,
  created_at timestamptz not null default now()
);

create or replace procedure public.sp_accept_ride_group(
  p_group_id uuid,
  p_driver_id uuid,
  inout p_message text default ''
)
language plpgsql as $$
declare
  v_status text; v_target integer; v_current integer;
begin
  select status, target_passengers into v_status, v_target
  from public.ride_groups where id = p_group_id for update;
  if not found then raise exception 'ไม่พบกลุ่ม %', p_group_id; end if;
  if v_status not in ('forming', 'sent_to_driver') then
    raise exception 'กลุ่มสถานะ % รับงานไม่ได้', v_status;
  end if;
  if not exists (select 1 from public.profiles where id = p_driver_id and role = 'driver') then
    raise exception 'ผู้ใช้ % ไม่ใช่คนขับ', p_driver_id;
  end if;
  v_current := public.group_passenger_total(p_group_id);
  update public.ride_groups set driver_id = p_driver_id, status = 'accepted'
   where id = p_group_id;
  insert into public.ride_group_events (group_id, actor_id, event, detail)
  values (p_group_id, p_driver_id, 'accepted',
          format('คนขับรับงาน: ผู้โดยสาร %s/%s คน', v_current, v_target));
  p_message := format('รับงานสำเร็จ: ผู้โดยสาร %s/%s คน', v_current, v_target);
end; $$;

create or replace procedure public.sp_cancel_ride_group(
  p_group_id uuid,
  p_actor_id uuid,
  p_reason   text,
  inout p_message text default ''
)
language plpgsql as $$
declare v_status text;
begin
  select status into v_status from public.ride_groups where id = p_group_id for update;
  if not found then raise exception 'ไม่พบกลุ่ม %', p_group_id; end if;
  if v_status in ('completed', 'cancelled') then
    raise exception 'กลุ่มสถานะ % ยกเลิกไม่ได้', v_status;
  end if;
  update public.ride_groups set status = 'cancelled', driver_id = null
   where id = p_group_id;
  insert into public.ride_group_events (group_id, actor_id, event, detail)
  values (p_group_id, p_actor_id, 'cancelled', p_reason);
  p_message := format('ยกเลิกกลุ่มสำเร็จ (%s)', p_reason);
end; $$;

create or replace procedure public.sp_expire_stale_groups(
  p_older_than interval,
  inout p_expired integer default 0
)
language plpgsql as $$
declare v_ids uuid[];
begin
  with stale as (
    update public.ride_groups set status = 'cancelled'
     where status = 'forming' and created_at < now() - p_older_than
    returning id
  )
  select array_agg(id) into v_ids from stale;
  if v_ids is null then p_expired := 0; return; end if;
  insert into public.ride_group_events (group_id, event, detail)
  select unnest(v_ids), 'expired', 'หมดเวลารวมคนอัตโนมัติ';
  p_expired := array_length(v_ids, 1);
end; $$;


-- ---------------------------------------------------------
-- 1) เตรียมข้อมูลทดสอบ (ใช้ profile ที่มีอยู่จริงในระบบ)
-- ---------------------------------------------------------
insert into public.ride_requests
  (id, passenger_id, origin_text, destination_text,
   origin_lat, origin_lng, destination_lat, destination_lng, target_passengers, status)
select '00000000-0000-0000-0000-0000000e0002', id, 'จุดรับทดสอบ', 'ปลายทางทดสอบ',
       19.0295, 99.8955, 19.0300, 99.8900, 4, 'matched'
from public.profiles where role = 'passenger' order by created_at limit 1
on conflict (id) do nothing;

insert into public.ride_groups (id, leader_id, target_passengers, status)
select '00000000-0000-0000-0000-0000000e0001', passenger_id, 4, 'forming'
from public.ride_requests where id = '00000000-0000-0000-0000-0000000e0002'
on conflict (id) do update set status = 'forming', driver_id = null;

insert into public.ride_group_members (group_id, ride_request_id, passenger_id, party_size)
select '00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-0000000e0002',
       passenger_id, 2
from public.ride_requests where id = '00000000-0000-0000-0000-0000000e0002'
on conflict (group_id, passenger_id) do update set party_size = 2;


-- ---------------------------------------------------------
-- 2) ตารางเก็บผลการทดสอบ แล้วเรียก procedure ทีละขั้น
-- ---------------------------------------------------------
create table if not exists public.sp_demo_log (
  step integer, action text, outcome text, at timestamptz default now()
);
delete from public.sp_demo_log;

do $$
declare
  v_group     uuid := '00000000-0000-0000-0000-0000000e0001';
  v_driver    uuid;
  v_passenger uuid;
  v_msg       text;
  v_n         integer;
begin
  select id into v_driver    from public.profiles where role = 'driver'    order by created_at limit 1;
  select id into v_passenger from public.profiles where role = 'passenger' order by created_at limit 1;

  -- 2.1 ผู้โดยสารพยายามรับงานแทนคนขับ (ต้องได้ ERROR)
  begin
    v_msg := '';
    call public.sp_accept_ride_group(v_group, v_passenger, v_msg);
    insert into public.sp_demo_log(step, action, outcome)
    values (1, 'sp_accept_ride_group (ผู้โดยสาร)', 'ไม่ควรเกิด: ' || v_msg);
  exception when others then
    insert into public.sp_demo_log(step, action, outcome)
    values (1, 'sp_accept_ride_group (ผู้โดยสาร)', 'ERROR: ' || sqlerrm);
  end;

  -- 2.2 คนขับรับงาน (สำเร็จ)
  v_msg := '';
  call public.sp_accept_ride_group(v_group, v_driver, v_msg);
  insert into public.sp_demo_log(step, action, outcome)
  values (2, 'sp_accept_ride_group (คนขับ)', v_msg);

  -- 2.3 รับงานซ้ำ (ต้องได้ ERROR)
  begin
    v_msg := '';
    call public.sp_accept_ride_group(v_group, v_driver, v_msg);
    insert into public.sp_demo_log(step, action, outcome)
    values (3, 'sp_accept_ride_group (ซ้ำ)', 'ไม่ควรเกิด: ' || v_msg);
  exception when others then
    insert into public.sp_demo_log(step, action, outcome)
    values (3, 'sp_accept_ride_group (ซ้ำ)', 'ERROR: ' || sqlerrm);
  end;

  -- 2.4 ยกเลิกกลุ่ม
  v_msg := '';
  call public.sp_cancel_ride_group(v_group, v_passenger, 'ทดสอบยกเลิก', v_msg);
  insert into public.sp_demo_log(step, action, outcome)
  values (4, 'sp_cancel_ride_group', v_msg);

  -- 2.5 งานประจำ: ทำให้กลุ่มทดสอบค้างเกินเวลา แล้วปิดอัตโนมัติ
  update public.ride_groups
     set status = 'forming', driver_id = null, created_at = now() - interval '5 hours'
   where id = v_group;
  v_n := 0;
  call public.sp_expire_stale_groups('1 hour', v_n);
  insert into public.sp_demo_log(step, action, outcome)
  values (5, 'sp_expire_stale_groups', 'ปิดกลุ่ม ' || v_n || ' กลุ่ม');
end $$;


-- ---------------------------------------------------------
-- 3) ดูผลการทดสอบ (แคปหน้าจอตารางนี้)
-- ---------------------------------------------------------
select step, action, outcome from public.sp_demo_log order by step;


-- ---------------------------------------------------------
-- 4) ดู event log ที่ procedure บันทึกไว้ให้อัตโนมัติ
-- ---------------------------------------------------------
select event, detail, created_at from public.ride_group_events order by id;


-- ---------------------------------------------------------
-- 5) รายการ Stored Procedure ทั้งหมด
-- ---------------------------------------------------------
select p.proname as procedure_name,
       pg_get_function_arguments(p.oid) as arguments,
       l.lanname as language
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname = 'public' and p.prokind = 'p'
order by p.proname;


-- ---------------------------------------------------------
-- 6) ทำความสะอาด (รันเมื่อเก็บภาพเสร็จ)
-- ---------------------------------------------------------
-- drop table if exists public.sp_demo_log;
-- delete from public.ride_group_events
--  where group_id = '00000000-0000-0000-0000-0000000e0001';
-- delete from public.ride_groups
--  where id = '00000000-0000-0000-0000-0000000e0001';
-- delete from public.ride_requests
--  where id = '00000000-0000-0000-0000-0000000e0002';
