import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import Sidebar from "./Sidebar";

export default function MobileSidebar({ activeCategory, onCategoryChange, onUploadClick, onNewFolderClick, isManager, managerName, onLoginClick, onLogout }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-64">
        <Sidebar
          activeCategory={activeCategory}
          onCategoryChange={onCategoryChange}
          onUploadClick={onUploadClick}
          onNewFolderClick={onNewFolderClick}
          isManager={isManager}
          managerName={managerName}
          onLoginClick={onLoginClick}
          onLogout={onLogout}
        />
      </SheetContent>
    </Sheet>
  );
}