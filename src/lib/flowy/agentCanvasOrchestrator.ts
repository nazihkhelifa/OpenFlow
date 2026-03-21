import type { EditOperation } from "@/lib/chat/editOperations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MouseAction =
  | { kind: "move"; x: number; y: number; duration: number }
  | { kind: "click"; x: number; y: number }
  | { kind: "clickElement"; selector: string }
  | { kind: "waitForElement"; selector: string; timeout: number }
  | { kind: "typeText"; nodeId: string; field: "prompt" | "inputPrompt"; text: string; charDelay: number }
  | { kind: "storeCall"; label: string; fn: () => void }
  | { kind: "pause"; ms: number };

export interface CursorState {
  x: number;
  y: number;
  actionLabel: string;
  clickRipple: { x: number; y: number; id: number } | null;
}

type CursorSetter = (state: Partial<CursorState>) => void;
type SleepFn = (ms: number) => Promise<void>;

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function getElementCenter(selector: string): { x: number; y: number } | null {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function getNodeScreenCenter(nodeId: string): { x: number; y: number } | null {
  const el = document.querySelector(
    `.react-flow__node[data-id="${CSS.escape(nodeId)}"]`
  ) as HTMLElement | null;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** React Flow adds `react-flow__node-${type}` (e.g. generateImage, prompt). */
function getReactFlowNodeType(nodeId: string): string | null {
  const el = document.querySelector(
    `.react-flow__node[data-id="${CSS.escape(nodeId)}"]`
  ) as HTMLElement | null;
  if (!el) return null;
  for (const cls of el.classList) {
    if (!cls.startsWith("react-flow__node-")) continue;
    const rest = cls.slice("react-flow__node-".length);
    if (!rest || rest === "selected" || rest === "dragging") continue;
    return rest;
  }
  return null;
}

function queryGenerateImageAspectSelect(nodeId: string): HTMLSelectElement | null {
  const panel = document.querySelector(
    '[data-id="control-panel-aspect-ratio"]'
  ) as HTMLSelectElement | null;
  if (panel) {
    const r = panel.getBoundingClientRect();
    // `position: fixed` controls often have null offsetParent; use geometry instead.
    if (r.width > 0 && r.height > 0) return panel;
  }
  const toolbar = document.querySelector(
    `[data-id="generate-image-toolbar-aspect-ratio"][data-openflow-node-id="${CSS.escape(nodeId)}"]`
  ) as HTMLSelectElement | null;
  if (toolbar) {
    const r = toolbar.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return toolbar;
  }
  const inline = document.querySelector(
    `[data-id="generate-image-inline-aspect-ratio"][data-openflow-node-id="${CSS.escape(nodeId)}"]`
  ) as HTMLSelectElement | null;
  if (inline) {
    const r = inline.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return inline;
  }
  return null;
}

function commitNativeSelectValue(select: HTMLSelectElement, value: string): boolean {
  const ok = Array.from(select.options).some((o) => o.value === value);
  if (!ok) return false;
  select.value = value;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function isControlPanelAspectSelect(select: HTMLSelectElement): boolean {
  return select.getAttribute("data-id") === "control-panel-aspect-ratio";
}

/**
 * Move the assist cursor to the top-right control panel (when used), then to the
 * native &lt;select&gt;, click to open/focus, step with Arrow keys so the choice
 * reads visibly, then commit (React still gets input/change).
 */
async function humanLikeSelectAspectRatio(
  select: HTMLSelectElement,
  aspectRatio: string,
  deps: OrchestratorDeps
): Promise<boolean> {
  const { setCursor, getCursorPos, sleep } = deps;
  const options = Array.from(select.options);
  const targetIdx = options.findIndex((o) => o.value === aspectRatio);
  if (targetIdx < 0) return false;

  const viaControlPanel = isControlPanelAspectSelect(select);

  if (viaControlPanel) {
    const panel = document.querySelector(
      '[data-id="openflow-control-panel"]'
    ) as HTMLElement | null;
    if (panel) {
      const pr = panel.getBoundingClientRect();
      if (pr.width > 0 && pr.height > 0) {
        setCursor({ actionLabel: "top-right panel" });
        const wpx = pr.left + pr.width * 0.52;
        const wpy = pr.top + Math.min(96, Math.max(40, pr.height * 0.18));
        await animateCursorTo(wpx, wpy, 580, setCursor, sleep, getCursorPos());
        await sleep(280);
      }
    }
  }

  const rect = select.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  setCursor({ actionLabel: "aspect ratio" });
  await animateCursorTo(cx, cy, viaControlPanel ? 440 : 380, setCursor, sleep, getCursorPos());
  await sleep(160);

  emitClickRipple(cx, cy, setCursor);
  clickElementAt(select);
  await sleep(280);

  select.focus({ preventScroll: true });
  await sleep(120);

  const fromIdx = select.selectedIndex;
  if (fromIdx !== targetIdx) {
    setCursor({ actionLabel: `pick ${aspectRatio}` });
    const stepKey = targetIdx > fromIdx ? "ArrowDown" : "ArrowUp";
    const steps = Math.abs(targetIdx - fromIdx);
    for (let i = 0; i < steps; i++) {
      select.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: stepKey,
          code: stepKey,
          bubbles: true,
          cancelable: true,
        })
      );
      await sleep(130);
    }
  }

  const ok = commitNativeSelectValue(select, aspectRatio);
  await sleep(ok ? 220 : 0);
  return ok;
}

