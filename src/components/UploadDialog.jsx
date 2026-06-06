import { useState, useRef, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { uploadFile } from "@/api/fileService";

export default function UploadDialog({ open, onOpenChange, onUploaded, currentFolderId = null, initialFiles = null }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      setFiles(Array.isArray(initialFiles) ? initialFiles : [initialFiles]);
    }
  }, [initialFiles]);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setUploading(false);
    }
  }, [open]);

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    let successCount = 0;
    let failCount = 0;
    for (const file of files) {
      try {
        await uploadFile({
          file,
          folderId: currentFolderId,
        });
        successCount++;
      } catch (err) {
        failCount++;
        console.error("Upload failed:", file.name, err);
      }
    }
    setUploading(false);
    if (successCount > 0) toast.success(`${successCount} file(s) uploaded successfully!`);
    if (failCount > 0) toast.error(`${failCount} file(s) failed to upload.`);
    onUploaded?.();
    onOpenChange(false);
    setFiles([]);
  };

  const handleClose = (open) => {
    if (!open) { setFiles([]); }
    onOpenChange(open);
  };

  const handleDropZoneDrop = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const dropped = Array.from(e.dataTransfer.files || []);
    if (dropped.length > 0) setFiles(prev => [...prev, ...dropped]);
  };

  const handleFileInput = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) setFiles(prev => [...prev, ...selected]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />Upload Files
          </DialogTitle>
          <DialogDescription>Drag files here or click to select multiple files.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={handleDropZoneDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
              isDraggingOver
                ? "border-primary bg-primary/10 scale-[1.02]"
                : files.length > 0
                ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20"
                : "border-border hover:border-primary/40 hover:bg-primary/5"
            }`}
          >
            <FileUp className={`h-8 w-8 mx-auto mb-2 transition-colors ${isDraggingOver ? "text-primary" : "text-muted-foreground"}`} />
            {files.length > 0 ? (
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{files.length} file(s) selected</p>
            ) : (
              <>
                <p className="text-sm font-medium">{isDraggingOver ? "Drop it!" : "Drag & drop or click to select files"}</p>
                <p className="text-xs text-muted-foreground mt-1">Multiple files supported</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
              {files.map((file, i) => (
                <div key={i} className="flex items-center justify-between text-sm px-2 py-1 bg-secondary/30 rounded">
                  <span className="truncate flex-1">{file.name}</span>
                  <span className="text-xs text-muted-foreground mr-2">{(file.size / 1024).toFixed(1)} KB</span>
                  <button onClick={() => removeFile(i)} className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button onClick={handleUpload} disabled={files.length === 0 || uploading} className="w-full">
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading {files.length} file(s)…
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />Upload {files.length > 0 ? `(${files.length})` : ""}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
