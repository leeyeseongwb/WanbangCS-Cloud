import { useMemo, useState, useEffect } from "react";
import { Folder, FolderOpen, ChevronRight, Lock, HardDrive } from "lucide-react";

const folderText = {
  blue: "text-blue-500", purple: "text-purple-500", emerald: "text-emerald-500",
  orange: "text-orange-500", pink: "text-pink-500", amber: "text-amber-500",
};

function Node({ node, depth, byParent, expanded, toggle, pathIds, currentId, onNavigate }) {
  const children = byParent.get(node.id) || [];
  const isOpen = expanded.has(node.id);
  const isCurrent = currentId === node.id;
  const Icon = isCurrent || isOpen ? FolderOpen : Folder;
  return (
    <div>
      <div
        onClick={() => onNavigate(node)}
        style={{ paddingLeft: 8 + depth * 14 }}
        className={`flex items-center gap-1 rounded-lg pr-2 py-1.5 cursor-pointer text-sm transition-colors ${
          isCurrent ? "bg-primary/10 text-primary font-medium"
            : pathIds.has(node.id) ? "text-foreground hover:bg-secondary"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        <button
          onClick={(e) => { e.stopPropagation(); toggle(node.id); }}
          className={`p-0.5 rounded hover:bg-background/60 ${children.length ? "" : "invisible"}`}
          aria-label={isOpen ? "Collapse" : "Expand"}
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
        </button>
        <Icon className={`h-4 w-4 flex-shrink-0 ${folderText[node.color || "blue"]}`} />
        <span className="truncate flex-1 ml-1" title={node.name}>{node.name}</span>
        {node.is_public === false && <Lock className="h-3 w-3 flex-shrink-0 opacity-60" />}
      </div>
      {isOpen && children.map((c) => (
        <Node key={c.id} node={c} depth={depth + 1} {...{ byParent, expanded, toggle, pathIds, currentId, onNavigate }} />
      ))}
    </div>
  );
}

/**
 * "My Drive" row with the folder tree nested underneath it (like Google Drive).
 * folders must already be filtered to what the current user may see.
 */
export default function FolderTree({ folders, currentFolder, path, active, onNavigate }) {
  const currentId = currentFolder?.id ?? null;
  const pathIds = useMemo(() => new Set(path.map((p) => p.id)), [path]);

  const byParent = useMemo(() => {
    const m = new Map();
    const sorted = [...folders].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    for (const f of sorted) {
      const k = f.parent_folder_id || null;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(f);
    }
    return m;
  }, [folders]);

  const [rootOpen, setRootOpen] = useState(true);
  const [expanded, setExpanded] = useState(() => new Set());
  // Opening a folder reveals its place in the tree.
  useEffect(() => {
    if (pathIds.size === 0) return;
    setRootOpen(true);
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const id of pathIds) next.add(id);
      return next;
    });
  }, [pathIds]);
  const toggle = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const roots = byParent.get(null) || [];
  const rootActive = active && !currentFolder;

  return (
    <div>
      <div
        onClick={() => onNavigate(null)}
        className={`flex items-center gap-1 px-2 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
          rootActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        <button
          onClick={(e) => { e.stopPropagation(); setRootOpen((o) => !o); }}
          className={`p-0.5 rounded hover:bg-background/60 ${roots.length ? "" : "invisible"}`}
          aria-label={rootOpen ? "Collapse My Drive" : "Expand My Drive"}
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${rootOpen ? "rotate-90" : ""}`} />
        </button>
        <HardDrive className="h-4 w-4 ml-1" />
        <span className="ml-2">My Drive</span>
      </div>
      {rootOpen && roots.map((r) => (
        <Node key={r.id} node={r} depth={1} {...{ byParent, expanded, toggle, pathIds, currentId, onNavigate }} />
      ))}
    </div>
  );
}
