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
    return "Javob yuklanmadi — internet juda sekin ko'rinadi. Signal yaxshiroq joyda qayta yuboring.";
  }

  // A reply the server did send: it knows what went wrong, so say what it said.
  const serverMessage = err?.response?.data?.error;
  if (serverMessage) return String(serverMessage);

  const status = err?.response?.status;
  if (status >= 500) {
    return `Serverda xatolik (${status}). Bir oz kutib, qayta yuboring.`;
  }
  if (status) {
    return `So'rov qabul qilinmadi (${status}). Qayta yuborib ko'ring.`;
  }

  // No response at all and no timeout flag — the connection dropped mid-flight.
  return "Aloqa uzildi. Internetni tekshirib, javobni qayta yuboring.";
}
