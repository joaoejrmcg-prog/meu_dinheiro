-- =====================================================
-- Debug: Check Profiles Table
-- =====================================================

-- 1. Check if profiles table exists and what columns it has
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles';

-- 2. Count profiles
SELECT 'Profiles Count' as check_type, COUNT(*) as total FROM profiles;

-- 3. List all profiles
SELECT * FROM profiles LIMIT 5;

-- 4. Also check auth.users directly
SELECT 'Auth Users Count' as check_type, COUNT(*) as total FROM auth.users;

-- 5. List auth.users (just id and email)
SELECT id, email, created_at FROM auth.users LIMIT 5;