/**
 * Control Panel only mounts when exactly one configurable node is selected in the store.
 * Sync selection via Zustand, then perform a real canvas click so React Flow matches,
 * and wait for the panel/toolbar to render.
 */
async function ensureSingleNodeSelectedOnCanvas(nodeId: string, deps: OrchestratorDeps): Promise<void> {
  const { setCursor, getCursorPos, sleep } = deps;
  deps.ensureNodeSelected?.(nodeId);

  const nodeEl = document.querySelector(
    `.react-flow__node[data-id="${CSS.escape(nodeId)}"]`
  ) as HTMLElement | null;

  if (nodeEl) {
    const rect = nodeEl.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      setCursor({ actionLabel: "select node" });
      await animateCursorTo(cx, cy, 280, setCursor, sleep, getCursorPos());
      await sleep(70);
      emitClickRipple(cx, cy, setCursor);
      clickElementAt(nodeEl);
    }
  }

  await sleep(240);
}

/**
 * Assist mode: change image aspect ratio through the same UI users see —
 * right-hand Control Panel when inline params are off, or the node toolbar when inline is on.
 * (Prompt nodes use the text toolbar for LLM settings; they do not expose aspect ratio.)
 */
async function applyGenerateImageAspectRatioThroughChrome(
  nodeId: string,
  aspectRatio: string,
  deps: OrchestratorDeps
): Promise<boolean> {
  const { setCursor, getCursorPos, sleep } = deps;
  await ensureSingleNodeSelectedOnCanvas(nodeId, deps);

  let select: HTMLSelectElement | null = null;
  for (let i = 0; i < 32; i++) {
    select = queryGenerateImageAspectSelect(nodeId);
    if (select) break;
    await sleep(60);
  }
  if (!select) return false;

  return humanLikeSelectAspectRatio(select, aspectRatio, deps);
}

function getNodeTextarea(nodeId: string): HTMLTextAreaElement | null {
  const nodeEl = document.querySelector(
    `.react-flow__node[data-id="${CSS.escape(nodeId)}"]`
  );
  if (!nodeEl) return null;
  return nodeEl.querySelector("textarea") as HTMLTextAreaElement | null;
}

function getHandleCenter(
  nodeId: string,
  handleId?: string
): { x: number; y: number } | null {
  const nodeEl = document.querySelector(
    `.react-flow__node[data-id="${CSS.escape(nodeId)}"]`
  );
  if (!nodeEl) return null;
  const handleSelector = handleId
    ? `.react-flow__handle[data-handleid="${CSS.escape(handleId)}"]`
    : ".react-flow__handle";
  const handle = nodeEl.querySelector(handleSelector) as HTMLElement | null;
  if (!handle) return null;
  const rect = handle.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// ---------------------------------------------------------------------------
// Smooth cursor motion
// ---------------------------------------------------------------------------

async function animateCursorTo(
  targetX: number,
  targetY: number,
  duration: number,
  setCursor: CursorSetter,
  sleepFn: SleepFn,
  currentPos: { x: number; y: number }
) {
  const steps = Math.max(6, Math.round(duration / 16));
  const dx = targetX - currentPos.x;
  const dy = targetY - currentPos.y;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    setCursor({
      x: currentPos.x + dx * ease,
      y: currentPos.y + dy * ease,
    });
    await sleepFn(16);
  }
  setCursor({ x: targetX, y: targetY });
}

// ---------------------------------------------------------------------------
// Click ripple
// ---------------------------------------------------------------------------

let rippleId = 0;

function emitClickRipple(x: number, y: number, setCursor: CursorSetter) {
  rippleId += 1;
  setCursor({ clickRipple: { x, y, id: rippleId } });
}

// ---------------------------------------------------------------------------
// Real DOM click
// ---------------------------------------------------------------------------

