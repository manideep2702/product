# Admin Panel Setup Guide

This guide will help you set up the admin panel to retrieve data correctly.

## Prerequisites

You need to have admin access to your Supabase project's SQL Editor.

## Step 1: Set Admin Email

First, you need to configure which email address has admin privileges. Replace `your-admin@example.com` with your actual admin email:

```sql
-- Set the admin email at the database level
ALTER DATABASE postgres SET app.admin_email = 'your-admin@example.com';
```

**Important:** Make sure this email matches the one you use to sign in to the admin panel.

## Step 2: Deploy All Required Functions

Run the following SQL files in order in your Supabase SQL Editor:

1. **pooja_admin.sql** - Contains the admin helper functions and Pooja bookings listing
2. **admin_lists.sql** - Contains all other admin listing functions (Annadanam, Donations, Contact, Volunteers)

You can run them by copying the contents of each file and executing in the SQL Editor.

## Step 3: Verify Functions Are Deployed

Run this query to check if all required functions exist:

```sql
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name LIKE 'admin_%'
ORDER BY routine_name;
```

You should see these functions:
- `admin_can` (function)
- `admin_list_annadanam_bookings` (function)
- `admin_list_contact_us` (function)
- `admin_list_donations` (function)
- `admin_list_pooja_bookings` (function)
- `admin_list_volunteer_bookings` (function)
- `current_user_email` (function)

## Step 4: Verify Database Tables Exist

Check that all required tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name IN (
        'Bookings',
        'Pooja-Bookings',
        'donations',
        'contact-us',
        'Volunteer Bookings'
    )
ORDER BY table_name;
```

## Step 5: Test Admin Access

Sign in to the admin panel with the email you configured in Step 1. Try loading data from each section:

1. **Annadanam List** - Select a date and click "Load Bookings"
2. **Pooja Bookings** - Select a date and timing, click "Load Bookings"
3. **Donations** - Set date range and click "Load Donations"
4. **Contact Messages** - Set date range and click "Load Messages"
5. **Volunteer Bookings** - Set date range and click "Load Volunteers"

## Troubleshooting

### "Could not find the function" Error

This means the function is not deployed. Re-run the corresponding SQL file.

### "Not authenticated" or "Forbidden" Error

1. Make sure you're signed in with the correct admin email
2. Verify the `app.admin_email` setting matches your sign-in email
3. Check that you set the environment variable `NEXT_PUBLIC_ADMIN_EMAIL` in your `.env.local` file

### No Data Returned

1. Check if there's actually data in the database for the selected filters
2. Try removing filters and loading all data
3. Check the browser console for any JavaScript errors

### Environment Variables

Make sure these are set in your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_ADMIN_EMAIL=your-admin@example.com
ADMIN_EMAIL=your-admin@example.com
```

## Testing Individual Functions

You can test each function directly in the Supabase SQL Editor:

```sql
-- Test Annadanam bookings
SELECT * FROM admin_list_annadanam_bookings(
    start_date := '2025-01-01'::date,
    end_date := '2025-12-31'::date,
    sess := null,
    limit_rows := 10,
    offset_rows := 0
);

-- Test Pooja bookings
SELECT * FROM admin_list_pooja_bookings(
    start_date := '2025-01-01'::date,
    end_date := '2025-12-31'::date,
    sess := null,
    limit_rows := 10,
    offset_rows := 0
);

-- Test Donations
SELECT * FROM admin_list_donations(
    start_ts := '2025-01-01T00:00:00Z'::timestamptz,
    end_ts := '2025-12-31T23:59:59Z'::timestamptz,
    limit_rows := 10,
    offset_rows := 0
);

-- Test Contact messages
SELECT * FROM admin_list_contact_us(
    start_ts := '2025-01-01T00:00:00Z'::timestamptz,
    end_ts := '2025-12-31T23:59:59Z'::timestamptz,
    limit_rows := 10,
    offset_rows := 0
);

-- Test Volunteer bookings
SELECT * FROM admin_list_volunteer_bookings(
    start_date := '2025-01-01'::date,
    end_date := '2025-12-31'::date,
    sess := null,
    limit_rows := 10,
    offset_rows := 0
);
```

**Note:** These tests must be run while signed in as the admin user, or they will return no results.

