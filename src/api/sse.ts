/**
 * One frame of a server-sent event stream into the event it carries.
 *
 * Its own module rather than part of api/aiStream so that it can be tested directly:
 * aiStream reaches the network through api/client, which resolves the API base URL
 * from import.meta.env when it loads and therefore only works inside Vite.
 *
 * This is the layer where a malformed frame turns into a
 * missing reply rather than a visible error, so it is worth pinning down. A frame it
 * cannot make sense of returns null and is skipped — a stream should not die because
 * one heartbeat or comment came through in a shape this client did not expect.
 */
export function parseSseFrame(frame: string): { event: string; data: any } | null {
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    // Per the SSE format a data line may appear more than once in one frame, and the
    // pieces are joined with newlines to make the payload.
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }

  if (!dataLines.length) return null;

  try {
    return { event, data: JSON.parse(dataLines.join('\n')) };
  } catch {
    return null;
  }
}
