import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import { validateWorkflowPath } from "@/utils/pathValidation";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { path?: string; newName?: string };
    const sourcePath = body.path?.trim();
    const newName = body.newName?.trim();

    if (!sourcePath || !newName) {
      return NextResponse.json(
        { success: false, error: "path and newName are required" },
        { status: 400 }
      );
    }

    const sourceValidation = validateWorkflowPath(sourcePath);
    if (!sourceValidation.valid) {
      return NextResponse.json(
        { success: false, error: sourceValidation.error },
        { status: 400 }
      );
    }

    const safeName = newName.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
    if (!safeName) {
      return NextResponse.json(
        { success: false, error: "Invalid name" },
        { status: 400 }
      );
    }

    const parentDir = path.dirname(sourceValidation.resolved);
    const targetPath = path.join(parentDir, safeName);
    const targetValidation = validateWorkflowPath(targetPath);
    if (!targetValidation.valid) {
      return NextResponse.json(
        { success: false, error: targetValidation.error },
        { status: 400 }
      );
    }

    await fs.rename(sourceValidation.resolved, targetValidation.resolved);
    return NextResponse.json({ success: true, path: targetValidation.resolved });
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === "EEXIST") {
      return NextResponse.json(
        { success: false, error: "An item with that name already exists" },
        { status: 409 }
      );
    }
    if (err?.code === "ENOENT") {
      return NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to rename item",
      },
      { status: 500 }
    );
  }
}
