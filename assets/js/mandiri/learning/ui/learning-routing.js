import { normalizeContentId } from '../domain/learning-validation.js';

export const MAX_LESSON_ROUTE_LENGTH = 120;

export function parseLessonRoute(search = '') {
  if (typeof search !== 'string' || search.length > 512) {
    return Object.freeze({ ok: false, reason: 'invalid_route', lessonId: null });
  }
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const entries = [...params.entries()];
  if (entries.length !== 1 || entries[0][0] !== 'lesson') {
    return Object.freeze({ ok: false, reason: 'invalid_route', lessonId: null });
  }
  const lessonId = entries[0][1];
  if (!lessonId || lessonId.length > MAX_LESSON_ROUTE_LENGTH) {
    return Object.freeze({ ok: false, reason: 'invalid_route', lessonId: null });
  }
  try {
    const normalized = normalizeContentId(lessonId, 'lesson', 'lesson');
    return Object.freeze({ ok: true, reason: null, lessonId: normalized });
  } catch {
    return Object.freeze({ ok: false, reason: 'invalid_route', lessonId: null });
  }
}

export function createLessonHref(lessonId) {
  const normalized = normalizeContentId(lessonId, 'lesson', 'lesson');
  return `./lesson.html?lesson=${encodeURIComponent(normalized)}`;
}
