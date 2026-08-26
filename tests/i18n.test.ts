import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TRANSLATIONS, DEFAULT_LANG, SUPPORTED_LANGS } from '../src/i18n/translations.js';

describe('Frontend i18n Translations', () => {
  it('should have supported languages array containing default language', () => {
    assert.equal(Array.isArray(SUPPORTED_LANGS), true);
    assert.equal(SUPPORTED_LANGS.includes(DEFAULT_LANG), true);
  });

  it('should contain core translation keys in English locale', () => {
    const en = TRANSLATIONS.en;
    assert.ok(en, 'English translation object should exist');
    assert.equal(en['nav.home'], 'Home');
    // Nav label was renamed from 'Top' to 'Ranking'; the test had not followed.
    assert.equal(en['nav.leaderboard'], 'Ranking');
    assert.equal(en['nav.invite'], 'Invite');
    assert.equal(en['nav.profile'], 'Profile');
  });

  it('should contain updated non-IELTS text keys', () => {
    const en = TRANSLATIONS.en;
    assert.equal(en['home.premiumSub'], 'Unlimited talking with partners');
    assert.equal(en['profile.freeSub'], '10 minutes of talking every day');
    assert.equal(en['pm.proLine1'], 'Talking with no daily limit');
    assert.equal(en['pm.proLine2'], 'Fast partner matching');
  });
});
