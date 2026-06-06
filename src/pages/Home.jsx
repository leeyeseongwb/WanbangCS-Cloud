import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSession, clearSession } from "@/lib/auth";
import { listFiles, listFolders, listAllFolders, buildFolderPathMap, deleteFolder, deleteFile, updateFolder, moveFileToFolder, handleDownload, downloadFilesAsZip } from "@/api/fileService";
import { supabase } from "@/api/supabaseClient";
import Sidebar from "@/components/Sidebar";
import MobileSidebar from "@/components/MobileSidebar";
import SearchBar from "@/components/SearchBar";
import FileCard from "@/components/FileCard";
import FolderCard from "@/components/FolderCard";
import UploadDialog from "@/components/UploadDialog";
import CreateFolderDialog from "@/components/CreateFolderDialog";
import EditFileDialog from "@/components/EditFileDialog";
import EditFolderDialog from "@/components/EditFolderDialog";
import FolderInfoDialog from "@/components/FolderInfoDialog";
import EmptyState from "@/components/EmptyState";
import DarkModeToggle from "@/components/DarkModeToggle";
import ViewToggle from "@/components/ViewToggle";
import ContextMenu from "@/components/ContextMenu";
import {
  Loader2, HardDrive, ChevronRight, Home as HomeIcon, Upload, Download, X, Trash2, Pencil, ArrowUpDown, ChevronLeft, ChevronRight as ChevronRightIcon, Info, Lock, Globe
} from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 20;

// Background task tracking via window events (with safe fallback)
let _taskId = 0;
const addTask = (type, title) => {
  const id = ++_taskId;
  if (typeof window.addTask === 'function') return window.addTask(type, title);
  window.dispatchEvent(new CustomEvent('task:add', { detail: { id, type, title, progress: 0, status: "running" } }));
  return id;
};
const updateTask = (id, updates) => {
  if (typeof window.updateTask === 'function') { window.updateTask(id, updates); return; }
  window.dispatchEvent(new CustomEvent('task:update', { detail: { id, ...updates } }));
};
const removeTask = (id) => {
  if (typeof window.removeTask === 'function') { window.removeTask(id); return; }
  window.dispatchEvent(new CustomEvent('task:remove', { detail: { id } }));
};

export default function Home() {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editFileOpen, setEditFileOpen] = useState(false);
  const [editFolderOpen, setEditFolderOpen] = useState(false);
  const [folderInfoOpen, setFolderInfoOpen] = useState(false);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [view, setView] = useState("grid");
  const [dragOverFolderId, setDragOverFolderId] = useState(null);
  const [globalDragOver, setGlobalDragOver] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState(null);
  const dragCounterRef = useRef(0);

// Drag box selection (viewport-based for accuracy)
const [dragBox, setDragBox] = useState(null);
const dragBoxRef = useRef(null);
const dragStartRef = useRef(null);

// Sorting
const [sortBy, setSortBy] = useState("created_at");
const [sortOrder, setSortOrder] = useState("desc");

// Pagination
const [currentPage, setCurrentPage] = useState(1);

