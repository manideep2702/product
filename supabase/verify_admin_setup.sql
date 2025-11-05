-- Admin Setup Verification Script
-- Run this in Supabase SQL Editor to verify your admin panel setup

-- ============================================================================
-- 1. Check if admin email is configured
-- ============================================================================
SELECT 
    'Admin Email Configuration' AS check_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.admin_config WHERE key = 'admin_email')
        THEN '✓ PASS - Admin email is set to: ' || (SELECT value FROM public.admin_config WHERE key = 'admin_email')
        ELSE '✗ FAIL - Admin email is NOT set. Run the admin_setup_complete.sql script.'
    END AS result;

-- ============================================================================
-- 2. Check if all required functions exist
-- ============================================================================
WITH required_functions AS (
    SELECT unnest(ARRAY[
        'current_user_email',
        'admin_can',
        'admin_list_pooja_bookings',
        'admin_list_annadanam_bookings',
        'admin_list_donations',
        'admin_list_contact_us',
        'admin_list_volunteer_bookings'
    ]) AS func_name
),
existing_functions AS (
    SELECT routine_name
    FROM information_schema.routines
    WHERE routine_schema = 'public'
)
SELECT 
    'Database Functions' AS check_name,
    CASE 
        WHEN COUNT(rf.func_name) = 7 AND COUNT(ef.routine_name) = 7
        THEN '✓ PASS - All 7 required functions exist'
        ELSE '✗ FAIL - Only ' || COUNT(ef.routine_name) || ' out of 7 functions found. Missing: ' || 
             string_agg(rf.func_name, ', ') FILTER (WHERE ef.routine_name IS NULL)
    END AS result
FROM required_functions rf
LEFT JOIN existing_functions ef ON rf.func_name = ef.routine_name;

-- ============================================================================
-- 3. Check if required tables exist
-- ============================================================================
WITH required_tables AS (
    SELECT unnest(ARRAY[
        'Bookings',
        'Pooja-Bookings',
        'donations',
        'contact-us',
        'Volunteer Bookings'
    ]) AS table_name
),
existing_tables AS (
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
)
SELECT 
    'Database Tables' AS check_name,
    CASE 
        WHEN COUNT(rt.table_name) = 5 AND COUNT(et.table_name) = 5
        THEN '✓ PASS - All 5 required tables exist'
        ELSE '✗ FAIL - Only ' || COUNT(et.table_name) || ' out of 5 tables found. Missing: ' || 
             string_agg(rt.table_name, ', ') FILTER (WHERE et.table_name IS NULL)
    END AS result
FROM required_tables rt
LEFT JOIN existing_tables et ON rt.table_name = et.table_name;

-- ============================================================================
-- 4. Check current user authentication
-- ============================================================================
SELECT 
    'Current User Authentication' AS check_name,
    CASE 
        WHEN auth.uid() IS NOT NULL
        THEN '✓ PASS - You are authenticated as: ' || coalesce(public.current_user_email(), 'unknown')
        ELSE '✗ FAIL - You are not authenticated. Please sign in first.'
    END AS result;

-- ============================================================================
-- 5. Check if current user is admin
-- ============================================================================
SELECT 
    'Admin Access Check' AS check_name,
    CASE 
        WHEN public.admin_can() = true
        THEN '✓ PASS - You have admin access'
        WHEN auth.uid() IS NULL
        THEN '✗ FAIL - Not authenticated'
        WHEN NOT EXISTS (SELECT 1 FROM public.admin_config WHERE key = 'admin_email')
        THEN '✗ FAIL - Admin email not configured in database'
        ELSE '✗ FAIL - Your email (' || coalesce(public.current_user_email(), 'unknown') || 
             ') does not match admin email (' || (SELECT value FROM public.admin_config WHERE key = 'admin_email') || ')'
    END AS result;

