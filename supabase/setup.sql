-- Lume / Vercel. Execute todo este arquivo no SQL Editor de um projeto Supabase ativo.
-- Idempotente: não apaga tabelas ou dados de outros aplicativos.
begin;

create schema if not exists lume_private;
revoke all on schema lume_private from public, anon, authenticated;

create table if not exists public.lume_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  phone text not null default '' check (char_length(phone) <= 20),
  goal text not null default 'equilibrio' check (goal in ('equilibrio','vico','conforto','pausa')),
  avatar_color text not null default 'blue' check (avatar_color in ('blue','violet','green')),
  updated_at timestamptz not null default now()
);
create table if not exists public.lume_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  treatment_id text not null check (treatment_id in ('essencial','luminosidade','serenidade','corporal')),
  primary key (user_id, treatment_id)
);
create table if not exists public.lume_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  treatment_id text not null check (treatment_id in ('avaliacao','essencial','luminosidade','serenidade','corporal')),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  phone text not null check (char_length(phone) <= 20 and char_length(regexp_replace(phone,'[^0-9]','','g')) between 10 and 15),
  date date not null,
  slot text not null check (slot in ('09:00','10:30','13:30','15:00','16:30','18:00')),
  status text not null default 'reservado' check (status in ('reservado','cancelado')),
  created_at timestamptz not null default now()
);
create unique index if not exists lume_bookings_unique_active_slot on public.lume_bookings(date,slot) where status = 'reservado';
create index if not exists lume_bookings_owner_date on public.lume_bookings(user_id,date desc);
create table if not exists lume_private.chat_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start bigint not null,
  count integer not null
);
revoke all on lume_private.chat_limits from public, anon, authenticated;

alter table public.lume_profiles enable row level security;
alter table public.lume_favorites enable row level security;
alter table public.lume_bookings enable row level security;
alter table lume_private.chat_limits enable row level security;
revoke all on public.lume_profiles, public.lume_favorites, public.lume_bookings from public, anon, authenticated;
grant select, insert, update, delete on public.lume_profiles to authenticated;
grant select, insert, delete on public.lume_favorites to authenticated;
grant select on public.lume_bookings to authenticated;

drop policy if exists lume_profiles_select_own on public.lume_profiles;
create policy lume_profiles_select_own on public.lume_profiles for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists lume_profiles_insert_own on public.lume_profiles;
create policy lume_profiles_insert_own on public.lume_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists lume_profiles_update_own on public.lume_profiles;
create policy lume_profiles_update_own on public.lume_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists lume_profiles_delete_own on public.lume_profiles;
create policy lume_profiles_delete_own on public.lume_profiles for delete to authenticated using ((select auth.uid()) = user_id);
drop policy if exists lume_favorites_select_own on public.lume_favorites;
create policy lume_favorites_select_own on public.lume_favorites for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists lume_favorites_insert_own on public.lume_favorites;
create policy lume_favorites_insert_own on public.lume_favorites for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists lume_favorites_delete_own on public.lume_favorites;
create policy lume_favorites_delete_own on public.lume_favorites for delete to authenticated using ((select auth.uid()) = user_id);
drop policy if exists lume_bookings_select_own on public.lume_bookings;
create policy lume_bookings_select_own on public.lume_bookings for select to authenticated using ((select auth.uid()) = user_id);

-- Só horários livres são retornados; dados das reservas de outros usuários ficam privados.
-- Estas funções privilegiadas são necessárias para verificar a agenda inteira e realizar
-- escritas atômicas. Todas exigem auth.uid(), fixam search_path e limitam a execução ao role authenticated.
create or replace function public.lume_available_slots(p_date date)
returns table (slot text)
language plpgsql security definer set search_path = '' as $$
declare v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para continuar.' using errcode = '42501'; end if;
  if p_date is null or p_date < v_today or p_date > v_today + 120 then raise exception 'Escolha uma data entre hoje e os próximos 120 dias.'; end if;
  if extract(dow from p_date) = 0 then return; end if;
  return query
    select candidate.value from unnest(array['09:00','10:30','13:30','15:00','16:30','18:00']::text[]) as candidate(value)
    where (extract(dow from p_date) <> 6 or candidate.value in ('09:00','10:30'))
      and (p_date + candidate.value::time) at time zone 'America/Sao_Paulo' > now() + interval '1 hour'
      and not exists (select 1 from public.lume_bookings as booked where booked.date = p_date and booked.slot = candidate.value and booked.status = 'reservado')
    order by candidate.value;
end;
$$;

