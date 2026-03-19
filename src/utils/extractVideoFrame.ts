/**
 * Capture a single frame from a video (in-DOM element or URL) as a PNG data URL.
 * Used by video toolbars to spawn Upload nodes with the extracted image.
 */

export type VideoFrameExtractionSlot = "first" | "current" | "last";

function drawVideoFrameToPng(video: HTMLVideoElement): string | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  try {
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function seekVideo(video: HTMLVideoElement, timeSeconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      resolve();
    };
    const onError = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      reject(new Error("Video seek failed"));
    };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.currentTime = timeSeconds;
  });
}

/**
 * Extract from the live preview element. For first/last, seeks then restores previous time.
 */
export async function extractFrameFromVideoElement(
  video: HTMLVideoElement,
  slot: VideoFrameExtractionSlot
): Promise<string | null> {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) return null;

  const eps = 1 / 30;

  if (slot === "current") {
    return drawVideoFrameToPng(video);
  }

  const prevTime = video.currentTime;
  const wasPaused = video.paused;
  try {
    if (slot === "first") {
      await seekVideo(video, Math.min(eps, duration / 2));
    } else {
      await seekVideo(video, Math.max(0, duration - eps));
    }
    return drawVideoFrameToPng(video);
  } catch {
    return null;
  } finally {
    try {
      await seekVideo(video, prevTime);
      if (!wasPaused) {
        void video.play().catch(() => {});
      }
    } catch {
      /* ignore restore */
    }
  }
}

/**
 * Extract when no live element is available (or element is not ready). Loads video in memory.
 */
export async function extractFrameFromVideoUrl(
  url: string,
  slot: VideoFrameExtractionSlot,
  currentTimeHint?: number
): Promise<string | null> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  let objectUrl: string | null = null;

  try {
    if (url.startsWith("data:")) {
      const blob = await fetch(url).then((r) => r.blob());
      objectUrl = URL.createObjectURL(blob);
      video.src = objectUrl;
    } else {
      video.src = url;
    }
  } catch {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    return null;
  }

  return new Promise((resolve) => {
    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };

    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        cleanup();
        resolve(null);
        return;
      }
      const eps = 1 / 30;
      let t: number;
      if (slot === "first") {
        t = Math.min(eps, duration / 2);
      } else if (slot === "last") {
        t = Math.max(0, duration - eps);
      } else {
        const hint = currentTimeHint ?? 0;
        t = Math.min(Math.max(0, hint), Math.max(0, duration - eps));
      }
      video.currentTime = t;
    };

    video.onseeked = () => {
      const png = drawVideoFrameToPng(video);
      cleanup();
      resolve(png);
    };

    video.onerror = () => {
      cleanup();
      resolve(null);
    };

    video.load();
  });
}