-- ============================================================================
-- 6. Test data counts (optional - shows if you have data)
-- ============================================================================
SELECT 
    'Data Availability' AS check_name,
    'Bookings: ' || (SELECT COUNT(*)::text FROM public."Bookings") || 
    ' | Pooja: ' || (SELECT COUNT(*)::text FROM public."Pooja-Bookings") ||
    ' | Donations: ' || (SELECT COUNT(*)::text FROM public.donations) ||
    ' | Contact: ' || (SELECT COUNT(*)::text FROM public."contact-us") ||
    ' | Volunteers: ' || (SELECT COUNT(*)::text FROM public."Volunteer Bookings") AS result;

-- ============================================================================
-- 7. List all admin functions with their signatures
-- ============================================================================
SELECT 
    routine_name AS function_name,
    string_agg(
        parameter_name || ' ' || 
        CASE 
            WHEN data_type = 'USER-DEFINED' THEN udt_name
            ELSE data_type
        END || 
        CASE 
            WHEN parameter_default IS NOT NULL THEN ' = ' || parameter_default
            ELSE ''
        END,
        ', ' ORDER BY ordinal_position
    ) AS parameters
FROM information_schema.parameters
WHERE specific_schema = 'public'
    AND (routine_name LIKE 'admin_%' OR routine_name IN ('current_user_email'))
    AND parameter_mode IN ('IN', 'INOUT')
GROUP BY routine_name
ORDER BY routine_name;

-- ============================================================================
-- SUMMARY
-- ============================================================================
DO $$
DECLARE
    admin_email_set BOOLEAN;
    functions_count INTEGER;
    tables_count INTEGER;
    is_authenticated BOOLEAN;
    is_admin BOOLEAN;
    all_checks_pass BOOLEAN;
BEGIN
    -- Check each condition
    admin_email_set := EXISTS (SELECT 1 FROM public.admin_config WHERE key = 'admin_email');
    
    SELECT COUNT(*) INTO functions_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
        AND routine_name IN (
            'current_user_email', 'admin_can', 'admin_list_pooja_bookings',
            'admin_list_annadanam_bookings', 'admin_list_donations',
            'admin_list_contact_us', 'admin_list_volunteer_bookings'
        );
    
    SELECT COUNT(*) INTO tables_count
    FROM information_schema.tables
    WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name IN ('Bookings', 'Pooja-Bookings', 'donations', 'contact-us', 'Volunteer Bookings');
    
    is_authenticated := auth.uid() IS NOT NULL;
    is_admin := is_authenticated AND public.admin_can();
    
    all_checks_pass := admin_email_set AND functions_count = 7 AND tables_count = 5 AND is_admin;
    
    -- Print summary
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ADMIN SETUP VERIFICATION SUMMARY';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Admin Email Set: %', CASE WHEN admin_email_set THEN '✓ YES' ELSE '✗ NO' END;
    RAISE NOTICE 'Functions Deployed: % / 7', functions_count;
    RAISE NOTICE 'Tables Exist: % / 5', tables_count;
    RAISE NOTICE 'Authenticated: %', CASE WHEN is_authenticated THEN '✓ YES' ELSE '✗ NO' END;
    RAISE NOTICE 'Admin Access: %', CASE WHEN is_admin THEN '✓ YES' ELSE '✗ NO' END;
    RAISE NOTICE '========================================';
    
    IF all_checks_pass THEN
        RAISE NOTICE '✓✓✓ ALL CHECKS PASSED! ✓✓✓';
        RAISE NOTICE 'Your admin panel should work correctly.';
    ELSE
        RAISE NOTICE '✗✗✗ SOME CHECKS FAILED ✗✗✗';
        RAISE NOTICE 'Please review the results above and fix any issues.';
        RAISE NOTICE '';
        IF NOT admin_email_set THEN
            RAISE NOTICE 'TODO: Run admin_setup_complete.sql to configure admin email';
        END IF;
        IF functions_count < 7 THEN
            RAISE NOTICE 'TODO: Deploy missing functions by running admin_setup_complete.sql';
        END IF;
        IF NOT is_authenticated THEN
            RAISE NOTICE 'TODO: Sign in to Supabase with your admin account';
        END IF;
        IF is_authenticated AND NOT is_admin THEN
            RAISE NOTICE 'TODO: Make sure your sign-in email matches the configured admin email';
        END IF;
    END IF;
    RAISE NOTICE '========================================';
END $$;

