// Bound the actual stream, even when Content-Length is missing or inaccurate.
export async function readRequestBody(request: Request, maximumBytes: number) {
  if (Number(request.headers.get("content-length")) > maximumBytes) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    size += result.value.byteLength;
    if (size > maximumBytes) { await reader.cancel(); return null; }
    chunks.push(result.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}
