import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Folder, Calendar, FileText, HardDrive } from "lucide-react";
import { format } from "date-fns";
import { formatBytes } from "@/components/FileCard";

export default function FolderInfoDialog({ open, onOpenChange, folder, fileCount, totalSize }) {
  if (!folder) return null;

  const colorMap = {
    blue: "bg-blue-500", purple: "bg-purple-500", emerald: "bg-emerald-500",
    orange: "bg-orange-500", pink: "bg-pink-500", amber: "bg-amber-500",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-primary" /> Folder Info
          </DialogTitle>
          <DialogDescription>Details about this folder.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${colorMap[folder.color] || "bg-blue-500"} flex items-center justify-center`}>
              <Folder className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-medium text-sm">{folder.name}</p>
              <p className="text-xs text-muted-foreground">{folder.description || "No description"}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="w-4 h-4" />
              <span>{fileCount} file{fileCount !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <HardDrive className="w-4 h-4" />
              <span>{formatBytes(totalSize)} total</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>Created {folder.created_at ? format(new Date(folder.created_at), "MMM d, yyyy") : "—"}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