function clickElementAt(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  el.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      clientX: cx,
      clientY: cy,
      view: window,
    })
  );
}

// ---------------------------------------------------------------------------
// Typing simulation into a React-controlled textarea
// ---------------------------------------------------------------------------

async function simulateTyping(
  textarea: HTMLTextAreaElement,
  text: string,
  charDelay: number,
  sleepFn: SleepFn
) {
  textarea.focus();

  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value"
  )?.set;

  for (let i = 0; i < text.length; i++) {
    const partial = text.slice(0, i + 1);
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(textarea, partial);
    } else {
      textarea.value = partial;
    }
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    await sleepFn(charDelay);
  }
}

// ---------------------------------------------------------------------------
// Main executor: runs a single EditOperation as real mouse interactions
// ---------------------------------------------------------------------------

export interface OrchestratorDeps {
  setCursor: CursorSetter;
  getCursorPos: () => { x: number; y: number };
  sleep: SleepFn;
  /** Applies one or more EditOperations via the existing store pipeline */
  applyOps: (ops: EditOperation[]) => void;
  storeUpdateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number };
  flowToScreenPosition: (pos: { x: number; y: number }) => { x: number; y: number };
  setCenter: (x: number, y: number, opts?: { duration?: number; zoom?: number }) => void;
  getViewportZoom: () => number;
  /** Ensures exactly this node is selected so Control Panel / node toolbars reflect it */
  ensureNodeSelected?: (nodeId: string) => void;
}

export async function executeOperationWithMouse(
  op: EditOperation,
  deps: OrchestratorDeps
): Promise<string | null> {
  const { setCursor, getCursorPos, sleep } = deps;

  switch (op.type) {
    case "addNode":
      return await executeAddNode(op, deps);
    case "updateNode":
      return await executeUpdateNode(op, deps);
    case "addEdge":
      return await executeAddEdge(op, deps);
    case "removeNode":
      return await executeRemoveNode(op, deps);
    case "moveNode":
      return await executeMoveNode(op, deps);
    default:
      setCursor({ actionLabel: op.type });
      deps.applyOps([op]);
      await sleep(200);
      return null;
  }
}

// ---------------------------------------------------------------------------
// addNode: click toolbar → click menu item → move node to position → type prompt
// ---------------------------------------------------------------------------

async function executeAddNode(
  op: Extract<EditOperation, { type: "addNode" }>,
  deps: OrchestratorDeps
): Promise<string | null> {
  const { setCursor, getCursorPos, sleep } = deps;

  setCursor({ actionLabel: "opening toolbar" });

  // 1. Move cursor to the "+" button
  const toolbarBtn = getElementCenter('[data-id="add-node-button"]');
  if (toolbarBtn) {
    await animateCursorTo(toolbarBtn.x, toolbarBtn.y, 350, setCursor, sleep, getCursorPos());
    await sleep(120);

    // 2. Click the "+" button (real DOM click)
    const btnEl = document.querySelector('[data-id="add-node-button"]') as HTMLElement;
    if (btnEl) {
      emitClickRipple(toolbarBtn.x, toolbarBtn.y, setCursor);
      clickElementAt(btnEl);
      await sleep(280);
    }
  }

  // 3. Wait for menu to appear and find the target node type
  setCursor({ actionLabel: `selecting ${op.nodeType}` });
  const menuItemSelector = `[data-agent-node-type="${op.nodeType}"]`;
  let attempts = 0;
  let menuItemPos: { x: number; y: number } | null = null;
  while (attempts < 15) {
    menuItemPos = getElementCenter(menuItemSelector);
    if (menuItemPos) break;
    await sleep(80);
    attempts++;
  }

  if (menuItemPos) {
    // 4. Move cursor to the menu item
    await animateCursorTo(menuItemPos.x, menuItemPos.y, 250, setCursor, sleep, getCursorPos());
    await sleep(100);

    // 5. Click the menu item (real DOM click — this triggers the real addNode)
    const menuItemEl = document.querySelector(menuItemSelector) as HTMLElement;
    if (menuItemEl) {
      emitClickRipple(menuItemPos.x, menuItemPos.y, setCursor);
      clickElementAt(menuItemEl);
      await sleep(200);
    }
  } else {
    // Fallback: apply via store if menu item not found
    deps.applyOps([op]);
    await sleep(200);
  }

  // 6. The node was added at pane center. If a specific position is requested, move it.
  //    Find the most recently added node of this type.
  await sleep(150);
  const allNodes = document.querySelectorAll(
    `.react-flow__node[data-id^="${op.nodeType}"]`
  );
  const latestNode = allNodes[allNodes.length - 1] as HTMLElement | null;
  const nodeId = latestNode?.getAttribute("data-id") ?? op.nodeId ?? null;

  if (nodeId && op.position) {
    setCursor({ actionLabel: "positioning" });
    const targetScreen = deps.flowToScreenPosition(op.position);
    const nodeCenter = getNodeScreenCenter(nodeId);
    if (nodeCenter) {
      await animateCursorTo(targetScreen.x, targetScreen.y, 300, setCursor, sleep, getCursorPos());
    }
    deps.storeUpdateNodeData(nodeId, { _agentTouched: Date.now() });
    deps.applyOps([{ type: "moveNode", nodeId, position: op.position }]);
    await sleep(100);
  }

  // 7. If there's prompt data to type, simulate typing
  const promptText =
    (op.data as any)?.prompt ??
    (op.data as any)?.inputPrompt ??
    null;

  if (promptText && nodeId) {
    await typePromptIntoNode(nodeId, promptText, op.nodeType, deps);
  } else if (op.data && nodeId) {
    const payload = { ...(op.data as Record<string, unknown>) };
    if (op.nodeType === "generateImage" && typeof payload.aspectRatio === "string") {
      // DOM assist for Gemini-style selects; always persist to store too (controlled inputs can desync).
      await applyGenerateImageAspectRatioThroughChrome(nodeId, payload.aspectRatio, deps);
    }
    deps.storeUpdateNodeData(nodeId, {
      ...payload,
      _agentTouched: Date.now(),
    });
  }

  // Pan canvas to show the new node
  if (op.position) {
    deps.setCenter(op.position.x + 150, op.position.y + 75, {
      duration: 400,
      zoom: deps.getViewportZoom(),
    });
  }

  return nodeId;
}

