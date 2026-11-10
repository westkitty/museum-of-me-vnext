// Pure logic for the visitor-facing collection-total guard used by
// validate-content.mjs. Kept separate so it can be unit-tested.

const UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

export function spokenNumber(text) {
  if (/^\d+$/.test(text)) return Number(text);
  const [tens, unit] = text.toLowerCase().split(/[- ]/);
  const t = TENS.indexOf(tens);
  if (t >= 2) return t * 10 + (unit ? Math.max(0, UNITS.indexOf(unit)) : 0);
  const u = UNITS.indexOf(tens);
  return u >= 0 ? u : null;
}

const NUMBER = String.raw`(\d+|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?)`;
const COUNT_CLAIM = new RegExp(String.raw`\b${NUMBER}[\s-]+(?:current\s+)?(projects?|project identities|exhibits?)\b`, 'gi');

// A sentence that is explicitly about an earlier state of the collection may
// name the earlier total. The marker must sit in the same sentence as the number.
const HISTORICAL = /\b(historical(ly)?|earlier|original(ly)?|former(ly)?|previous(ly)?|once|at the time|back then|used to|frozen|snapshot|grew from|grown from|up from|began with|started with|in 20\d\d|20\d\d-\d\d-\d\d)\b/i;

function sentenceAround(line, index) {
  const before = line.lastIndexOf('. ', index);
  const after = line.indexOf('. ', index);
  return line.slice(before < 0 ? 0 : before + 2, after < 0 ? line.length : after + 1);
}

/**
 * Returns every stated collection total in `line` that disagrees with the living data.
 * Totals below 20 are ignored: they describe one exhibit's contents, not the collection.
 */
export function countClaims(line, totals) {
  const claims = [];
  for (const m of line.matchAll(COUNT_CLAIM)) {
    const stated = spokenNumber(m[1]);
    if (stated === null || stated < 20) continue;
    const actual = /^project/i.test(m[2]) ? totals.projects : totals.exhibits;
    const historical = HISTORICAL.test(sentenceAround(line, m.index));
    claims.push({ text: m[0], stated, actual, historical, ok: stated === actual || historical });
  }
  return claims;
}
