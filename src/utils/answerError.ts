/**
 * Turning a failed answer upload into something the candidate — and whoever reads the
 * bug report — can act on.
 *
 * Every failure used to collapse into one sentence ("Javobni yuborishda xatolik"),
 * which meant a timeout on a weak uplink, a server fault and a rejected request all
 * looked identical. That made the difference between "your connection is too slow" and
 * "something is broken" impossible to tell apart from a screenshot.
 */
export function describeAnswerError(err: any): string {
  // Axios reports its own timeout this way; the request never reached the server.
  if (err?.code === 'ECONNABORTED' || /timeout/i.test(String(err?.message || ''))) {
    return 'Could not send your answer. Your internet looks slow — try again with a better signal.';
  }

  // A reply the server did send: it knows what went wrong, so say what it said.
  const serverMessage = err?.response?.data?.error;
  if (serverMessage) return String(serverMessage);

  const status = err?.response?.status;
  if (status >= 500) {
    return `Something went wrong on our side (${status}). Wait a moment and send again.`;
  }
  if (status) {
    return `Your answer was not accepted (${status}). Please send it again.`;
  }

  // No response at all and no timeout flag — the connection dropped mid-flight.
  return 'Connection lost. Check your internet and send your answer again.';
}