// ---------------------------------------------------------------------------
// updateNode: move cursor to node → click textarea → type
// ---------------------------------------------------------------------------

async function executeUpdateNode(
  op: Extract<EditOperation, { type: "updateNode" }>,
  deps: OrchestratorDeps
): Promise<null> {
  const { setCursor, getCursorPos, sleep } = deps;

  setCursor({ actionLabel: "editing" });

  // Check if there's a prompt to type
  const promptText =
    (op.data as any)?.prompt ??
    (op.data as any)?.inputPrompt ??
    null;

  const willApplyImageAspectChrome =
    getReactFlowNodeType(op.nodeId) === "generateImage" &&
    typeof (op.data as Record<string, unknown> | undefined)?.aspectRatio === "string";

  // Control panel + aspect UI: `applyGenerateImageAspectRatioThroughChrome` selects the node
  // and waits for the panel — skip the generic hover so we don't double-move the cursor.
  const skipGenericNodeHover = willApplyImageAspectChrome && !promptText;

  if (!skipGenericNodeHover) {
    const nodeCenter = getNodeScreenCenter(op.nodeId);
    if (nodeCenter) {
      await animateCursorTo(nodeCenter.x, nodeCenter.y, 300, setCursor, sleep, getCursorPos());
      emitClickRipple(nodeCenter.x, nodeCenter.y, setCursor);
      await sleep(150);
    }
  }

  if (promptText) {
    // Find the node type to determine the textarea approach
    const nodeEl = document.querySelector(
      `.react-flow__node[data-id="${CSS.escape(op.nodeId)}"]`
    );
    const nodeType = nodeEl?.getAttribute("data-id")?.split("-")[0] ?? "prompt";
    await typePromptIntoNode(op.nodeId, promptText, nodeType, deps);

    // Apply remaining data (minus prompt fields) via store
    const restData = { ...(op.data as Record<string, unknown>) };
    delete restData.prompt;
    delete restData.inputPrompt;
    let rest = restData;
    if (
      typeof rest.aspectRatio === "string" &&
      getReactFlowNodeType(op.nodeId) === "generateImage"
    ) {
      await applyGenerateImageAspectRatioThroughChrome(op.nodeId, rest.aspectRatio, deps);
    }
    if (Object.keys(rest).length > 0) {
      deps.storeUpdateNodeData(op.nodeId, { ...rest, _agentTouched: Date.now() });
    }
  } else {
    const payload = { ...(op.data as Record<string, unknown>) };
    if (
      typeof payload.aspectRatio === "string" &&
      getReactFlowNodeType(op.nodeId) === "generateImage"
    ) {
      await applyGenerateImageAspectRatioThroughChrome(op.nodeId, payload.aspectRatio, deps);
    }
    if (Object.keys(payload).length > 0) {
      deps.storeUpdateNodeData(op.nodeId, {
        ...payload,
        _agentTouched: Date.now(),
      });
    }
    await sleep(100);
  }

  return null;
}

