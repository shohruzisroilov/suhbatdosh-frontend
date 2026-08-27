/**
 * Picking a browser speech voice that matches the examiner's gender.
 *
 * The mock exams normally speak through the server's TTS, which is given a voice
 * explicitly. This is only for the fallback that runs when that call fails — there the
 * browser would otherwise read the examiner's lines in whatever voice the device lists
 * first, which on most Android and Windows installs is male. A female-named examiner
 * speaking in a male voice is the bug this avoids.
 */

export type ExaminerGender = 'male' | 'female';

/**
 * Voice names are not standardised and carry no gender flag, so they are matched by
 * name. These are the common English voices shipped by iOS, macOS, Android, Windows
 * and Chrome.
 */
const FEMALE_HINTS = [
  'female', 'samantha', 'karen', 'moira', 'tessa', 'fiona', 'victoria', 'susan',
  'zira', 'hazel', 'catherine', 'serena', 'allison', 'ava', 'joanna', 'salli',
  'kendra', 'kimberly', 'nicole', 'amy', 'emma', 'aria', 'jenny', 'michelle',
];

const MALE_HINTS = [
  'male', 'daniel', 'alex', 'fred', 'david', 'mark', 'george', 'james', 'oliver',
  'thomas', 'arthur', 'ryan', 'guy', 'brian', 'matthew', 'justin', 'joey', 'rishi',
];

/** "Google UK English Male" also contains "female" as a substring — match on words. */
function hasHint(name: string, hints: string[]): boolean {
  const words = name.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return hints.some((h) => words.includes(h));
}

function scoreFor(voice: SpeechSynthesisVoice, gender: ExaminerGender): number {
  const name = voice.name || '';
  const wanted = gender === 'male' ? MALE_HINTS : FEMALE_HINTS;
  const other = gender === 'male' ? FEMALE_HINTS : MALE_HINTS;

  if (hasHint(name, other)) return -1; // Wrong gender: never use it.
  return hasHint(name, wanted) ? 2 : 1; // Named match, else merely acceptable.
}

/**
 * The best English voice for this gender, or null to leave the browser default alone.
 *
 * `getVoices()` is populated asynchronously and returns an empty list on the first
 * call in most browsers, so callers should also listen for `voiceschanged`.
 */
export function pickExaminerVoice(
  gender: ExaminerGender,
  lang = 'en-US'
): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  const english = window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang?.toLowerCase().startsWith('en'));
  if (!english.length) return null;

  const prefix = lang.slice(0, 2).toLowerCase();
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = 0;

  for (const voice of english) {
    const score = scoreFor(voice, gender);
    if (score < 0) continue;
    // Same locale as the exam is worth more than a merely English one.
    const localised = voice.lang?.toLowerCase().startsWith(prefix) ? 0.5 : 0;
    const total = score + localised;
    if (total > bestScore) {
      best = voice;
      bestScore = total;
    }
  }

  return best;
}

/** Resolves once the voice list is populated, or immediately if it already is. */
export function whenVoicesReady(callback: () => void): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (window.speechSynthesis.getVoices().length) {
    callback();
    return;
  }
  window.speechSynthesis.addEventListener('voiceschanged', () => callback(), { once: true });
}
