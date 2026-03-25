"use client";

import { useCallback } from "react";
import { Handle, Node, NodeProps, Position } from "@xyflow/react";
import { BaseNode } from "../shared/BaseNode";
import { NodeRunButton } from "../shared/NodeRunButton";
import { useWorkflowStore } from "@/store/workflowStore";
import { CameraAngleControlNodeData } from "@/types";
import { OrbitCameraControl } from "./OrbitCameraControl";

type CameraAngleNodeType = Node<CameraAngleControlNodeData, "cameraAngleControl">;

export function CameraAngleControlNode({ id, data, selected }: NodeProps<CameraAngleNodeType>) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const settings = data.angleSettings ?? { rotation: 0, tilt: 0, zoom: 100, wideAngle: false };
  const previewImage = data.inputImages?.[0] ?? data.outputImage ?? null;

  const updateAngle = useCallback(
    (patch: Partial<CameraAngleControlNodeData["angleSettings"]>) => {
      updateNodeData(id, { angleSettings: { ...settings, ...patch } });
    },
    [id, settings, updateNodeData]
  );

  return (
    <BaseNode
      id={id}
      selected={selected}
      isExecuting={isRunning}
      hasError={data.status === "error"}
      fullBleed
      footerRight={<NodeRunButton nodeId={id} disabled={isRunning} />}
    >
      <Handle type="target" position={Position.Left} id="image" style={{ top: "35%", zIndex: 10 }} data-handletype="image" />
      <Handle type="target" position={Position.Left} id="text" style={{ top: "65%", zIndex: 10 }} data-handletype="text" />
      <Handle type="source" position={Position.Right} id="image" style={{ top: "50%", zIndex: 10 }} data-handletype="image" />

      <div className="h-full w-full rounded-2xl border border-neutral-700/80 bg-neutral-900/95 p-3 text-xs text-neutral-200 shadow-2xl">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] font-semibold text-neutral-100">3D Camera Control</div>
          <button
            type="button"
            onClick={() => updateNodeData(id, {
              cameraPrompt: "",
              angleSettings: { rotation: 0, tilt: 0, zoom: 100, wideAngle: false },
            })}
            className="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-300 hover:bg-neutral-700"
          >
            Reset
          </button>
        </div>
        <div className="mb-2 rounded-xl border border-neutral-700/70 bg-[#181d3b] p-2">
          <div className="nodrag nopan" onPointerDown={(e) => e.stopPropagation()}>
            <OrbitCameraControl
              imageUrl={previewImage}
              rotation={settings.rotation}
              tilt={settings.tilt}
              onRotationChange={(value) => updateAngle({ rotation: value })}
              onTiltChange={(value) => updateAngle({ tilt: value })}
            />
          </div>
          <label className="mt-2 block">
            <div className="mb-1 text-[10px] text-neutral-400">Zoom ({settings.zoom}%)</div>
            <input type="range" min={50} max={200} step={1} value={settings.zoom} onChange={(e) => updateAngle({ zoom: Number(e.target.value) })} className="w-full" />
          </label>
        </div>
        <label className="mb-2 flex items-center gap-2 text-[10px] text-neutral-300">
          <input type="checkbox" checked={settings.wideAngle} onChange={(e) => updateAngle({ wideAngle: e.target.checked })} />
          Wide-angle lens
        </label>
        <textarea
          value={data.cameraPrompt ?? ""}
          onChange={(e) => updateNodeData(id, { cameraPrompt: e.target.value })}
          placeholder="Optional camera instruction"
          className="nodrag nopan mb-2 min-h-14 w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-[11px] text-white placeholder:text-neutral-500"
        />
        <div className="rounded-lg border border-emerald-700/70 bg-emerald-900/20 px-2 py-1 text-center text-[11px] text-emerald-300">
          Generate New Angle
        </div>
      </div>
    </BaseNode>
  );
}

