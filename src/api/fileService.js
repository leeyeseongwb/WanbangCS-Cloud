import { supabase } from './supabaseClient'

// ============================================================
// Folder API
// ============================================================

export async function listFolders() {
    const { data, error } = await supabase
        .from('folders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

    if (error) throw error
    return data || []
}

export async function createFolder({ name, description = '', color = 'blue' }) {
    const { data, error } = await supabase
        .from('folders')
        .insert({ name, description, color })
        .select()
        .single()

    if (error) throw error
    return data
}

export async function deleteFolder(id) {
    // Check if folder has files
    const { count, error: countError } = await supabase
        .from('files')
        .select('*', { count: 'exact', head: true })
        .eq('folder_id', id)

    if (countError) throw countError
    if (count > 0) {
        throw new Error(`Folder has ${count} file(s). Move or delete the files first.`)
    }

    const { error } = await supabase.from('folders').delete().eq('id', id)
    if (error) throw error
}

// ============================================================
// File API
// ============================================================

export async function listFiles() {
    const { data, error } = await supabase
        .from('files')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)

    if (error) throw error
    return data || []
}

function detectCategory(mimeType) {
    if (!mimeType) return 'other'
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'audio'
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text') || mimeType.includes('sheet') || mimeType.includes('presentation')) return 'document'
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar') || mimeType.includes('gzip') || mimeType.includes('7z')) return 'archive'
    return 'other'
}

export async function uploadFile({ file, folderId = null, description = '', category = null, published = true }) {
    // 1. Generate safe path
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const path = `${timestamp}_${safeName}`

    const finalCategory = category || detectCategory(file.type)

    // 2. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
        .from('files')
        .upload(path, file, { contentType: file.type })

    if (uploadError) throw uploadError

    // 3. Get public URL
    const { data: publicUrlData } = supabase.storage
        .from('files')
        .getPublicUrl(path)

    const fileUrl = publicUrlData.publicUrl

    // 4. Insert metadata into DB
    const { data, error: insertError } = await supabase
        .from('files')
        .insert({
            name: file.name,
            file_url: fileUrl,
            storage_path: path,
            file_size: file.size,
            file_type: file.type,
            category: finalCategory,
            description,
            folder_id: folderId,
            published,
        })
        .select()
        .single()

    if (insertError) {
        // Rollback: delete uploaded storage file
        await supabase.storage.from('files').remove([path])
        throw insertError
    }

    return data
}

export async function updateFile(fileId, { name, description, category, published }) {
    const updates = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (category !== undefined) updates.category = category
    if (published !== undefined) updates.published = published

    const { data, error } = await supabase
        .from('files')
        .update(updates)
        .eq('id', fileId)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function deleteFile(file) {
    // 1. Delete from storage first
    if (file.storage_path) {
        const { error: storageError } = await supabase.storage
            .from('files')
            .remove([file.storage_path])
        if (storageError) console.warn('Storage delete warning:', storageError)
    }

    // 2. Delete from DB
    const { error } = await supabase.from('files').delete().eq('id', file.id)
    if (error) throw error
}

export async function updateFolder(folderId, { name, description, color }) {
    const updates = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (color !== undefined) updates.color = color

    const { data, error } = await supabase
        .from('folders')
        .update(updates)
        .eq('id', folderId)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function moveFileToFolder(fileId, folderId) {
    const { data, error } = await supabase
        .from('files')
        .update({ folder_id: folderId })
        .eq('id', fileId)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function toggleFilePublished(fileId, published) {
    const { data, error } = await supabase
        .from('files')
        .update({ published })
        .eq('id', fileId)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function handleDownload(file) {
    if (!file?.file_url) return;
    try {
        const { data, error } = await supabase.storage.from('files').download(file.storage_path);
        if (error) throw error;
        const blobUrl = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
    } catch (err) {
        console.error('Download error:', err);
        window.open(file.file_url, '_blank');
    }
}
