import type { Connection, Edge } from "@xyflow/react";

/**
 * Minimal node shape for connection validation (planner, tests, agent helpers).
 */
export type WorkflowNodeForConnection = {
  id: string;
  type?: string | null;
  data?: unknown;
};

/** Logical handle category used by isValidWorkflowConnection (matches WorkflowCanvas rules). */
export type WorkflowHandleCategory =
  | "image"
  | "text"
  | "video"
  | "audio"
  | "3d"
  | "easeCurve"
  | null;

/**
 * Map a React Flow handle id to a connection category.
 * Generic router handles return null (wildcard).
 */
export function getHandleType(
  handleId: string | null | undefined
): WorkflowHandleCategory {
  if (!handleId) return null;
  if (handleId === "generic-input" || handleId === "generic-output") return null;
  if (handleId === "easeCurve") return "easeCurve";
  if (handleId === "3d") return "3d";
  if (handleId === "video") return "video";
  if (handleId === "audio" || handleId.startsWith("audio")) return "audio";
  if (handleId === "image" || handleId === "text") return handleId;
  if (handleId.includes("video")) return "video";
  if (
    handleId.startsWith("image-") ||
    handleId.includes("image") ||
    handleId.includes("frame")
  ) {
    return "image";
  }
  if (
    handleId.startsWith("text-") ||
    handleId === "prompt" ||
    handleId === "negative_prompt" ||
    handleId.includes("prompt")
  ) {
    return "text";
  }
  return null;
}

/**
 * Static handle ids per node type (dynamic handles on video/3d/audio are not listed).
 * Used by the planner / docs; runtime may expose image-0, text-1, etc.
 */
export function getNodeHandles(nodeType: string): {
  inputs: string[];
  outputs: string[];
} {
  switch (nodeType) {
    case "mediaInput":
      return {
        inputs: ["reference", "audio", "3d"],
        outputs: ["image", "audio", "video"],
      };
    case "annotation":
      return { inputs: ["image"], outputs: ["image"] };
    case "prompt":
      return { inputs: ["text", "image"], outputs: ["text"] };
    case "generateImage":
      return { inputs: ["image", "text"], outputs: ["image"] };
    case "cameraAngleControl":
      return { inputs: ["image", "text"], outputs: ["image"] };
    case "generateVideo":
      return { inputs: ["image", "text"], outputs: ["video"] };
    case "generate3d":
      return { inputs: ["image", "text"], outputs: ["3d"] };
    case "generateAudio":
      return { inputs: ["text"], outputs: ["audio"] };
    case "imageCompare":
      return { inputs: ["image", "image-1"], outputs: [] };
    case "easeCurve":
      return {
        inputs: ["video", "easeCurve"],
        outputs: ["video", "easeCurve"],
      };
    case "router":
      return {
        inputs: [
          "image",
          "text",
          "video",
          "audio",
          "3d",
          "easeCurve",
          "generic-input",
        ],
        outputs: [
          "image",
          "text",
          "video",
          "audio",
          "3d",
          "easeCurve",
          "generic-output",
        ],
      };
    case "switch":
      return { inputs: ["generic-input"], outputs: [] };
    case "conditionalSwitch":
      return { inputs: ["text"], outputs: [] };
    case "glbViewer":
      return { inputs: ["3d"], outputs: ["image"] };
    default:
      return { inputs: [], outputs: [] };
  }
}

/**
 * Same rules as WorkflowCanvas `isValidConnection` — kept in one module for agent + backend docs parity.
 */
export function isValidWorkflowConnection(
  connection: Connection | Edge,
  nodes: readonly WorkflowNodeForConnection[]
): boolean {
  const sourceType = getHandleType(connection.sourceHandle);
  const targetType = getHandleType(connection.targetHandle);

  const targetNode = nodes.find((n) => n.id === connection.target);
  const sourceNode = nodes.find((n) => n.id === connection.source);
  if (targetNode?.type === "switch" && connection.targetHandle === "generic-input")
    return true;

  if (sourceNode?.type === "switch") {
    const switchData = sourceNode.data as { inputType?: string | null } | undefined;
    if (switchData?.inputType && targetType) {
      return switchData.inputType === targetType;
    }
    return true;
  }

  if (targetNode?.type === "conditionalSwitch") {
    return sourceType === "text";
  }
  if (sourceNode?.type === "conditionalSwitch") {
    return targetType === "text";
  }

  if (!sourceType || !targetType) return true;

  if (sourceType === "easeCurve" || targetType === "easeCurve") {
    const tn = nodes.find((n) => n.id === connection.target);
    const sn = nodes.find((n) => n.id === connection.source);
    if (tn?.type === "router" || sn?.type === "router") return true;
    if (sourceType !== "easeCurve" || targetType !== "easeCurve") return false;
    return tn?.type === "easeCurve";
  }

  if (sourceType === "video") {
    const tn = nodes.find((n) => n.id === connection.target);
    if (!tn) return false;
    const targetNodeType = tn.type;
    if (
      targetNodeType === "generateVideo" ||
      targetNodeType === "easeCurve" ||
      targetNodeType === "router"
    ) {
      return true;
    }
    return false;
  }

  if (sourceType === "3d" || targetType === "3d") {
    const sn = nodes.find((n) => n.id === connection.source);
    const tn = nodes.find((n) => n.id === connection.target);
    if (sn?.type === "router" || tn?.type === "router") return true;
    return sourceType === "3d" && targetType === "3d";
  }

  if (sourceType === "audio" || targetType === "audio") {
    if (sourceType === "audio") {
      const tn = nodes.find((n) => n.id === connection.target);
      if (tn?.type === "router") return true;
    }
    return sourceType === "audio" && targetType === "audio";
  }

  return sourceType === targetType;
}

/**
 * After connect, stored handles may differ from the plan (router/switch resolution).
 */
export function planEdgeMatchesStoreEdge(
  plan: {
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  },
  edge: {
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }
): boolean {
  if (edge.source !== plan.source || edge.target !== plan.target) return false;

  const planSource = plan.sourceHandle != null ? String(plan.sourceHandle).trim() : "";
  const planTarget = plan.targetHandle != null ? String(plan.targetHandle).trim() : "";
  // Without at least one planned handle we cannot tell this edge is the right one — any
  // existing link A→B would falsely "verify" and skip the store apply.
  if (!planSource && !planTarget) return false;

  const handleCompat = (
    planned: string,
    actual: string | null | undefined
  ): boolean => {
    if (!planned) return true;
    const a = actual != null ? String(actual).trim() : "";
    if (!a) return false;
    if (planned === a) return true;
    if (planned === "generic-input" || planned === "generic-output") return true;
    const pt = getHandleType(planned);
    const at = getHandleType(a);
    if (pt && at) return pt === at;
    return false;
  };

  return (
    handleCompat(planSource, edge.sourceHandle) &&
    handleCompat(planTarget, edge.targetHandle)
  );
}
