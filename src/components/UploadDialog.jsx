import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileUp, Loader2, X, FolderUp } from "lucide-react";
import { toast } from "sonner";
import { uploadFile, deleteFile, UploadAbortError } from "@/api/fileService";

function getFilesFromEntries(entries) {
  return new Promise((resolve) => {
    const results = [];
    let pending = 0;
    function processEntry(entry) {
      if (entry.isFile) {
        entry.file((file) => {
          file.relativePath = entry.fullPath.replace(/^\//, "");
          results.push(file);
          pending--;
          if (pending === 0) resolve(results);
        });
      } else if (entry.isDirectory) {
        pending++;
        const reader = entry.createReader();
        function readBatch() {
          reader.readEntries((entries) => {
            if (entries.length === 0) { pending--; if (pending === 0) resolve(results); return; }
            entries.forEach((e) => { pending++; processEntry(e); });
            readBatch();
          });
        }
        readBatch();
      }
    }
    entries.forEach((entry) => { pending++; processEntry(entry); });
    if (pending === 0) resolve(results);
  });
}

// Safe task functions with fallback
const safeAddTask = (type, title) => {
  if (typeof window.addTask === 'function') return window.addTask(type, title);
  return null;
};
const safeUpdateTask = (id, updates) => {
  if (typeof window.updateTask === 'function') window.updateTask(id, updates);
};
const safeRemoveTask = (id) => {
  if (typeof window.removeTask === 'function') window.removeTask(id);
};

export default function UploadDialog({ open, onOpenChange, onUploaded, currentFolderId = null, initialFiles = null }) {
  const [mode, setMode] = useState("files");
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileRef = useRef(null);
  const folderRef = useRef(null);

  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      setFiles(Array.isArray(initialFiles) ? initialFiles : [initialFiles]);
      setMode("files");
    }
  }, [initialFiles]);

  useEffect(() => {
    if (!open) { setFiles([]); setUploading(false); setMode("files"); }
  }, [open]);

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);

    // AbortController lets the X button cancel mid-upload.
    const controller = new AbortController();
    const taskId = safeAddTask("upload", `Uploading ${files.length} file(s)`);
    safeUpdateTask(taskId, { onCancel: () => controller.abort() });

    let successCount = 0;
    let failCount = 0;
    let aborted = false;
    // Track everything successfully uploaded in THIS batch so we can roll it back on cancel.
    const uploadedInBatch = [];

    for (let i = 0; i < files.length; i++) {
      if (controller.signal.aborted) { aborted = true; break; }
      const file = files[i];
      try {
        const uploaded = await uploadFile({
          file,
          folderId: currentFolderId,
          relativePath: file.relativePath || null,
          signal: controller.signal,
        });
        if (uploaded) uploadedInBatch.push(uploaded);
        successCount++;
      } catch (err) {
        if (err instanceof UploadAbortError || err?.aborted || controller.signal.aborted) {
          aborted = true;
          break;
        }
        failCount++;
        console.error("Upload failed:", file.name, err);
      }
      safeUpdateTask(taskId, { progress: Math.round(((i + 1) / files.length) * 100) });
    }

    if (aborted) {
      // Cancel pressed: remove every file that was already uploaded in this batch.
      safeUpdateTask(taskId, { title: "Cancelling upload…", onCancel: undefined });
      for (const f of uploadedInBatch) {
        try { await deleteFile(f); } catch (e) { console.warn("Cleanup failed:", e); }
      }
      setUploading(false);
      toast.info("Upload cancelled — uploaded files were removed.");
      if (taskId) safeRemoveTask(taskId);
      onUploaded?.();          // refresh the view so removed items disappear
      onOpenChange(false);
      setFiles([]);
      return;
    }

    setUploading(false);
    if (successCount > 0) toast.success(`${successCount} file(s) uploaded!`);
    if (failCount > 0) toast.error(`${failCount} file(s) failed.`);
    safeUpdateTask(taskId, { status: "done", onCancel: undefined });
    if (taskId) setTimeout(() => safeRemoveTask(taskId), 2000);
    onUploaded?.();
    onOpenChange(false);
    setFiles([]);
  };

  const handleClose = (open) => { if (!open) { setFiles([]); setMode("files"); } onOpenChange(open); };

  const handleDropZoneDrop = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (mode === "folder") {
      const items = Array.from(e.dataTransfer.items || []);
      const entries = items.filter(item => item.kind === "file").map(item => item.webkitGetAsEntry()).filter(Boolean);
      if (entries.length > 0) {
        getFilesFromEntries(entries).then((collectedFiles) => {
          if (collectedFiles.length > 0) setFiles(prev => [...prev, ...collectedFiles]);
        });
      }
      return;
    }
    const dropped = Array.from(e.dataTransfer.files || []);
    if (dropped.length > 0) setFiles(prev => [...prev, ...dropped]);
  };

  const handleFileInput = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) setFiles(prev => [...prev, ...selected]);
  };

  const handleFolderInput = (e) => {
    const selected = Array.from(e.target.files || []);
    // webkitRelativePath를 이용해 relativePath 설정 (input folder upload용)
    const filesWithPath = selected.map(file => {
      if (file.webkitRelativePath) {
        file.relativePath = file.webkitRelativePath;
      }
      return file;
    });
    if (filesWithPath.length > 0) setFiles(prev => [...prev, ...filesWithPath]);
  };

  const removeFile = (index) => { setFiles(prev => prev.filter((_, i) => i !== index)); };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-primary" />Upload</DialogTitle>
          <DialogDescription>Upload individual files or an entire folder.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex gap-2">
            <button onClick={() => { setMode("files"); setFiles([]); }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${mode === "files" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"}`}>
              <FileUp className="h-4 w-4" />Files
            </button>
            <button onClick={() => { setMode("folder"); setFiles([]); }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${mode === "folder" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"}`}>
              <FolderUp className="h-4 w-4" />Folder
            </button>
          </div>

          {mode === "files" ? (
            <div onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={handleDropZoneDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${isDraggingOver ? "border-primary bg-primary/10 scale-[1.02]" : files.length > 0 ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20" : "border-border hover:border-primary/40 hover:bg-primary/5"}`}>
              <FileUp className={`h-8 w-8 mx-auto mb-2 transition-colors ${isDraggingOver ? "text-primary" : "text-muted-foreground"}`} />
              {files.length > 0 ? (
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{files.length} file(s) selected</p>
              ) : (
                <>
                  <p className="text-sm font-medium">{isDraggingOver ? "Drop it!" : "Drag & drop or click to select files"}</p>
                  <p className="text-xs text-muted-foreground mt-1">Multiple files supported</p>
                </>
              )}
              <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFileInput} />
            </div>
          ) : (
            <div onClick={() => folderRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setIsDraggingOver(false);
                const items = Array.from(e.dataTransfer.items || []);
                const entries = items.filter(item => item.kind === "file").map(item => item.webkitGetAsEntry()).filter(Boolean);
                if (entries.length > 0) {
                  getFilesFromEntries(entries).then((collectedFiles) => {
                    if (collectedFiles.length > 0) setFiles(prev => [...prev, ...collectedFiles]);
                  });
                }
              }}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${isDraggingOver ? "border-primary bg-primary/10 scale-[1.02]" : files.length > 0 ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20" : "border-border hover:border-primary/40 hover:bg-primary/5"}`}>
              <FolderUp className={`h-8 w-8 mx-auto mb-2 transition-colors ${isDraggingOver ? "text-primary" : "text-muted-foreground"}`} />
              {files.length > 0 ? (
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{files.length} file(s) from folder</p>
              ) : (
                <>
                  <p className="text-sm font-medium">{isDraggingOver ? "Drop it!" : "Drag & drop or click to select a folder"}</p>
                  <p className="text-xs text-muted-foreground mt-1">All files in the folder will be uploaded</p>
                </>
              )}
              <input ref={folderRef} type="file" webkitdirectory="true" directory="true" multiple className="hidden" onChange={handleFolderInput} />
            </div>
          )}

          {files.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
              {files.map((file, i) => (
                <div key={i} className="flex items-center justify-between text-sm px-2 py-1 bg-secondary/30 rounded min-w-0">
                  <span className="truncate flex-1 min-w-0 overflow-hidden" title={file.relativePath || file.name}>
                    {file.relativePath || file.name}
                  </span>
                  <span className="text-xs text-muted-foreground mr-2 flex-shrink-0">{(file.size / 1024).toFixed(1)} KB</span>
                  <button onClick={() => removeFile(i)} className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button onClick={handleUpload} disabled={files.length === 0 || uploading} className="w-full">
            {uploading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading {files.length} file(s)…</>
            ) : (
              <><Upload className="w-4 h-4 mr-2" />Upload {files.length > 0 ? `(${files.length})` : ""}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
