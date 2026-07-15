// Tests for lib/normalize.js — Unicode normalization & entity parsing
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeText, hasObfuscation, extractHiddenUrls, extractEntityInfo } from '../lib/normalize.js';

// Zero-width / invisible obfuscation characters, built via fromCharCode so the
// test file contains no raw invisible bytes and can't be mangled by encoding.
const ZWSP = String.fromCharCode(0x200b); // zero-width space
const ZWNJ = String.fromCharCode(0x200c); // zero-width non-joiner
const ZWJ = String.fromCharCode(0x200d);  // zero-width joiner
const BOM = String.fromCharCode(0xfeff);  // byte order mark / zero-width no-break space
const SHY = String.fromCharCode(0x00ad);  // soft hyphen
const WJ = String.fromCharCode(0x2060);   // word joiner

describe('normalizeText', () => {
  test('strips zero-width characters', () => {
    const input = `H${ZWSP}e${ZWNJ}l${ZWJ}l${BOM}o`;
    assert.equal(normalizeText(input), 'Hello');
  });

  test('strips soft hyphen and word joiner obfuscation chars', () => {
    const input = `Fr${SHY}ee mo${WJ}ney`;
    assert.equal(normalizeText(input), 'Free money');
  });

  test('maps Cyrillic confusables to Latin equivalents', () => {
    // а(0430) е(0435) о(043E) с(0441) р(0440) і(0456) ѕ(0455) һ(04BB) у(0443) х(0445)
    const input = [0x0430, 0x0435, 0x043e, 0x0441, 0x0440, 0x0456, 0x0455, 0x04bb, 0x0443, 0x0445]
      .map(cp => String.fromCharCode(cp)).join('');
    assert.equal(normalizeText(input), 'aeocpishyx');
  });

  test('defeats obfuscated keyword bypass (Cyrillic + zero-width combo)', () => {
    // "free" spelled with Cyrillic е (0435) plus a zero-width space injected mid-word
    const cyrillicE = String.fromCharCode(0x0435);
    const input = `fr${cyrillicE}${ZWSP}e money`;
    assert.equal(normalizeText(input), 'free money');
  });

  test('leaves normal ASCII text intact (aside from whitespace collapse)', () => {
    const input = 'Hello World 123, how are you today?';
    assert.equal(normalizeText(input), input);
  });

  test('collapses repeated spaces/tabs but preserves newlines', () => {
    const input = 'Line one   with   spaces\nLine two\t\ttabbed';
    assert.equal(normalizeText(input), 'Line one with spaces\nLine two tabbed');
  });

  test('trims leading and trailing whitespace', () => {
    assert.equal(normalizeText('   padded text   '), 'padded text');
  });

  test('returns empty string for falsy input', () => {
    assert.equal(normalizeText(''), '');
    assert.equal(normalizeText(null), '');
    assert.equal(normalizeText(undefined), '');
  });
});

describe('hasObfuscation', () => {
  test('detects zero-width space (200B)', () => {
    assert.equal(hasObfuscation(`fr${ZWSP}ee`), true);
  });

  test('detects zero-width joiner (200D) and non-joiner (200C)', () => {
    assert.equal(hasObfuscation(`a${ZWJ}b`), true);
    assert.equal(hasObfuscation(`a${ZWNJ}b`), true);
  });

  test('detects BOM (FEFF) and soft hyphen (00AD)', () => {
    assert.equal(hasObfuscation(`${BOM}hello`), true);
    assert.equal(hasObfuscation(`hel${SHY}lo`), true);
  });

  test('returns false for normal text with no obfuscation', () => {
    assert.equal(hasObfuscation('Hello friends, how is everyone doing today?'), false);
  });

  test('returns false for falsy input', () => {
    assert.equal(hasObfuscation(''), false);
    assert.equal(hasObfuscation(null), false);
    assert.equal(hasObfuscation(undefined), false);
  });

  // Note: word-joiner/invisible-operator chars U+2061-U+2064 are stripped by
  // normalizeText() but are NOT part of the hasObfuscation() detection regex
  // (which only checks U+200B-200D, FEFF, 00AD, 2060). This is a narrower set
  // by design in the source — documented here, not asserted as a bug.
});

describe('extractHiddenUrls', () => {
  test('extracts a text_link (hidden URL) from message entities', () => {
    const message = {
      text: 'Click here for info',
      entities: [
        { type: 'text_link', offset: 0, length: 10, url: 'https://scam-site.xyz/phish' }
      ]
    };
    const urls = extractHiddenUrls(message);
    assert.deepEqual(urls, [{ url: 'https://scam-site.xyz/phish', hidden: true }]);
  });

  test('extracts a plain url entity using text offset/length', () => {
    const message = {
      text: 'Visit https://example.com now',
      entities: [
        { type: 'url', offset: 6, length: 19 }
      ]
    };
    const urls = extractHiddenUrls(message);
    assert.deepEqual(urls, [{ url: 'https://example.com', hidden: false }]);
  });

  test('extracts URLs from caption_entities using caption text', () => {
    const message = {
      caption: 'Check this out bit.ly/xyz',
      caption_entities: [
        { type: 'url', offset: 15, length: 10 }
      ]
    };
    const urls = extractHiddenUrls(message);
    assert.deepEqual(urls, [{ url: 'bit.ly/xyz', hidden: false }]);
  });

  test('combines entities and caption_entities, ignoring other entity types', () => {
    const message = {
      text: 'Hello world',
      entities: [
        { type: 'bold', offset: 0, length: 5 },
        { type: 'text_link', offset: 0, length: 5, url: 'https://a.example.com' }
      ],
      caption: 'A caption',
      caption_entities: [
        { type: 'text_link', offset: 0, length: 1, url: 'https://b.example.com' }
      ]
    };
    const urls = extractHiddenUrls(message);
    assert.equal(urls.length, 2);
    assert.deepEqual(urls, [
      { url: 'https://a.example.com', hidden: true },
      { url: 'https://b.example.com', hidden: true }
    ]);
  });

  test('returns empty array when message has no entities', () => {
    assert.deepEqual(extractHiddenUrls({ text: 'no links here' }), []);
  });
});

describe('extractEntityInfo', () => {
  test('counts each entity type correctly across entities + caption_entities', () => {
    const message = {
      entities: [
        { type: 'url' },
        { type: 'url' },
        { type: 'text_link', url: 'https://x.com' },
        { type: 'phone_number' },
        { type: 'mention' },
        { type: 'mention' },
        { type: 'blockquote' },
        { type: 'custom_emoji' },
        { type: 'bold' }, // should be ignored
      ],
      caption_entities: [
        { type: 'expandable_blockquote' },
        { type: 'mention' },
      ]
    };
    const info = extractEntityInfo(message);
    assert.deepEqual(info, {
      urlCount: 2,
      hiddenLinkCount: 1,
      phoneCount: 1,
      mentionCount: 3,
      blockquoteCount: 2, // blockquote + expandable_blockquote
      customEmojiCount: 1,
    });
  });

  test('returns all-zero counts for a message with no entities', () => {
    const info = extractEntityInfo({});
    assert.deepEqual(info, {
      urlCount: 0,
      hiddenLinkCount: 0,
      phoneCount: 0,
      mentionCount: 0,
      blockquoteCount: 0,
      customEmojiCount: 0,
    });
  });
});
