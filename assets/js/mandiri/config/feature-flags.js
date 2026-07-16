export const MANDIRI_FEATURE_ENV_KEY = 'VITE_VITANUSA_MANDIRI_STATE';
export const MANDIRI_FEATURE_STATES = Object.freeze({
  OFF: 'off',
  INTERNAL: 'internal',
});

const BUILD_FEATURE_STATE = (
  typeof import.meta.env === 'object'
  && import.meta.env
  && import.meta.env.VITE_VITANUSA_MANDIRI_STATE
);

export function resolveMandiriFeatureState(value) {
  return value === MANDIRI_FEATURE_STATES.INTERNAL
    ? MANDIRI_FEATURE_STATES.INTERNAL
    : MANDIRI_FEATURE_STATES.OFF;
}

export function readMandiriFeatureState(environment = {}) {
  if (!environment || typeof environment !== 'object') {
    return MANDIRI_FEATURE_STATES.OFF;
  }

  return resolveMandiriFeatureState(environment[MANDIRI_FEATURE_ENV_KEY]);
}

export function getMandiriFeatureState(environment) {
  if (environment !== undefined) {
    return readMandiriFeatureState(environment);
  }

  return resolveMandiriFeatureState(BUILD_FEATURE_STATE);
}

export function getMandiriFeatureContract(value) {
  const state = resolveMandiriFeatureState(value);
  const isInternal = state === MANDIRI_FEATURE_STATES.INTERNAL;

  return Object.freeze({
    state,
    visibleInNavigation: isInternal,
    shellAvailable: isInternal,
    grantsPermission: false,
    startsStorage: false,
  });
}

export function shouldStartMandiriStorage() {
  return false;
}
