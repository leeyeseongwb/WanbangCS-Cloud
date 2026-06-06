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

## 🔒 Folder Visibility (Public / Private)

Folders now have an `is_public` flag.

- **Public** (default): everyone can see the folder, its subfolders, and its files.
- **Private**: hidden from non-managers. When a folder is private, **all of its subfolders and files are hidden too** (the whole subtree). Managers still see everything.

Managers can change visibility from the folder's **context menu** (right-click → *Make Private / Make Public*) or in the **Edit Folder** / **New Folder** dialog.

> **⚠️ Existing databases:** run this once in Supabase → SQL Editor (it's already included in `supabase/schema.sql`):
>
> ```sql
> ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;
> ```

## ⬇️⬆️ Cancelling Uploads & Downloads

The progress bar at the bottom now has an **X (cancel)** button:

- **Upload:** pressing X stops the upload. Any files **already uploaded in that batch are automatically deleted**, so nothing partial is left behind.
- **Download (ZIP / folder):** pressing X cancels the ZIP build before it is saved.

## 🗂️ Move files & folders (managers)

Managers can reorganize the tree by **drag & drop**:

- **Into a folder:** drag a file or folder onto another folder card to move it inside.
- **Up to a parent / root:** the path bar (breadcrumb) at the top is now a drop zone. Drag an item onto any crumb — e.g. **WBCS Cloud** (top level) or any parent folder name — and release to move it up to that level.

The breadcrumb shows the **full path** (e.g. `WBCS Cloud › Folder 1 › Folder 1-a`), so you can drop onto any ancestor. Moving a folder into itself or one of its own subfolders is blocked automatically to prevent loops.

## 📂 Folder Download keeps subfolder structure

Downloading a folder produces a single `.zip` that **preserves the original subfolder tree**. For example, downloading `Folder 1` yields:

```
Folder 1.zip
├── Folder 1-a/
│   ├── File 1
│   └── File 2
└── Folder 2/
    └── File 3
```

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