create or replace function public.lume_create_booking(p_treatment text, p_date date, p_slot text, p_name text, p_phone text, p_consent boolean)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'Entre na sua conta para continuar.' using errcode = '42501'; end if;
  if p_consent is distinct from true then raise exception 'Confirme o consentimento para reservar.'; end if;
  if p_treatment is null or p_treatment not in ('avaliacao','essencial','luminosidade','serenidade','corporal') then raise exception 'Escolha um ritual válido.'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 2 and 80 or p_phone is null or char_length(p_phone) > 20 or char_length(regexp_replace(p_phone,'[^0-9]','','g')) not between 10 and 15 then raise exception 'Confira seu nome e celular.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  if (select count(*) from public.lume_bookings where user_id = v_user and date >= (now() at time zone 'America/Sao_Paulo')::date and status = 'reservado') >= 6 then raise exception 'Você já tem várias reservas. Consulte sua área antes de agendar novamente.'; end if;
  if not exists (select 1 from public.lume_available_slots(p_date) as available where available.slot = p_slot) then raise exception 'Esse horário não está disponível. Escolha outro.'; end if;
  insert into public.lume_bookings(user_id,treatment_id,name,phone,date,slot)
    values (v_user,p_treatment,btrim(p_name),btrim(p_phone),p_date,p_slot) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.lume_cancel_booking(p_id uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_booking public.lume_bookings%rowtype;
begin
  if v_user is null then raise exception 'Entre na sua conta para continuar.' using errcode = '42501'; end if;
  select * into v_booking from public.lume_bookings where id = p_id and user_id = v_user for update;
  if not found then raise exception 'Reserva não encontrada.'; end if;
  if v_booking.status = 'cancelado' then return 'cancelado'; end if;
  if (v_booking.date + v_booking.slot::time) at time zone 'America/Sao_Paulo' <= now() then raise exception 'Uma reserva que já passou não pode ser cancelada.'; end if;
  update public.lume_bookings set status = 'cancelado' where id = p_id and user_id = v_user;
  return 'cancelado';
end;
$$;

create or replace function public.lume_toggle_favorite(p_treatment text)
returns table (treatment_id text)
language plpgsql security invoker set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Entre na sua conta para continuar.' using errcode = '42501'; end if;
  if p_treatment is null or p_treatment not in ('essencial','luminosidade','serenidade','corporal') then raise exception 'Escolha um ritual válido.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('favorite:' || v_user::text, 0));
  delete from public.lume_favorites as favorite where favorite.user_id = v_user and favorite.treatment_id = p_treatment;
  if not found then insert into public.lume_favorites(user_id,treatment_id) values(v_user,p_treatment) on conflict do nothing; end if;
  return query select favorite.treatment_id from public.lume_favorites as favorite where favorite.user_id = v_user order by favorite.treatment_id;
end;
$$;

create or replace function public.lume_chat_limit()
returns integer
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_window_start bigint := floor(extract(epoch from now()) / 60); v_count integer;
begin
  if v_user is null then raise exception 'Entre na sua conta para continuar.' using errcode = '42501'; end if;
  insert into lume_private.chat_limits(user_id,window_start,count) values(v_user,v_window_start,1)
    on conflict(user_id) do update set window_start = excluded.window_start,
    count = case when chat_limits.window_start = excluded.window_start then chat_limits.count + 1 else 1 end
    returning count into v_count;
  if v_count > 8 then raise exception 'Vamos fazer uma pequena pausa. Tente novamente em um minuto.'; end if;
  return v_count;
end;
$$;

create or replace function public.lume_delete_data()
returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Entre na sua conta para continuar.' using errcode = '42501'; end if;
  delete from public.lume_profiles where user_id = v_user;
  delete from public.lume_favorites where user_id = v_user;
  delete from public.lume_bookings where user_id = v_user;
  delete from lume_private.chat_limits where user_id = v_user;
  return true;
end;
$$;

revoke all on function public.lume_available_slots(date) from public, anon, authenticated;
revoke all on function public.lume_create_booking(text,date,text,text,text,boolean) from public, anon, authenticated;
revoke all on function public.lume_cancel_booking(uuid) from public, anon, authenticated;
revoke all on function public.lume_toggle_favorite(text) from public, anon, authenticated;
revoke all on function public.lume_chat_limit() from public, anon, authenticated;
revoke all on function public.lume_delete_data() from public, anon, authenticated;
grant execute on function public.lume_available_slots(date), public.lume_create_booking(text,date,text,text,text,boolean), public.lume_cancel_booking(uuid), public.lume_toggle_favorite(text), public.lume_chat_limit(), public.lume_delete_data() to authenticated;

commit;
