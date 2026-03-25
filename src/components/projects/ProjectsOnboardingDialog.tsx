"use client";

import { useState } from "react";
import { FolderOpen, Settings } from "lucide-react";
import {
  getDefaultProjectDirectory,
  setDefaultProjectDirectory,
} from "@/store/utils/localStorage";

interface ProjectsOnboardingDialogProps {
  isOpen: boolean;
  onStart: () => void;
  onOpenSetup: () => void;
}

export function ProjectsOnboardingDialog({
  isOpen,
  onStart,
  onOpenSetup,
}: ProjectsOnboardingDialogProps) {
  const [directory, setDirectory] = useState(() => getDefaultProjectDirectory());
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [isSavingDirectory, setIsSavingDirectory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBrowseDefault = async () => {
    setIsBrowsing(true);
    setError(null);
    try {
      const response = await fetch("/api/browse-directory");
      const result = await response.json();
      if (result.success && !result.cancelled && result.path) {
        setDirectory(result.path);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to browse directories");
    } finally {
      setIsBrowsing(false);
    }
  };

  const handleSaveDirectory = () => {
    setIsSavingDirectory(true);
    try {
      setDefaultProjectDirectory(directory.trim());
    } finally {
      setIsSavingDirectory(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[92%] max-w-[680px] rounded-2xl border border-neutral-700/80 bg-neutral-900/95 shadow-2xl">
        <div className="border-b border-neutral-700/60 px-6 py-5">
          <h2 className="text-xl font-semibold text-neutral-100">Welcome to Projects</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Set your defaults once, then start creating projects faster.
          </p>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            <label className="mb-1 block text-sm text-neutral-400">Default project directory</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={directory}
                onChange={(e) => setDirectory(e.target.value)}
                placeholder="/Users/username/projects"
                className="flex-1 rounded-lg border border-neutral-600 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleBrowseDefault}
                disabled={isBrowsing}
                className="inline-flex items-center gap-2 rounded-lg bg-neutral-700 px-3 py-2 text-sm text-neutral-200 transition-colors hover:bg-neutral-600 disabled:opacity-50"
              >
                <FolderOpen className="h-4 w-4" />
                {isBrowsing ? "..." : "Browse"}
              </button>
              <button
                type="button"
                onClick={handleSaveDirectory}
                disabled={isSavingDirectory}
                className="rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-200 transition-colors hover:bg-neutral-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Used as the base folder for project list and new project creation.
            </p>
            {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
          </div>

          <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-neutral-100">Model and Node defaults</h3>
                <p className="mt-1 text-xs text-neutral-400">
                  Choose which models are available and auto-selected for new nodes.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenSetup}
                className="inline-flex items-center gap-2 rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-200 transition-colors hover:bg-neutral-700"
              >
                <Settings className="h-4 w-4" />
                Open setup
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-neutral-700/60 px-6 py-4">
          <button
            type="button"
            onClick={onStart}
            className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-950 transition-colors hover:bg-white"
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
}
