import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tapHaptic, notifyHaptic, selectionHaptic } from '../src/utils/haptics.js';

describe('Frontend Haptic Utils', () => {
  it('should safely execute tapHaptic without crashing when Telegram WebApp is undefined', () => {
    assert.doesNotThrow(() => {
      tapHaptic('light');
      tapHaptic('medium');
      tapHaptic('heavy');
    });
  });

  it('should safely execute notifyHaptic without crashing', () => {
    assert.doesNotThrow(() => {
      notifyHaptic('error');
      notifyHaptic('success');
      notifyHaptic('warning');
    });
  });

  it('should safely execute selectionHaptic without crashing', () => {
    assert.doesNotThrow(() => {
      selectionHaptic();
    });
  });
});
