/**
 * Video Processing Executors
 *
 * Executors for easeCurve nodes.
 * Used by both executeWorkflow and regenerateNode.
 */

import type { EaseCurveNodeData } from "@/types";
import { revokeBlobUrl } from "@/store/utils/executionUtils";
import type { NodeExecutionContext } from "./types";

/**
 * EaseCurve: applies speed curve to a video input.
 */
export async function executeEaseCurve(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData, getEdges, getNodes } = ctx;
  const nodeData = node.data as EaseCurveNodeData;

  if (nodeData.encoderSupported === false) {
    updateNodeData(node.id, {
      status: "error",
      error: "Browser does not support video encoding",
      progress: 0,
    });
    throw new Error("Browser does not support video encoding");
  }

  updateNodeData(node.id, { status: "loading", progress: 0, error: null });

  try {
    const inputs = getConnectedInputs(node.id);

    // Propagate parent easeCurve settings if inherited
    let activeBezierHandles = nodeData.bezierHandles;
    let activeEasingPreset = nodeData.easingPreset;
    if (inputs.easeCurve) {
      activeBezierHandles = inputs.easeCurve.bezierHandles;
      activeEasingPreset = inputs.easeCurve.easingPreset;
      const edges = getEdges();
      const easeCurveSourceId =
        edges.filter(
          (e) => e.target === node.id && e.targetHandle === "easeCurve"
        )[0]?.source ?? null;
      updateNodeData(node.id, {
        bezierHandles: activeBezierHandles,
        easingPreset: activeEasingPreset,
        inheritedFrom: easeCurveSourceId,
      });
    }

    if (inputs.videos.length === 0) {
      updateNodeData(node.id, {
        status: "error",
        error: "Connect a video input to apply ease curve",
        progress: 0,
      });
      throw new Error("Connect a video input to apply ease curve");
    }

    const videoUrl = inputs.videos[0];
    const videoBlob = await fetch(videoUrl).then((r) => r.blob());

    // Get video duration for warpTime input
    const videoDuration = await new Promise<number>((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        resolve(video.duration);
        URL.revokeObjectURL(video.src);
      };
      video.onerror = () => {
        resolve(5); // Fallback to 5 seconds
        URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(videoBlob);
    });

    // Determine easing function: use named preset if set, otherwise create from Bezier handles
    let easingFunction: string | ((t: number) => number);
    if (activeEasingPreset) {
      easingFunction = activeEasingPreset;
    } else {
      const { createBezierEasing } = await import("@/lib/easing-functions");
      easingFunction = createBezierEasing(
        activeBezierHandles[0],
        activeBezierHandles[1],
        activeBezierHandles[2],
        activeBezierHandles[3]
      );
    }

    const { applySpeedCurveAsync } = await import("@/hooks/useApplySpeedCurve");
    const outputBlob = await applySpeedCurveAsync(
      videoBlob,
      videoDuration,
      nodeData.outputDuration,
      (progress) => {
        updateNodeData(node.id, { progress: progress.progress });
      },
      easingFunction
    );

    if (!outputBlob) {
      throw new Error("Speed curve processing returned no output");
    }

    // Revoke old blob URL before replacing
    const oldData = getNodes().find((n) => n.id === node.id)?.data as
      | Record<string, unknown>
      | undefined;
    revokeBlobUrl(oldData?.outputVideo as string | undefined);

    let outputVideo: string;
    if (outputBlob.size > 20 * 1024 * 1024) {
      outputVideo = URL.createObjectURL(outputBlob);
    } else {
      const reader = new FileReader();
      outputVideo = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("FileReader error while reading ease curve video"));
        reader.onabort = () => reject(new Error("FileReader aborted while reading ease curve video"));
        reader.readAsDataURL(outputBlob);
      });
    }

    updateNodeData(node.id, {
      outputVideo,
      status: "complete",
      progress: 100,
      error: null,
    });
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Ease curve processing failed";
    updateNodeData(node.id, {
      status: "error",
      error: errorMessage,
      progress: 0,
    });
    throw err instanceof Error ? err : new Error(errorMessage);
  }
}