// Multi-select
const [selectedIds, setSelectedIds] = useState(new Set());
const selectedIdsRef = useRef(selectedIds);        
useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]); 
  const [lastSelectedId, setLastSelectedId] = useState(null);
  const toggleSelect = useCallback((id, shiftKey) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (shiftKey && lastSelectedId) {
        // Find all file IDs in current view
        const idsInView = filteredFileIds;
        const idx1 = idsInView.indexOf(lastSelectedId);
        const idx2 = idsInView.indexOf(id);
        if (idx1 !== -1 && idx2 !== -1) {
          const [start, end] = idx1 < idx2 ? [idx1, idx2] : [idx2, idx1];
          for (let i = start; i <= end; i++) {
            next.add(idsInView[i]);
          }
          return next;
        }
      }
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setLastSelectedId(id);
  }, [lastSelectedId]);
  const clearSelection = useCallback(() => { setSelectedIds(new Set()); setLastSelectedId(null); }, []);

  const [editingFile, setEditingFile] = useState(null);
  const [editingFolder, setEditingFolder] = useState(null);
  const [infoFolder, setInfoFolder] = useState(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState(null);
  const openContextMenu = useCallback((e, items) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }, []);
  const closeContextMenu = () => setContextMenu(null);

  // Manager session
  const [session, setSession] = useState(() => getSession());
  const isManager = !!session;
  const managerName = session?.username || "";

  const queryClient = useQueryClient();

  const { data: files = [], isLoading: loadingFiles } = useQuery({
    queryKey: ["files"],
    queryFn: listFiles,
  });

  const { data: folders = [], isLoading: loadingFolders } = useQuery({
    queryKey: ["folders", currentFolder?.id || null],
    queryFn: () => listFolders(currentFolder?.id || null),
  });

  // 모든 폴더를 가져와서 파일 필터링 / private 처리 / 폴더 다운로드 경로 계산에 사용
  const { data: allFolders = [] } = useQuery({
    queryKey: ["allFolders"],
    queryFn: listAllFolders,
    staleTime: 1000 * 60,
  });

  const isLoading = loadingFiles || loadingFolders;

  // ── Private 폴더 처리 ───────────────────────────────────────────────
  // private 폴더 자신과 그 하위 폴더 전체의 ID 집합을 계산한다.
  // 일반 사용자(비매니저)에게는 이 집합에 속한 폴더와 파일이 모두 숨겨진다.
  const hiddenFolderIds = useMemo(() => {
    const hidden = new Set();
    if (isManager) return hidden; // 매니저는 모두 볼 수 있음

    // parent -> children 맵
    const byParent = new Map();
    for (const f of allFolders) {
      const key = f.parent_folder_id || "root";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(f);
    }
    const markSubtree = (folderId) => {
      hidden.add(folderId);
      const children = byParent.get(folderId) || [];
      for (const c of children) markSubtree(c.id);
    };
    for (const f of allFolders) {
      if (f.is_public === false) markSubtree(f.id);
    }
    return hidden;
  }, [allFolders, isManager]);

  // Filtered & sorted files
  const filteredFiles = useMemo(() => {
    let result = files;
    if (!isManager) result = result.filter((f) => f.published !== false);
    // private 폴더(및 그 하위)에 속한 파일은 일반 사용자에게 숨김
    if (!isManager && hiddenFolderIds.size > 0) {
      result = result.filter((f) => !f.folder_id || !hiddenFolderIds.has(f.folder_id));
    }
    if (currentFolder) {
      result = result.filter((f) => f.folder_id === currentFolder.id);
    } else if (!search.trim()) {
      // 중첩 폴더 지원: folder_id가 있으면(어떤 폴더에 속해있으면) 루트에서 숨김
      result = result.filter((f) => !f.folder_id);
    }
    if (category !== "all") {
      result = result.filter((f) => f.category === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = files.filter(
        (f) => (isManager || f.published !== false) &&
          (isManager || !f.folder_id || !hiddenFolderIds.has(f.folder_id)) &&
          (f.name?.toLowerCase().includes(q) || f.description?.toLowerCase().includes(q))
      );
    }
    // Sort
    result.sort((a, b) => {
      let valA = a[sortBy] || "";
      let valB = b[sortBy] || "";
      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [files, folders, currentFolder, category, search, isManager, sortBy, sortOrder, hiddenFolderIds]);

  const filteredFileIds = useMemo(() => filteredFiles.map(f => f.id), [filteredFiles]);

  const visibleFolders = useMemo(() => {
    if (search.trim()) return [];
    // 일반 사용자에게는 private 폴더(및 하위)를 숨김
    if (!isManager && hiddenFolderIds.size > 0) {
      return folders.filter((f) => !hiddenFolderIds.has(f.id));
    }
    return folders; // folders query already filters by currentFolder
  }, [folders, search, isManager, hiddenFolderIds]);

  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / PAGE_SIZE));
  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredFiles.slice(start, start + PAGE_SIZE);
  }, [filteredFiles, currentPage]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [search, category, currentFolder, sortBy, sortOrder]);

  const fileCountForFolder = (folderId) => files.filter((f) => f.folder_id === folderId).length;
  const folderTotalSize = (folderId) => files.filter((f) => f.folder_id === folderId).reduce((sum, f) => sum + (f.file_size || 0), 0);

  const handleFileContextMenu = useCallback((e, file) => {
    const items = [
      { icon: Download, label: "Download", onClick: () => handleDownload(file) },
    ];
    if (isManager) {
      items.push(
        { icon: Pencil, label: "Edit", onClick: () => { setEditingFile(file); setEditFileOpen(true); } },
        { icon: Trash2, label: "Delete", onClick: () => handleDeleteFile(file) },
      );
    }
    openContextMenu(e, items);
  }, [openContextMenu, isManager]);

  const handleFolderContextMenu = useCallback((e, folder) => {
    const items = [
      { icon: Info, label: "Folder Info", onClick: () => { setInfoFolder(folder); setFolderInfoOpen(true); } },
      {
        icon: Download,
        label: `Download folder (ZIP)`,
        onClick: () => handleFolderDownload(folder),
      },
    ];
    if (isManager) {
      items.push(
        {
          icon: folder.is_public === false ? Globe : Lock,
          label: folder.is_public === false ? "Make Public" : "Make Private",
          onClick: () => handleToggleFolderVisibility(folder),
        },
        { icon: Pencil, label: "Edit Folder", onClick: () => { setEditingFolder(folder); setEditFolderOpen(true); } },
        { icon: Trash2, label: "Delete Folder", onClick: () => handleDeleteFolder(folder) },
      );
    }
    openContextMenu(e, items);
  }, [files, openContextMenu, isManager]);

  const handleToggleFolderVisibility = async (folder) => {
    const next = !(folder.is_public !== false); // toggle
    try {
      await updateFolder(folder.id, { is_public: next });
      toast.success(next ? "Folder is now Public" : "Folder is now Private");
      invalidateAll();
    } catch (err) {
      console.error("Toggle folder visibility failed:", err);
      // Most common cause: the is_public column hasn't been added to the DB yet.
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("is_public") || msg.includes("column") || err?.code === "PGRST204" || err?.code === "42703") {
        toast.error('DB missing "is_public" column. Run: ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;');
      } else {
        toast.error(err.message || "Failed to update folder visibility");
      }
    }
  };

  const handleDeleteFile = async (file) => {
    try {
      await deleteFile(file);
      toast.success("File deleted");
      queryClient.invalidateQueries({ queryKey: ["files"] });
      clearSelection();
    } catch (err) {
      toast.error(err.message || "Failed to delete file");
    }
  };

  const handleBulkDelete = async () => {
    const toDelete = filteredFiles.filter(f => selectedIds.has(f.id));
    if (toDelete.length === 0) return;
    if (!confirm(`Delete ${toDelete.length} file(s)? This cannot be undone.`)) return;
    const taskId = addTask("delete", `Deleting ${toDelete.length} file(s)`);
    let done = 0;
    for (const file of toDelete) {
      try { await deleteFile(file); } catch (e) { console.warn(e); }
      done++;
      updateTask(taskId, { progress: Math.round((done / toDelete.length) * 100) });
    }
    updateTask(taskId, { progress: 100, status: "done" });
    toast.success(`${toDelete.length} file(s) deleted`);
    setTimeout(() => removeTask(taskId), 2000);
    queryClient.invalidateQueries({ queryKey: ["files"] });
    clearSelection();
  };

  const handleDeleteFolder = async (folder) => {
    const count = fileCountForFolder(folder.id);
    if (count > 0) { toast.error(`Folder has ${count} file(s). Move or delete them first.`); return; }
    try {
      await deleteFolder(folder.id);
      toast.success("Folder deleted");
      queryClient.invalidateQueries({ queryKey: ["folders"] });
    } catch (err) {
      toast.error(err.message || "Failed to delete folder");
    }
  };

  // 재귀적으로 모든 하위 폴더 ID 수집
  const getAllSubfolderIds = useCallback(async (parentId) => {
    const ids = [parentId];
    const { data: children } = await supabase
      .from('folders')
      .select('id')
      .eq('parent_folder_id', parentId);

    if (children) {
      for (const child of children) {
        const childIds = await getAllSubfolderIds(child.id);
        ids.push(...childIds);
      }
    }
    return ids;
  }, []);

  // 폴더 전체 다운로드 (하위 폴더 구조 그대로 유지, 취소 가능)
  const handleFolderDownload = async (folder) => {
    try {
      // 0. 최신 폴더 트리 확보 (allFolders가 비어있을 수 있으니 안전하게 보강)
      let folderTree = allFolders;
      if (!folderTree || folderTree.length === 0) {
        folderTree = await listAllFolders();
      }

      // 1. 해당 폴더 + 모든 하위 폴더의 ID → 상대경로 매핑
      const pathMap = buildFolderPathMap(folderTree, folder);
      const allFolderIds = Object.keys(pathMap);

      // 2. 매니저가 아니면 private 폴더(및 하위)는 제외
      const includedIds = isManager
        ? allFolderIds
        : allFolderIds.filter((id) => !hiddenFolderIds.has(id));
      const includedSet = new Set(includedIds);

      // 3. 해당 폴더들에 속한 파일 수집 (비매니저는 published 파일만)
      const folderFiles = files.filter((f) =>
        includedSet.has(f.folder_id) && (isManager || f.published !== false)
      );

      if (folderFiles.length === 0) {
        toast.info("This folder has no files.");
        return;
      }

      // 4. ZIP 내부 경로 결정 함수 (하위 폴더 구조 유지)
      const safeName = (name) => (name || "file").replace(/[\\/:*?"<>|]/g, "_");
      const pathFor = (file) => {
        const dir = pathMap[file.folder_id] || "";
        const fname = safeName(file.name);
        return dir ? `${dir}/${fname}` : fname;
      };

      const controller = new AbortController();
      const taskId = addTask("download", `Downloading folder "${folder.name}"`);
      updateTask(taskId, { onCancel: () => controller.abort() });

      const result = await downloadFilesAsZip(
        folderFiles,
        (progress) => updateTask(taskId, { progress: Math.round(progress * 100) }),
        { signal: controller.signal, pathFor, zipName: `${safeName(folder.name)}.zip` }
      );

      if (result.success) {
        updateTask(taskId, { progress: 100, status: "done" });
        toast.success(`Downloaded folder "${folder.name}" (${result.count} files)`);
        setTimeout(() => removeTask(taskId), 2000);
      } else if (result.aborted) {
        removeTask(taskId);
        toast.info("Download cancelled");
      } else {
        updateTask(taskId, { status: "error", error: result.error });
        toast.error(result.error || 'Download failed');
        setTimeout(() => removeTask(taskId), 2500);
      }
    } catch (err) {
      console.error(err);
      toast.error("Folder download failed");
    }
  };

  const handleBulkDownload = async () => {
    const toDownload = filteredFiles.filter(f => selectedIds.has(f.id));
    if (toDownload.length === 0) return;
    clearSelection();

    if (toDownload.length === 1) {
      try {
        await handleDownload(toDownload[0]);
        toast.success(`Downloaded ${toDownload[0].name}`);
      } catch (e) { console.warn(e); toast.error('Download failed'); }
      return;
    }

    const controller = new AbortController();
    const taskId = addTask("download", `Downloading ${toDownload.length} file(s) as ZIP`);
    updateTask(taskId, { onCancel: () => controller.abort() });
    try {
      if (typeof downloadFilesAsZip !== 'function') { toast.error('Download function not available'); removeTask(taskId); return; }
      const result = await downloadFilesAsZip(
        toDownload,
        (progress) => updateTask(taskId, { progress: Math.round(progress * 100) }),
        { signal: controller.signal }
      );
      if (result.success) {
        updateTask(taskId, { progress: 100, status: "done" });
        toast.success(`Downloaded ${result.count} file(s) as ZIP`);
        setTimeout(() => removeTask(taskId), 2000);
      } else if (result.aborted) {
        removeTask(taskId);
        toast.info("Download cancelled");
      } else {
        updateTask(taskId, { status: "error", error: result.error });
        toast.error(result.error || 'ZIP download failed');
        setTimeout(() => removeTask(taskId), 2500);
      }
    } catch (err) {
      updateTask(taskId, { status: "error", error: err.message });
      toast.error("ZIP download failed");
    }
  };

  const handleCategoryChange = (cat) => {
    setCategory(cat); setCurrentFolder(null); setSearch(""); clearSelection();
  };

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["files"] });
    queryClient.invalidateQueries({ queryKey: ["folders"] });
    // Also invalidate any nested folder queries
    queryClient.invalidateQueries({ queryKey: ["folders"], exact: false });
    queryClient.invalidateQueries({ queryKey: ["allFolders"] });
  }, [queryClient]);

  const handleLogout = () => {
    clearSession();
    setSession(null);
    toast.success("Logged out");
  };

  // Drag & drop handlers
  const handleDragStart = useCallback((e, file) => {
    const idsToMove = selectedIds.has(file.id) && selectedIds.size > 1
      ? Array.from(selectedIds)
      : [file.id];
    e.dataTransfer.setData("fileIds", JSON.stringify(idsToMove));
    e.dataTransfer.effectAllowed = "move";
  }, [selectedIds]);

  const handleDragOver = useCallback((e, folderId) => {
    e.preventDefault();
    setDragOverFolderId(folderId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverFolderId(null);
  }, []);

  const handleDrop = useCallback(async (e, targetFolder) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const raw = e.dataTransfer.getData("fileIds");
    if (!raw) return;
    let ids = [];
    try { ids = JSON.parse(raw); } catch { ids = [raw]; }
    if (!ids.length) return;
    try {
      for (const fileId of ids) {
        await moveFileToFolder(fileId, targetFolder.id);
      }
      toast.success(`Moved ${ids.length} file(s) to "${targetFolder.name}"`);
      invalidateAll();
    } catch (err) {
      toast.error(err.message || "Failed to move file(s)");
    }
  }, [invalidateAll]);

  // Drag box selection handler
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0 || e.target.closest('[data-selectable]') || e.target.closest('button') || e.target.closest('a') || e.target.closest('[role="menu"]')) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    dragStartRef.current = { x: startX, y: startY };
    dragBoxRef.current = { left: startX, top: startY, width: 0, height: 0 };
    setDragBox({ left: startX, top: startY, width: 0, height: 0 });

    const handleMouseMove = (moveEvent) => {
      if (!dragStartRef.current) return;
      const currentX = moveEvent.clientX;
      const currentY = moveEvent.clientY;
      const box = {
        left: Math.min(dragStartRef.current.x, currentX),
        top: Math.min(dragStartRef.current.y, currentY),
        width: Math.abs(currentX - dragStartRef.current.x),
        height: Math.abs(currentY - dragStartRef.current.y),
      };
      dragBoxRef.current = box;
      setDragBox(box);
    };

    const handleMouseUp = () => {
      const box = dragBoxRef.current;
      if (box && box.width > 5 && box.height > 5) {
        const selectableEls = document.querySelectorAll('[data-selectable]');
        const newSelected = new Set(selectedIdsRef.current || []);
        selectableEls.forEach((el) => {
          const elRect = el.getBoundingClientRect();
          if (
            elRect.left < box.left + box.width &&
            elRect.right > box.left &&
            elRect.top < box.top + box.height &&
            elRect.bottom > box.top
          ) {
            const id = el.dataset.id;
            if (id) newSelected.add(id);
          }
        });
        setSelectedIds(newSelected);
      }
      dragStartRef.current = null;
      dragBoxRef.current = null;
      setDragBox(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  const showEmpty = !isLoading && visibleFolders.length === 0 && filteredFiles.length === 0;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
      if (isInput) return;

      // Cmd/Ctrl + A: Select all visible files
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const allIds = filteredFileIds;
        setSelectedIds(new Set(allIds));
        if (allIds.length > 0) setLastSelectedId(allIds[allIds.length - 1]);
      }
      // Delete: Delete selected files (manager only)
      if (e.key === 'Delete' && isManager && selectedIds.size > 0) {
        e.preventDefault();
        handleBulkDelete();
      }
      // Escape: Clear selection
      if (e.key === 'Escape' && selectedIds.size > 0) {
        e.preventDefault();
        clearSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredFileIds, isManager, selectedIds.size, clearSelection, handleBulkDelete]);

  // Global drag-and-drop for managers
  const handleGlobalDragEnter = (e) => {
    if (!isManager) return;
    if (!e.dataTransfer.types.includes("Files")) return;
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) setGlobalDragOver(true);
  };
  const handleGlobalDragLeave = () => {
    if (!isManager) return;
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setGlobalDragOver(false); }
  };
  const handleGlobalDrop = (e) => {
    if (!isManager) return;
    e.preventDefault();
    dragCounterRef.current = 0;
    setGlobalDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) { setDroppedFiles(files); setUploadOpen(true); }
  };
  const handleGlobalDragOver = (e) => { if (isManager && e.dataTransfer.types.includes("Files")) e.preventDefault(); };

  const handleCategoryChangeWithReset = (cat) => { clearSelection(); handleCategoryChange(cat); };

  const sidebarProps = {
    activeCategory: category,
    onCategoryChange: handleCategoryChangeWithReset,
    onUploadClick: () => setUploadOpen(true),
    onNewFolderClick: () => setFolderDialogOpen(true),
    isManager,
    managerName,
    onLoginClick: () => window.location.href = '/login',
    onLogout: handleLogout,
  };

  return (
    <div
      className="min-h-screen bg-background relative"
      onDragEnter={handleGlobalDragEnter}
      onDragLeave={handleGlobalDragLeave}
      onDragOver={handleGlobalDragOver}
      onDrop={handleGlobalDrop}
    >
      {/* Global drop overlay */}
      {globalDragOver && isManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm border-4 border-dashed border-primary rounded-none pointer-events-none">
          <div className="bg-card rounded-2xl px-10 py-8 shadow-2xl flex flex-col items-center gap-3 border border-primary/30">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <p className="text-xl font-semibold">Drop to upload</p>
            <p className="text-sm text-muted-foreground">Release to add this file to WBCS Cloud</p>
          </div>
        </div>
      )}
      {/* Context menu */}
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={closeContextMenu} />
      )}

      <div className="hidden lg:block">
        <Sidebar {...sidebarProps} />
      </div>

      <main className="lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
          <MobileSidebar {...sidebarProps} />
          <SearchBar value={search} onChange={(v) => { setSearch(v); setCurrentPage(1); }} />
          <div className="ml-auto flex items-center gap-2">
            {/* Sort toggle */}
            <button
              onClick={() => {
                if (sortBy === "name") setSortOrder(prev => prev === "asc" ? "desc" : "asc");
                else { setSortBy("name"); setSortOrder("asc"); }
              }}
              className={`hidden sm:flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${sortBy === "name" ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground hover:bg-secondary"}`}
            >
              <ArrowUpDown className="h-3 w-3" />
              Name
            </button>
            <button
              onClick={() => {
                if (sortBy === "created_at") setSortOrder(prev => prev === "asc" ? "desc" : "asc");
                else { setSortBy("created_at"); setSortOrder("desc"); }
              }}
              className={`hidden sm:flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${sortBy === "created_at" ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground hover:bg-secondary"}`}
            >
              <ArrowUpDown className="h-3 w-3" />
              Date
            </button>
            <button
              onClick={() => {
                if (sortBy === "file_size") setSortOrder(prev => prev === "asc" ? "desc" : "asc");
                else { setSortBy("file_size"); setSortOrder("desc"); }
              }}
              className={`hidden sm:flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${sortBy === "file_size" ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground hover:bg-secondary"}`}
            >
              <ArrowUpDown className="h-3 w-3" />
              Size
            </button>
            <ViewToggle view={view} onChange={setView} />
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground bg-secondary/60 px-3 py-1.5 rounded-full">
              <HardDrive className="h-3.5 w-3.5" />
              {files.length} files
            </div>
            <DarkModeToggle className="lg:hidden" />
          </div>
        </header>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="sticky top-[73px] z-10 bg-primary text-primary-foreground px-4 sm:px-6 lg:px-8 py-2.5 flex items-center gap-3">
            <span className="text-sm font-medium">{selectedIds.size} file{selectedIds.size !== 1 ? "s" : ""} selected</span>
            <button
              onClick={handleBulkDownload}
              className="flex items-center gap-1.5 bg-primary-foreground/20 hover:bg-primary-foreground/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
            {isManager && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 bg-destructive/80 hover:bg-destructive px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            )}
            <button onClick={clearSelection} className="ml-auto p-1.5 rounded-lg hover:bg-primary-foreground/20 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="px-4 sm:px-6 lg:px-8 py-6 select-none" onMouseDown={handleMouseDown}>
          {/* Drag selection box (viewport-based, fixed position) */}
          {dragBox && (
            <div
              className="fixed border-2 border-primary bg-primary/10 pointer-events-none z-50 rounded-md"
              style={{
                left: dragBox.left,
                top: dragBox.top,
                width: dragBox.width,
                height: dragBox.height,
              }}
            />
          )}

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm mb-5">
            <button
              onClick={() => { setCurrentFolder(null); clearSelection(); }}
              className={`flex items-center gap-1 hover:text-primary transition-colors ${!currentFolder ? "text-foreground font-medium" : "text-muted-foreground"}`}
            >
              <HomeIcon className="h-3.5 w-3.5" />
              WBCS Cloud
            </button>
            {currentFolder && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-foreground font-medium">{currentFolder.name}</span>
              </>
            )}
          </div>

          {/* Heading */}
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold font-heading">
                {search ? `Results for "${search}"` : currentFolder ? currentFolder.name : category === "all" ? "All Files" : category.charAt(0).toUpperCase() + category.slice(1) + "s"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {!search && !currentFolder && visibleFolders.length > 0 && (
                  <span>{visibleFolders.length} folder{visibleFolders.length !== 1 ? "s" : ""} · </span>
                )}
                {filteredFiles.length} file{filteredFiles.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Folders */}
              {visibleFolders.length > 0 && (
                <div className="mb-8">
                  {view !== "list" && (
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Folders</p>
                  )}
                  {view === "list" ? (
                    <div className="rounded-xl overflow-hidden border border-border">
                      {visibleFolders.map((folder) => (
                        <FolderCard
                          key={folder.id}
                          folder={folder}
                          fileCount={fileCountForFolder(folder.id)}
                          onClick={() => { clearSelection(); setCurrentFolder(folder); setCategory("all"); }}
                          onDelete={isManager ? handleDeleteFolder : undefined}
                          onEdit={isManager ? () => { setEditingFolder(folder); setEditFolderOpen(true); } : undefined}
                          onToggleVisibility={isManager ? handleToggleFolderVisibility : undefined}
                          isManager={isManager}
                          view="list"
                          onDragOver={(e) => handleDragOver(e, folder.id)}
                          onDrop={(e) => handleDrop(e, folder)}
                          onContextMenu={handleFolderContextMenu}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className={`grid gap-4 ${view === "compact" ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"}`}>
                      {visibleFolders.map((folder) => (
                        <div
                          key={folder.id}
                          onDragLeave={handleDragLeave}
                          className={dragOverFolderId === folder.id ? "ring-2 ring-primary rounded-2xl" : ""}
                        >
                          <FolderCard
                            folder={folder}
                            fileCount={fileCountForFolder(folder.id)}
                            onClick={() => { clearSelection(); setCurrentFolder(folder); setCategory("all"); }}
                            onDelete={isManager ? handleDeleteFolder : undefined}
                            onEdit={isManager ? () => { setEditingFolder(folder); setEditFolderOpen(true); } : undefined}
                            onDownload={handleFolderDownload}
                            onToggleVisibility={isManager ? handleToggleFolderVisibility : undefined}
                            isManager={isManager}
                            view={view}
                            onDragOver={(e) => handleDragOver(e, folder.id)}
                            onDrop={(e) => handleDrop(e, folder)}
                            onContextMenu={handleFolderContextMenu}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Files */}
              {paginatedFiles.length > 0 && (
                <div>
                  {view !== "list" && visibleFolders.length > 0 && (
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Files</p>
                  )}
                  {view === "list" ? (
                    <div className="rounded-xl overflow-hidden border border-border">
                      {/* List header */}
                      <div className="flex items-center gap-3 px-4 py-2 bg-secondary/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        <div className="w-8 flex-shrink-0" />
                        <div className="flex-1">Name</div>
                        <div className="w-20 text-right flex-shrink-0">Size</div>
                        <div className="w-28 text-right flex-shrink-0 hidden sm:block">Date</div>
                        <div className="w-8 flex-shrink-0" />
                      </div>
                      {paginatedFiles.map((file) => (
                        <FileCard key={file.id} file={file} view="list" isManager={isManager} onDragStart={handleDragStart} onContextMenu={handleFileContextMenu} selected={selectedIds.has(file.id)} onSelect={(id, shift) => toggleSelect(id, shift)} />
                      ))}
                    </div>
                  ) : (
                    <div className={`grid gap-4 ${view === "compact" ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"}`}>
                      {paginatedFiles.map((file) => (
                        <FileCard key={file.id} file={file} view={view} isManager={isManager} onDragStart={handleDragStart} onContextMenu={handleFileContextMenu} selected={selectedIds.has(file.id)} onSelect={(id, shift) => toggleSelect(id, shift)} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-border hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-border hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>
              )}

              {showEmpty && (
                <EmptyState message={search ? `No files match "${search}"` : currentFolder ? "This folder is empty" : "No files here yet"} />
              )}
            </>
          )}
        </div>
      </main>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={(val) => { setUploadOpen(val); if (!val) setDroppedFiles(null); }}
        onUploaded={invalidateAll}
        currentFolderId={currentFolder?.id || null}
        initialFiles={droppedFiles}
      />
      <CreateFolderDialog
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        onCreated={invalidateAll}
      />
      <EditFileDialog
        open={editFileOpen}
        onOpenChange={setEditFileOpen}
        file={editingFile}
        onUpdated={invalidateAll}
      />
      <EditFolderDialog
        open={editFolderOpen}
        onOpenChange={setEditFolderOpen}
        folder={editingFolder}
        onUpdated={invalidateAll}
      />
      <FolderInfoDialog
        open={folderInfoOpen}
        onOpenChange={setFolderInfoOpen}
        folder={infoFolder}
        fileCount={infoFolder ? fileCountForFolder(infoFolder.id) : 0}
        totalSize={infoFolder ? folderTotalSize(infoFolder.id) : 0}
      />
    </div>
  );
}
