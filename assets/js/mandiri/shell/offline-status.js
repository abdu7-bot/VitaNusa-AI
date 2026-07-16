export const MANDIRI_STATUS_STATES = Object.freeze([
  'local-only',
  'offline',
  'online-unverified',
  'pending',
  'blocked',
  'conflict',
]);

const STATUS_DEFINITIONS = Object.freeze({
  'local-only': Object.freeze({
    label: 'Mode lokal',
    message: 'Data Mandiri belum disinkronkan ke cloud.',
  }),
  offline: Object.freeze({
    label: 'Offline',
    message: 'Perangkat sedang offline. Fondasi lokal tetap dapat dibuka.',
  }),
  'online-unverified': Object.freeze({
    label: 'Internet tersedia',
    message: 'Internet tersedia, tetapi VitaNusa Mandiri masih berjalan lokal.',
  }),
  pending: Object.freeze({
    label: 'Menunggu',
    message: 'Ada operasi lokal yang belum selesai diperiksa.',
  }),
  blocked: Object.freeze({
    label: 'Status dibatasi',
    message: 'Status belum dapat dipastikan. Tidak ada data yang dikirim.',
  }),
  conflict: Object.freeze({
    label: 'Perlu pemeriksaan',
    message: 'Terdapat status lokal yang perlu diperiksa sebelum melanjutkan.',
  }),
});

export function normalizeMandiriStatusState(value) {
  return MANDIRI_STATUS_STATES.includes(value) ? value : 'blocked';
}

export function getMandiriStatus(value) {
  const state = normalizeMandiriStatusState(value);
  const definition = STATUS_DEFINITIONS[state];

  return Object.freeze({
    state,
    label: definition.label,
    message: definition.message,
  });
}

export function resolveMandiriConnectionState(online) {
  if (online === false) return 'offline';
  if (online === true) return 'online-unverified';
  return 'local-only';
}

export function renderMandiriStatus(node, value) {
  const status = getMandiriStatus(value);
  if (!node) return status;

  node.dataset.mandiriStatus = status.state;
  node.textContent = status.message;
  node.setAttribute('aria-label', status.label + ': ' + status.message);
  return status;
}

export function initMandiriOfflineStatus({
  windowRef = window,
  documentRef = windowRef.document,
} = {}) {
  const localStatusNode = documentRef.querySelector('[data-mandiri-local-status]');
  const connectionStatusNode = documentRef.querySelector('[data-mandiri-connection-status]');

  renderMandiriStatus(localStatusNode, 'local-only');

  const updateConnection = () => renderMandiriStatus(
    connectionStatusNode,
    resolveMandiriConnectionState(windowRef.navigator?.onLine),
  );
  const handleOnline = () => renderMandiriStatus(connectionStatusNode, 'online-unverified');
  const handleOffline = () => renderMandiriStatus(connectionStatusNode, 'offline');

  updateConnection();
  windowRef.addEventListener('online', handleOnline);
  windowRef.addEventListener('offline', handleOffline);

  return Object.freeze({
    getLocalState: () => getMandiriStatus('local-only'),
    getConnectionState: updateConnection,
    destroy() {
      windowRef.removeEventListener('online', handleOnline);
      windowRef.removeEventListener('offline', handleOffline);
    },
  });
}
