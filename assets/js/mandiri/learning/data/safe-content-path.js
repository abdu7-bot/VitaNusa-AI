import { learningContentError } from './content-loader-errors.js';

export const LEARNING_CONTENT_ROOT = 'content/mandiri/learning/';
export const LEARNING_CATALOG_FILENAME = 'catalog.json';

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/iu;

function decodePath(value) {
  let current = value;
  for (let count = 0; count < 4; count += 1) {
    let decoded;
    try {
      decoded = decodeURIComponent(current);
    } catch (error) {
      throw learningContentError('unsafe_path', error);
    }
    if (decoded === current) return decoded;
    current = decoded;
  }
  throw learningContentError('unsafe_path');
}

export function assertSafeLearningContentPath(value, { requireRoot = false } = {}) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > 320
    || value !== value.trim()
    || CONTROL_CHARACTER_PATTERN.test(value)
    || value.includes('\\')
    || value.includes('?')
    || value.includes('#')
    || value.startsWith('/')
    || value.startsWith('//')
    || URL_SCHEME_PATTERN.test(value)
  ) {
    throw learningContentError('unsafe_path');
  }

  const decoded = decodePath(value);
  if (
    decoded !== decoded.trim()
    || CONTROL_CHARACTER_PATTERN.test(decoded)
    || decoded.includes('\\')
    || decoded.includes('?')
    || decoded.includes('#')
    || decoded.startsWith('/')
    || decoded.startsWith('//')
    || URL_SCHEME_PATTERN.test(decoded)
  ) {
    throw learningContentError('unsafe_path');
  }
  const segments = decoded.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw learningContentError('unsafe_path');
  }
  if (requireRoot && !decoded.startsWith(LEARNING_CONTENT_ROOT)) {
    throw learningContentError('unsafe_path');
  }
  return decoded;
}

function parseAllowedUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw learningContentError('unsafe_path', error);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw learningContentError('unsafe_path');
  }
  return parsed;
}

export function assertLearningCatalogUrl(value) {
  const parsed = parseAllowedUrl(value);
  const expectedSuffix = `/${LEARNING_CONTENT_ROOT}${LEARNING_CATALOG_FILENAME}`;
  if (!parsed.pathname.endsWith(expectedSuffix) || parsed.search || parsed.hash) {
    throw learningContentError('unsafe_path');
  }
  return parsed.href;
}

export function resolveLearningCatalogUrl(pageUrl) {
  const page = parseAllowedUrl(pageUrl);
  const catalog = new URL(`../../${LEARNING_CONTENT_ROOT}${LEARNING_CATALOG_FILENAME}`, page);
  return assertLearningCatalogUrl(catalog.href);
}

export function resolveLearningContentUrl(
  relativePath,
  { catalogUrl, baseUrl = catalogUrl } = {},
) {
  const safePath = assertSafeLearningContentPath(relativePath);
  const catalog = new URL(assertLearningCatalogUrl(catalogUrl));
  const base = parseAllowedUrl(baseUrl);
  if (base.origin !== catalog.origin) throw learningContentError('unsafe_path');

  const resolved = new URL(safePath, base);
  const catalogRoot = catalog.pathname.slice(0, -LEARNING_CATALOG_FILENAME.length);
  if (
    resolved.origin !== catalog.origin
    || !resolved.pathname.startsWith(catalogRoot)
    || resolved.pathname === catalogRoot
    || resolved.search
    || resolved.hash
  ) {
    throw learningContentError('unsafe_path');
  }
  return resolved.href;
}
