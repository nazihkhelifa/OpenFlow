"""
Canvas connection rules aligned with openflow/src/lib/workflow/canvasConnectionRules.ts
and WorkflowCanvas isValidConnection.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional


def get_handle_type(handle_id: Optional[str]) -> Optional[str]:
    if not handle_id:
        return None
    hid = str(handle_id)
    if hid in ("generic-input", "generic-output"):
        return None
    if hid == "easeCurve":
        return "easeCurve"
    if hid == "3d":
        return "3d"
    if hid == "video":
        return "video"
    if hid == "audio" or hid.startswith("audio"):
        return "audio"
    if hid in ("image", "text"):
        return hid
    if "video" in hid:
        return "video"
    if (
        hid.startswith("image-")
        or "image" in hid
        or "frame" in hid
    ):
        return "image"
    if (
        hid.startswith("text-")
        or hid == "prompt"
        or hid == "negative_prompt"
        or "prompt" in hid
    ):
        return "text"
    return None


def _node_by_id(nodes: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    for n in nodes:
        if not isinstance(n, dict):
            continue
        nid = n.get("id")
        if nid:
            out[str(nid)] = n
    return out


def is_valid_workflow_connection(
    connection: Dict[str, Any],
    nodes: List[Dict[str, Any]],
) -> bool:
    """Mirror isValidWorkflowConnection (TypeScript)."""
    source_type = get_handle_type(connection.get("sourceHandle"))
    target_type = get_handle_type(connection.get("targetHandle"))
    by_id = _node_by_id(nodes)

    target_node = by_id.get(str(connection.get("target") or ""))
    source_node = by_id.get(str(connection.get("source") or ""))

    if target_node and target_node.get("type") == "switch":
        if connection.get("targetHandle") == "generic-input":
            return True

    if source_node and source_node.get("type") == "switch":
        data = source_node.get("data") if isinstance(source_node.get("data"), dict) else {}
        input_type = data.get("inputType")
        if input_type and target_type:
            return str(input_type) == str(target_type)
        return True

    if target_node and target_node.get("type") == "conditionalSwitch":
        return source_type == "text"
    if source_node and source_node.get("type") == "conditionalSwitch":
        return target_type == "text"

    if not source_type or not target_type:
        return True

    if source_type == "easeCurve" or target_type == "easeCurve":
        tn = by_id.get(str(connection.get("target") or ""))
        sn = by_id.get(str(connection.get("source") or ""))
        if (tn and tn.get("type") == "router") or (sn and sn.get("type") == "router"):
            return True
        if source_type != "easeCurve" or target_type != "easeCurve":
            return False
        return bool(tn and tn.get("type") == "easeCurve")

    if source_type == "video":
        tn = by_id.get(str(connection.get("target") or ""))
        if not tn:
            return False
        tnt = tn.get("type")
        if tnt in ("generateVideo", "easeCurve", "router"):
            return True
        return False

    if source_type == "3d" or target_type == "3d":
        sn = by_id.get(str(connection.get("source") or ""))
        tn = by_id.get(str(connection.get("target") or ""))
        if (sn and sn.get("type") == "router") or (tn and tn.get("type") == "router"):
            return True
        return source_type == "3d" and target_type == "3d"

    if source_type == "audio" or target_type == "audio":
        if source_type == "audio":
            tn = by_id.get(str(connection.get("target") or ""))
            if tn and tn.get("type") == "router":
                return True
        return source_type == "audio" and target_type == "audio"

    return source_type == target_type


def validate_planned_edge(
    source: str,
    target: str,
    source_handle: Optional[str],
    target_handle: Optional[str],
    nodes: List[Dict[str, Any]],
) -> Optional[str]:
    """
    Return an error string if this edge would be rejected by the canvas, else None.
    """
    conn = {
        "source": source,
        "target": target,
        "sourceHandle": source_handle,
        "targetHandle": target_handle,
    }
    if not is_valid_workflow_connection(conn, nodes):
        return (
            f"Invalid connection for canvas rules: {source}:{source_handle} -> {target}:{target_handle}"
        )
    return None


def handle_id_allowed(handle_id: str, schema: Dict[str, Any]) -> bool:
    """Planner / builder handle strings: base types, extras, and indexed suffixes."""
    h = str(handle_id).strip()
    if not h:
        return False
    base = set(str(x) for x in (schema.get("handleTypes") or []))
    extra = set(str(x) for x in (schema.get("extraHandleIds") or []))
    if h in base or h in extra:
        return True
    pat = schema.get("handleIdSuffixPattern")
    if pat and re.match(str(pat), h):
        return True
    return False
