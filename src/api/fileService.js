import JSZip from 'jszip'
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
    // 1. Generate safe path (short hash to avoid Supabase Storage path length limit ~255 chars)
    const timestamp = Date.now()
    // Extract extension
    const extMatch = file.name.match(/\.[^.]+$/)
    const ext = extMatch ? extMatch[0] : ''
    // Short hash of filename using simple hash
    const fileNameHash = Array.from(file.name).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, timestamp).toString(36)
    const path = `${timestamp}_${fileNameHash}${ext}`

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

/**
 * 여러 파일을 하나의 ZIP으로 묶어 다운로드
 * returns: { success: boolean, count: number, error?: string }
 */
export async function downloadFilesAsZip(files, onProgress) {
    if (!files || files.length === 0) return { success: false, count: 0, error: 'No files to download' };

    const zip = new JSZip();
    const usedNames = {};
    let downloadedCount = 0;
    const total = files.length;

    for (let i = 0; i < total; i++) {
        const file = files[i];
        if (!file?.storage_path) continue;
        try {
            const { data, error } = await supabase.storage
                .from('files')
                .download(file.storage_path);
            if (error) {
                console.warn(`Failed to download ${file.name}:`, error);
                continue;
            }

            let fileName = file.name;
            if (usedNames[fileName]) {
                usedNames[fileName]++;
                const parts = fileName.split('.');
                if (parts.length > 1) {
                    const ext = parts.pop();
                    fileName = `${parts.join('.')}_${usedNames[fileName]}.${ext}`;
                } else {
                    fileName = `${fileName}_${usedNames[fileName]}`;
                }
            } else {
                usedNames[fileName] = 1;
            }

            zip.file(fileName, data);
            downloadedCount++;
        } catch (err) {
            console.warn(`Error adding ${file.name} to zip:`, err);
        }

        // Progress: 0-80% for downloads, 80-90% for zip generation
        if (onProgress) onProgress(((i + 1) / total) * 0.8);
    }

    if (downloadedCount === 0) return { success: false, count: 0, error: 'No files could be downloaded' };

    if (onProgress) onProgress(0.85);

    const blob = await zip.generateAsync({
        type: 'blob',
        // Update progress during zip generation
        onUpdate: (metadata) => {
            if (onProgress) onProgress(0.85 + metadata.percent / 100 * 0.15);
        }
    });

    if (onProgress) onProgress(1);

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'WBCS_Disk_files.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

    return { success: true, count: downloadedCount };
}
