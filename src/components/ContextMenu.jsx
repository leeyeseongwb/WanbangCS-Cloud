import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Google Drive style context menu.
// items: [{ icon, label, shortcut, onClick, danger, disabled } | { separator: true } | { header: "text" }]
export default function ContextMenu({ x, y, onClose, items }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Clamp to the viewport once we know the real menu size.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const pad = 8;
    setPos({
      left: Math.max(pad, Math.min(x, window.innerWidth - width - pad)),
      top: Math.max(pad, Math.min(y, window.innerHeight - height - pad)),
    });
  }, [x, y, items]);

  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("blur", onClose);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      style={{ position: "fixed", left: pos.left, top: pos.top, zIndex: 9999 }}
      onContextMenu={(e) => e.preventDefault()}
      className="min-w-[230px] max-w-[300px] bg-card text-card-foreground border border-border rounded-xl shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-100"
    >
      {items.map((item, i) => {
        if (item.separator) return <div key={i} className="my-1.5 border-t border-border" />;
        if (item.header) {
          return (
            <div key={i} className="px-4 py-1.5 text-xs font-medium text-muted-foreground truncate">
              {item.header}
            </div>
          );
        }
        const Icon = item.icon;
        return (
          <button
            key={i}
            role="menuitem"
            disabled={item.disabled}
            onClick={() => { onClose(); item.onClick?.(); }}
            className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors disabled:opacity-40 disabled:pointer-events-none ${
              item.danger ? "text-destructive hover:bg-destructive/10" : "hover:bg-secondary"
            }`}
          >
            {Icon && <Icon className={`h-4 w-4 flex-shrink-0 ${item.danger ? "" : "text-muted-foreground"}`} />}
            <span className="flex-1 truncate">{item.label}</span>
            {item.shortcut && <span className="text-xs text-muted-foreground">{item.shortcut}</span>}
          </button>
        );
      })}
    </div>
  );
}
