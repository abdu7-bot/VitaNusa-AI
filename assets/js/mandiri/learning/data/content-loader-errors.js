const SAFE_MESSAGES = Object.freeze({
  feature_disabled: 'NusaBelajar belum tersedia pada build ini.',
  catalog_load_failed: 'Katalog pembelajaran belum dapat dimuat.',
  catalog_too_large: 'Katalog pembelajaran melampaui batas aman.',
  catalog_json_invalid: 'Katalog pembelajaran tidak dapat dibaca.',
  catalog_invalid: 'Katalog pembelajaran tidak valid.',
  unsafe_path: 'Lokasi paket pembelajaran tidak aman.',
  manifest_load_failed: 'Manifest paket pembelajaran belum dapat dimuat.',
  manifest_too_large: 'Manifest paket pembelajaran melampaui batas aman.',
  manifest_json_invalid: 'Manifest paket pembelajaran tidak dapat dibaca.',
  manifest_invalid: 'Manifest paket pembelajaran tidak valid.',
  package_not_published: 'Paket pembelajaran belum dipublikasikan untuk mode ini.',
  content_load_failed: 'Materi pembelajaran belum dapat dimuat.',
  content_too_large: 'Materi pembelajaran melampaui batas aman.',
  content_size_mismatch: 'Ukuran materi tidak sesuai manifest.',
  checksum_unavailable: 'Paket materi tidak dapat diverifikasi. Coba muat ulang atau hubungi pengelola VitaNusa.',
  checksum_mismatch: 'Paket materi tidak dapat diverifikasi. Coba muat ulang atau hubungi pengelola VitaNusa.',
  content_json_invalid: 'Materi pembelajaran tidak dapat dibaca.',
  content_graph_invalid: 'Struktur materi pembelajaran tidak valid.',
  lesson_not_found: 'Pelajaran yang diminta tidak ditemukan.',
  exercise_not_found: 'Latihan yang diminta tidak ditemukan.',
  unsupported_activity: 'Aktivitas ini belum didukung pada tahap sekarang.',
  unsupported_exercise: 'Jenis latihan ini belum didukung pada tahap sekarang.',
  unknown_error: 'NusaBelajar belum dapat dibuka. Coba lagi nanti.',
});

export const NUSABELAJAR_CONTENT_ERROR_CODES = Object.freeze(Object.keys(SAFE_MESSAGES));

export class NusaBelajarContentError extends Error {
  constructor(code, cause) {
    const safeCode = Object.hasOwn(SAFE_MESSAGES, code) ? code : 'unknown_error';
    super(SAFE_MESSAGES[safeCode]);
    this.name = 'NusaBelajarContentError';
    this.code = safeCode;
    if (cause && typeof cause.name === 'string') {
      this.causeName = cause.name.slice(0, 80);
    }
  }
}

export function learningContentError(code, cause) {
  return new NusaBelajarContentError(code, cause);
}

export function mapLearningContentError(error, fallbackCode = 'unknown_error') {
  if (error instanceof NusaBelajarContentError) return error;
  return learningContentError(fallbackCode, error);
}

export function getLearningContentErrorMessage(code) {
  return SAFE_MESSAGES[code] || SAFE_MESSAGES.unknown_error;
}