// ---------------------------------------------------------------------------
// addEdge: move cursor from source handle → target handle → connect via store
// ---------------------------------------------------------------------------

async function executeAddEdge(
  op: Extract<EditOperation, { type: "addEdge" }>,
  deps: OrchestratorDeps
): Promise<null> {
  const { setCursor, getCursorPos, sleep } = deps;

  setCursor({ actionLabel: "connecting" });

  // Move to source handle
  const sourceHandle = getHandleCenter(op.source, op.sourceHandle);
  const sourceNode = getNodeScreenCenter(op.source);
  const sourcePos = sourceHandle ?? sourceNode;
  if (sourcePos) {
    await animateCursorTo(sourcePos.x, sourcePos.y, 300, setCursor, sleep, getCursorPos());
    emitClickRipple(sourcePos.x, sourcePos.y, setCursor);
    await sleep(200);
  }

  // Move to target handle
  const targetHandle = getHandleCenter(op.target, op.targetHandle);
  const targetNode = getNodeScreenCenter(op.target);
  const targetPos = targetHandle ?? targetNode;
  if (targetPos) {
    await animateCursorTo(targetPos.x, targetPos.y, 400, setCursor, sleep, getCursorPos());
    emitClickRipple(targetPos.x, targetPos.y, setCursor);
    await sleep(150);
  }

  // Create the connection via the store pipeline
  deps.applyOps([op]);
  await sleep(200);

  return null;
}

// ---------------------------------------------------------------------------
// removeNode: move cursor to node → use store (keyboard delete)
// ---------------------------------------------------------------------------

async function executeRemoveNode(
  op: Extract<EditOperation, { type: "removeNode" }>,
  deps: OrchestratorDeps
): Promise<null> {
  const { setCursor, getCursorPos, sleep } = deps;

  setCursor({ actionLabel: "removing" });

  const nodeCenter = getNodeScreenCenter(op.nodeId);
  if (nodeCenter) {
    await animateCursorTo(nodeCenter.x, nodeCenter.y, 300, setCursor, sleep, getCursorPos());
    emitClickRipple(nodeCenter.x, nodeCenter.y, setCursor);
    await sleep(200);
  }

  deps.applyOps([op]);
  await sleep(200);

  return null;
}

// ---------------------------------------------------------------------------
// moveNode: animate cursor to new position → store move
// ---------------------------------------------------------------------------

async function executeMoveNode(
  op: Extract<EditOperation, { type: "moveNode" }>,
  deps: OrchestratorDeps
): Promise<null> {
  const { setCursor, getCursorPos, sleep } = deps;

  setCursor({ actionLabel: "moving" });

  const nodeCenter = getNodeScreenCenter(op.nodeId);
  if (nodeCenter) {
    await animateCursorTo(nodeCenter.x, nodeCenter.y, 250, setCursor, sleep, getCursorPos());
    await sleep(100);
  }

  const targetScreen = deps.flowToScreenPosition(op.position);
  await animateCursorTo(targetScreen.x, targetScreen.y, 400, setCursor, sleep, getCursorPos());
  emitClickRipple(targetScreen.x, targetScreen.y, setCursor);

  deps.applyOps([op]);
  await sleep(150);

  return null;
}

// ---------------------------------------------------------------------------
// Shared: type prompt text into a node's textarea
// ---------------------------------------------------------------------------

async function typePromptIntoNode(
  nodeId: string,
  text: string,
  nodeType: string,
  deps: OrchestratorDeps
) {
  const { setCursor, getCursorPos, sleep } = deps;

  setCursor({ actionLabel: "typing" });

  // Find the textarea inside the node
  const textarea = getNodeTextarea(nodeId);
  if (textarea) {
    const rect = textarea.getBoundingClientRect();
    const textareaCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    await animateCursorTo(textareaCenter.x, textareaCenter.y, 200, setCursor, sleep, getCursorPos());
    emitClickRipple(textareaCenter.x, textareaCenter.y, setCursor);
    await sleep(100);

    // Simulate real typing character by character
    const charDelay = Math.max(8, Math.min(25, 1200 / text.length));
    await simulateTyping(textarea, text, charDelay, sleep);
    await sleep(80);
  } else {
    // Fallback: apply via store
    const field = nodeType === "prompt" ? "prompt" : "inputPrompt";
    deps.storeUpdateNodeData(nodeId, { [field]: text, _agentTouched: Date.now() });
    await sleep(100);
  }
}
