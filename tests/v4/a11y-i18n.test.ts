import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { DICTIONARY, t } from '../../src/v4/i18n/dictionary.js';
import { LiveAnnouncer } from '../../src/react/components/LiveAnnouncer.js';

describe('Category 11: Accessibility & i18n Contracts', () => {
  it('tr-TR and en-US dictionaries have full 1-to-1 key parity', () => {
    const trKeys = Object.keys(DICTIONARY['tr-TR']).sort();
    const enKeys = Object.keys(DICTIONARY['en-US']).sort();

    assert.deepEqual(trKeys, enKeys, 'Both locales must have identical translation keys');
  });

  it('t() resolves keys correctly for both locales', () => {
    assert.equal(t('term.requirement', 'tr-TR'), 'Gereksinim');
    assert.equal(t('term.requirement', 'en-US'), 'Requirement');
    assert.equal(t('action.save', 'tr-TR'), 'Kaydet');
    assert.equal(t('action.save', 'en-US'), 'Save');
  });

  it('LiveAnnouncer renders aria-live status container', () => {
    const el = React.createElement(LiveAnnouncer, { message: 'Plan kaydedildi', politeness: 'polite' });
    assert.ok(el);
    assert.equal(el.props.message, 'Plan kaydedildi');
    assert.equal(el.props.politeness, 'polite');
  });
});
