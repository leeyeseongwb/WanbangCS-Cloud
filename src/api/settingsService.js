import { supabase } from './supabaseClient'

export async function getSetting(key) {
    const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', key)
        .single()

    if (error) throw error
    return data?.value || null
}

export async function updateSetting(key, value) {
    const { data, error } = await supabase
        .from('settings')
        .upsert({ key, value, updated_at: new Date().toISOString() })
        .select()
        .single()

    if (error) throw error
    return data
}
