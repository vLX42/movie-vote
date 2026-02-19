/**
 * Generate a browser fingerprint that works even in private/incognito mode.
 * Uses stable browser signals: screen, timezone, language, hardware,
 * and a canvas rendering test. Returns a 16-char hex string.
 */
export async function getBrowserFingerprint(): Promise<string> {
  const signals: string[] = [];

  // Navigator / hardware signals
  signals.push(navigator.userAgent);
  signals.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
  signals.push(String(screen.pixelDepth));
  signals.push(navigator.language || "");
  signals.push((navigator.languages ?? []).join(","));
  signals.push(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
  signals.push(String(navigator.hardwareConcurrency || 0));
  signals.push(navigator.platform || "");

  // Canvas fingerprint — GPU/font rendering varies per machine
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#f60";
      ctx.fillRect(10, 1, 62, 20);
      ctx.fillStyle = "#069";
      ctx.font = "13px Arial, sans-serif";
      ctx.fillText("MovieNight \u{1F3AC} abc123", 2, 15);
      ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
      ctx.fillText("MovieNight \u{1F3AC} xyz789", 4, 17);
      signals.push(canvas.toDataURL());
    }
  } catch {
    // canvas blocked — still have other signals
  }

  const raw = signals.join("|");
  const encoded = new TextEncoder().encode(raw);
  const hashBuf = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}
