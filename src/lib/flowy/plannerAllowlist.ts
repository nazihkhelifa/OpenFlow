/**
 * Flowy canvas planner allowlists.
 *
 * Canonical node types exposed to the Flowy planner.
 * Keep `planner_schema.json` in sync — run tests.
 */
import type { NodeType } from "@/types/nodes";

export const FLOWY_PLANNER_NODE_TYPES = [
  "mediaInput",
  "annotation",
  "comment",
  "prompt",
  "generateImage",
  "generateVideo",
  "generateAudio",
  "imageCompare",
  "easeCurve",
  "router",
  "switch",
  "conditionalSwitch",
  "generate3d",
  "glbViewer",
] as const satisfies readonly NodeType[];
