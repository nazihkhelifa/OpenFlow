"use client";

import { CheckSquare, MoreVertical, Pencil, Square, Trash2, FolderInput } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { LocalProject } from "@/lib/local-db";
import type { FileProject } from "@/lib/project-types";
import { getProjectThumbnail } from "@/lib/project-thumbnail";
import { formatRelativeTime } from "@/lib/relative-time";

type ProjectCardProps = {
  project: LocalProject | FileProject;
  onDelete: () => void;
  onRename?: () => void;
  onMove?: () => void;
  onToggleSelect?: () => void;
  isSelected?: boolean;
  compact?: boolean;
};

export function ProjectCard({
  project,
  onDelete,
  onRename,
  onMove,
  onToggleSelect,
  isSelected = false,
  compact = false,
}: ProjectCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const thumbnail =
    "content" in project
      ? getProjectThumbnail(project as LocalProject)
      : "thumbnail" in project && (project as FileProject).thumbnail
        ? { url: (project as FileProject).thumbnail!, type: "image" as const }
        : null;
  const name = project.name || "Untitled Project";
  const subtitle = project.updatedAt
    ? formatRelativeTime(project.updatedAt)
    : null;
  const aspectClass = "aspect-tv";

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Delete this project? This cannot be undone.")) {
      onDelete();
    }
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  const cardVisual = (
    <div className="relative h-full w-full">
      {thumbnail ? (
        thumbnail.type === "video" ? (
          <video
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            src={thumbnail.url}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
          />
        ) : (
          <img
            alt={name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            src={thumbnail.url}
          />
        )
      ) : (
        <>
          <img
            src="/thumbnail.jpeg"
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] bg-neutral-800"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.classList.remove("hidden");
            }}
          />
          <div className="hidden absolute inset-0 bg-neutral-800 flex items-center justify-center">
            <span className="text-neutral-500 text-sm">No preview</span>
          </div>
        </>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <p className="text-sm font-medium text-white truncate">{name}</p>
        {subtitle && (
          <p className="text-xs text-white/80 truncate mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );

  if (compact) {
    return (
      <div className="relative flex items-center justify-between rounded-lg border border-transparent px-4 py-3 hover:border-[#2e3038] hover:bg-[#25262c]/80">
        <Link href={`/projects/${project.id}`} className="min-w-0 flex-1">
          <p className="truncate text-sm text-white">{name}</p>
          {subtitle && <p className="mt-0.5 text-xs text-white/70">{subtitle}</p>}
        </Link>
        <div ref={menuRef} className="relative ml-3">
          <button
            type="button"
            className="rounded-md p-1.5 text-white/80 hover:bg-black/30 hover:text-white"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen((open) => !open);
            }}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-40 mt-1 min-w-40 rounded-xl border border-white/10 bg-[#1c1c1c] p-1 shadow-xl">
              <Link href={`/projects/${project.id}`} className="block rounded-lg px-2 py-2 text-xs text-white hover:bg-white/10">Open</Link>
              {onRename && <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-white hover:bg-white/10" onClick={() => { onRename(); setMenuOpen(false); }}><Pencil className="h-3.5 w-3.5" />Rename</button>}
              {onToggleSelect && <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-white hover:bg-white/10" onClick={() => { onToggleSelect(); setMenuOpen(false); }}>{isSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}{isSelected ? "Unselect" : "Select"}</button>}
              {onMove && <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-white hover:bg-white/10" onClick={() => { onMove(); setMenuOpen(false); }}><FolderInput className="h-3.5 w-3.5" />Move to folder</button>}
              <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-red-300 hover:bg-red-500/20" onClick={(e) => { handleDeleteClick(e); setMenuOpen(false); }}><Trash2 className="h-3.5 w-3.5" />Delete</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative cursor-pointer overflow-visible rounded-xl border border-[#2e3038] bg-[#222328] transition-colors hover:border-[#3c3d45] ${aspectClass}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={`/projects/${project.id}`} className="block h-full w-full overflow-hidden rounded-[10px]">
        {cardVisual}
      </Link>

      <div
        ref={menuRef}
        className="absolute top-3 right-3 z-20 transition-opacity duration-200"
        style={{ opacity: isHovered || menuOpen ? 1 : 0 }}
      >
        <button
          type="button"
          className="rounded-full bg-black/30 p-1.5 text-white/80 backdrop-blur-sm hover:bg-black/60 hover:text-white"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((open) => !open);
          }}
          title="Actions"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 min-w-44 rounded-xl border border-white/10 bg-[#1c1c1c] p-1 shadow-xl">
            <Link href={`/projects/${project.id}`} className="block rounded-lg px-2 py-2 text-xs text-white hover:bg-white/10">Open project</Link>
            {onRename && <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-white hover:bg-white/10" onClick={() => { onRename(); setMenuOpen(false); }}><Pencil className="h-3.5 w-3.5" />Rename</button>}
            {onToggleSelect && <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-white hover:bg-white/10" onClick={() => { onToggleSelect(); setMenuOpen(false); }}>{isSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}{isSelected ? "Unselect project" : "Select project"}</button>}
            {onMove && <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-white hover:bg-white/10" onClick={() => { onMove(); setMenuOpen(false); }}><FolderInput className="h-3.5 w-3.5" />Move to folder</button>}
            <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-red-300 hover:bg-red-500/20" onClick={(e) => { handleDeleteClick(e); setMenuOpen(false); }}><Trash2 className="h-3.5 w-3.5" />Delete</button>
          </div>
        )}
      </div>
    </div>
  );
}
