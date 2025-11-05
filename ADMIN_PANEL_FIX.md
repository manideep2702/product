# Admin Panel Data Retrieval Fix

## Issues Found and Fixed

### 1. ✅ Annadanam Bookings - Wrong Date Fields
**Problem:** The `loadAnnadanam` function was using the wrong state variables (`start` and `end` from the Export Data section) instead of the `annaDate` variable.

**Fix:** Updated the function to use `annaDate` for both start_date and end_date parameters.

### 2. ⚠️ Database Functions Not Deployed
**Problem:** The Supabase RPC functions may not be deployed to your database.

**Solution:** Run the setup script (see below).

### 3. ⚠️ Admin Email Not Configured
**Problem:** The `app.admin_email` database parameter may not be set, causing the `admin_can()` function to fail.

**Solution:** Set your admin email in the database (see below).

## Quick Setup Instructions

### Step 1: Deploy Database Functions

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Open the file `/Users/manideep/.cursor/worktrees/Madyy/Kg8V2/supabase/admin_setup_complete.sql`
4. **IMPORTANT:** Edit line 28 and replace `'Adminssss@ayyappa.com'` with your actual admin email
5. Copy the entire contents and paste into the SQL Editor
6. Click **Run** to execute

This will create an `admin_config` table and store your admin email there (Supabase doesn't allow ALTER DATABASE commands).

### Step 2: Verify Setup

After running the script, you should see:
- "SUCCESS: All 7 admin functions are deployed correctly!"
- A list of all deployed functions
- Your configured admin email

### Step 3: Update Environment Variables

Make sure your `.env.local` file has these variables set:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_ADMIN_EMAIL=your-admin@example.com
ADMIN_EMAIL=your-admin@example.com
```

### Step 4: Test the Admin Panel

1. Sign in to the admin panel with your configured admin email
2. Test each section:
   - **Annadanam List:** Select a date and click "Load Bookings"
   - **Pooja Bookings:** Select a date and timing, click "Load Bookings"
   - **Donations:** Set date range and click "Load Donations"
   - **Contact Messages:** Set date range and click "Load Messages"
   - **Volunteer Bookings:** Set date range and click "Load Volunteers"

## Changes Made to Code

### File: `src/app/admin/page.tsx`

1. **Fixed Annadanam date parameters:**
   - Changed from: `start_date: start || null, end_date: end || null`
   - Changed to: `start_date: annaDate || null, end_date: annaDate || null`

2. **Added user feedback for all load functions:**
   - Now shows an info alert when no results are found
   - Helps users understand if filters are too restrictive

## Database Functions Created/Updated

All these functions are in `supabase/admin_setup_complete.sql`:

1. `current_user_email()` - Gets the current authenticated user's email
2. `admin_can()` - Checks if current user is the configured admin
3. `admin_list_pooja_bookings()` - Lists Pooja bookings with filters
4. `admin_list_annadanam_bookings()` - Lists Annadanam bookings with filters
5. `admin_list_donations()` - Lists donations with date filters
6. `admin_list_contact_us()` - Lists contact messages with date filters
7. `admin_list_volunteer_bookings()` - Lists volunteer bookings with filters

## Troubleshooting

### "Could not find the function" Error

**Cause:** The database function is not deployed.

**Solution:** Run the `admin_setup_complete.sql` script in Supabase SQL Editor.

### No Data Returned (Empty Results)

**Possible causes:**
1. No data exists for the selected filters
2. Admin email not configured correctly
3. Signed in with wrong email

**Solutions:**
1. Try removing filters and loading all data
2. Verify `app.admin_email` is set correctly in database
3. Sign in with the email configured as admin
4. Check browser console for errors

### "Not authenticated" or "Forbidden" Error

**Cause:** Either not signed in or signed in with non-admin email.

**Solutions:**
1. Sign out and sign in again with the admin email
2. Verify the email in Supabase Auth matches the configured admin email
3. Check that `NEXT_PUBLIC_ADMIN_EMAIL` environment variable matches

### Pooja Bookings API Error

**Cause:** The API route requires `SUPABASE_SERVICE_ROLE_KEY`.

**Solution:** Make sure `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`.

## Testing Individual Functions in Supabase

You can test each function directly in the SQL Editor:

```sql
-- Test if you're recognized as admin
SELECT admin_can();  -- Should return true when signed in as admin

-- Test Annadanam bookings
SELECT * FROM admin_list_annadanam_bookings(
    '2025-01-01'::date,  -- start_date
    '2025-12-31'::date,  -- end_date
    null,                -- session (null = all)
    10,                  -- limit
    0                    -- offset
);

-- Test Donations
SELECT * FROM admin_list_donations(
    '2025-01-01T00:00:00Z'::timestamptz,  -- start_ts
    '2025-12-31T23:59:59Z'::timestamptz,  -- end_ts
    10,                                    -- limit
    0                                      -- offset
);
```

## Additional Resources

- **Detailed Setup Guide:** `supabase/ADMIN_SETUP.md`
- **Complete SQL Script:** `supabase/admin_setup_complete.sql`
- **Individual Function Files:**
  - `supabase/pooja_admin.sql` - Pooja bookings functions
  - `supabase/admin_lists.sql` - Other admin list functions

## Summary

The main issues were:
1. ✅ **Fixed:** Wrong date variables in Annadanam loading function
2. ⚠️ **Action Required:** Deploy database functions using `admin_setup_complete.sql`
3. ⚠️ **Action Required:** Configure admin email in database
4. ✅ **Improved:** Added user feedback for empty results

After completing the setup steps above, your admin panel should work correctly!

