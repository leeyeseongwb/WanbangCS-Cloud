import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { getSession, clearSession } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import MobileSidebar from "@/components/MobileSidebar";
import SearchBar from "@/components/SearchBar";
import FileCard, { handleDownload } from "@/components/FileCard";
import FolderCard from "@/components/FolderCard";
import UploadDialog from "@/components/UploadDialog";
import CreateFolderDialog from "@/components/CreateFolderDialog";
import EmptyState from "@/components/EmptyState";
import DarkModeToggle from "@/components/DarkModeToggle";
import ViewToggle from "@/components/ViewToggle";
import ContextMenu from "@/components/ContextMenu";
import AuthPage from "./AuthPage";
import { Loader2, HardDrive, ChevronRight, Home as HomeIcon, Upload, Download, X } from "lucide-react";
import { toast } from "sonner";

export default function Home() {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [view, setView] = useState("grid"); // "grid" | "list" | "compact"
  const [showAuth, setShowAuth] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState(null);
  const [globalDragOver, setGlobalDragOver] = useState(false);
  const [droppedFile, setDroppedFile] = useState(null);
  const dragCounterRef = useState(0);

  // Multi-select
  const [selectedIds, setSelectedIds] = useState(new Set());
  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const clearSelection = () => setSelectedIds(new Set());

  // Context menu
  const [contextMenu, setContextMenu] = useState(null); // { x, y, items }
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
    queryFn: () => base44.entities.File.list("-created_date", 500),
  });

  const { data: folders = [], isLoading: loadingFolders } = useQuery({
    queryKey: ["folders"],
    queryFn: () => base44.entities.Folder.list("-created_date", 200),
  });

  const isLoading = loadingFiles || loadingFolders;

  const visibleFolders = useMemo(() => {
    if (search.trim() || currentFolder) return [];
    return folders;
  }, [folders, currentFolder, search]);

  const filteredFiles = useMemo(() => {
    let result = files;
    // Non-managers cannot see hidden files
    if (!isManager) result = result.filter((f) => f.published !== false);
    if (currentFolder) {
      result = result.filter((f) => f.folder_id === currentFolder.id);
    } else if (!search.trim()) {
      const folderIds = new Set(folders.map((f) => f.id));
      result = result.filter((f) => !f.folder_id || !folderIds.has(f.folder_id));
    }
    if (category !== "all") {
      result = result.filter((f) => f.category === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = files.filter(
        (f) => (isManager || f.published !== false) &&
          (f.name?.toLowerCase().includes(q) || f.description?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [files, folders, currentFolder, category, search, isManager]);

  const fileCountForFolder = (folderId) => files.filter((f) => f.folder_id === folderId).length;

  const handleFileContextMenu = useCallback((e, file) => {
    openContextMenu(e, [
      { icon: Download, label: "Download", onClick: () => handleDownload(file) },
    ]);
  }, [openContextMenu]);

  const handleFolderContextMenu = useCallback((e, folder) => {
    const folderFiles = files.filter(f => f.folder_id === folder.id);
    openContextMenu(e, [
      {
        icon: Download,
        label: `Download all files (${folderFiles.length})`,
        onClick: () => {
          if (folderFiles.length === 0) { toast.info("This folder has no files."); return; }
          folderFiles.forEach((f, i) => setTimeout(() => handleDownload(f), i * 300));
          toast.success(`Downloading ${folderFiles.length} file(s)…`);
        },
      },
    ]);
  }, [files, openContextMenu]);

  const handleBulkDownload = () => {
    const toDownload = filteredFiles.filter(f => selectedIds.has(f.id));
    toDownload.forEach((f, i) => setTimeout(() => handleDownload(f), i * 300));
    toast.success(`Downloading ${toDownload.length} file(s)…`);
    clearSelection();
  };

  const handleDeleteFolder = async (folder) => {
    const count = fileCountForFolder(folder.id);
    if (count > 0) { toast.error(`Folder has ${count} file(s). Move or delete them first.`); return; }
    await base44.entities.Folder.delete(folder.id);
    toast.success("Folder deleted");
    queryClient.invalidateQueries({ queryKey: ["folders"] });
  };

  const handleCategoryChange = (cat) => {
    setCategory(cat); setCurrentFolder(null); setSearch("");
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["files"] });
    queryClient.invalidateQueries({ queryKey: ["folders"] });
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
    toast.success("Logged out");
  };

  const handleAuthSuccess = (username) => {
    setSession(getSession());
    setShowAuth(false);
  };

  // Drag & drop handlers
  const handleDragStart = useCallback((e, file) => {
    e.dataTransfer.setData("fileId", file.id);
  }, []);

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
    const fileId = e.dataTransfer.getData("fileId");
    if (!fileId) return;
    await base44.entities.File.update(fileId, { folder_id: targetFolder.id });
    toast.success(`Moved to "${targetFolder.name}"`);
    invalidateAll();
  }, []);

  const showEmpty = !isLoading && visibleFolders.length === 0 && filteredFiles.length === 0;

  // Global drag-and-drop for managers
  const handleGlobalDragEnter = (e) => {
    if (!isManager) return;
    // Only react to file drags (not folder-to-folder moves)
    if (!e.dataTransfer.types.includes("Files")) return;
    dragCounterRef[0]++;
    setGlobalDragOver(true);
  };
  const handleGlobalDragLeave = () => {
    if (!isManager) return;
    dragCounterRef[0]--;
    if (dragCounterRef[0] <= 0) { dragCounterRef[0] = 0; setGlobalDragOver(false); }
  };
  const handleGlobalDrop = (e) => {
    if (!isManager) return;
    e.preventDefault();
    dragCounterRef[0] = 0;
    setGlobalDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) { setDroppedFile(file); setUploadOpen(true); }
  };
  const handleGlobalDragOver = (e) => { if (isManager && e.dataTransfer.types.includes("Files")) e.preventDefault(); };

  // Reset selection when folder/category/search changes
  const handleCategoryChangeWithReset = (cat) => { clearSelection(); handleCategoryChange(cat); };

  if (showAuth) {
    return <AuthPage onSuccess={handleAuthSuccess} onBack={() => setShowAuth(false)} />;
  }

  const sidebarProps = {
    activeCategory: category,
    onCategoryChange: handleCategoryChangeWithReset,
    onUploadClick: () => setUploadOpen(true),
    onNewFolderClick: () => setFolderDialogOpen(true),
    isManager,
    managerName,
    onLoginClick: () => setShowAuth(true),
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
            <p className="text-sm text-muted-foreground">Release to add this file to WBCS Disk</p>
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
          <SearchBar value={search} onChange={setSearch} />
          <div className="ml-auto flex items-center gap-2">
            <ViewToggle view={view} onChange={setView} />
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground bg-secondary/60 px-3 py-1.5 rounded-full">
              <HardDrive className="h-3.5 w-3.5" />
              {files.length} files
            </div>
            <DarkModeToggle className="lg:hidden" />
          </div>
        </header>

        {/* Bulk download bar */}
        {selectedIds.size > 0 && (
          <div className="sticky top-[73px] z-10 bg-primary text-primary-foreground px-4 sm:px-6 lg:px-8 py-2.5 flex items-center gap-3">
            <span className="text-sm font-medium">{selectedIds.size} file{selectedIds.size !== 1 ? "s" : ""} selected</span>
            <button
              onClick={handleBulkDownload}
              className="flex items-center gap-1.5 bg-primary-foreground/20 hover:bg-primary-foreground/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="h-4 w-4" />
              Download selected
            </button>
            <button onClick={clearSelection} className="ml-auto p-1.5 rounded-lg hover:bg-primary-foreground/20 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm mb-5">
            <button
              onClick={() => setCurrentFolder(null)}
              className={`flex items-center gap-1 hover:text-primary transition-colors ${!currentFolder ? "text-foreground font-medium" : "text-muted-foreground"}`}
            >
              <HomeIcon className="h-3.5 w-3.5" />
              WBCS Disk
            </button>
            {currentFolder && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-foreground font-medium">{currentFolder.name}</span>
              </>
            )}
          </div>

          {/* Heading */}
          <div className="mb-5">
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
                          onDelete={handleDeleteFolder}
                          isManager={isManager}
                          view="list"
                          onDragOver={(e) => handleDragOver(e, folder.id)}
                          onDrop={(e) => handleDrop(e, folder)}
                          onContextMenu={handleFolderContextMenu}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className={`grid gap-4 ${view === "compact" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}>
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
                            onDelete={handleDeleteFolder}
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
              {filteredFiles.length > 0 && (
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
                      {filteredFiles.map((file) => (
                        <FileCard key={file.id} file={file} view="list" isManager={isManager} onDragStart={handleDragStart} onContextMenu={handleFileContextMenu} selected={selectedIds.has(file.id)} onSelect={toggleSelect} />
                      ))}
                    </div>
                  ) : (
                    <div className={`grid gap-4 ${view === "compact" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}>
                      {filteredFiles.map((file) => (
                        <FileCard key={file.id} file={file} view={view} isManager={isManager} onDragStart={handleDragStart} onContextMenu={handleFileContextMenu} selected={selectedIds.has(file.id)} onSelect={toggleSelect} />
                      ))}
                    </div>
                  )}
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
        onOpenChange={(val) => { setUploadOpen(val); if (!val) setDroppedFile(null); }}
        onUploaded={invalidateAll}
        currentFolderId={currentFolder?.id || null}
        initialFile={droppedFile}
      />
      <CreateFolderDialog
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        onCreated={invalidateAll}
      />
    </div>
  );
}