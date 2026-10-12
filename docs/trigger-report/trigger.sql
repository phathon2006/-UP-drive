-- =========================================================
-- UP DRIVE V2 - DATABASE TRIGGERS
-- ระบบแชร์รถ มหาวิทยาลัยพะเยา (กลุ่ม UP Drive)
-- รันบน PostgreSQL / Supabase
-- =========================================================

-- ---------------------------------------------------------
-- TRIGGER 1: ตั้งเวลาอัตโนมัติเมื่อสถานะของกลุ่มเปลี่ยน
--   forming -> sent_to_driver  => confirmed_at = now()
--   -> accepted                => accepted_at  = now()
--   -> completed               => completed_at = now()
-- ---------------------------------------------------------
create or replace function public.sync_group_status_timestamps()
returns trigger
language plpgsql
as $$
begin
  -- ทำงานเฉพาะตอน "สถานะเปลี่ยนจริง" (idempotent)
  if new.status is distinct from old.status then

    if new.status = 'sent_to_driver'
       and new.confirmed_at is null then
      new.confirmed_at := now();
    end if;

    if new.status = 'accepted'
       and new.accepted_at is null then
      new.accepted_at := now();
    end if;

    if new.status = 'completed'
       and new.completed_at is null then
      new.completed_at := now();
    end if;

  end if;

  return new;
end;
$$;

drop trigger if exists trg_ride_groups_status_timestamps
on public.ride_groups;

create trigger trg_ride_groups_status_timestamps
before update on public.ride_groups
for each row
execute function public.sync_group_status_timestamps();


-- ---------------------------------------------------------
-- TRIGGER 2: บังคับกติกาความถูกต้องของข้อมูล
--   ห้ามตั้งสถานะ accepted ถ้ายังไม่มีคนขับ (driver_id is null)
-- ---------------------------------------------------------
create or replace function public.enforce_group_driver_rules()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'accepted' and new.driver_id is null then
    raise exception
      'ride_groups: ตั้งสถานะ accepted ไม่ได้ถ้าไม่มีคนขับ (driver_id)';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ride_groups_driver_rules
on public.ride_groups;

create trigger trg_ride_groups_driver_rules
before update on public.ride_groups
for each row
execute function public.enforce_group_driver_rules();


-- ---------------------------------------------------------
-- TRIGGER 3: อัปเดต updated_at ของตำแหน่งคนขับให้เป็นปัจจุบันเสมอ
-- ---------------------------------------------------------
create or replace function public.touch_driver_location()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_driver_locations_touch
on public.driver_locations;

create trigger trg_driver_locations_touch
before update on public.driver_locations
for each row
execute function public.touch_driver_location();
