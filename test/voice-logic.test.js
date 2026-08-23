'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { chooseEnglishVoice, isEnglishLang, normalizeLangTag } = require('../shared/voice-logic.js');

const voice = (name, lang, isDefault) => ({ name, lang, default: !!isDefault });

// iOS orders getVoices() by language tag, so en-AU leads the English ones no
// matter how the iPad is set. This is the regression that keeps coming back.
const IPAD_VOICES = [
  voice('Anna', 'de-DE'),
  voice('Karen', 'en-AU'),
  voice('Daniel', 'en-GB'),
  voice('Samantha', 'en-US'),
  voice('Monica', 'es-ES'),
];

test('a US iPad is not handed the Australian voice just because it sorts first', () => {
  assert.strictEqual(chooseEnglishVoice(IPAD_VOICES, ['en-US']).name, 'Samantha');
});

test('an Australian iPad still gets the Australian voice', () => {
  assert.strictEqual(chooseEnglishVoice(IPAD_VOICES, ['en-AU']).name, 'Karen');
});

test('a default flag set on every English voice cannot resurrect Karen', () => {
  // The failure mode we cannot verify on a real iPad: if WebKit ever reports
  // `default` on everything, leading with that flag would hand back the first
  // en* entry - which on iOS is en-AU. The device's own tag has to win.
  const allFlagged = IPAD_VOICES.map((v) => ({ ...v, default: true }));
  assert.strictEqual(chooseEnglishVoice(allFlagged, ['en-US']).name, 'Samantha');
});

test('a default flag set on no voice at all still resolves by tag', () => {
  const noneFlagged = IPAD_VOICES.map((v) => ({ ...v, default: false }));
  assert.strictEqual(chooseEnglishVoice(noneFlagged, ['en-US']).name, 'Samantha');
});

test('the default flag breaks ties within the language the device asked for', () => {
  // Desktop Safari lists novelty en-US voices; the flag points at the real one.
  const withNovelty = [voice('Albert', 'en-US'), voice('Bad News', 'en-US'),
    voice('Samantha', 'en-US', true), voice('Karen', 'en-AU')];
  assert.strictEqual(chooseEnglishVoice(withNovelty, ['en-US']).name, 'Samantha');
});

test('an English default is still used when no tag matches', () => {
  const voices = [voice('Karen', 'en-AU'), voice('Moira', 'en-IE', true)];
  assert.strictEqual(chooseEnglishVoice(voices, ['en-CA']).name, 'Moira');
});

test('a non-English default does not win — that is the case this exists for', () => {
  const voices = [voice('Monica', 'es-ES', true), voice('Karen', 'en-AU'), voice('Samantha', 'en-US')];
  assert.strictEqual(chooseEnglishVoice(voices, ['es-ES']).name, 'Samantha');
});

test('a device wanting no English at all falls back to en-US, then en-GB', () => {
  assert.strictEqual(chooseEnglishVoice(IPAD_VOICES, ['de-DE']).name, 'Samantha');
  const noUS = IPAD_VOICES.filter((v) => v.lang !== 'en-US');
  assert.strictEqual(chooseEnglishVoice(noUS, ['de-DE']).name, 'Daniel');
});

test('device preferences are honoured in the order the device ranked them', () => {
  assert.strictEqual(chooseEnglishVoice(IPAD_VOICES, ['fr-FR', 'en-GB', 'en-US']).name, 'Daniel');
});

test('an exact-region miss falls back rather than taking the first English entry', () => {
  assert.strictEqual(chooseEnglishVoice(IPAD_VOICES, ['en-CA']).name, 'Samantha');
});

test('underscore and mixed-case language tags still match', () => {
  const voices = [voice('Karen', 'en_AU'), voice('Samantha', 'EN_us')];
  assert.strictEqual(chooseEnglishVoice(voices, ['en-US']).name, 'Samantha');
});

test('no English voice leaves the choice to the browser', () => {
  assert.strictEqual(chooseEnglishVoice([voice('Monica', 'es-ES')], ['en-US']), null);
  assert.strictEqual(chooseEnglishVoice([], ['en-US']), null);
});

test('missing or malformed inputs never throw', () => {
  assert.strictEqual(chooseEnglishVoice(undefined, undefined), null);
  assert.strictEqual(chooseEnglishVoice([null, voice('Karen', 'en-AU')], null).name, 'Karen');
  assert.strictEqual(chooseEnglishVoice([voice('Nameless', undefined)], ['en-US']), null);
});

test('isEnglishLang accepts bare en and en-REGION, and nothing else', () => {
  assert.ok(isEnglishLang('en'));
  assert.ok(isEnglishLang('en-GB'));
  assert.ok(!isEnglishLang('eng'));
  assert.ok(!isEnglishLang('es-ES'));
  assert.ok(!isEnglishLang(''));
  assert.strictEqual(normalizeLangTag('EN_us'), 'en-us');
});
