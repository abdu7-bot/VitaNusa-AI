import { MandiriDomainError } from '../../domain/validation.js';

export class NusaBelajarDomainError extends MandiriDomainError {
  constructor(code, message, path = '') {
    super(code, message, path);
    this.name = 'NusaBelajarDomainError';
  }
}

export function createLearningError(code, path, message) {
  return new NusaBelajarDomainError(code, message, path);
}
