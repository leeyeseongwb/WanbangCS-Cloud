import { useMemo, useState, useEffect } from "react";
import { Folder, FolderOpen, HardDrive, ChevronRight, Lock, MapPin, CheckSquare } from "lucide-react";
import { formatBytes } from "@/components/FileCard";

const folderText = {
  blue: "text-blue-500", purple: "text-purple-500", emerald: "text-emerald-500",
  orange: "text-orange-500", pink: "text-pink-500", amber: "text-amber-500",
};
const folderDot = {
  blue: "bg-blue-500", purple: "bg-purple-500", emerald: "bg-emerald-500",
  orange: "bg-orange-500", pink: "bg-pink-500", amber: "bg-amber-500",
};
const categoryMeta = {
  document: { label: "Documents", bar: "bg-blue-500" },
  image: { label: "Images", bar: "bg-emerald-500" },
  archive: { label: "Archives", bar: "bg-amber-500" },
  other: { label: "Other", bar: "bg-slate-400" },
};
const categoryKey = (c) => (categoryMeta[c] ? c : "other");

function SectionTitle({ children }) {
  return <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">{children}</p>;
}

// Vertical "you are here" timeline: root → … → current folder
function PathTimeline({ path, onNavigate }) {
  const nodes = [{ id: null, name: "WBCS Cloud", root: true }, ...path];
  return (
    <ol className="relative">
      {nodes.map((n, i) => {
        const isLast = i === nodes.length - 1;
        const dot = n.root ? "bg-foreground" : folderDot[n.color || "blue"];
        return (
          <li key={n.id ?? "root"} className="relative pl-7 pb-3 last:pb-0">
            {!isLast && <span className="absolute left-[9px] top-5 bottom-0 w-px bg-border" />}
            <span
              className={`absolute left-0 top-1.5 w-[19px] h-[19px] rounded-full flex items-center justify-center ${
                isLast ? "bg-primary/15 ring-2 ring-primary/40" : "bg-secondary"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isLast ? "bg-primary" : dot}`} />
            </span>
            <button
              onClick={() => !isLast && onNavigate(n.root ? null : n)}
              disabled={isLast}
              className={`text-left text-sm leading-6 max-w-full truncate block ${
                isLast ? "font-semibold text-foreground cursor-default" : "text-muted-foreground hover:text-primary"
              }`}
              title={n.name}
            >
              {n.name}
            </button>
            {isLast && <span className="text-[11px] text-primary font-medium">You are here</span>}
          </li>
        );
      })}
    </ol>
  );
}

