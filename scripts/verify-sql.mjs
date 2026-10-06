import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// PostgreSQL real, isolado em memória. Auth é simulada apenas no teste.
const db = new PGlite();
const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
let checks = 0;
try {
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema public, auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    insert into auth.users values ('${a}'), ('${b}');`);
  const sql = await readFile(new URL('../supabase/setup.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(sql);
  checks += 2;
  const asUser = (id, query, params = []) => db.transaction(async tx => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
    return tx.query(query, params);
  });
  const denied = async (promise, code) => {
    await assert.rejects(promise, error => !code || error.code === code);
    checks++;
  };
  await asUser(a, 'insert into public.lume_profiles(user_id,name) values($1,$2)', [a, 'Ana Teste']);
  await asUser(b, 'insert into public.lume_profiles(user_id,name) values($1,$2)', [b, 'Bruno Teste']);
  assert.deepEqual((await asUser(a, 'select name from public.lume_profiles')).rows, [{ name: 'Ana Teste' }]); checks++;
  await denied(asUser(a, 'insert into public.lume_profiles(user_id,name) values($1,$2) on conflict(user_id) do update set name=excluded.name', [b, 'Intruso']), '42501');
  await denied(asUser(a, 'update public.lume_profiles set user_id=$1 where user_id=$2', ['33333333-3333-4333-8333-333333333333', a]), '42501');
  assert.equal((await asUser(a, "select * from public.lume_toggle_favorite('essencial')")).rows.length, 1); checks++;
  assert.equal((await asUser(b, 'select * from public.lume_favorites')).rows.length, 0); checks++;
  assert.equal((await asUser(a, "select * from public.lume_toggle_favorite('essencial')")).rows.length, 0); checks++;
  await denied(asUser(a, "select * from public.lume_toggle_favorite('invalido')"), 'P0001');
  await denied(asUser(a, 'select * from lume_private.chat_limits'), '42501');
  await denied(asUser(a, "insert into public.lume_bookings(user_id,treatment_id,name,phone,date,slot) values($1,'avaliacao','Ana','11999999999',current_date+1,'09:00')", [a]), '42501');
  await denied(db.transaction(async tx => { await tx.exec('set local role anon'); return tx.query('select * from public.lume_profiles'); }), '42501');
  await denied(db.transaction(async tx => { await tx.exec('set local role anon'); return tx.query('select * from public.lume_available_slots(current_date+1)'); }), '42501');
  await denied(asUser('', 'select * from public.lume_available_slots(current_date+1)'), '42501');
  const dates = (await db.query("select d::date::text as date from generate_series((now() at time zone 'America/Sao_Paulo')::date+1, (now() at time zone 'America/Sao_Paulo')::date+20, interval '1 day') d where extract(dow from d) between 1 and 5 order by d limit 8")).rows.map(row => row.date);
  const book = (id, date, slot = '09:00', consent = true) => asUser(id,
    'select public.lume_create_booking($1,$2::date,$3,$4,$5,$6) as id', ['avaliacao', date, slot, 'Nome Teste', '11999999999', consent]);
  assert.equal((await asUser(a, 'select * from public.lume_available_slots($1::date)', [dates[0]])).rows.length, 6); checks++;
  await denied(book(a, dates[0], '09:00', false), 'P0001');
  await denied(book(a, dates[0], '03:00'), 'P0001');
  const booking = (await book(a, dates[0])).rows[0].id;
  await denied(book(b, dates[0]), 'P0001');
  assert.equal((await asUser(b, 'select * from public.lume_bookings')).rows.length, 0); checks++;
  assert.equal((await asUser(b, 'select * from public.lume_available_slots($1::date)', [dates[0]])).rows.length, 5); checks++;
  await denied(asUser(b, 'select public.lume_cancel_booking($1)', [booking]), 'P0001');
  await denied(db.query("insert into public.lume_bookings(user_id,treatment_id,name,phone,date,slot) values($1,'avaliacao','Bruno','11999999999',$2::date,'09:00')", [b, dates[0]]), '23505');
  await asUser(a, 'select public.lume_cancel_booking($1)', [booking]);
  assert.equal((await asUser(b, 'select * from public.lume_available_slots($1::date)', [dates[0]])).rows.length, 6); checks++;
  await book(b, dates[0]);
  for (const date of dates.slice(1, 7)) await book(a, date);
  await denied(book(a, dates[7]), 'P0001');
  await denied(asUser(a, "select * from public.lume_available_slots('2026-02-31'::date)"), '22008');
  await denied(asUser(a, 'select * from public.lume_available_slots(current_date-1)'), 'P0001');
  const sunday = (await db.query("select d::date::text as date from generate_series(current_date+1,current_date+8,interval '1 day') d where extract(dow from d)=0 limit 1")).rows[0].date;
  assert.equal((await asUser(a, 'select * from public.lume_available_slots($1::date)', [sunday])).rows.length, 0); checks++;
  for (let i = 1; i <= 8; i++) assert.equal((await asUser(a, 'select public.lume_chat_limit() as count')).rows[0].count, i);
  checks += 8;
  await denied(asUser(a, 'select public.lume_chat_limit()'), 'P0001');
  await db.query('update lume_private.chat_limits set window_start=window_start-1 where user_id=$1', [a]);
  assert.equal((await asUser(a, 'select public.lume_chat_limit() as count')).rows[0].count, 1); checks++;
  await asUser(a, "select * from public.lume_toggle_favorite('corporal')");
  await asUser(a, 'select public.lume_delete_data()');
  for (const table of ['lume_profiles', 'lume_favorites', 'lume_bookings']) {
    assert.equal((await asUser(a, `select * from public.${table}`)).rows.length, 0); checks++;
  }
  assert.equal((await asUser(b, 'select * from public.lume_profiles')).rows.length, 1); checks++;
  assert.equal((await asUser(b, 'select * from public.lume_bookings')).rows.length, 1); checks++;
  console.log(`SQL: ${checks} verificações passaram (PostgreSQL isolado, RLS e funções reais).`);
} catch (error) { console.error("SQL falhou:", error.code, error.message, error.where ?? ""); process.exitCode = 1; } finally { await db.close(); }
