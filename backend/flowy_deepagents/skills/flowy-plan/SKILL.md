---
name: flowy-plan
description: Plan and return edit operations for the workflow canvas from the user's message.
---

# Flowy Planner Skill (Compact)

## Job
Given `Message` + current workflow JSON, return one JSON object only:
- `assistantText`
- `operations`
- `requiresApproval: true`
- `approvalReason`
- optional `executeNodeIds`, `runApprovalRequired`

## Planning behavior
- Be autonomous; default when ambiguity is minor.
- Prefer minimal delta: `updateNode` -> edge edits -> `moveNode` -> `addNode`.
- Reuse existing graph before adding duplicates.
- If user asks for full workflow, return complete coherent operations when feasible.
- For variants, create 2-3 branches; if wording differs, use one prompt node per branch.
- If user requests output, set `executeNodeIds`; do not stop at setup-only.

## Operations
- Use supported edit ops only.
- For `clear/reset`, prefer `{"type":"clearCanvas"}`.
- Always include `nodeId` for each `addNode`.

## Prompt data quality
- Preserve user intent and detail.
- Never compress a detailed user prompt into a shorter version.
- For short prompts, enrich with concrete subject/setting/style/motion details.
- Keep technical params (aspect, duration, etc.) in node settings when possible.

## Toolbar intents
- model/settings change -> `updateNode`
- upscale -> add `generateImage`, connect image input, execute new node
- split grid -> add multiple image nodes + `reference` edges
- extract frame -> add image node + `reference` edge from video source
- ease/switch rules -> `updateNode` relevant fields

## Hard fallback
If planning fails, still return valid JSON with empty operations:
`{"assistantText":"...", "operations":[], "requiresApproval":true, "approvalReason":"...", "executeNodeIds":null, "runApprovalRequired":null}`

