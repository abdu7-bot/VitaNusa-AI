import { normalizeLearningPackageCatalog } from '../content/package-catalog.js';
import { deepFreezeLearningValue } from '../domain/learning-validation.js';
import { mapLearningContentError } from './content-loader-errors.js';
import { assertLearningCatalogUrl } from './safe-content-path.js';
import { fetchStaticContentBytes, parseStaticJson } from './static-content-fetch.js';

export const MAX_LEARNING_CATALOG_BYTES = 64 * 1024;

export function createLearningCatalogLoader({
  fetchImpl = globalThis.fetch,
  catalogUrl,
  maxBytes = MAX_LEARNING_CATALOG_BYTES,
} = {}) {
  const safeCatalogUrl = assertLearningCatalogUrl(catalogUrl);

  async function loadCatalog() {
    const bytes = await fetchStaticContentBytes({
      fetchImpl,
      url: safeCatalogUrl,
      maxBytes,
      loadErrorCode: 'catalog_load_failed',
      tooLargeCode: 'catalog_too_large',
    });
    const input = parseStaticJson(bytes, 'catalog_json_invalid');
    let catalog;
    try {
      catalog = normalizeLearningPackageCatalog(input);
    } catch (error) {
      throw mapLearningContentError(error, 'catalog_invalid');
    }
    const entries = catalog.packages.filter((entry) => (
      entry.status === 'published' && entry.reviewStatus === 'approved'
    ));
    return deepFreezeLearningValue({
      catalog,
      entries: [...entries],
      catalogUrl: safeCatalogUrl,
      byteLength: bytes.byteLength,
    });
  }

  return Object.freeze({ loadCatalog });
}

export async function loadLearningCatalog(options) {
  return createLearningCatalogLoader(options).loadCatalog();
}
