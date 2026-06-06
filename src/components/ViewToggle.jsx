import { LayoutGrid, List, Grid2x2 } from "lucide-react";

const views = [
  { key: "grid", icon: LayoutGrid, label: "Grid" },
  { key: "list", icon: List, label: "List" },
  { key: "compact", icon: Grid2x2, label: "Compact" },
];

export default function ViewToggle({ view, onChange }) {
  return (
    <div className="flex items-center bg-secondary rounded-lg p-1 gap-0.5">
      {views.map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          title={label}
          onClick={() => onChange(key)}
          className={`p-1.5 rounded-md transition-colors ${
            view === key
              ? "bg-card shadow text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}