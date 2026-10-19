-- Jalankan sekali di Supabase > SQL Editor
create table if not exists site  (id int primary key, data jsonb not null);
create table if not exists likes (work_id text primary key, count int not null default 0);
alter table site  enable row level security;
alter table likes enable row level security;

create or replace function like_work(wid text) returns int
language sql security definer as $$
  insert into likes(work_id, count) values (wid, 1)
  on conflict (work_id) do update set count = likes.count + 1
  returning count;
$$;

insert into storage.buckets (id, name, public) values ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

-- Pesan dari form kontak
create table if not exists messages (
  id bigint generated always as identity primary key,
  name text not null, email text not null, message text not null,
  created_at timestamptz not null default now()
);
alter table messages enable row level security;
