Thư mục này chứa **migration SQL cho Supabase** (Postgres + Auth + RLS).

PostgreSQL trong `docker-compose` **không** có schema `auth` của Supabase — đừng chạy file migration lên Postgres đó.

## Áp migration

1. Dashboard Supabase → **SQL** → dán file `supabase/migrations/20260113120000_m1_m2_profiles_core_rls.sql` → Run  
2. Hoặc CLI: `supabase link && supabase db push`

## Bật Google OAuth

Dashboard → Authentication → Providers → Google. Redirect / Site URL làm theo hướng dẫn Supabase và Google OAuth Web client.

Chi tiết module M1+M2 và REST: **`docs/MODULE_M1_M2_SUPABASE.md`**.
