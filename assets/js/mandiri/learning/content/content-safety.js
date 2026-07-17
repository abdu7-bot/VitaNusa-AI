import {
  assertSafeDataStructure,
  deepFreezeLearningValue,
} from '../domain/learning-validation.js';

const SAFETY_RULES = Object.freeze([
  Object.freeze({
    code: 'degrading_language',
    message: 'bahasa yang menilai atau merendahkan pengguna tidak diizinkan',
    patterns: Object.freeze([
      /\bbodoh\b/iu,
      /\bgagal\s+total\b/iu,
      /\b(?:kamu|anda|pengguna)\s+(?:benar-benar\s+)?tidak\s+mampu\b/iu,
      /\b(?:kamu|anda|pengguna)\s+tertinggal\b/iu,
      /\b(?:kamu|anda|pengguna)\s+malas\b/iu,
      /\biq\s+rendah\b/iu,
    ]),
  }),
  Object.freeze({
    code: 'formal_education_claim',
    message: 'klaim kesetaraan atau kelulusan pendidikan formal tidak diizinkan',
    patterns: Object.freeze([
      /\bsetara\s+(?:sd|smp|sma|sekolah)\b/iu,
      /\bpasti\s+lulus\b/iu,
      /\bpengganti\s+(?:sekolah|guru)\b/iu,
    ]),
  }),
  Object.freeze({
    code: 'health_claim',
    message: 'klaim kesehatan berlebihan atau diagnosis tidak diizinkan',
    patterns: Object.freeze([
      /\bpasti\s+sembuh\b/iu,
      /\bmendiagnosis\s+penyakit\b/iu,
      /\b100\s*%\s+aman\b/iu,
      /\btanpa\s+efek\s+samping\b/iu,
    ]),
  }),
  Object.freeze({
    code: 'business_claim',
    message: 'klaim keuntungan atau status laporan resmi tidak diizinkan',
    patterns: Object.freeze([
      /\bpasti\s+untung\b/iu,
      /\blaba\s+dijamin\b/iu,
      /\blaporan\s+pajak\s+resmi\b/iu,
    ]),
  }),
]);

function collectStrings(value, path, output) {
  if (typeof value === 'string') {
    output.push({ path, value });
    return;
  }
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${path}[${index}]`, output));
    return;
  }
  for (const key of Object.keys(value)) {
    collectStrings(value[key], `${path}.${key}`, output);
  }
}

export function lintContentSafety(input, { path = 'content' } = {}) {
  assertSafeDataStructure(input, { path, maxDepth: 20, maxNodes: 100000 });
  const strings = [];
  collectStrings(input, path, strings);
  const findings = [];

  for (const item of strings) {
    for (const rule of SAFETY_RULES) {
      if (rule.patterns.some((pattern) => pattern.test(item.value))) {
        findings.push(Object.freeze({
          code: rule.code,
          path: item.path,
          message: rule.message,
        }));
      }
    }
  }

  return deepFreezeLearningValue(findings);
}

export function isContentSafetyClean(input, options) {
  return lintContentSafety(input, options).length === 0;
}
