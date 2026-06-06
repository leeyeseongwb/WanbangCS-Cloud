import { supabase } from './supabaseClient'

// ============================================================
// Local Storage Fallback (for development without Supabase)
// ============================================================

const LOCAL_MANAGERS_KEY = 'wbcs_local_managers';

function isSupabaseConfigured() {
    const url = import.meta.env.VITE_SUPABASE_URL || '';
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    return url.length > 0 && !url.includes('placeholder') && key.length > 0 && key !== 'placeholder';
}

function getLocalManagers() {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_MANAGERS_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveLocalManagers(managers) {
    localStorage.setItem(LOCAL_MANAGERS_KEY, JSON.stringify(managers));
}

// ============================================================
// Manager API
// ============================================================

export async function getManagerByUsername(username) {
    if (!isSupabaseConfigured()) {
        const managers = getLocalManagers();
        return managers.find(m => m.username === username) || null;
    }

    const { data, error } = await supabase
        .from('managers')
        .select('*')
        .eq('username', username)
        .single()

    if (error && error.code !== 'PGRST116') throw error
    return data || null
}

export async function createManager({ username, passwordHash }) {
    if (!isSupabaseConfigured()) {
        const managers = getLocalManagers();
        if (managers.find(m => m.username === username)) {
            throw new Error('Username already taken.');
        }
        const newManager = {
            id: crypto.randomUUID?.() || Date.now().toString(),
            username,
            password_hash: passwordHash,
            created_at: new Date().toISOString(),
        };
        managers.push(newManager);
        saveLocalManagers(managers);
        return newManager;
    }

    const { data, error } = await supabase
        .from('managers')
        .insert({ username, password_hash: passwordHash })
        .select()
        .single()

    if (error) throw error
    return data
}

export async function listManagers() {
    if (!isSupabaseConfigured()) {
        return getLocalManagers();
    }

    const { data, error } = await supabase
        .from('managers')
        .select('*')

    if (error) throw error
    return data || []
}
