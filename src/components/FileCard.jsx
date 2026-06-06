import { FileText, Image, Video, Music, Archive, File, Download, Calendar, HardDrive, Eye, EyeOff, CheckSquare } from "lucide-react";
import { format } from "date-fns";
import { toggleFilePublished, handleDownload } from "@/api/fileService";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const iconMap = {
  document: FileText, image: Image, video: Video, audio: Music, archive: Archive, other: File,
};

const colorMap = {
  document: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  image: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  video: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  audio: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  archive: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  other: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

export function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}



function useTogglePublish() {
  const queryClient = useQueryClient();
  return async (file) => {
    const next = file.published === false ? true : false;
    await toggleFilePublished(file.id, next);
    toast.success(next ? "File is now visible to users." : "File is now hidden from users.");
    queryClient.invalidateQueries({ queryKey: ["files"] });
  };
}

function PublishToggle({ file, small = false }) {
  const toggle = useTogglePublish();
  const isPublished = file.published !== false;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); toggle(file); }}
      title={isPublished ? "Hide from users" : "Publish to users"}
      className={`flex items-center gap-1 rounded-lg transition-colors text-[11px] font-medium px-2 py-1 ${
        isPublished
          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400"
          : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
      }`}
    >
      {isPublished ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      {!small && (isPublished ? "Public" : "Hidden")}
    </button>
  );
}

// Grid view card
function GridCard({ file, isManager, onDragStart, onContextMenu, selected, onSelect }) {
  const category = file.category || "other";
  const Icon = iconMap[category];
  const color = colorMap[category];
  const isHidden = file.published === false;
  return (
    <div
      draggable={isManager}
      onDragStart={onDragStart ? (e) => onDragStart(e, file) : undefined}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu && onContextMenu(e, file); }}
      data-selectable="true"
      data-id={file.id}
      onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey) { e.preventDefault(); onSelect && onSelect(file.id, e.shiftKey); } }}
      className={`group relative bg-card border rounded-2xl p-5 hover:shadow-lg transition-all duration-300 ${isManager ? "cursor-grab active:cursor-grabbing" : "cursor-default"} ${
        selected ? "border-primary ring-2 ring-primary/30" : isHidden ? "border-amber-300 dark:border-amber-700 opacity-75" : "border-border hover:border-primary/20"
      }`}
    >
      {/* Selection checkbox */}
      <button
        onClick={(e) => { e.stopPropagation(); onSelect && onSelect(file.id); }}
        className={`absolute top-3 left-3 transition-opacity ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`}
      >
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selected ? "bg-primary border-primary" : "border-muted-foreground bg-card"}`}>
          {selected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
        </div>
      </button>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isManager && <PublishToggle file={file} />}
          <button onClick={(e) => { e.stopPropagation(); handleDownload(file); }} className="p-2 rounded-lg hover:bg-secondary" title="Download">
            <Download className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
      <h3 className="font-medium text-sm truncate mb-1" title={file.name}>{file.name}</h3>
      {file.description && <p className="text-xs text-muted-foreground truncate mb-3">{file.description}</p>}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-auto pt-3 border-t border-border">
        <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" />{formatBytes(file.file_size)}</span>
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {file.created_at ? format(new Date(file.created_at), "MMM d, yyyy") : "—"}
        </span>
        {isManager && isHidden && <span className="ml-auto flex items-center gap-1 text-amber-600 dark:text-amber-400"><EyeOff className="h-3 w-3" />Hidden</span>}
      </div>
    </div>
  );
}

// Compact card
function CompactCard({ file, isManager, onDragStart, onContextMenu, selected, onSelect }) {
  const category = file.category || "other";
  const Icon = iconMap[category];
  const color = colorMap[category];
  const isHidden = file.published === false;
  return (
    <div
      draggable={isManager}
      onDragStart={onDragStart ? (e) => onDragStart(e, file) : undefined}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu && onContextMenu(e, file); }}
      data-selectable="true"
      data-id={file.id}
      onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey) { e.preventDefault(); onSelect && onSelect(file.id, e.shiftKey); } }}
      className={`group relative bg-card border rounded-xl p-3 hover:shadow-md transition-all duration-200 flex flex-col items-center text-center gap-2 ${isManager ? "cursor-grab active:cursor-grabbing" : "cursor-default"} ${
        selected ? "border-primary ring-2 ring-primary/30" : isHidden ? "border-amber-300 dark:border-amber-700 opacity-75" : "border-border hover:border-primary/20"
      }`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onSelect && onSelect(file.id); }}
        className={`absolute top-1.5 left-1.5 transition-opacity ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`}
      >
        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selected ? "bg-primary border-primary" : "border-muted-foreground bg-card"}`}>
          {selected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
        </div>
      </button>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="w-full">
        <p className="text-xs font-medium truncate" title={file.name}>{file.name}</p>
        <p className="text-[10px] text-muted-foreground">{formatBytes(file.file_size)}</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isManager && <PublishToggle file={file} small />}
        <button onClick={(e) => { e.stopPropagation(); handleDownload(file); }} className="p-1 rounded hover:bg-secondary">
          <Download className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

// List row
function ListRow({ file, isManager, onDragStart, onContextMenu, selected, onSelect }) {
  const category = file.category || "other";
  const Icon = iconMap[category];
  const color = colorMap[category];
  const isHidden = file.published === false;
  return (
    <div
      draggable={isManager}
      onDragStart={onDragStart ? (e) => onDragStart(e, file) : undefined}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu && onContextMenu(e, file); }}
      data-selectable="true"
      data-id={file.id}
      onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey) { e.preventDefault(); onSelect && onSelect(file.id, e.shiftKey); } }}
      className={`group flex items-center gap-3 px-4 py-2.5 bg-card border-b border-border hover:bg-secondary/40 transition-colors ${isManager ? "cursor-grab active:cursor-grabbing" : "cursor-default"} ${
        selected ? "bg-primary/5" : isHidden ? "opacity-75" : ""
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => { e.stopPropagation(); onSelect && onSelect(file.id); }}
        className={`flex-shrink-0 transition-opacity ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`}
      >
        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selected ? "bg-primary border-primary" : "border-muted-foreground bg-card"}`}>
          {selected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
        </div>
      </button>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        {file.description && <p className="text-xs text-muted-foreground truncate">{file.description}</p>}
      </div>
      {isManager && isHidden && (
        <span className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 flex-shrink-0">
          <EyeOff className="h-3 w-3" />Hidden
        </span>
      )}
      <span className="text-xs text-muted-foreground w-20 text-right flex-shrink-0">{formatBytes(file.file_size)}</span>
      <span className="text-xs text-muted-foreground w-28 text-right flex-shrink-0 hidden sm:block">
        {file.created_at ? format(new Date(file.created_at), "MMM d, yyyy") : "—"}
      </span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0">
        {isManager && <PublishToggle file={file} small />}
        <button onClick={(e) => { e.stopPropagation(); handleDownload(file); }} className="p-1.5 rounded hover:bg-secondary">
          <Download className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

export default function FileCard({ file, view = "grid", isManager = false, onDragStart, onContextMenu, selected, onSelect }) {
  const props = { file, isManager, onDragStart, onContextMenu, selected, onSelect };
  if (view === "list") return <ListRow {...props} />;
  if (view === "compact") return <CompactCard {...props} />;
  return <GridCard {...props} />;
}