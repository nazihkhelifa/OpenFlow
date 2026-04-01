import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { validateWorkflowPath } from "@/utils/pathValidation";
import { isFileProjectId } from "@/lib/project-types";

export const runtime = "nodejs";

type SnapshotStoreFile = {
  entries: Array<{
    sessionId: string;
    messageId: string;
    updatedAt: number;
    snapshot: unknown;
  }>;
};

function isSnapshotShape(s: unknown): boolean {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return (
    o.version === 1 &&
    typeof o.capturedAt === "number" &&
    Array.isArray(o.nodes) &&
    Array.isArray(o.edges) &&
    typeof o.edgeStyle === "string" &&
    o.groups !== null &&
    typeof o.groups === "object"
  );
}

/**
 * Persists Flowy canvas snapshots for file-backed projects under `.openflow/flowy-canvas-snapshots.json`.
 * Complements client-side localStorage on the same machine; useful for backup and multi-device sync hooks.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const messageId = typeof body.messageId === "string" ? body.messageId : "";
    const snapshot = body.snapshot;
    if (!projectId || !isFileProjectId(projectId)) {
      return NextResponse.json({ ok: false, error: "Invalid projectId" }, { status: 400 });
    }
    if (!sessionId || !messageId || !isSnapshotShape(snapshot)) {
      return NextResponse.json(
        { ok: false, error: "sessionId, messageId, and a valid snapshot are required" },
        { status: 400 }
      );
    }
    const decoded = decodeURIComponent(projectId);
    const pathValidation = validateWorkflowPath(decoded);
    if (!pathValidation.valid || !pathValidation.resolved) {
      return NextResponse.json({ ok: false, error: pathValidation.error || "Invalid path" }, { status: 400 });
    }
    const dir = pathValidation.resolved;
    const openflowDir = path.join(dir, ".openflow");
    const filePath = path.join(openflowDir, "flowy-canvas-snapshots.json");
    await fs.mkdir(openflowDir, { recursive: true });
    let store: SnapshotStoreFile = { entries: [] };
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw) as SnapshotStoreFile;
      if (parsed && Array.isArray(parsed.entries)) store = parsed;
    } catch {
      /* new file */
    }
    const idx = store.entries.findIndex((e) => e.sessionId === sessionId && e.messageId === messageId);
    const entry = { sessionId, messageId, updatedAt: Date.now(), snapshot };
    if (idx >= 0) store.entries[idx] = entry;
    else store.entries.push(entry);
    if (store.entries.length > 500) {
      store.entries = store.entries.slice(-500);
    }
    await fs.writeFile(filePath, JSON.stringify(store, null, 2), "utf-8");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to persist snapshot" },
      { status: 500 }
    );
  }
}
