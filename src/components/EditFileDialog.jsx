import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { updateFile } from "@/api/fileService";

export default function EditFileDialog({ open, onOpenChange, file, onUpdated }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("other");
  const [published, setPublished] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (file) {
      setName(file.name || "");
      setCategory(file.category || "other");
      setPublished(file.published !== false);
    }
  }, [file]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("File name cannot be empty.");
      return;
    }
    setLoading(true);
    try {
      await updateFile(file.id, {
        name: name.trim(),
        category,
        published,
      });
      toast.success("File updated!");
      onUpdated?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message || "Failed to update file.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" /> Edit File
          </DialogTitle>
          <DialogDescription>Update file metadata.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>File Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="File name" />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="document">Document</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="audio">Audio</option>
              <option value="archive">Archive</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="edit-published"
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="rounded border-gray-300"
            />
            <Label htmlFor="edit-published" className="font-normal">
              Published (visible to all users)
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
