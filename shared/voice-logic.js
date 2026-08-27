// Choosing which voice reads this app's English words aloud, kept DOM-free so
// it can be unit-tested under Node and reused by shared/speech.js (loaded after
// this one).
//
// The short version: almost always this app should choose nothing at all.
//
// Every page is `<html lang="en">`, so an utterance with no `voice` set already
// asks the browser for an *English* voice, and the browser answers with the one
// the device is set up to use — including a voice a parent picked in Settings,
// which nothing in getVoices() reveals. That answer is the right one on any
// device that speaks English, and it is the voice this app had before it
// started guessing.
//
// Guessing has now regressed the voice twice, each time by picking a real
// English voice that simply wasn't the device's own:
//
//   * taking the first `en*` entry in getVoices() made every iPad Australian —
//     iOS orders that list by language tag, so `en-AU` (Karen) leads it no
//     matter how the iPad is set;
//   * then taking the first entry matching navigator.language, with the
//     `default` flag as a tie-break, made every iPad *some other* voice: iOS
//     lists alternates and novelty voices (Aaron, Junior, "Bad News") under
//     en-US too, and WebKit doesn't reliably flag the real system voice as
//     `default`, so the tie-break silently didn't apply and the list order
//     decided again.
//
// Both were the same mistake — answering a question the browser had already
// answered better. So the only case left here is the one this file was
// created for: a device that asks for no English at all, where old iOS Safari
// ignores the utterance language and reads English words with the non-English
// system voice, coming out in that language's phonetics. Only there is a
// hard-coded English voice better than what the browser would have done.
//
// The device's language list is the single signal used, because it is the one
// every engine reports honestly. The `default` flag is deliberately not
// consulted: it is the signal that could never be verified against a real
// iPad from here, and every past regression came from trusting the voice list
// over the device.

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
// (navigator.languages). Returns null whenever the browser's own choice should
// stand, which leaves `voice` unset — the default, and the common case.
function chooseEnglishVoice(voices, preferredLangs) {
  const list = Array.isArray(voices) ? voices : [];
  const english = list.filter(function (v) { return v && isEnglishLang(v.lang); });
  if (!english.length) return null;

  const wanted = (Array.isArray(preferredLangs) ? preferredLangs : []).map(normalizeLangTag);

  // The device speaks English — or didn't say, in which case guessing is how
  // this went wrong before. Either way the browser's answer stands: no voice
  // this code could name is more likely to be the one the child had yesterday.
  if (!wanted.length || wanted.some(isEnglishLang)) return null;

  // The device wants no English at all — the case this function exists for.
  // Any English voice beats hearing "elephant" with Spanish phonetics.
  for (let i = 0; i < FALLBACK_ENGLISH_TAGS.length; i++) {
    const match = findVoiceByTag(english, FALLBACK_ENGLISH_TAGS[i]);
    if (match) return match;
  }
  return english[0];
}

// Exported for Node's test runner; ignored in the browser (no `module`).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { chooseEnglishVoice, isEnglishLang, normalizeLangTag };
}
