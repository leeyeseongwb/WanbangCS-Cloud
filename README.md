# Wanbang CS Cloud

Online Cloud Storage for Wanbang Computer Science Team

## 🚀 Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env` file

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here

# Manager Registration Code (used when Supabase settings table is unreachable)
VITE_REGISTRATION_CODE=WanbangCS260606
```

### 3. Run Supabase SQL

In your Supabase Dashboard → **SQL Editor**, paste and run the entire contents of `supabase/schema.sql`.

This creates:
- `folders` table
- `files` table
- `managers` table (for custom username/password login)
- `settings` table (for dynamic registration code)

### 4. Start the dev server

```bash
npm run dev
```

## 🔧 How to change the Manager Registration Code

There are **two ways** to change the registration code used when creating a new manager account:

### Method A: Supabase Database (Recommended for production)

The app first tries to read the code from the Supabase database.

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Open your project → **Table Editor**
3. Select the **`settings`** table
4. Find the row where `key` = `registration_code`
5. Click the row, edit the `value` column, and save

> **Note:** This change is live immediately. No app restart needed.

### Method B: Local `.env` file (Fallback for local development)

If the app cannot connect to Supabase, it automatically falls back to the code in `.env`:

```env
VITE_REGISTRATION_CODE=YourNewCodeHere
```

> **Note:** You must restart the dev server (`npm run dev`) after changing `.env`.

## 📁 Database Table Names

| Table | Purpose |
|---|---|
| `folders` | Stores folder metadata (name, color, description) |
| `files` | Stores file metadata (name, URL, size, category, folder_id, published) |
| `managers` | Stores custom manager accounts (username, password_hash) |
| `settings` | Stores dynamic app configuration (e.g., registration_code) |

## 🛡️ Manager Login System

- No Google login — only custom username/password authentication
- Passwords are hashed client-side with a simple salt (for basic security)
- Manager session is stored in `localStorage`
- Non-managers cannot see hidden files (`published = false`)

## 📝 SQL Cheat Sheet: Insert Registration Code Manually

If the `settings` table is empty or you want to insert a new code via SQL:

```sql
-- Insert or update the registration code
INSERT INTO public.settings (key, value)
VALUES ('registration_code', 'WanbangCS260606')
ON CONFLICT (key) DO UPDATE SET value = 'WanbangCS260606';
```

Or simply run the full `supabase/schema.sql` file which includes this insert automatically.
