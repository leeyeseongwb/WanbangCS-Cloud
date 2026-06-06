import { useState, useRef, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Upload, FileUp, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

function detectCategory(mimeType) {
  if (!mimeType) return "other";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.includes("pdf") || mimeType.includes("document") || mimeType.includes("text") || mimeType.includes("sheet") || mimeType.includes("presentation")) return "document";
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar") || mimeType.includes("gzip") || mimeType.includes("7z")) return "archive";
  return "other";
}

export default function UploadDialog({ open, onOpenChange, onUploaded, currentFolderId = null, initialFile = null }) {
  const [file, setFile] = useState(initialFile);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileRef = useRef(null);

  // Sync initialFile when dialog opens with a pre-dropped file
  useEffect(() => { if (initialFile) setFile(initialFile); }, [initialFile]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.File.create({
      name: file.name,
      file_url,
      file_size: file.size,
      file_type: file.type,
      category: detectCategory(file.type),
      description,
      folder_id: currentFolderId || null,
    });
    toast.success("File uploaded successfully!");
    setUploading(false);
    setFile(null);
    setDescription("");
    onOpenChange(false);
    onUploaded?.();
  };

  const handleClose = (open) => {
    if (!open) { setFile(null); setDescription(""); }
    onOpenChange(open);
  };

  const handleDropZoneDrop = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />Upload File
          </DialogTitle>
          <DialogDescription>Drag a file here or click to select one.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={handleDropZoneDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
              isDraggingOver
                ? "border-primary bg-primary/10 scale-[1.02]"
                : file
                ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20"
                : "border-border hover:border-primary/40 hover:bg-primary/5"
            }`}
          >
            <FileUp className={`h-8 w-8 mx-auto mb-2 transition-colors ${isDraggingOver ? "text-primary" : "text-muted-foreground"}`} />
            {file ? (
              <>
                <p className="text-sm font-medium truncate text-emerald-700 dark:text-emerald-400">{file.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">{isDraggingOver ? "Drop it!" : "Drag & drop or click to select"}</p>
                <p className="text-xs text-muted-foreground mt-1">Any file type supported</p>
              </>
            )}
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add a description..." rows={2} />
          </div>
          <Button onClick={handleUpload} disabled={!file || uploading} className="w-full">
            {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</> : "Upload"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}