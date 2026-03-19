import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import { validateWorkflowPath } from "@/utils/pathValidation";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { basePath?: string; name?: string };
    const basePath = body.basePath?.trim();
    const folderName = body.name?.trim();

    if (!basePath || !folderName) {
      return NextResponse.json(
        { success: false, error: "basePath and name are required" },
        { status: 400 }
      );
    }

    const safeName = folderName.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
    if (!safeName) {
      return NextResponse.json(
        { success: false, error: "Invalid folder name" },
        { status: 400 }
      );
    }

    const pathValidation = validateWorkflowPath(basePath);
    if (!pathValidation.valid) {
      return NextResponse.json(
        { success: false, error: pathValidation.error },
        { status: 400 }
      );
    }

    const folderPath = path.join(pathValidation.resolved, safeName);
    await fs.mkdir(folderPath, { recursive: false });

    return NextResponse.json({ success: true, path: folderPath });
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === "EEXIST") {
      return NextResponse.json(
        { success: false, error: "Folder already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to create folder",
      },
      { status: 500 }
    );
  }
}
