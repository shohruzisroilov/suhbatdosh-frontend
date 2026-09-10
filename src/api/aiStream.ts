import { BASE_URL } from './client';
import { parseSseFrame } from './sse';
import useAppStore from '../store/useAppStore';

/**
 * Reads one streamed reply from the AI partner.
 *
 * EventSource cannot do this: it is GET-only and cannot carry an Authorization header,
 * and this turn is a POST with the message in its body. So the stream is read straight
 * off `fetch` instead, and the SSE framing is parsed here — which is a dozen lines, and
 * buys `AbortSignal` support for free, the thing the Stop button is built on.
 *
 * Unknown event names are ignored rather than treated as errors, so the server can add
 * a new one without breaking a client that has not shipped yet.
 */

export interface AiStreamEvents {
  /** Ids assigned to this turn, before any text arrives. */
  onMeta?: (data: { userMessageId: string; conversationId: string }) => void;
  /** One chunk of the reply. */
  onDelta?: (delta: string) => void;
  /** A finished sentence with its audio — voice mode only. */
  onSentence?: (sentence: string, audioUrl: string | null) => void;
  /** The word worth keeping from this reply, if any. */
  onVocab?: (vocab: { word: string; meaning: string; example: string }) => void;
  /** The thread's generated name, after the first exchange. */
  onTitle?: (title: string) => void;
  /** The complete reply, once. */
  onDone?: (data: { text: string; assistantMessageId: string }) => void;
}

export interface AiStreamRequest {
  conversationId: string;
  /** Ignored when `regenerate` is set: the question is already stored in the thread. */
  text: string;
  /** True for a spoken turn: the server also synthesises each sentence as it lands. */
  voice?: boolean;
  userLevel?: string;
  /**
   * Answer the thread's last question again, replacing the answer it already has,
   * rather than treating `text` as something newly said.
   */
  regenerate?: boolean;
  signal?: AbortSignal;
}

export class AiStreamError extends Error {
  limitReached: boolean;
  constructor(message: string, limitReached = false) {
    super(message);
    this.name = 'AiStreamError';
    this.limitReached = limitReached;
  }
}

export async function streamAiTurn(req: AiStreamRequest, events: AiStreamEvents): Promise<void> {
  const token = useAppStore.getState().token;

  const res = await fetch(`${BASE_URL}/ai-partner/stream`, {
    method: 'POST',
    signal: req.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      conversationId: req.conversationId,
      text: req.text,
      voice: req.voice === true,
      regenerate: req.regenerate === true,
      userLevel: req.userLevel,
    }),
  });

  // A refusal arrives before the stream opens, as ordinary JSON.
  if (!res.ok || !res.body) {
    let message = 'Suhbatdosh AI is currently unavailable. Please try again shortly.';
    let limit = false;
    try {
      const body = await res.json();
      message = body?.error || body?.message || message;
      limit = body?.limitReached === true;
    } catch {
      /* keep the default */
    }
    throw new AiStreamError(message, limit);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamError: string | null = null;

  const handleFrame = (frame: string) => {
    const parsed = parseSseFrame(frame);
    if (!parsed) return;
    const { event, data } = parsed;

    switch (event) {
      case 'meta':
        events.onMeta?.(data);
        break;
      case 'delta':
        if (data?.delta) events.onDelta?.(data.delta);
        break;
      case 'sentence':
        events.onSentence?.(data?.sentence || '', data?.audioUrl ?? null);
        break;
      case 'vocab':
        if (data?.vocab?.word) events.onVocab?.(data.vocab);
        break;
      case 'title':
        if (data?.title) events.onTitle?.(data.title);
        break;
      case 'done':
        events.onDone?.(data);
        break;
      case 'error':
        streamError = data?.error || 'Something went wrong.';
        break;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '');

    let split = buffer.indexOf('\n\n');
    while (split !== -1) {
      handleFrame(buffer.slice(0, split));
      buffer = buffer.slice(split + 2);
      split = buffer.indexOf('\n\n');
    }
  }

  if (buffer.trim()) handleFrame(buffer);
  if (streamError) throw new AiStreamError(streamError);
}
