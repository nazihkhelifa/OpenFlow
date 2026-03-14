/**
 * Simple Node Executors
 *
 * Executors for node types that don't call external APIs:
 * annotation, prompt, imageCompare.
 *
 * These are used by executeWorkflow (and some by regenerateNode).
 */

import type {
  AnnotationNodeData,
  PromptNodeData,
  WorkflowNode,
} from "@/types";
import type { NodeExecutionContext } from "./types";
import { parseVarTags } from "@/utils/parseVarTags";
import { buildLlmHeaders } from "@/store/utils/buildApiHeaders";

/**
 * Annotation node: receives upstream image as source, passes through if no annotations.
 */
export async function executeAnnotation(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData } = ctx;
  try {
    const { images } = getConnectedInputs(node.id);
    const image = images[0] || null;
    if (image) {
      const nodeData = node.data as AnnotationNodeData;
      updateNodeData(node.id, { sourceImage: image, sourceImageRef: undefined });
      // Pass through the image if no annotations exist, or if the previous
      // output was itself a pass-through of the old source image
      if (!nodeData.outputImage || nodeData.outputImage === nodeData.sourceImage) {
        updateNodeData(node.id, { outputImage: image, outputImageRef: undefined });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Workflow] Annotation node ${node.id} failed:`, message);
    updateNodeData(node.id, { error: message });
  }
}

/**
 * Prompt node: resolves @variables, then runs LLM generation.
 */
export async function executePrompt(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData, getFreshNode, getEdges, getNodes } = ctx;
  const freshNode = getFreshNode(node.id);
  const nodeData = (freshNode?.data || node.data) as PromptNodeData;
  const template = nodeData.prompt;

  const edges = getEdges();
  const nodes = getNodes();
  const connectedTextNodes = edges
    .filter((e) => e.target === node.id && e.targetHandle === "text")
    .map((e) => nodes.find((n) => n.id === e.source))
    .filter((n): n is WorkflowNode => n !== undefined);

  const variableMap: Record<string, string> = {};
  connectedTextNodes.forEach((srcNode) => {
    if (srcNode.type === "prompt") {
      const d = srcNode.data as PromptNodeData;
      const output = d.outputText ?? null;
      if (d.variableName && output) {
        variableMap[d.variableName] = output;
      }
      if (output) {
        parseVarTags(output).forEach(({ name, value }) => {
          if (variableMap[name] === undefined) variableMap[name] = value;
        });
      }
    }
  });

  let resolvedText = template;
  const varPattern = /@(\w+)/g;
  for (const match of template.matchAll(varPattern)) {
    const varName = match[1];
    if (variableMap[varName] !== undefined) {
      resolvedText = resolvedText.replaceAll(`@${varName}`, variableMap[varName]);
    }
  }

  const inputs = getConnectedInputs(node.id);
  // Prompt source: instructions (bottom) > connected text only. Top is always output, never used as prompt.
  const text = (resolvedText.trim() || inputs.text) ?? nodeData.inputPrompt;
  const images = inputs.images.length > 0 ? inputs.images : (nodeData.inputImages ?? []);

  if (!text) {
    updateNodeData(node.id, { status: "error", error: "Missing prompt - type instructions or connect a text source" });
    throw new Error("Missing prompt");
  }

  updateNodeData(node.id, {
    inputPrompt: text,
    inputImages: images,
    status: "loading",
    error: null,
  });

  const provider = nodeData.provider ?? "google";
  const model = nodeData.model ?? "gemini-2.5-flash";
  const temperature = nodeData.temperature ?? 0.7;
  const maxTokens = nodeData.maxTokens ?? 2048;

  const headers = buildLlmHeaders(provider, ctx.providerSettings);

  try {
    const response = await fetch("/api/llm", {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt: text,
        ...(images.length > 0 && { images }),
        provider,
        model,
        temperature,
        maxTokens,
      }),
      ...(ctx.signal ? { signal: ctx.signal } : {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
      } catch {
        if (errorText) errorMessage += ` - ${errorText.substring(0, 200)}`;
      }
      updateNodeData(node.id, { status: "error", error: errorMessage });
      throw new Error(errorMessage);
    }

    const result = await response.json();
    if (result.success && result.text) {
      updateNodeData(node.id, {
        outputText: result.text,
        status: "complete",
        error: null,
      });
    } else {
      updateNodeData(node.id, {
        status: "error",
        error: result.error || "LLM generation failed",
      });
      throw new Error(result.error || "LLM generation failed");
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    const message = error instanceof Error ? error.message : "LLM generation failed";
    updateNodeData(node.id, { status: "error", error: message });
    throw error;
  }
}

/**
 * ImageCompare node: takes two upstream images for side-by-side comparison.
 */
export async function executeImageCompare(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData } = ctx;
  const { images } = getConnectedInputs(node.id);
  updateNodeData(node.id, {
    imageA: images[0] || null,
    imageB: images[1] || null,
  });
}

/**
 * Router node: pure passthrough with brief status flash.
 */
export async function executeRouter(ctx: NodeExecutionContext): Promise<void> {
  // Router is pure passthrough — data flows via edge traversal in getConnectedInputs.
  // Brief status flash to show execution occurred.
  ctx.updateNodeData(ctx.node.id, { status: "loading" });
  await new Promise(resolve => setTimeout(resolve, 50));
  if (!ctx.signal?.aborted) {
    ctx.updateNodeData(ctx.node.id, { status: "complete" });
  }
}

/**
 * Switch node: pure passthrough with toggle-controlled routing.
 */
export async function executeSwitch(ctx: NodeExecutionContext): Promise<void> {
  // Switch is pure passthrough — data flows via edge traversal in getConnectedInputs.
  // Disabled outputs are filtered during traversal.
  ctx.updateNodeData(ctx.node.id, { status: "loading" });
  await new Promise(resolve => setTimeout(resolve, 50));
  if (!ctx.signal?.aborted) {
    ctx.updateNodeData(ctx.node.id, { status: "complete" });
  }
}

/**
 * ConditionalSwitch node: pure passthrough with text-based rule matching.
 */
export async function executeConditionalSwitch(ctx: NodeExecutionContext): Promise<void> {
  // ConditionalSwitch is pure passthrough — actual text matching happens during connectedInputs traversal.
  // Brief status flash to show execution occurred.
  ctx.updateNodeData(ctx.node.id, { status: "loading" });
  await new Promise(resolve => setTimeout(resolve, 50));
  if (!ctx.signal?.aborted) {
    ctx.updateNodeData(ctx.node.id, { status: "complete" });
  }
}

/**
 * GLB Viewer node: receives 3D model URL from upstream, fetches and loads it.
 */
export async function executeGlbViewer(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData, signal } = ctx;
  const { model3d } = getConnectedInputs(node.id);
  if (model3d) {
    // Fetch the GLB URL and create a blob URL for the viewer
    try {
      const response = await fetch(model3d, signal ? { signal } : {});
      if (!response.ok) {
        throw new Error(`Failed to fetch 3D model: ${response.status}`);
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      updateNodeData(node.id, {
        glbUrl: blobUrl,
        filename: "generated.glb",
        capturedImage: null,
      });
    } catch (error) {
      // Don't set error state on abort
      if ((error instanceof DOMException && error.name === "AbortError") || signal?.aborted) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Workflow] GLB Viewer node ${node.id} failed:`, message);
      updateNodeData(node.id, { error: message });
    }
  }
}
