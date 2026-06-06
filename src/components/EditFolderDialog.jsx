import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { updateFolder } from "@/api/fileService";

const COLORS = [
  { key: "blue", label: "Blue" },
  { key: "purple", label: "Purple" },
  { key: "emerald", label: "Emerald" },
  { key: "orange", label: "Orange" },
  { key: "pink", label: "Pink" },
  { key: "amber", label: "Amber" },
];

export default function EditFolderDialog({ open, onOpenChange, folder, onUpdated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("blue");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (folder) {
      setName(folder.name || "");
      setDescription(folder.description || "");
      setColor(folder.color || "blue");
    }
  }, [folder]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Folder name cannot be empty.");
      return;
    }
    setLoading(true);
    try {
      await updateFolder(folder.id, {
        name: name.trim(),
        description,
        color,
      });
      toast.success("Folder updated!");
      onUpdated?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message || "Failed to update folder.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" /> Edit Folder
          </DialogTitle>
          <DialogDescription>Update folder details.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Folder Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Folder name" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description..." rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setColor(c.key)}
                  title={c.label}
                  className={`w-8 h-8 rounded-full transition-all ${
                    color === c.key ? "ring-2 ring-offset-2 ring-primary scale-110" : "opacity-60 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: {
                    blue: "#3b82f6", purple: "#a855f7", emerald: "#10b981",
                    orange: "#f97316", pink: "#ec4899", amber: "#f59e0b"
                  }[c.key] }}
                />
              ))}
            </div>
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
