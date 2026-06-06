import { Folder, MoreVertical, Trash2, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const colorMap = {
  blue:    { bg: "bg-blue-500/10",    icon: "text-blue-500",    border: "hover:border-blue-300 dark:hover:border-blue-700" },
  purple:  { bg: "bg-purple-500/10",  icon: "text-purple-500",  border: "hover:border-purple-300 dark:hover:border-purple-700" },
  emerald: { bg: "bg-emerald-500/10", icon: "text-emerald-500", border: "hover:border-emerald-300 dark:hover:border-emerald-700" },
  orange:  { bg: "bg-orange-500/10",  icon: "text-orange-500",  border: "hover:border-orange-300 dark:hover:border-orange-700" },
  pink:    { bg: "bg-pink-500/10",    icon: "text-pink-500",    border: "hover:border-pink-300 dark:hover:border-pink-700" },
  amber:   { bg: "bg-amber-500/10",   icon: "text-amber-500",   border: "hover:border-amber-300 dark:hover:border-amber-700" },
};

// Grid folder card
function GridFolder({ folder, fileCount, onClick, onDelete, onEdit, isManager, onDragOver, onDrop, onContextMenu }) {
  const c = colorMap[folder.color || "blue"];
  return (
    <div
      onClick={onClick}
      onDragOver={isManager ? onDragOver : undefined}
      onDrop={isManager ? onDrop : undefined}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu && onContextMenu(e, folder); }}
      className={`group relative bg-card border border-border rounded-2xl p-5 cursor-pointer hover:shadow-lg flex-shrink-0 min-w-[220px] transition-all duration-300 ${c.border}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${c.bg}`}>
          <Folder className={`h-6 w-6 ${c.icon}`} />
        </div>
        {isManager && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 rounded-lg hover:bg-secondary">
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(folder)}>
                    <Pencil className="h-4 w-4 mr-2" />Edit Folder
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(folder)}>
                  <Trash2 className="h-4 w-4 mr-2" />Delete Folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      <h3 className="font-medium text-sm truncate" title={folder.name}>{folder.name}</h3>
      {folder.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{folder.description}</p>}
      <p className="text-xs text-muted-foreground mt-2">{fileCount} file{fileCount !== 1 ? "s" : ""}</p>
    </div>
  );
}

// Compact folder
function CompactFolder({ folder, fileCount, onClick, onDelete, onEdit, isManager, onDragOver, onDrop, onContextMenu }) {
  const c = colorMap[folder.color || "blue"];
  return (
    <div
      onClick={onClick}
      onDragOver={isManager ? onDragOver : undefined}
      onDrop={isManager ? onDrop : undefined}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu && onContextMenu(e, folder); }}
      className={`group bg-card border border-border rounded-xl p-3 cursor-pointer hover:shadow-md transition-all duration-200 flex flex-col items-center text-center gap-2 ${c.border}`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${c.bg}`}>
        <Folder className={`h-5 w-5 ${c.icon}`} />
      </div>
      <p className="text-xs font-medium truncate w-full" title={folder.name}>{folder.name}</p>
      <p className="text-[10px] text-muted-foreground">{fileCount} files</p>
    </div>
  );
}

// List folder row
function ListFolder({ folder, fileCount, onClick, onDelete, onEdit, isManager, onDragOver, onDrop, onContextMenu }) {
  const c = colorMap[folder.color || "blue"];
  return (
    <div
      onClick={onClick}
      onDragOver={isManager ? onDragOver : undefined}
      onDrop={isManager ? onDrop : undefined}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu && onContextMenu(e, folder); }}
      className={`group flex items-center gap-3 px-4 py-2.5 bg-card border-b border-border hover:bg-secondary/40 transition-colors cursor-pointer`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${c.bg}`}>
        <Folder className={`h-4 w-4 ${c.icon}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{folder.name}</p>
        {folder.description && <p className="text-xs text-muted-foreground truncate">{folder.description}</p>}
      </div>
      <span className="text-xs text-muted-foreground">{fileCount} files</span>
      {isManager && (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 rounded hover:bg-secondary opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(folder)}>
                  <Pencil className="h-4 w-4 mr-2" />Edit Folder
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(folder)}>
                <Trash2 className="h-4 w-4 mr-2" />Delete Folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

export default function FolderCard({ folder, fileCount, onClick, onDelete, onEdit, isManager, view = "grid", onDragOver, onDrop, onContextMenu }) {
  const props = { folder, fileCount, onClick, onDelete, onEdit, isManager, onDragOver, onDrop, onContextMenu };
  if (view === "list") return <ListFolder {...props} />;
  if (view === "compact") return <CompactFolder {...props} />;
  return <GridFolder {...props} />;
}
