// Bounded request-body reader shared by Worker routes and deterministic unit tests.
// Counts bytes, not UTF-16 characters, and cancels the stream immediately on overflow.
export async function readBoundedRequestBody(request, maxBytes = 16_384) {
  if (!request || typeof request !== "object" ||
      !Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new TypeError("INVALID_BOUNDED_BODY_READER_INPUT");
  }

  const reader = request.body?.getReader();
  if (!reader) return { ok: true, text: "", bytes: 0 };

  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "";
  let bytes = 0;

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (!(chunk.value instanceof Uint8Array)) {
        await reader.cancel().catch(() => {});
        return { ok: false, reason: "INVALID_BODY_CHUNK", bytes };
      }

      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => {});
        return { ok: false, reason: "TOO_LARGE", bytes };
      }

      try {
        text += decoder.decode(chunk.value, { stream: true });
      } catch {
        await reader.cancel().catch(() => {});
        return { ok: false, reason: "INVALID_UTF8", bytes };
      }
    }

    try {
      text += decoder.decode();
    } catch {
      return { ok: false, reason: "INVALID_UTF8", bytes };
    }
    return { ok: true, text, bytes };
  } finally {
    try { reader.releaseLock(); } catch {}
  }
}
