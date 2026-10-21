-- 利用者表（users）の読み取りルールが自分自身を呼び続ける不具合（infinite recursion）の直し
-- 2026-10-21
--
-- 原因：users のルール「superadmin全操作_users」「同社スタッフ参照」が、条件の中で users をもう一度読んでいた。
--       users を読む → ルールが users を読む → またルールが… と止まらず、
--       users を条件に使う companies・simulations の読み取りもまとめてエラーになっていた。
-- 直し方：「自分の役割」「自分の会社」を返す小さな関数を作り、ルールはそれを使う。
--         関数は作成者の権限で動くので、関数の中ではルールを通らず、呼び返しが起きない。
-- 誰が何を見られるか（権限の中身）は変えていない。

begin;

-- 安全装置：いまのルールが想定どおりの中身のときだけ進む（違えば何も変えずに止まる）
do $$
declare q1 text; q2 text;
begin
  select regexp_replace(qual, '\s+', ' ', 'g') into q1 from pg_policies
   where schemaname='public' and tablename='users' and policyname='superadmin全操作_users';
  select regexp_replace(qual, '\s+', ' ', 'g') into q2 from pg_policies
   where schemaname='public' and tablename='users' and policyname='同社スタッフ参照';
  if q1 is null or q1 not like '%SELECT users_1.role FROM users users_1 WHERE (users_1.id = auth.uid())) = ''superadmin''%' then
    raise exception '想定と違うルールです（superadmin全操作_users）: %', q1;
  end if;
  if q2 is null or q2 <> '(company_id = ( SELECT users_1.company_id FROM users users_1 WHERE (users_1.id = auth.uid())))' then
    raise exception '想定と違うルールです（同社スタッフ参照）: %', q2;
  end if;
end $$;

create or replace function public.my_role()
returns public.users.role%type
language sql stable security definer set search_path = public
as $$ select role from public.users where id = auth.uid() $$;

create or replace function public.my_company_id()
returns public.users.company_id%type
language sql stable security definer set search_path = public
as $$ select company_id from public.users where id = auth.uid() $$;

drop policy if exists "superadmin全操作_users" on public.users;
create policy "superadmin全操作_users" on public.users
  for all to public
  using (public.my_role() = 'superadmin')
  with check (public.my_role() = 'superadmin');

drop policy if exists "同社スタッフ参照" on public.users;
create policy "同社スタッフ参照" on public.users
  for select to public
  using (company_id = public.my_company_id());

commit;

-- 確かめ（エラーにならず、件数が出れば直っている）
select count(*) from public.companies;
