-- =========================================================
-- UP DRIVE V2 — สคริปต์ทดสอบ TRIGGER
-- วิธีใช้: วางทั้งไฟล์ใน Supabase > SQL Editor แล้วกด Run
--         ผลจะออกเป็นตาราง (ดูข้อ 4 ของรายงานประกอบ)
-- =========================================================

-- ---------------------------------------------------------
-- 0) สร้าง Trigger ให้พร้อม (ถ้ายังไม่มี)
--    เนื้อหาเหมือนใน supabase.sql หัวข้อ TRIGGERS
-- ---------------------------------------------------------
create or replace function public.sync_group_status_timestamps()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'sent_to_driver' and new.confirmed_at is null then
      new.confirmed_at := now();
    end if;
    if new.status = 'accepted' and new.accepted_at is null then
      new.accepted_at := now();
    end if;
    if new.status = 'completed' and new.completed_at is null then
      new.completed_at := now();
    end if;
  end if;
  return new;
end; $$;

create or replace function public.enforce_group_driver_rules()
returns trigger language plpgsql as $$
begin
  if new.status = 'accepted' and new.driver_id is null then
    raise exception
      'ride_groups: ตั้งสถานะ accepted ไม่ได้ถ้าไม่มีคนขับ (driver_id)';
  end if;
  return new;
end; $$;

create or replace function public.touch_driver_location()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists trg_ride_groups_status_timestamps on public.ride_groups;
create trigger trg_ride_groups_status_timestamps
before update on public.ride_groups
for each row execute function public.sync_group_status_timestamps();

drop trigger if exists trg_ride_groups_driver_rules on public.ride_groups;
create trigger trg_ride_groups_driver_rules
before update on public.ride_groups
for each row execute function public.enforce_group_driver_rules();

drop trigger if exists trg_driver_locations_touch on public.driver_locations;
create trigger trg_driver_locations_touch
before update on public.driver_locations
for each row execute function public.touch_driver_location();


-- ---------------------------------------------------------
-- 1) เตรียมข้อมูลทดสอบ (ใช้ profile ที่มีอยู่จริงในระบบ)
--    ใช้ id คงที่ เพื่อให้ SELECT ต่อได้ง่าย
-- ---------------------------------------------------------
insert into public.ride_groups (id, leader_id, target_passengers, status)
select '00000000-0000-0000-0000-0000000d0001',
       id, 2, 'forming'
from public.profiles
where role = 'passenger'
order by created_at
limit 1
on conflict (id) do update set status = 'forming',
  confirmed_at = null, accepted_at = null, completed_at = null;

-- ดูค่าก่อนเปลี่ยนสถานะ (ทุก *_at ควรเป็น NULL)
select status, driver_id, confirmed_at, accepted_at, completed_at
from public.ride_groups
where id = '00000000-0000-0000-0000-0000000d0001';


-- ---------------------------------------------------------
-- 2) เปลี่ยนสถานะ -> sent_to_driver (Trigger เติม confirmed_at)
-- ---------------------------------------------------------
update public.ride_groups
set status = 'sent_to_driver'
where id = '00000000-0000-0000-0000-0000000d0001';

select status, confirmed_at, accepted_at, completed_at
from public.ride_groups
where id = '00000000-0000-0000-0000-0000000d0001';


-- ---------------------------------------------------------
-- 3) ให้คนขับรับงาน -> accepted (Trigger เติม accepted_at)
-- ---------------------------------------------------------
update public.ride_groups
set driver_id = (select id from public.profiles
                 where role = 'driver' order by created_at limit 1),
    status = 'accepted'
where id = '00000000-0000-0000-0000-0000000d0001';

select status, driver_id, confirmed_at, accepted_at, completed_at
from public.ride_groups
where id = '00000000-0000-0000-0000-0000000d0001';


-- ---------------------------------------------------------
-- 4) เดินทางเสร็จ -> completed (Trigger เติม completed_at)
-- ---------------------------------------------------------
update public.ride_groups
set status = 'completed'
where id = '00000000-0000-0000-0000-0000000d0001';

select status, confirmed_at, accepted_at, completed_at
from public.ride_groups
where id = '00000000-0000-0000-0000-0000000d0001';


-- ---------------------------------------------------------
-- 5) ทดสอบ Trigger บังคับกติกา
--    ตั้ง accepted ทั้งที่ยังไม่มีคนขับ -> ต้องได้ ERROR
-- ---------------------------------------------------------
update public.ride_groups
set driver_id = null,
    status = 'forming',
    confirmed_at = null, accepted_at = null, completed_at = null
where id = '00000000-0000-0000-0000-0000000d0001';

update public.ride_groups
set status = 'accepted'
where id = '00000000-0000-0000-0000-0000000d0001';
-- ผลที่คาดหวัง: ERROR: ride_groups: ตั้งสถานะ accepted ไม่ได้ถ้าไม่มีคนขับ (driver_id)


-- ---------------------------------------------------------
-- 6) ตรวจรายการ Trigger ทั้งหมด
-- ---------------------------------------------------------
select event_object_table as table_name,
       trigger_name,
       action_timing,
       event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table, trigger_name;


-- ---------------------------------------------------------
-- 7) ลบข้อมูลทดสอบ (รันเมื่อเก็บภาพเสร็จแล้ว)
-- ---------------------------------------------------------
-- delete from public.ride_groups
-- where id = '00000000-0000-0000-0000-0000000d0001';
