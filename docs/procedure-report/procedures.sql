-- =========================================================
-- UP DRIVE V2 - STORED PROCEDURES
-- ระบบแชร์รถ มหาวิทยาลัยพะเยา (กลุ่ม UP Drive)
-- PostgreSQL (Supabase รองรับ CREATE PROCEDURE ตั้งแต่ PG11)
-- เรียกใช้ด้วยคําสั่ง CALL
-- =========================================================

-- ตารางบันทึกเหตุการณ์ของกลุ่ม ใช้เป็น audit log ของ procedure
create table if not exists public.ride_group_events (
  id bigserial primary key,
  group_id uuid not null references public.ride_groups(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  event text not null,
  detail text,
  created_at timestamptz not null default now()
);


-- ---------------------------------------------------------
-- PROCEDURE 1: sp_accept_ride_group
--   คนขับรับงาน : ตรวจเงื่อนไข -> มอบหมายคนขับ -> ตั้งสถานะ accepted
--   -> บันทึก event ทั้งหมดในคําสั่งเดียว
-- ---------------------------------------------------------
create or replace procedure public.sp_accept_ride_group(
  p_group_id uuid,
  p_driver_id uuid,
  inout p_message text default ''
)
language plpgsql
as $$
declare
  v_status  text;
  v_target  integer;
  v_current integer;
begin
  -- ล็อกแถวไว้กันการรับงานซ้อน
  select status, target_passengers
    into v_status, v_target
  from public.ride_groups
  where id = p_group_id
  for update;

  if not found then
    raise exception 'ไม่พบกลุ่ม %', p_group_id;
  end if;

  if v_status not in ('forming', 'sent_to_driver') then
    raise exception 'กลุ่มสถานะ % รับงานไม่ได้', v_status;
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_driver_id and role = 'driver'
  ) then
    raise exception 'ผู้ใช้ % ไม่ใช่คนขับ', p_driver_id;
  end if;

  v_current := public.group_passenger_total(p_group_id);

  update public.ride_groups
     set driver_id = p_driver_id,
         status    = 'accepted'
   where id = p_group_id;

  insert into public.ride_group_events (group_id, actor_id, event, detail)
  values (p_group_id, p_driver_id, 'accepted',
          format('คนขับรับงาน: ผู้โดยสาร %s/%s คน', v_current, v_target));

  p_message := format('รับงานสำเร็จ: ผู้โดยสาร %s/%s คน', v_current, v_target);
end;
$$;


-- ---------------------------------------------------------
-- PROCEDURE 2: sp_cancel_ride_group
--   ยกเลิกกลุ่ม : ตั้งสถานะ cancelled -> คืนคนขับ -> บันทึก event
-- ---------------------------------------------------------
create or replace procedure public.sp_cancel_ride_group(
  p_group_id uuid,
  p_actor_id uuid,
  p_reason   text,
  inout p_message text default ''
)
language plpgsql
as $$
declare
  v_status text;
begin
  select status
    into v_status
  from public.ride_groups
  where id = p_group_id
  for update;

  if not found then
    raise exception 'ไม่พบกลุ่ม %', p_group_id;
  end if;

  if v_status in ('completed', 'cancelled') then
    raise exception 'กลุ่มสถานะ % ยกเลิกไม่ได้', v_status;
  end if;

  update public.ride_groups
     set status    = 'cancelled',
         driver_id = null
   where id = p_group_id;

  insert into public.ride_group_events (group_id, actor_id, event, detail)
  values (p_group_id, p_actor_id, 'cancelled', p_reason);

  p_message := format('ยกเลิกกลุ่มสำเร็จ (%s)', p_reason);
end;
$$;


-- ---------------------------------------------------------
-- PROCEDURE 3: sp_expire_stale_groups
--   งานประจํา (maintenance) : ปิดกลุ่มที่รวมคนเกินเวลาที่กําหนด
--   แล้วบันทึก event ให้ทุกกลุ่มที่ถูกปิด
-- ---------------------------------------------------------
create or replace procedure public.sp_expire_stale_groups(
  p_older_than interval,
  inout p_expired integer default 0
)
language plpgsql
as $$
declare
  v_ids uuid[];
begin
  with stale as (
    update public.ride_groups
       set status = 'cancelled'
     where status = 'forming'
       and created_at < now() - p_older_than
    returning id
  )
  select array_agg(id) into v_ids from stale;

  if v_ids is null then
    p_expired := 0;
    return;
  end if;

  insert into public.ride_group_events (group_id, event, detail)
  select unnest(v_ids), 'expired', 'หมดเวลารวมคนอัตโนมัติ';

  p_expired := array_length(v_ids, 1);
end;
$$;
