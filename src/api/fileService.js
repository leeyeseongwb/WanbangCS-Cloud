import JSZip from 'jszip'
import { supabase } from './supabaseClient'

// ============================================================
// Folder API
// ============================================================

export async function listFolders(parentFolderId = null) {
    let query = supabase
        .from('folders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

    if (parentFolderId == null) {
        query = query.is('parent_folder_id', null)
    } else {
        query = query.eq('parent_folder_id', parentFolderId)
    }

    const { data, error } = await query

    console.log('[listFolders] parentFolderId:', parentFolderId, 'result count:', data?.length || 0);

    if (error) throw error
    return data || []
}

export async function createFolder({ name, description = '', color = 'blue', parent_folder_id = null, is_public = true }) {
    const { data, error } = await supabase
        .from('folders')
        .insert({ name, description, color, parent_folder_id, is_public })
        .select()
        .single()

    if (error) throw error
    return data
}

// Fetch ALL folders (used for visibility/privacy calculations across the whole tree)
export async function listAllFolders() {
    const { data, error } = await supabase
        .from('folders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2000)

    if (error) throw error
    return data || []
}

// Create nested folders from a relative path (e.g. "Folder A/Folder A-1/File.pdf")
// Returns the ID of the deepest folder created/found
export async function ensureFolderPath(relativePath, parentFolderId = null) {
    if (!relativePath) return parentFolderId;

    const parts = relativePath.split('/').filter(Boolean);
    if (parts.length === 0) return parentFolderId;

    // Determine folder parts (exclude the last item if it looks like a filename)
    let folderParts = parts;
    const lastPart = parts[parts.length - 1];
    if (lastPart.includes('.')) {
        folderParts = parts.slice(0, -1);
    }

    if (folderParts.length === 0) return parentFolderId;

    let currentParent = parentFolderId;

    for (const folderName of folderParts) {
        console.log('[ensureFolderPath] Creating/checking folder:', folderName, 'under parent:', currentParent);

        // Check if folder with same name already exists under current parent
        let query = supabase
            .from('folders')
            .select('id')
            .eq('name', folderName);

        if (currentParent == null) {
            query = query.is('parent_folder_id', null);
        } else {
            query = query.eq('parent_folder_id', currentParent);
        }

        const { data: existing } = await query.maybeSingle();

        if (existing?.id) {
            console.log('[ensureFolderPath] Found existing folder:', existing.id);
            currentParent = existing.id;
        } else {
            const newFolder = await createFolder({
                name: folderName,
                parent_folder_id: currentParent ?? null
            });
            console.log('[ensureFolderPath] Created new folder:', newFolder.id);
            currentParent = newFolder.id;
        }
    }

    return currentParent;
}

export async function deleteFolder(id) {
    // 1. 해당 폴더에 속한 모든 파일 삭제
    const { data: filesInFolder } = await supabase
        .from('files')
        .select('id, storage_path')
        .eq('folder_id', id)

    if (filesInFolder && filesInFolder.length > 0) {
        // Storage에서 파일 삭제
        const storagePaths = filesInFolder
            .map(f => f.storage_path)
            .filter(Boolean)

        if (storagePaths.length > 0) {
            await supabase.storage.from('files').remove(storagePaths)
        }

        // DB에서 파일 삭제
        const fileIds = filesInFolder.map(f => f.id)
        await supabase.from('files').delete().in('id', fileIds)
    }

    // 2. 폴더 삭제
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

// Custom error used to signal a user-initiated cancellation
export class UploadAbortError extends Error {
    constructor(message = 'Upload cancelled') {
        super(message);
        this.name = 'UploadAbortError';
        this.aborted = true;
    }
}

export async function uploadFile({ file, folderId = null, description = '', category = null, published = true, relativePath = null, signal = null }) {
    if (signal?.aborted) throw new UploadAbortError();
    // 1. Generate safe path (short hash to avoid Supabase Storage path length limit ~255 chars)
    const timestamp = Date.now()
    // Extract extension
    const extMatch = file.name.match(/\.[^.]+$/)
    const ext = extMatch ? extMatch[0] : ''
    // Short hash of filename using simple hash
    const fileNameHash = Array.from(file.name).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, timestamp).toString(36)
    let path = `${timestamp}_${fileNameHash}${ext}`
    let displayName = file.name

    let finalFolderId = folderId

    if (relativePath) {
      // Preserve folder structure: create nested folders and place file inside the deepest one
      finalFolderId = await ensureFolderPath(relativePath, folderId)
      displayName = relativePath.split('/').pop() || file.name   // just the filename
      const safeRel = relativePath.replace(/[^a-zA-Z0-9._/-]/g, '_')
      path = `${safeRel.replace(/\//g, '_')}_${timestamp}_${fileNameHash}${ext}`
    }

    const finalCategory = category || detectCategory(file.type)

    // 2. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
        .from('files')
        .upload(path, file, { contentType: file.type })

    if (uploadError) throw uploadError

    // If cancelled while/after uploading the binary, clean it up and abort.
    if (signal?.aborted) {
        await supabase.storage.from('files').remove([path]).catch(() => {})
        throw new UploadAbortError()
    }

    // 3. Get public URL
    const { data: publicUrlData } = supabase.storage
        .from('files')
        .getPublicUrl(path)

    const fileUrl = publicUrlData.publicUrl

    // 4. Insert metadata into DB
    const { data, error: insertError } = await supabase
        .from('files')
        .insert({
            name: displayName,
            file_url: fileUrl,
            storage_path: path,
            file_size: file.size,
            file_type: file.type,
            category: finalCategory,
            description,
            folder_id: finalFolderId,
            published,
        })
        .select()
        .single()

    if (insertError) {
        // Rollback: delete uploaded storage file
        await supabase.storage.from('files').remove([path])
        throw insertError
    }

    // If cancelled right after the metadata row was created, remove both the
    // storage object and the DB row so nothing is left behind.
    if (signal?.aborted) {
        await supabase.from('files').delete().eq('id', data.id).catch(() => {})
        await supabase.storage.from('files').remove([path]).catch(() => {})
        throw new UploadAbortError()
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

export async function updateFolder(folderId, { name, description, color, is_public }) {
    const updates = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (color !== undefined) updates.color = color
    if (is_public !== undefined) updates.is_public = is_public

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
 * 폴더 트리에서, 주어진 rootFolder 이하 모든 폴더에 대해
 * "rootFolder 기준 상대 경로"를 매핑한 객체를 반환.
 * 예) { [rootFolderId]: "", [childId]: "Folder 1-a", [grandChildId]: "Folder 1-a/inner" }
 *
 * allFolders: listAllFolders()로 가져온 전체 폴더 배열
 */
export function buildFolderPathMap(allFolders, rootFolder) {
    const byParent = new Map();
    for (const f of allFolders) {
        const key = f.parent_folder_id || null;
        if (!byParent.has(key)) byParent.set(key, []);
        byParent.get(key).push(f);
    }

    const pathMap = {};
    const sanitize = (name) => (name || 'Untitled').replace(/[\\/:*?"<>|]/g, '_').trim() || 'Untitled';

    // The root folder itself maps to "" so its direct files sit at the zip root.
    const walk = (folder, prefix) => {
        pathMap[folder.id] = prefix;
        const children = byParent.get(folder.id) || [];
        for (const child of children) {
            const childPath = prefix ? `${prefix}/${sanitize(child.name)}` : sanitize(child.name);
            walk(child, childPath);
        }
    };

    walk(rootFolder, '');
    return pathMap;
}

export class DownloadAbortError extends Error {
    constructor(message = 'Download cancelled') {
        super(message);
        this.name = 'DownloadAbortError';
        this.aborted = true;
    }
}

/**
 * 여러 파일을 하나의 ZIP으로 묶어 다운로드
 *
 * @param {Array} files               파일 목록
 * @param {Function} onProgress       (0~1) 진행률 콜백
 * @param {Object} options
 * @param {AbortSignal} options.signal      취소 신호 (X 버튼)
 * @param {Function} options.pathFor        (file) => "Folder/Sub/file.ext" 형태의 ZIP 내부 경로
 * @param {String} options.zipName          저장될 zip 파일 이름
 * returns: { success: boolean, count: number, error?: string, aborted?: boolean }
 */
export async function downloadFilesAsZip(files, onProgress, options = {}) {
    const { signal = null, pathFor = null, zipName = 'WBCS_Disk_files.zip' } = options;

    if (!files || files.length === 0) return { success: false, count: 0, error: 'No files to download' };

    const zip = new JSZip();
    const usedNames = {};
    let downloadedCount = 0;
    const total = files.length;

    const ensureUniquePath = (rawPath) => {
        if (!usedNames[rawPath]) {
            usedNames[rawPath] = 1;
            return rawPath;
        }
        usedNames[rawPath]++;
        const slash = rawPath.lastIndexOf('/');
        const dir = slash === -1 ? '' : rawPath.slice(0, slash + 1);
        const base = slash === -1 ? rawPath : rawPath.slice(slash + 1);
        const dot = base.lastIndexOf('.');
        if (dot > 0) {
            return `${dir}${base.slice(0, dot)}_${usedNames[rawPath]}${base.slice(dot)}`;
        }
        return `${dir}${base}_${usedNames[rawPath]}`;
    };

    for (let i = 0; i < total; i++) {
        if (signal?.aborted) return { success: false, count: 0, aborted: true, error: 'Download cancelled' };

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

            // Build the path inside the zip. When pathFor is provided we keep the
            // original folder structure (e.g. "Folder 1-a/File 1").
            let zipPath = pathFor ? pathFor(file) : file.name;
            zipPath = ensureUniquePath(zipPath);

            zip.file(zipPath, data);
            downloadedCount++;
        } catch (err) {
            console.warn(`Error adding ${file.name} to zip:`, err);
        }

        // Progress: 0-80% for downloads, 80-90% for zip generation
        if (onProgress) onProgress(((i + 1) / total) * 0.8);
    }

    if (signal?.aborted) return { success: false, count: 0, aborted: true, error: 'Download cancelled' };
    if (downloadedCount === 0) return { success: false, count: 0, error: 'No files could be downloaded' };

    if (onProgress) onProgress(0.85);

    const blob = await zip.generateAsync({
        type: 'blob',
        // Update progress during zip generation
        onUpdate: (metadata) => {
            if (onProgress) onProgress(0.85 + metadata.percent / 100 * 0.15);
        }
    });

    if (signal?.aborted) return { success: false, count: 0, aborted: true, error: 'Download cancelled' };
    if (onProgress) onProgress(1);

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = zipName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

    return { success: true, count: downloadedCount };
}
