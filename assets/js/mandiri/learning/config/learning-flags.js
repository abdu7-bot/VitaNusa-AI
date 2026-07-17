export const NUSABELAJAR_FEATURE_ENV_KEY = 'VITE_NUSABELAJAR_STATE';

export const NUSABELAJAR_FEATURE_STATES = Object.freeze({
  OFF: 'off',
  INTERNAL: 'internal',
});

const BUILD_LEARNING_STATE = (
  typeof import.meta.env === 'object'
  && import.meta.env
  && import.meta.env.VITE_NUSABELAJAR_STATE
);

export function resolveNusaBelajarFeatureState(value) {
  return value === NUSABELAJAR_FEATURE_STATES.INTERNAL
    ? NUSABELAJAR_FEATURE_STATES.INTERNAL
    : NUSABELAJAR_FEATURE_STATES.OFF;
}

export function readNusaBelajarFeatureState(environment = {}) {
  if (!environment || typeof environment !== 'object') {
    return NUSABELAJAR_FEATURE_STATES.OFF;
  }
  return resolveNusaBelajarFeatureState(environment[NUSABELAJAR_FEATURE_ENV_KEY]);
}

export function getNusaBelajarFeatureState(environment) {
  if (environment !== undefined) {
    return readNusaBelajarFeatureState(environment);
  }
  return resolveNusaBelajarFeatureState(BUILD_LEARNING_STATE);
}

export function getNusaBelajarFeatureContract({ mandiriState, learningState } = {}) {
  const resolvedLearningState = resolveNusaBelajarFeatureState(learningState);
  const enabled = mandiriState === 'internal'
    && resolvedLearningState === NUSABELAJAR_FEATURE_STATES.INTERNAL;

  return Object.freeze({
    state: enabled ? NUSABELAJAR_FEATURE_STATES.INTERNAL : NUSABELAJAR_FEATURE_STATES.OFF,
    mandiriState: mandiriState === 'internal' ? 'internal' : 'off',
    learningState: resolvedLearningState,
    enabled,
    grantsPermission: false,
    startsStorage: false,
  });
}
