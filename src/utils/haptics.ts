function hf() {
  return window.Telegram?.WebApp?.HapticFeedback;
}

export function tapHaptic(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light') {
  try {
    hf()?.impactOccurred(style);
  } catch {}
}

export function notifyHaptic(type: 'error' | 'success' | 'warning' = 'success') {
  try {
    hf()?.notificationOccurred(type);
  } catch {}
}

export function selectionHaptic() {
  try {
    hf()?.selectionChanged();
  } catch {}
}
