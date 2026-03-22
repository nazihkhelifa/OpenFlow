"use client";

import { User, LayoutTemplate, Search, Plus } from "lucide-react";

export type ProjectsViewTab = "mine" | "templates";

type ProjectsStickyHeaderProps = {
  activeTab: ProjectsViewTab;
  onTabChange: (tab: ProjectsViewTab) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  onNewProjectClick?: () => void;
};

export function ProjectsStickyHeader({
  activeTab,
  onTabChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search projects...",
  onNewProjectClick,
}: ProjectsStickyHeaderProps) {
  const tabClasses = [
    "flex items-center justify-center gap-2 font-medium transition duration-150 ease-in-out",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "aria-pressed:cursor-default aria-pressed:opacity-100",
    "outline-none focus:outline-none focus-visible:outline-none active:outline-none",
    "h-9 px-4 text-xs rounded-full w-full whitespace-nowrap",
  ].join(" ");

  const ghostClasses =
    "bg-transparent text-[#9aa0a6] hover:bg-white/[0.06] active:bg-white/[0.08]";
  const secondaryClasses =
    "bg-[#303136] text-white shadow-none aria-pressed:bg-[#3c3e45] hover:bg-[#383a42] active:bg-[#3c3e45]";

  return (
    <div className="mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onTabChange("mine")}
              aria-pressed={activeTab === "mine"}
              className={`${tabClasses} ${activeTab === "mine" ? secondaryClasses : ghostClasses}`}
              data-cy="boards-filter-mine-button"
            >
              <User className="hidden md:block size-3.5" aria-hidden />
              <span className="truncate">My projects</span>
            </button>
            <button
              type="button"
              onClick={() => onTabChange("templates")}
              aria-pressed={activeTab === "templates"}
              className={`${tabClasses} ${activeTab === "templates" ? secondaryClasses : ghostClasses}`}
              data-cy="boards-tab-templates-button"
            >
              <LayoutTemplate className="hidden md:block size-3.5" aria-hidden />
              <span className="truncate">Templates</span>
            </button>
          </div>
          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className="relative flex-1 max-w-xs">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#80868b]"
                aria-hidden
              />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                data-cy="boards-search-input"
                className="block h-9 w-full rounded-full border border-[#3c3d45] bg-[#25262c] py-2 pl-9 pr-3 text-xs text-white placeholder:text-[#80868b] focus:border-[#5f6368] focus:outline-none"
              />
            </div>
            {onNewProjectClick && (
              <button
                type="button"
                onClick={onNewProjectClick}
                className="flex h-9 shrink-0 items-center gap-2 rounded-full bg-white px-4 text-xs font-medium text-[#191a1f] transition-colors hover:bg-[#e8eaed] active:bg-[#dadce0]"
              >
                <Plus className="h-4 w-4" />
                New Project
              </button>
            )}
          </div>
        </div>
      </div>
  );
}
