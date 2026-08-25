import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import useAppStore from '../src/store/useAppStore.js';

describe('Frontend App Store (Zustand)', () => {
  it('should initialize with default store values', () => {
    const state = useAppStore.getState();
    assert.equal(state.screen, 'onboarding');
    assert.equal(state.user, null);
    assert.equal(state.isAuthLoading, true);
    assert.equal(state.partnerPref, 'any');
  });

  it('should update screen state when navigate action is called', () => {
    useAppStore.getState().navigate('profile', { tab: 'settings' });
    const state = useAppStore.getState();
    assert.equal(state.screen, 'profile');
    assert.deepEqual(state.screenParams, { tab: 'settings' });
  });

  it('should update user state when setUser action is called', () => {
    const mockUser = { id: 'usr_123', displayName: 'Test User', isPremium: false };
    useAppStore.getState().setUser(mockUser as any);
    const state = useAppStore.getState();
    assert.deepEqual(state.user, mockUser as any);
  });

  it('should update partner preference when setPartnerPref is called', () => {
    useAppStore.getState().setPartnerPref('female');
    const state = useAppStore.getState();
    assert.equal(state.partnerPref, 'female');
  });
});
