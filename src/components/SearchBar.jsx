import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function SearchBar({ value, onChange }) {
  return (
    <div className="relative flex-1 max-w-xl">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by file name or type (e.g. image, pdf)..."
        className="pl-9 pr-4 bg-secondary/50 border-border focus-visible:ring-1 focus-visible:bg-background transition-colors w-full"
      />
    </div>
  );
}