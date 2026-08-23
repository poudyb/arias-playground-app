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
// no matter how the iPad was set. So: what the device wants comes first here,
// and a hard-coded English voice is only ever for a device that wants no
// English at all.

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

  // 1. The browser's own default, when it is already English. That is exactly
  //    the voice leaving `voice` unset would have used, so a correctly set-up
  //    device keeps sounding the way it always did — including a parent's
  //    explicit pick in Settings, which no language tag would reveal.
  for (let i = 0; i < english.length; i++) {
    if (english[i].default) return english[i];
  }

  // 2. Otherwise the device's declared languages, in the order it ranked them.
  const wanted = (Array.isArray(preferredLangs) ? preferredLangs : [])
    .map(normalizeLangTag)
    .filter(isEnglishLang);
  for (let i = 0; i < wanted.length; i++) {
    const match = findVoiceByTag(english, wanted[i]);
    if (match) return match;
  }

  // 3. Nothing English is wanted — the case this function exists for. Any
  //    English voice beats hearing "elephant" read with Spanish phonetics.
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
