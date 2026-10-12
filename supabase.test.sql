-- =========================================================
-- UP DRIVE V2
-- University of Phayao Carpooling
-- =========================================================

create extension if not exists pgcrypto;


-- =========================================================
-- PROFILES
-- =========================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,

  name text not null,

  phone text,

  role text not null
    check (role in ('passenger', 'driver')),

  vehicle_seats integer not null default 4
    check (vehicle_seats between 1 and 10),

  created_at timestamptz not null default now()
);

-- =========================================================
-- RIDE GROUPS
-- =========================================================

create table public.ride_groups (
  id uuid primary key default gen_random_uuid(),

  leader_id uuid not null
    references public.profiles(id),

  target_passengers integer not null
    check (target_passengers between 1 and 10),

  status text not null default 'forming'
    check (
      status in (
        'forming',
        'sent_to_driver',
        'accepted',
        'completed',
        'cancelled'
      )
    ),

  driver_id uuid
    references public.profiles(id),

  created_at timestamptz not null default now(),

  confirmed_at timestamptz,

  accepted_at timestamptz,

  completed_at timestamptz
);

-- =========================================================
-- RIDE REQUESTS
-- =========================================================

create table public.ride_requests (
  id uuid primary key default gen_random_uuid(),

  passenger_id uuid not null
    references public.profiles(id),

  group_id uuid
    references public.ride_groups(id)
    on delete set null,

  origin_text text not null,

  destination_text text not null,

  origin_detail text,

  destination_detail text,

  origin_lat double precision not null,

  origin_lng double precision not null,

  destination_lat double precision not null,

  destination_lng double precision not null,

  target_passengers integer not null
    check (target_passengers between 1 and 10),

  status text not null default 'searching'
    check (
      status in (
        'searching',
        'matched',
        'sent_to_driver',
        'accepted',
        'completed',
        'cancelled'
      )
    ),

  created_at timestamptz not null default now()
);

-- =========================================================
-- GROUP MEMBERS
-- =========================================================

create table public.ride_group_members (
  id uuid primary key default gen_random_uuid(),

  group_id uuid not null
    references public.ride_groups(id)
    on delete cascade,

  ride_request_id uuid not null
    references public.ride_requests(id)
    on delete cascade,

  passenger_id uuid not null
    references public.profiles(id)
    on delete cascade,

  party_size integer not null default 1
    check (party_size between 1 and 10),

  confirmed boolean not null default false,

  joined_at timestamptz not null default now(),

  unique(group_id, passenger_id),

  unique(group_id, ride_request_id)
);

-- =========================================================
-- ROUTES
-- =========================================================

create table public.ride_routes (
  id uuid primary key default gen_random_uuid(),

  group_id uuid not null
    references public.ride_groups(id)
    on delete cascade,

  distance_meters double precision,

  duration_seconds double precision,

  geometry jsonb,

  created_at timestamptz not null default now(),

  unique(group_id)
);

-- =========================================================
-- DRIVER GPS
-- =========================================================

create table public.driver_locations (
  id uuid primary key default gen_random_uuid(),

  driver_id uuid not null
    references public.profiles(id)
    on delete cascade,

  latitude double precision not null,

  longitude double precision not null,

  heading double precision,

  speed double precision,

  accuracy double precision,

  updated_at timestamptz not null default now(),

  unique(driver_id)
);

-- =========================================================
-- INDEXES
-- =========================================================

create index idx_ride_requests_passenger
on public.ride_requests(passenger_id);

create index idx_ride_requests_group
on public.ride_requests(group_id);

create index idx_ride_requests_status
on public.ride_requests(status);

create index idx_ride_groups_status
on public.ride_groups(status);

create index idx_ride_groups_driver
on public.ride_groups(driver_id);

create index idx_group_members_group
on public.ride_group_members(group_id);

create index idx_group_members_passenger
on public.ride_group_members(passenger_id);

create index idx_driver_locations_driver
on public.driver_locations(driver_id);

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.profiles enable row level security;

alter table public.ride_groups enable row level security;

alter table public.ride_requests enable row level security;

alter table public.ride_group_members enable row level security;

alter table public.ride_routes enable row level security;

alter table public.driver_locations enable row level security;

-- =========================================================
-- PROFILES
-- =========================================================

create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
);

-- =========================================================
-- RIDE GROUPS
-- =========================================================

