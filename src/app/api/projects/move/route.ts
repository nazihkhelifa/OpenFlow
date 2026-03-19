import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import { validateWorkflowPath } from "@/utils/pathValidation";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { path?: string; targetFolderPath?: string };
    const sourcePath = body.path?.trim();
    const targetFolderPath = body.targetFolderPath?.trim();

    if (!sourcePath || !targetFolderPath) {
      return NextResponse.json(
        { success: false, error: "path and targetFolderPath are required" },
        { status: 400 }
      );
    }

    const sourceValidation = validateWorkflowPath(sourcePath);
    const targetValidation = validateWorkflowPath(targetFolderPath);
    if (!sourceValidation.valid) {
      return NextResponse.json(
        { success: false, error: sourceValidation.error },
        { status: 400 }
      );
    }
    if (!targetValidation.valid) {
      return NextResponse.json(
        { success: false, error: targetValidation.error },
        { status: 400 }
      );
    }

    const itemName = path.basename(sourceValidation.resolved);
    const destinationPath = path.join(targetValidation.resolved, itemName);
    const destinationValidation = validateWorkflowPath(destinationPath);
    if (!destinationValidation.valid) {
      return NextResponse.json(
        { success: false, error: destinationValidation.error },
        { status: 400 }
      );
    }

    await fs.rename(sourceValidation.resolved, destinationValidation.resolved);
    return NextResponse.json({ success: true, path: destinationValidation.resolved });
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === "EEXIST") {
      return NextResponse.json(
        { success: false, error: "Target already contains an item with that name" },
        { status: 409 }
      );
    }
    if (err?.code === "ENOENT") {
      return NextResponse.json(
        { success: false, error: "Source or target folder not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to move item",
      },
      { status: 500 }
    );
  }
}
