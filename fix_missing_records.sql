-- Ensure all users have a subscription record
INSERT INTO subscriptions (user_id, plan, status, current_period_end)
SELECT 
    id as user_id,
    'trial' as plan,
    'trial' as status,
    NOW() + INTERVAL '7 days' as current_period_end
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM subscriptions);

-- Also ensure all users have a profile record
INSERT INTO profiles (user_id, referral_code)
SELECT 
    id as user_id,
    UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8)) as referral_code
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM profiles);