create policy "groups_select_members_or_drivers"
on public.ride_groups
for select
to authenticated
using (
  auth.uid() = driver_id

  or status = 'sent_to_driver'

  or exists (
    select 1
    from public.ride_group_members m
    where m.group_id = id
      and m.passenger_id = auth.uid()
  )
);

-- =========================================================
-- RIDE REQUESTS
-- =========================================================

create policy "requests_select_owner_or_group_member"
on public.ride_requests
for select
to authenticated
using (
  passenger_id = auth.uid()

  or exists (
    select 1
    from public.ride_group_members m
    where m.ride_request_id = id
      and m.passenger_id = auth.uid()
  )

  or exists (
    select 1
    from public.ride_groups g
    where g.id = group_id
      and (
        g.status = 'sent_to_driver'
        or g.driver_id = auth.uid()
      )
  )
);

-- =========================================================
-- GROUP MEMBERS
-- =========================================================

create policy "members_select_group_users"
on public.ride_group_members
for select
to authenticated
using (
  passenger_id = auth.uid()

  or exists (
    select 1
    from public.ride_groups g
    where g.id = group_id
      and (
        g.status = 'sent_to_driver'
        or g.driver_id = auth.uid()
        or exists (
          select 1
          from public.ride_group_members m2
          where m2.group_id = g.id
            and m2.passenger_id = auth.uid()
        )
      )
  )
);

-- =========================================================
-- ROUTES
-- =========================================================

create policy "routes_select_group_users"
on public.ride_routes
for select
to authenticated
using (
  exists (
    select 1
    from public.ride_groups g
    where g.id = group_id
      and (
        g.status = 'sent_to_driver'
        or g.driver_id = auth.uid()
        or exists (
          select 1
          from public.ride_group_members m
          where m.group_id = g.id
            and m.passenger_id = auth.uid()
        )
      )
  )
);

-- =========================================================
-- DRIVER LOCATIONS
-- =========================================================

create policy "driver_locations_select_group_users"
on public.driver_locations
for select
to authenticated
using (
  driver_id = auth.uid()

  or exists (
    select 1
    from public.ride_groups g
    where g.driver_id = driver_locations.driver_id
      and (
        g.status = 'accepted'
        or g.status = 'completed'
      )
      and exists (
        select 1
        from public.ride_group_members m
        where m.group_id = g.id
          and m.passenger_id = auth.uid()
      )
  )
);

-- =========================================================
-- TRIGGERS
-- =========================================================

-- ตั้งเวลา confirmed_at / accepted_at / completed_at
-- อัตโนมัติเมื่อสถานะของกลุ่มเปลี่ยน
create or replace function public.sync_group_status_timestamps()
returns trigger
language plpgsql
as $$
begin
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

-- ห้ามตั้งสถานะ accepted ถ้ายังไม่มีคนขับ
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

-- อัปเดต updated_at ของตำแหน่งคนขับให้เป็นปัจจุบันเสมอ
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

-- =========================================================
-- SQL FUNCTIONS
-- =========================================================

-- คำนวณระยะทางระหว่างพิกัด 2 จุด (กิโลเมตร) ด้วยสูตร Haversine
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

-- นับจำนวนผู้โดยสารรวมของกลุ่ม (ผลรวม party_size ของสมาชิก)
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

-- หากลุ่มที่กำลังรวมคน (forming) ซึ่งอยู่ใกล้คำขอเดินทางใหม่
-- คืนผลเป็นตาราง พร้อมคะแนน (ยิ่งน้อย = ยิ่งใกล้)
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

-- =========================================================
-- STORED PROCEDURES
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

-- คนขับรับงาน : ตรวจเงื่อนไข -> มอบหมายคนขับ -> ตั้งสถานะ accepted -> บันทึก event
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

-- ยกเลิกกลุ่ม : ตั้งสถานะ cancelled -> คืนคนขับ -> บันทึก event
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

-- งานประจำ : ปิดกลุ่มที่รวมคนเกินเวลาที่กำหนด แล้วบันทึก event
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

-- =========================================================
-- REALTIME
-- =========================================================

alter publication supabase_realtime
add table public.ride_groups;

alter publication supabase_realtime
add table public.ride_group_members;

alter publication supabase_realtime
add table public.ride_routes;

alter publication supabase_realtime
add table public.driver_locations;

-- =========================================================
-- REPLICA IDENTITY
-- =========================================================

alter table public.ride_groups replica identity full;

alter table public.ride_group_members replica identity full;

alter table public.ride_routes replica identity full;

alter table public.driver_locations replica identity full;