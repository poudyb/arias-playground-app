'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { chooseEnglishVoice, isEnglishLang, normalizeLangTag } = require('../shared/voice-logic.js');

const voice = (name, lang, isDefault) => ({ name, lang, default: !!isDefault });

// iOS orders getVoices() by language tag, so en-AU leads the English ones no
// matter how the iPad is set, and lists alternates and novelty voices under
// en-US alongside the real system voice. Every voice regression so far has
// been this list being read as if it ranked anything.
const IPAD_VOICES = [
  voice('Anna', 'de-DE'),
  voice('Karen', 'en-AU'),
  voice('Daniel', 'en-GB'),
  voice('Aaron', 'en-US'),
  voice('Bad News', 'en-US'),
  voice('Samantha', 'en-US'),
  voice('Monica', 'es-ES'),
];

// The rule, and the whole point of this file: on a device that speaks English
// the browser has already answered this question, so nothing is chosen and the
// utterance keeps the device's own voice.
test('an English device is left with the voice it is set up to use', () => {
  assert.strictEqual(chooseEnglishVoice(IPAD_VOICES, ['en-US']), null);
  assert.strictEqual(chooseEnglishVoice(IPAD_VOICES, ['en-AU']), null);
  assert.strictEqual(chooseEnglishVoice(IPAD_VOICES, ['en']), null);
});

test('an English device is left alone even when its region has no voice', () => {
  // en-CA matches nothing in the list. Reaching for a near-miss is what handed
  // the iPad a voice that was not its own; the browser resolves this better.
  assert.strictEqual(chooseEnglishVoice(IPAD_VOICES, ['en-CA']), null);
});

test('English anywhere in the device list is enough to leave it alone', () => {
  assert.strictEqual(chooseEnglishVoice(IPAD_VOICES, ['fr-FR', 'en-GB']), null);
});

test('the voice list order never decides — Karen cannot come back', () => {
  // Regression 1: first en* entry wins. On iOS that is always en-AU.
  assert.notStrictEqual(chooseEnglishVoice(IPAD_VOICES, ['en-US']), IPAD_VOICES[1]);
});

test('the default flag is not consulted, however the device reports it', () => {
  // Regression 2: a tie-break on `default` that WebKit does not reliably set,
  // leaving list order to decide again. Flagged on everything, on nothing, or
  // on a novelty voice, the answer has to be the same one.
  const allFlagged = IPAD_VOICES.map((v) => ({ ...v, default: true }));
  const noneFlagged = IPAD_VOICES.map((v) => ({ ...v, default: false }));
  const noveltyFlagged = IPAD_VOICES.map((v) => ({ ...v, default: v.name === 'Bad News' }));
  assert.strictEqual(chooseEnglishVoice(allFlagged, ['en-US']), null);
  assert.strictEqual(chooseEnglishVoice(noneFlagged, ['en-US']), null);
  assert.strictEqual(chooseEnglishVoice(noveltyFlagged, ['en-US']), null);
  // And on the one device where a voice is chosen, the flag still changes nothing.
  assert.strictEqual(chooseEnglishVoice(noveltyFlagged, ['de-DE']).name, 'Aaron');
});

test('a device wanting no English at all falls back to en-US, then en-GB', () => {
  // The case this function exists for: old iOS Safari would otherwise read
  // English words with the German system voice, in German phonetics.
  assert.strictEqual(chooseEnglishVoice(IPAD_VOICES, ['de-DE']).name, 'Aaron');
  const noUS = IPAD_VOICES.filter((v) => normalizeLangTag(v.lang) !== 'en-us');
  assert.strictEqual(chooseEnglishVoice(noUS, ['de-DE']).name, 'Daniel');
  const noUSorGB = noUS.filter((v) => normalizeLangTag(v.lang) !== 'en-gb');
  assert.strictEqual(chooseEnglishVoice(noUSorGB, ['de-DE']).name, 'Karen');
});

test('underscore and mixed-case language tags still match', () => {
  const voices = [voice('Karen', 'en_AU'), voice('Samantha', 'EN_us')];
  assert.strictEqual(chooseEnglishVoice(voices, ['EN_us']), null);
  assert.strictEqual(chooseEnglishVoice(voices, ['de_DE']).name, 'Samantha');
});

test('no English voice leaves the choice to the browser', () => {
  assert.strictEqual(chooseEnglishVoice([voice('Monica', 'es-ES')], ['de-DE']), null);
  assert.strictEqual(chooseEnglishVoice([], ['de-DE']), null);
});

test('a device that declares no language is left to the browser', () => {
  // Nothing to go on is not a reason to guess; guessing is the regression.
  assert.strictEqual(chooseEnglishVoice(IPAD_VOICES, []), null);
  assert.strictEqual(chooseEnglishVoice(IPAD_VOICES, null), null);
});

test('missing or malformed inputs never throw', () => {
  assert.strictEqual(chooseEnglishVoice(undefined, undefined), null);
  assert.strictEqual(chooseEnglishVoice([null, voice('Karen', 'en-AU')], ['de-DE']).name, 'Karen');
  assert.strictEqual(chooseEnglishVoice([voice('Nameless', undefined)], ['de-DE']), null);
});

test('isEnglishLang accepts bare en and en-REGION, and nothing else', () => {
  assert.ok(isEnglishLang('en'));
  assert.ok(isEnglishLang('en-GB'));
  assert.ok(!isEnglishLang('eng'));
  assert.ok(!isEnglishLang('es-ES'));
  assert.ok(!isEnglishLang(''));
  assert.strictEqual(normalizeLangTag('EN_us'), 'en-us');
});
