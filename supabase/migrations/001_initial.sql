-- ============================================================
-- SplitBoard — Supabase Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. PROFILES (synced from auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz default now() not null
);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email      = excluded.email,
    full_name  = excluded.full_name,
    avatar_url = excluded.avatar_url;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. BOARDS
create table if not exists public.boards (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  invite_code  text not null unique,
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz default now() not null
);

-- 3. BOARD MEMBERS
create table if not exists public.board_members (
  id        uuid primary key default gen_random_uuid(),
  board_id  uuid not null references public.boards(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz default now() not null,
  unique(board_id, user_id)
);

-- 4. COSTS
create table if not exists public.costs (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references public.boards(id) on delete cascade,
  title       text not null,
  amount      numeric(12,2) not null check (amount > 0),
  paid_by     uuid not null references public.profiles(id),
  created_by  uuid not null references public.profiles(id),
  note        text,
  created_at  timestamptz default now() not null
);

-- 5. COST SPLITS
create table if not exists public.cost_splits (
  id          uuid primary key default gen_random_uuid(),
  cost_id     uuid not null references public.costs(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  share       numeric(12,2) not null check (share > 0),
  settled     boolean default false not null,
  settled_at  timestamptz,
  unique(cost_id, user_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles      enable row level security;
alter table public.boards        enable row level security;
alter table public.board_members enable row level security;
alter table public.costs         enable row level security;
alter table public.cost_splits   enable row level security;

-- Profiles: visible to members of the same board
create policy "Profiles are readable by board-mates"
  on public.profiles for select
  using (
    id = auth.uid() or
    id in (
      select user_id from public.board_members bm
      where bm.board_id in (
        select board_id from public.board_members where user_id = auth.uid()
      )
    )
  );

create policy "Users can update own profile"
  on public.profiles for update using (id = auth.uid());

-- Boards: visible to members
create policy "Board visible to members"
  on public.boards for select
  using (
    id in (select board_id from public.board_members where user_id = auth.uid())
  );

create policy "Authenticated users can create boards"
  on public.boards for insert
  with check (owner_id = auth.uid());

create policy "Owner can update board"
  on public.boards for update
  using (owner_id = auth.uid());

-- Board members: members can read, anyone auth'd can insert (join via invite)
create policy "Members can read board_members"
  on public.board_members for select
  using (
    board_id in (select board_id from public.board_members where user_id = auth.uid())
  );

create policy "Authenticated users can join boards"
  on public.board_members for insert
  with check (user_id = auth.uid());

-- Costs: board members can CRUD
create policy "Board members can read costs"
  on public.costs for select
  using (
    board_id in (select board_id from public.board_members where user_id = auth.uid())
  );

create policy "Board members can add costs"
  on public.costs for insert
  with check (
    created_by = auth.uid() and
    board_id in (select board_id from public.board_members where user_id = auth.uid())
  );

create policy "Creator can delete cost"
  on public.costs for delete
  using (created_by = auth.uid());

-- Cost splits
create policy "Board members can read splits"
  on public.cost_splits for select
  using (
    cost_id in (
      select id from public.costs where board_id in (
        select board_id from public.board_members where user_id = auth.uid()
      )
    )
  );

create policy "Board members can add splits"
  on public.cost_splits for insert
  with check (
    cost_id in (
      select id from public.costs where board_id in (
        select board_id from public.board_members where user_id = auth.uid()
      )
    )
  );

create policy "Users can settle their own splits"
  on public.cost_splits for update
  using (user_id = auth.uid());

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_board_members_user    on public.board_members(user_id);
create index if not exists idx_board_members_board   on public.board_members(board_id);
create index if not exists idx_costs_board           on public.costs(board_id);
create index if not exists idx_cost_splits_cost      on public.cost_splits(cost_id);
create index if not exists idx_cost_splits_user      on public.cost_splits(user_id);
create index if not exists idx_cost_splits_unsettled on public.cost_splits(settled) where not settled;
