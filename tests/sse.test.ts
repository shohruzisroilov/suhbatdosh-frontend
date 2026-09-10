import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseSseFrame } from '../src/api/sse.js';

describe('parseSseFrame', () => {
  it('reads the event name and its JSON payload', () => {
    const parsed = parseSseFrame('event: delta\ndata: {"delta":"Hello"}');
    assert.deepEqual(parsed, { event: 'delta', data: { delta: 'Hello' } });
  });

  it('defaults to the "message" event when the frame does not name one', () => {
    const parsed = parseSseFrame('data: {"ok":true}');
    assert.equal(parsed?.event, 'message');
  });

  it('joins a payload split across several data lines', () => {
    // The SSE format allows this, and a long reply is exactly where it would show up.
    const parsed = parseSseFrame('event: done\ndata: {"text":\ndata: "hi"}');
    assert.deepEqual(parsed?.data, { text: 'hi' });
  });

  it('preserves whitespace and newlines inside the payload', () => {
    const parsed = parseSseFrame('event: delta\ndata: {"delta":" line one\\nline two "}');
    assert.equal(parsed?.data.delta, ' line one\nline two ');
  });

  it('skips a frame with no data line, such as a comment or heartbeat', () => {
    assert.equal(parseSseFrame(': keep-alive'), null);
    assert.equal(parseSseFrame('event: ping'), null);
    assert.equal(parseSseFrame(''), null);
  });

  it('skips a frame whose payload is not JSON rather than throwing', () => {
    // One unreadable frame must not take down a reply that is already on screen.
    assert.equal(parseSseFrame('event: delta\ndata: not json at all'), null);
  });
});
