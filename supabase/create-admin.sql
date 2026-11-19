-- Make an existing Supabase Auth user an admin of the Shiftingpartner dashboard.
-- 1) Supabase Dashboard > Authentication > Users > "Add user" (email + password, tick "Auto confirm").
-- 2) Replace the email below and run this in the SQL Editor.
insert into public.admin_users (auth_user_id, email, role)
select id, email, 'admin' from auth.users where email = 'admin@shiftingpartner.com'
on conflict (auth_user_id) do nothing;

-- Check:
select * from public.admin_users;

-- Remove an admin:
-- delete from public.admin_users where email = 'someone@example.com';
