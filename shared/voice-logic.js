// Choosing which voice reads this app's English words aloud, kept DOM-free so
// it can be unit-tested under Node and reused by shared/speech.js (loaded after
// this one).
//
// Every page is `<html lang="en">`, so an utterance with no `voice` set already
// asks the browser for an *English* voice, and the browser answers with the one
// the device is set up for. That answer is the right one almost always. The one
// case worth overriding is old iOS Safari ignoring the utterance language and
// reading English words with a non-English default voice, which comes out in
// that language's phonetics.
//
// Overriding more than that is what put the Australian voice on the iPad: an
// earlier pass set the voice to the first `en*` entry in getVoices(), which
// throws away what the device asked for. iOS orders that list by language tag,
// so `en-AU` leads every English voice on it and every word came out Australian
// no matter how the iPad was set. So: what the device asked for comes first
// here — navigator.language, the one signal every engine reports honestly —
// and a hard-coded English voice is only ever for a device that wants no
// English at all.
//
// The `default` flag is used only to break ties inside a language the device
// asked for. It is never the lead signal: what WebKit reports there could not
// be checked on a real iPad from here, and if it ever came back set on every
// voice, leading with it would hand back the first `en*` entry — Karen, and
// the exact bug this replaced.

// Some engines report `en_US` rather than `en-US`.
function normalizeLangTag(lang) {
  return String(lang == null ? '' : lang).replace(/_/g, '-').toLowerCase();
}

function isEnglishLang(lang) {
  const tag = normalizeLangTag(lang);
  return tag === 'en' || tag.slice(0, 3) === 'en-';
}

// Only consulted for a device that asks for no English at all; order matters
// between these two, and past them any English voice will do.
const FALLBACK_ENGLISH_TAGS = ['en-us', 'en-gb'];

function findVoiceByTag(voices, tag) {
  for (let i = 0; i < voices.length; i++) {
    if (normalizeLangTag(voices[i].lang) === tag) return voices[i];
  }
  return null;
}

// `preferredLangs` is the device's own language list, most-wanted first
// (navigator.languages). Returns null when there's no English voice to pick,
// which leaves `voice` unset and the browser's default in charge.
function chooseEnglishVoice(voices, preferredLangs) {
  const list = Array.isArray(voices) ? voices : [];
  const english = list.filter(function (v) { return v && isEnglishLang(v.lang); });
  if (!english.length) return null;

  const wanted = (Array.isArray(preferredLangs) ? preferredLangs : [])
    .map(normalizeLangTag)
    .filter(isEnglishLang);

  // 1. What the device asked for, in the order it ranked it. navigator.language
  //    is the one signal every engine reports honestly, so it leads.
  //
  //    Within a tag, a `default` flag breaks the tie: on desktop Safari the
  //    en-US voices include the novelty ones (Albert, Bad News, Bubbles), and
  //    taking the first en-US entry could hand a child "Bad News" reading the
  //    alphabet. The flag points at the real system voice.
  for (let i = 0; i < wanted.length; i++) {
    const matches = english.filter(function (v) {
      return normalizeLangTag(v.lang) === wanted[i];
    });
    if (matches.length) return preferDefault(matches);
  }

  // 2. Nothing matched the device's tags, but the browser still nominated an
  //    English voice as its default. Deliberately below the tag match: the flag
  //    is the signal this code cannot verify on iOS, so it never gets to
  //    outvote a device that plainly said which English it wants.
  const flagged = english.filter(function (v) { return v.default; });
  if (flagged.length) return flagged[0];

  // 3. The device wants no English at all — the case this function exists for.
  //    Any English voice beats hearing "elephant" with Spanish phonetics.
  for (let i = 0; i < FALLBACK_ENGLISH_TAGS.length; i++) {
    const match = findVoiceByTag(english, FALLBACK_ENGLISH_TAGS[i]);
    if (match) return match;
  }
  return english[0];
}

function preferDefault(voices) {
  for (let i = 0; i < voices.length; i++) {
    if (voices[i].default) return voices[i];
  }
  return voices[0];
}

// Exported for Node's test runner; ignored in the browser (no `module`).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { chooseEnglishVoice, isEnglishLang, normalizeLangTag };
}
