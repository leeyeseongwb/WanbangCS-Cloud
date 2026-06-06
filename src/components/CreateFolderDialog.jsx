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
import { FolderPlus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

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
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    await base44.entities.Folder.create({ name: name.trim(), description, color });
    toast.success("Folder created!");
    setLoading(false);
    setName("");
    setDescription("");
    setColor("blue");
    onOpenChange(false);
    onCreated?.();
  };

  const handleClose = (open) => {
    if (!open) { setName(""); setDescription(""); setColor("blue"); }
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

          <Button onClick={handleCreate} disabled={!name.trim() || loading} className="w-full">
            Create Folder
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}