function TreeNode({ node, depth, byParent, expanded, toggle, pathIds, currentId, onNavigate, fileCounts }) {
  const children = byParent.get(node.id) || [];
  const isOpen = expanded.has(node.id);
  const isCurrent = currentId === node.id;
  const onPath = pathIds.has(node.id);
  const count = fileCounts.get(node.id) || 0;
  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded-lg pr-2 py-1 cursor-pointer text-sm transition-colors ${
          isCurrent ? "bg-primary/10 text-primary font-medium" : onPath ? "text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
        style={{ paddingLeft: depth * 14 + 4 }}
        onClick={() => onNavigate(node)}
      >
        <button
          onClick={(e) => { e.stopPropagation(); toggle(node.id); }}
          className={`p-0.5 rounded hover:bg-secondary ${children.length ? "" : "invisible"}`}
          aria-label={isOpen ? "Collapse" : "Expand"}
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
        </button>
        {isCurrent || isOpen
          ? <FolderOpen className={`h-4 w-4 flex-shrink-0 ${folderText[node.color || "blue"]}`} />
          : <Folder className={`h-4 w-4 flex-shrink-0 ${folderText[node.color || "blue"]}`} />}
        <span className="truncate flex-1 ml-1">{node.name}</span>
        {node.is_public === false && <Lock className="h-3 w-3 flex-shrink-0 opacity-60" />}
        {count > 0 && <span className="text-[10px] text-muted-foreground tabular-nums">{count}</span>}
      </div>
      {isOpen && children.length > 0 && (
        <div className="ml-[13px] border-l border-border/70">
          {children.map((c) => (
            <TreeNode key={c.id} node={c} depth={depth + 1} {...{ byParent, expanded, toggle, pathIds, currentId, onNavigate, fileCounts }} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Right-hand "where am I" panel.
 * folders / files must already be filtered for what the current user may see.
 */
export default function PathPanel({ folders, files, currentFolder, path, onNavigate, selection }) {
  const currentId = currentFolder?.id ?? null;
  const pathIds = useMemo(() => new Set(path.map((p) => p.id)), [path]);

  const byParent = useMemo(() => {
    const m = new Map();
    for (const f of [...folders].sort((a, b) => (a.name || "").localeCompare(b.name || ""))) {
      const k = f.parent_folder_id || null;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(f);
    }
    return m;
  }, [folders]);

  const fileCounts = useMemo(() => {
    const m = new Map();
    for (const f of files) if (f.folder_id) m.set(f.folder_id, (m.get(f.folder_id) || 0) + 1);
    return m;
  }, [files]);

  // Everything inside the current location (including nested folders)
  const stats = useMemo(() => {
    const ids = new Set();
    const walk = (id) => {
      for (const c of byParent.get(id) || []) { ids.add(c.id); walk(c.id); }
    };
    if (currentId) ids.add(currentId);
    walk(currentId);
    const inScope = currentId ? files.filter((f) => ids.has(f.folder_id)) : files;
    const folderCount = ids.size - (currentId ? 1 : 0);
    const bySize = {};
    let size = 0;
    for (const f of inScope) {
      const k = categoryKey(f.category);
      bySize[k] = (bySize[k] || 0) + (f.file_size || 0);
      size += f.file_size || 0;
    }
    return { folderCount, fileCount: inScope.length, size, bySize };
  }, [files, byParent, currentId]);

  const [expanded, setExpanded] = useState(() => new Set());
  // Keep the active path expanded as the user navigates
  useEffect(() => {
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
  const barTotal = Object.values(stats.bySize).reduce((a, b) => a + b, 0);

  return (
    <aside className="hidden xl:flex w-80 h-screen fixed right-0 top-0 bg-card border-l border-border flex-col z-20">
      <div className="px-6 py-5 flex items-center gap-2 border-b border-border">
        <MapPin className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold font-heading">Location</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
        <section>
          <SectionTitle>Path</SectionTitle>
          <PathTimeline path={path} onNavigate={onNavigate} />
        </section>

        <section>
          <SectionTitle>{currentFolder ? "In this folder" : "In WBCS Cloud"}</SectionTitle>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              ["Folders", stats.folderCount],
              ["Files", stats.fileCount],
              ["Size", formatBytes(stats.size)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-secondary/60 px-3 py-2.5">
                <p className="text-sm font-semibold tabular-nums truncate">{value}</p>
                <p className="text-[11px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          {barTotal > 0 ? (
            <>
              <div className="flex h-2 rounded-full overflow-hidden bg-secondary">
                {Object.entries(categoryMeta).map(([k, m]) =>
                  stats.bySize[k] ? (
                    <div key={k} className={m.bar} style={{ width: `${(stats.bySize[k] / barTotal) * 100}%` }} title={`${m.label}: ${formatBytes(stats.bySize[k])}`} />
                  ) : null
                )}
              </div>
              <ul className="mt-3 space-y-1.5">
                {Object.entries(categoryMeta).map(([k, m]) =>
                  stats.bySize[k] ? (
                    <li key={k} className="flex items-center gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full ${m.bar}`} />
                      <span className="text-muted-foreground flex-1">{m.label}</span>
                      <span className="tabular-nums">{formatBytes(stats.bySize[k])}</span>
                    </li>
                  ) : null
                )}
              </ul>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No files yet.</p>
          )}
        </section>

        {selection.count > 0 && (
          <section className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <CheckSquare className="h-4 w-4" />
              {selection.count} selected
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {selection.files} file{selection.files !== 1 ? "s" : ""}, {selection.folders} folder{selection.folders !== 1 ? "s" : ""}
              {selection.size > 0 && ` · ${formatBytes(selection.size)}`}
            </p>
          </section>
        )}

        <section>
          <SectionTitle>Folders</SectionTitle>
          <div
            onClick={() => onNavigate(null)}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 mb-1 cursor-pointer text-sm transition-colors ${
              !currentFolder ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <HardDrive className="h-4 w-4" />
            <span className="flex-1">WBCS Cloud</span>
          </div>
          {roots.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2">No folders yet.</p>
          ) : (
            roots.map((r) => (
              <TreeNode key={r.id} node={r} depth={0} {...{ byParent, expanded, toggle, pathIds, currentId, onNavigate, fileCounts }} />
            ))
          )}
        </section>
      </div>
    </aside>
  );
}
