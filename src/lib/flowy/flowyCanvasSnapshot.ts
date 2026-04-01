import type { WorkflowFile } from "@/store/workflowStore";
import { useWorkflowStore } from "@/store/workflowStore";
import { isFileProjectId } from "@/lib/project-types";

/** Canvas state captured after Flowy applies edit operations (stored per chat message / thread). */
export type FlowyCanvasSnapshot = {
  version: 1;
  capturedAt: number;
  nodes: WorkflowFile["nodes"];
  edges: WorkflowFile["edges"];
  edgeStyle: WorkflowFile["edgeStyle"];
  groups: WorkflowFile["groups"];
};

export function captureFlowyCanvasSnapshot(): FlowyCanvasSnapshot {
  const s = useWorkflowStore.getState();
  const nodes = s.nodes.map(({ selected: _s, ...rest }) => rest);
  return {
    version: 1,
    capturedAt: Date.now(),
    nodes: JSON.parse(JSON.stringify(nodes)) as WorkflowFile["nodes"],
    edges: JSON.parse(JSON.stringify(s.edges)) as WorkflowFile["edges"],
    edgeStyle: s.edgeStyle,
    groups: JSON.parse(JSON.stringify(s.groups ?? {})) as WorkflowFile["groups"],
  };
}

export function isFlowyCanvasSnapshot(raw: unknown): raw is FlowyCanvasSnapshot {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
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

/** Fire-and-forget: persists snapshot next to the file-backed project (when project id is a directory path). */
export function persistFlowySnapshotToBackend(opts: {
  projectId: string | null;
  sessionId: string;
  messageId: string;
  snapshot: FlowyCanvasSnapshot;
}): void {
  const { projectId, sessionId, messageId, snapshot } = opts;
  if (!projectId || !isFileProjectId(projectId)) return;
  void fetch("/api/flowy/agent-canvas-snapshots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, sessionId, messageId, snapshot }),
  }).catch(() => {});
}
