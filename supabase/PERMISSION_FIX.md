# Permission Error Fix

## The Problem

You encountered this error:
```
ERROR: 42501: permission denied to set parameter "app.admin_email"
```

This happens because Supabase's managed PostgreSQL doesn't allow users to run `ALTER DATABASE` commands. This is a security restriction in managed database services.

## The Solution

Instead of using database-level configuration parameters, we now use a **configuration table** to store the admin email.

### What Changed

**Before (doesn't work in Supabase):**
```sql
ALTER DATABASE postgres SET app.admin_email = 'admin@example.com';
```

**After (works in Supabase):**
```sql
-- Create a config table
CREATE TABLE public.admin_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

-- Store admin email in the table
INSERT INTO public.admin_config (key, value)
VALUES ('admin_email', 'admin@example.com');
```

### Updated Files

The following files have been updated to use the table-based approach:

1. ✅ `supabase/admin_setup_complete.sql` - Now creates `admin_config` table
2. ✅ `supabase/pooja_admin.sql` - Updated `admin_can()` function
3. ✅ `supabase/verify_admin_setup.sql` - Updated verification queries
4. ✅ `QUICK_START_ADMIN.md` - Updated instructions
5. ✅ `ADMIN_PANEL_FIX.md` - Updated setup guide

## How to Proceed

Simply run the updated `admin_setup_complete.sql` script:

1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy the contents of `supabase/admin_setup_complete.sql`
3. **Edit line 28** to set your admin email:
   ```sql
   VALUES ('admin_email', 'your-actual-admin@example.com', now())
   ```
4. Click **Run**

The script will now work without permission errors! ✅

## Technical Details

The `admin_can()` function now:
1. Gets the current user's email from `auth.users`
2. Looks up the admin email from the `admin_config` table
3. Compares them (case-insensitive)
4. Returns `true` if they match

This approach is actually better because:
- ✅ Works in Supabase's managed environment
- ✅ Can be updated without database restart
- ✅ Can be queried and audited easily
- ✅ Supports future expansion (more config values)

