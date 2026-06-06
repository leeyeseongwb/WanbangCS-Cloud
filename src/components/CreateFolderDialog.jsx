import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FolderPlus, Globe, Lock } from "lucide-react";
import { toast } from "sonner";
import { createFolder } from "@/api/fileService";

const COLORS = [
  { key: "blue",    label: "Blue",    cls: "bg-blue-500" },
  { key: "purple",  label: "Purple",  cls: "bg-purple-500" },
  { key: "emerald", label: "Emerald", cls: "bg-emerald-500" },
  { key: "orange",  label: "Orange",  cls: "bg-orange-500" },
  { key: "pink",    label: "Pink",    cls: "bg-pink-500" },
  { key: "amber",   label: "Amber",   cls: "bg-amber-500" },
];

export default function CreateFolderDialog({ open, onOpenChange, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("blue");
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await createFolder({ name: name.trim(), description, color, is_public: isPublic });
      toast.success("Folder created!");
      setName("");
      setDescription("");
      setColor("blue");
      setIsPublic(true);
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error(err.message || "Failed to create folder.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (open) => {
    if (!open) { setName(""); setDescription(""); setColor("blue"); setIsPublic(true); }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-primary" />
            New Folder
          </DialogTitle>
          <DialogDescription>Create a folder to organize your files.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Folder Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Project Assets"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>

          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's in this folder?"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setColor(c.key)}
                  title={c.label}
                  className={`w-7 h-7 rounded-full ${c.cls} transition-all ${
                    color === c.key ? "ring-2 ring-offset-2 ring-primary scale-110" : "opacity-60 hover:opacity-100"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Visibility</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${isPublic ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"}`}
              >
                <Globe className="h-4 w-4" /> Public
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${!isPublic ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"}`}
              >
                <Lock className="h-4 w-4" /> Private
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isPublic
                ? "Anyone can see this folder and its contents."
                : "Hidden from non-managers — its subfolders and files are hidden too."}
            </p>
          </div>

          <Button onClick={handleCreate} disabled={!name.trim() || loading} className="w-full">
            Create Folder
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
