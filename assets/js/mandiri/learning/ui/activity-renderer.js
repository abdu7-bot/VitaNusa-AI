import { learningContentError } from '../data/content-loader-errors.js';

function textElement(documentRef, tagName, value, className) {
  const element = documentRef.createElement(tagName);
  if (className) element.className = className;
  element.textContent = value;
  return element;
}

export function renderLearningActivity(documentRef, activity) {
  if (!['read_example', 'observe_sequence'].includes(activity?.type)) {
    throw learningContentError('unsupported_activity');
  }
  const section = documentRef.createElement('section');
  section.className = 'vn-learning-activity';
  section.dataset.activityId = activity.activityId;
  section.append(
    textElement(documentRef, 'h2', 'Aktivitas tanpa nilai'),
    textElement(documentRef, 'p', activity.prompt),
  );
  const list = documentRef.createElement(activity.type === 'observe_sequence' ? 'ol' : 'ul');
  activity.items.forEach((item) => list.append(textElement(documentRef, 'li', item.label)));
  section.append(list, textElement(documentRef, 'p', activity.explanation, 'vn-learning-muted'));

  const button = textElement(
    documentRef,
    'button',
    activity.type === 'read_example' ? 'Tandai sudah dibaca' : 'Tandai sudah dipahami',
  );
  button.type = 'button';
  const status = textElement(documentRef, 'p', '', 'vn-learning-activity-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const onClick = () => {
    button.disabled = true;
    status.textContent = 'Aktivitas ditandai untuk sesi halaman ini saja. Tidak ada skor yang dibuat.';
  };
  button.addEventListener('click', onClick);
  section.append(button, status);

  return Object.freeze({
    element: section,
    destroy() { button.removeEventListener('click', onClick); },
  });
}
