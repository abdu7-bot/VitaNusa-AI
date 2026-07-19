export const NUSAKASIR_FEATURE_ENV_KEY = 'VITE_NUSAKASIR_STATE';

export const NUSAKASIR_FEATURE_STATES = Object.freeze({
  OFF: 'off',
  INTERNAL: 'internal',
});

const BUILD_NUSAKASIR_STATE = (
  typeof import.meta.env === 'object'
  && import.meta.env
  && import.meta.env.VITE_NUSAKASIR_STATE
);

export function resolveNusaKasirFeatureState(value) {
  return value === NUSAKASIR_FEATURE_STATES.INTERNAL
    ? NUSAKASIR_FEATURE_STATES.INTERNAL
    : NUSAKASIR_FEATURE_STATES.OFF;
}

export function readNusaKasirFeatureState(environment = {}) {
  if (!environment || typeof environment !== 'object') {
    return NUSAKASIR_FEATURE_STATES.OFF;
  }
  return resolveNusaKasirFeatureState(environment[NUSAKASIR_FEATURE_ENV_KEY]);
}

export function getNusaKasirFeatureState(environment) {
  if (environment !== undefined) return readNusaKasirFeatureState(environment);
  return resolveNusaKasirFeatureState(BUILD_NUSAKASIR_STATE);
}

export function getNusaKasirFeatureContract({ mandiriState, nusakasirState } = {}) {
  const resolvedNusaKasirState = resolveNusaKasirFeatureState(nusakasirState);
  const enabled = mandiriState === 'internal'
    && resolvedNusaKasirState === NUSAKASIR_FEATURE_STATES.INTERNAL;

  return Object.freeze({
    state: enabled ? NUSAKASIR_FEATURE_STATES.INTERNAL : NUSAKASIR_FEATURE_STATES.OFF,
    mandiriState: mandiriState === 'internal' ? 'internal' : 'off',
    nusakasirState: resolvedNusaKasirState,
    enabled,
    grantsPermission: false,
    startsStorage: false,
  });
}
