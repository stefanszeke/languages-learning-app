'use strict';

// Hand-curated basic-sense English glosses for the ~200 most common German
// verbs, used as an override on top of the FreeDict-derived dictionary when
// building the verb-conjugation lookup (build-german-verb-dictionary.js).
//
// Why this exists: FreeDict/Ding's headword-level coverage skews toward
// idiomatic/technical phrase entries and is frequently wrong or missing for
// the single most common sense of exactly these high-frequency verbs (e.g.
// its best entry for "nehmen" glosses "negotiate", not "take"; "stehen" comes
// back as "say"; "wissen" has no entry at all). Since the verb-conjugation
// feature specifically targets these everyday verbs, a small verified list
// beats the automatic lookup for this slice of vocabulary. Verbs not listed
// here still fall back to the FreeDict lookup.
//
// Each gloss is a bare present-tense verb form (no "to", no pronoun) so it can
// be templated directly: "<gloss> / I <gloss> / he <gloss+s> / you <gloss> / we <gloss>".

module.exports = {
  sein: 'be', haben: 'have', werden: 'become', können: 'can', müssen: 'must',
  sollen: 'should', wollen: 'want', dürfen: 'may', mögen: 'like',

  sagen: 'say', machen: 'make', geben: 'give', kommen: 'come', gehen: 'go',
  wissen: 'know', sehen: 'see', lassen: 'let', stehen: 'stand', finden: 'find',
  bleiben: 'stay', liegen: 'lie', heißen: 'be called', denken: 'think',
  nehmen: 'take', tun: 'do', glauben: 'believe', halten: 'hold', nennen: 'name',
  zeigen: 'show', führen: 'lead', sprechen: 'speak', bringen: 'bring',
  leben: 'live', fahren: 'drive', meinen: 'mean', fragen: 'ask', kennen: 'know',
  gelten: 'apply', stellen: 'put', spielen: 'play', arbeiten: 'work',
  brauchen: 'need', folgen: 'follow', lernen: 'learn', verstehen: 'understand',
  setzen: 'set', bekommen: 'get', beginnen: 'begin', erzählen: 'tell',
  versuchen: 'try', schreiben: 'write', laufen: 'run', erklären: 'explain',
  entsprechen: 'correspond', sitzen: 'sit', ziehen: 'pull', scheinen: 'seem',
  fallen: 'fall', gehören: 'belong', entstehen: 'arise', erhalten: 'receive',
  treffen: 'meet', suchen: 'search', legen: 'lay', vorstellen: 'introduce',
  handeln: 'act', reichen: 'suffice', erreichen: 'reach', tragen: 'carry',
  schaffen: 'manage', lieben: 'love', bedeuten: 'mean', anrufen: 'call',
  aufstehen: 'get up', reden: 'talk', brechen: 'break', abbrechen: 'break off',
  aufbrechen: 'break open', ausbrechen: 'break out', einbrechen: 'break in',
  zerbrechen: 'shatter', unterbrechen: 'interrupt',

  essen: 'eat', trinken: 'drink', schlafen: 'sleep', wohnen: 'live',
  kaufen: 'buy', verkaufen: 'sell', kosten: 'cost', bezahlen: 'pay',
  zahlen: 'pay', öffnen: 'open', schließen: 'close', warten: 'wait',
  helfen: 'help', danken: 'thank', antworten: 'answer', hassen: 'hate',
  wünschen: 'wish', hoffen: 'hope', fühlen: 'feel', riechen: 'smell',
  schmecken: 'taste', hören: 'hear', lesen: 'read', rufen: 'call',
  lachen: 'laugh', weinen: 'cry', lächeln: 'smile', singen: 'sing',
  tanzen: 'dance', reisen: 'travel', fliegen: 'fly', rennen: 'run',
  schwimmen: 'swim', springen: 'jump', steigen: 'climb', fliehen: 'flee',
  kämpfen: 'fight', gewinnen: 'win', verlieren: 'lose', üben: 'practice',
  lehren: 'teach', unterrichten: 'teach', studieren: 'study',
  wechseln: 'change', ändern: 'change', umziehen: 'move', packen: 'pack',
  putzen: 'clean', waschen: 'wash', kochen: 'cook', backen: 'bake',
  braten: 'fry', schneiden: 'cut', rühren: 'stir', mischen: 'mix',
  gießen: 'pour', füllen: 'fill', heben: 'lift', senken: 'lower',
  drücken: 'press', schieben: 'push', werfen: 'throw', fangen: 'catch',
  verpassen: 'miss', ankommen: 'arrive', abfahren: 'depart',
  weggehen: 'leave', verlassen: 'leave', erscheinen: 'appear',
  verschwinden: 'disappear', passieren: 'happen', geschehen: 'happen',
  stattfinden: 'take place', existieren: 'exist', sterben: 'die',
  töten: 'kill', retten: 'save', schützen: 'protect', verteidigen: 'defend',
  angreifen: 'attack',

  diskutieren: 'discuss', besprechen: 'discuss', überlegen: 'consider',
  entscheiden: 'decide', beschließen: 'decide', planen: 'plan',
  vorbereiten: 'prepare', organisieren: 'organize', kontrollieren: 'check',
  prüfen: 'check', korrigieren: 'correct', verbessern: 'improve',
  wiederholen: 'repeat', vergessen: 'forget', erinnern: 'remind',
  merken: 'notice', bemerken: 'notice', beobachten: 'observe',
  schauen: 'look', gucken: 'look', blicken: 'glance', starren: 'stare',

  hängen: 'hang', klettern: 'climb', kriechen: 'crawl', rutschen: 'slide',
  stolpern: 'stumble', segeln: 'sail', rudern: 'row', wandern: 'hike',

  klingen: 'sound', aussehen: 'look', wirken: 'seem', vorkommen: 'occur',
  funktionieren: 'work', klappen: 'work out', gelingen: 'succeed',
  misslingen: 'fail', scheitern: 'fail', benutzen: 'use', verwenden: 'use',
  gebrauchen: 'use', nutzen: 'use', besitzen: 'own', verdienen: 'earn',
  sparen: 'save', ausgeben: 'spend', leihen: 'lend', borgen: 'borrow',
  schulden: 'owe',
};
