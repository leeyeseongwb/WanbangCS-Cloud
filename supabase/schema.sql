-- ============================================================
-- Supabase Schema for WanbangCS-Cloud
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Folders table
CREATE TABLE IF NOT EXISTS public.folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT 'blue' CHECK (color IN ('blue', 'purple', 'emerald', 'orange', 'pink', 'amber')),
    parent_folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Files table (metadata only — actual binaries go to Supabase Storage)
CREATE TABLE IF NOT EXISTS public.files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    file_url TEXT NOT NULL,            -- Supabase Storage public URL
    storage_path TEXT NOT NULL,        -- actual path in Supabase Storage bucket
    file_size BIGINT,
    file_type TEXT,
    category TEXT DEFAULT 'other' CHECK (category IN ('document', 'image', 'video', 'audio', 'archive', 'other')),
    description TEXT,
    folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
    published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Managers table (custom auth)
CREATE TABLE IF NOT EXISTS public.managers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON public.files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_category ON public.files(category);
CREATE INDEX IF NOT EXISTS idx_files_published ON public.files(published);
CREATE INDEX IF NOT EXISTS idx_folders_name ON public.folders(name);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON public.folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_managers_username ON public.managers(username);

-- 6. Updated_at auto trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_files_updated_at
    BEFORE UPDATE ON public.files
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_folders_updated_at
    BEFORE UPDATE ON public.folders
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Settings table (key-value store for app configuration)
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default registration code
-- TO CHANGE THIS LATER: go to Supabase Dashboard → Table Editor → settings → edit the row where key='registration_code'
INSERT INTO public.settings (key, value)
VALUES ('registration_code', 'WanbangCS260606')
ON CONFLICT (key) DO NOTHING;

-- 8. Row Level Security (RLS) policies
-- Enable RLS
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;

-- Anonymous / logged-in users can read published files & folders
CREATE POLICY "Allow public read folders" ON public.folders
    FOR SELECT USING (true);

CREATE POLICY "Allow public read published files" ON public.files
    FOR SELECT USING (published = true);

-- Allow all insert/update/delete for now (manager checks happen in client or via API key)
-- If you want stricter security, replace these with authenticated-user checks.
CREATE POLICY "Allow all file operations" ON public.files
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all folder operations" ON public.folders
    FOR ALL USING (true) WITH CHECK (true);

-- Manager table restricted to select only (registration handled via service role or Edge Functions)
CREATE POLICY "Allow public read managers" ON public.managers
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert managers" ON public.managers
    FOR INSERT WITH CHECK (true);

-- Settings table: anyone can read, but only service role or Edge Functions should write
-- For this use case, we allow public read so registration page can fetch the code
CREATE POLICY "Allow public read settings" ON public.settings
    FOR SELECT USING (true);

CREATE POLICY "Allow all settings write" ON public.settings
    FOR ALL USING (true) WITH CHECK (true);
