import type { CameraAngleControlNodeData } from "@/types";
import type { NodeExecutionContext } from "./types";
import { executeNanoBanana } from "./nanoBananaExecutor";

function buildCameraAnglePrompt(data: CameraAngleControlNodeData, connectedText: string | null): string {
  const userPrompt = (connectedText ?? data.cameraPrompt ?? "").trim();
  const { rotation, tilt, zoom, wideAngle } = data.angleSettings;
  const parts = [
    "Generate a new camera angle from the input image while preserving the same subject and scene identity.",
    `Rotation: ${rotation} degrees.`,
    `Tilt: ${tilt} degrees.`,
    `Zoom: ${zoom} percent.`,
    wideAngle ? "Use a wide-angle lens look." : "Use a standard lens look.",
  ];
  if (userPrompt) parts.push(userPrompt);
  return parts.join(" ");
}

export async function executeCameraAngleControl(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData, getFreshNode } = ctx;
  const freshNode = getFreshNode(node.id);
  const nodeData = (freshNode?.data || node.data) as CameraAngleControlNodeData;
  const connected = getConnectedInputs(node.id);
  const composedPrompt = buildCameraAnglePrompt(nodeData, connected.text);

  updateNodeData(node.id, {
    inputImages: connected.images.length > 0 ? connected.images : nodeData.inputImages,
    inputPrompt: composedPrompt,
  });

  await executeNanoBanana(ctx, { useStoredFallback: true });
}

