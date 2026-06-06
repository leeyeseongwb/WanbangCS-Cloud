import { useEffect, useRef } from "react";
import { Download, Eye, EyeOff, Trash2 } from "lucide-react";

export default function ContextMenu({ x, y, onClose, items }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("contextmenu", onClose);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("contextmenu", onClose);
    };
  }, [onClose]);

  // Adjust position so menu doesn't go off screen
  const style = {
    position: "fixed",
    top: Math.min(y, window.innerHeight - 200),
    left: Math.min(x, window.innerWidth - 200),
    zIndex: 9999,
  };

  return (
    <div
      ref={ref}
      style={style}
      className="bg-card border border-border rounded-xl shadow-xl py-1.5 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} className="my-1 border-t border-border" />
        ) : (
          <button
            key={i}
            onClick={() => { item.onClick(); onClose(); }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-secondary transition-colors text-left ${
              item.danger ? "text-destructive hover:bg-destructive/10" : "text-foreground"
            }`}
          >
            {item.icon && <item.icon className="h-4 w-4 flex-shrink-0" />}
            {item.label}
          </button>
        )
      )}
    </div>
  );
}