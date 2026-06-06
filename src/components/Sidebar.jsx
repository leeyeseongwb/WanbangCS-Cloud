import { HardDrive, FileText, Image, Video, Music, Archive, FolderOpen, Upload, FolderPlus, LogIn, LogOut, User } from "lucide-react";
import DarkModeToggle from "./DarkModeToggle";

const categories = [
{ key: "all", label: "All Files", icon: FolderOpen },
{ key: "document", label: "Documents", icon: FileText },
{ key: "image", label: "Images", icon: Image },
{ key: "video", label: "Videos", icon: Video },
{ key: "audio", label: "Audio", icon: Music },
{ key: "archive", label: "Archives", icon: Archive }];


export default function Sidebar({ activeCategory, onCategoryChange, onUploadClick, onNewFolderClick, isManager, managerName, onLoginClick, onLogout }) {
  return (
    <aside className="w-64 h-screen fixed left-0 top-0 bg-card border-r border-border flex flex-col z-20">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
          <HardDrive className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight font-heading">WBCS Disk</h1>
          <p className="text-[11px] text-muted-foreground -mt-0.5">Harbin Wanbang School</p>
        </div>
      </div>

      {/* Manager actions */}
      {isManager &&
      <div className="px-4 mb-4 space-y-2">
          <button
          onClick={onUploadClick}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
          
            <Upload className="h-4 w-4" />
            Upload File
          </button>
          <button
          onClick={onNewFolderClick}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground font-medium text-sm hover:bg-secondary/80 transition-colors border border-border">
          
            <FolderPlus className="h-4 w-4" />
            New Folder
          </button>
        </div>
      }

      {/* Categories */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        <p className="px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Categories
        </p>
        {categories.map(({ key, label, icon: Icon }) => {
          const active = activeCategory === key;
          return (
            <button
              key={key}
              onClick={() => onCategoryChange(key)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              active ?
              "bg-primary/10 text-primary font-medium" :
              "text-muted-foreground hover:bg-secondary hover:text-foreground"}`
              }>
              
              <Icon className="h-4 w-4" />
              {label}
            </button>);

        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border space-y-2">
        {isManager ?
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-primary" />
              <span className="font-medium truncate max-w-[100px]">{managerName}</span>
            </div>
            <button onClick={onLogout} title="Logout" className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </button>
          </div> :

        <button
          onClick={onLoginClick}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          
            <LogIn className="h-4 w-4" />
            Manager Login
          </button>
        }
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">© 2026 WBCS Disk</span>
          <DarkModeToggle />
        </div>
      </div>
    </aside>);

}