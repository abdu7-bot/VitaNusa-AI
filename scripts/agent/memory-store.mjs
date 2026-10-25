#!/usr/bin/env node
/**
 * VitaNusa AI - Memory Store
 *
 * Persistent storage for verified engineering memory records.
 * Each record tracks provenance, verification status, and staleness.
 * Never stores secrets or credentials.
 */

import { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

function redactSensitive(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/(?:api[_-]?key|token|secret|password|authorization|bearer)\s*[:=]\s*['"]?[^'"\s]+['"]?/gi, '[REDACTED]')
    .replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED]')
    .replace(/ghp_[a-zA-Z0-9]{36,}/g, '[REDACTED]')
    .replace(/x-access-token:[^@]+@/g, 'x-access-token:[REDACTED]@');
}
const MEMORY_VERSION = '1.0';

/**
 * Memory record types
 */
export const MEMORY_TYPES = {
  VERIFIED_FACT: 'verified_fact',
  TEST_OBSERVATION: 'test_observation',
  DESIGN_DECISION: 'design_decision',
  HYPOTHESIS: 'hypothesis',
  UNRESOLVED_DEFECT: 'unresolved_defect',
  HUMAN_APPROVAL: 'human_approval',
  EXTERNAL_BLOCKER: 'external_blocker',
};

/**
 * Verification status values
 */
export const VERIFICATION_STATUS = {
  VERIFIED: 'verified',
  PENDING: 'pending',
  REJECTED: 'rejected',
  STALE: 'stale',
  SUPERSEDED: 'superseded',
};

/**
 * Create a memory record
 * @param {object} params - Record parameters
 * @returns {object} Memory record
 */
export function createMemoryRecord(params) {
  const {
    title,
    description,
    type = MEMORY_TYPES.VERIFIED_FACT,
    category,
    source,
    evidence,
    repository,
    branch,
    commitSha,
    taskId,
    verificationStatus = VERIFICATION_STATUS.PENDING,
    confidence = 'medium',
    scope,
    limitations = [],
    supersedes,
    tags = [],
    lastValidatedAt,
    createdAt,
  } = params;

  const recordId = createHash('sha256')
    .update(`${title}:${type}:${category}:${Date.now()}`)
    .digest('hex')
    .substring(0, 16);

  return {
    recordId,
    version: MEMORY_VERSION,
    title,
    description,
    type,
    category,
    source,
    evidence: evidence || [],
    repository,
    branch,
    commitSha,
    taskId,
    verificationStatus,
    confidence,
    scope,
    limitations: limitations || [],
    supersedes: supersedes || null,
    tags: tags || [],
    createdAt: params.createdAt || new Date().toISOString(),
    lastValidatedAt: params.lastValidatedAt || new Date().toISOString(),
    supersededBy: null,
    isValid: true,
  };
}

/**
 * Validate a memory record
 * @param {object} record - Memory record to validate
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateMemoryRecord(record) {
  const errors = [];

  if (!record.recordId || typeof record.recordId !== 'string') {
    errors.push('Missing or invalid recordId');
  }
  if (!record.title || typeof record.title !== 'string') {
    errors.push('Missing or invalid title');
  }
  if (!record.description || typeof record.description !== 'string') {
    errors.push('Missing or invalid description');
  }
  if (!record.type || !Object.values(MEMORY_TYPES).includes(record.type)) {
    errors.push('Missing or invalid type');
  }
  if (!record.verificationStatus || !Object.values(VERIFICATION_STATUS).includes(record.verificationStatus)) {
    errors.push('Missing or invalid verificationStatus');
  }
  if (!Array.isArray(record.evidence)) {
    errors.push('evidence must be an array');
  } else {
    for (let i = 0; i < record.evidence.length; i++) {
      const evidenceItem = record.evidence[i];
      if (typeof evidenceItem !== 'object' || evidenceItem === null) {
        errors.push('Evidence item ' + i + ' must be an object');
      } else if (!evidenceItem.content || typeof evidenceItem.content !== 'string') {
        errors.push('Evidence item ' + i + ' must have a non-empty content string');
      }
    }
  }
  if (record.supersededBy && typeof record.supersededBy !== 'string') {
    errors.push('Invalid supersededBy field');
  }
  if (record.supersedes && typeof record.supersedes !== 'string') {
    errors.push('Invalid supersedes field');
  }
  if (record.supersedes && typeof record.supersedes !== 'string') {
    errors.push('Invalid supersedes field');
  }
  if (!Array.isArray(record.limitations)) {
    errors.push('limitations must be an array');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Create a memory store
 * @param {string} storeDir - Directory to persist memory records
 * @returns {object} Memory store API
 */
export function createMemoryStore(storeDir) {
  mkdirSync(storeDir, { recursive: true });

  const records = new Map();

  /**
   * Load all records from disk
   */
  function loadAll() {
    if (!existsSync(storeDir)) return;
    const files = readdirSync(storeDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = readFileSync(join(storeDir, file), 'utf8');
        const record = JSON.parse(raw);
        if (record.recordId) {
          records.set(record.recordId, record);
        }
      } catch (e) {
        // Skip corrupted records
      }
    }
  }

  /**
   * Save a record to disk
   * @param {object} record - Memory record
   */
  function persistRecord(record) {
    const file = join(storeDir, `${record.recordId}.json`);
    undefined
  }

  loadAll();

  return {
    /**
     * Add a new memory record
     * @param {object} params - Record parameters
     * @returns {object} { success: boolean, recordId?: string, errors?: string[] }
     */
    add(recordParams) {
      const record = createMemoryRecord(recordParams);
      const validation = validateMemoryRecord(record);
      if (!validation.valid) {
        return { success: false, errors: validation.errors };
      }

      // Check for superseded records
      if (record.supersedes) {
        const existing = records.get(record.supersedes);
        if (!existing) {
          return { success: false, errors: ['Referenced record does not exist: ' + record.supersedes] };
        }
        existing.supersededBy = record.recordId;
        existing.verificationStatus = VERIFICATION_STATUS.SUPERSEDED;
        existing.isValid = false;
        persistRecord(existing);
      }

      // Redact secrets in evidence items AND reject records with secrets
      if (record.evidence && Array.isArray(record.evidence)) {
        for (const ev of record.evidence) {
          if (typeof ev.content === 'string' && redactSensitive(ev.content) !== ev.content) {
            return { success: false, errors: ['Evidence contains sensitive information'] };
          }
        }
        record.evidence = record.evidence.map(ev => {
          if (typeof ev.content === 'string') {
            return { ...ev, content: redactSensitive(ev.content) };
          }
          return ev;
        });
      }
      // Redact secrets in record text fields
      if (typeof record.description === 'string') {
        record.description = redactSensitive(record.description);
      }
      if (record.title && typeof record.title === 'string') {
        record.title = redactSensitive(record.title);
      }
      // Redact secrets in record text fields before storing in memory
      if (typeof record.title === 'string') {
        record.title = redactSensitive(record.title);
      }
      if (typeof record.description === 'string') {
        record.description = redactSensitive(record.description);
      }
      records.set(record.recordId, record);
      persistRecord(record);

      return { success: true, recordId: record.recordId, record };
    },

    /**
     * Get a record by ID
     * @param {string} recordId - Record ID
     * @returns {object|null} Record or null
     */
    get(recordId) {
      return records.get(recordId) || null;
    },

    /**
     * Get all records, optionally filtered
     * @param {object} filter - Filter criteria
     * @returns {object[]} Matching records
     */
    getAll(filter = {}) {
      let results = Array.from(records.values());

      if (filter.type) {
        results = results.filter(r => r.type === filter.type);
      }
      if (filter.verificationStatus) {
        results = results.filter(r => r.verificationStatus === filter.verificationStatus);
      }
      if (filter.category) {
        results = results.filter(r => r.category === filter.category);
      }
      if (filter.isValid !== undefined) {
        results = results.filter(r => r.isValid === filter.isValid);
      }
      if (filter.tag) {
        results = results.filter(r => r.tags && r.tags.includes(filter.tag));
      }

      return results;
    },

    /**
     * Update a record
     * @param {string} recordId - Record ID
     * @param {object} updates - Fields to update
     * @returns {object} { success: boolean, errors?: string[] }
     */
    update(recordId, updates) {
      const record = records.get(recordId);
      if (!record) {
        return { success: false, errors: ['Record not found'] };
      }

      const updated = { ...record, ...updates, recordId };
      const validation = validateMemoryRecord(updated);
      if (!validation.valid) {
        return { success: false, errors: validation.errors };
      }

      records.set(recordId, updated);
      persistRecord(updated);
      return { success: true, recordId, record: updated };
    },

    /**
     * Mark a record as superseded
     * @param {string} recordId - Record ID
     * @param {string} supersededBy - ID of replacing record
     * @returns {object} { success: boolean, errors?: string[] }
     */
    supersede(recordId, supersededBy) {
      const record = records.get(recordId);
      if (!record) {
        return { success: false, errors: ['Record not found'] };
      }

      record.supersededBy = supersededBy;
      record.verificationStatus = VERIFICATION_STATUS.SUPERSEDED;
      record.isValid = false;
      persistRecord(record);
      return { success: true, recordId };
    },

    /**
     * Mark a record as stale (needs revalidation)
     * @param {string} recordId - Record ID
     * @returns {object} { success: boolean }
     */
    markStale(recordId) {
      const record = records.get(recordId);
      if (!record) {
        return { success: false, errors: ['Record not found'] };
      }

      record.verificationStatus = VERIFICATION_STATUS.STALE;
      record.isValid = false;
      persistRecord(record);
      return { success: true, recordId };
    },

    /**
     * Mark a record as verified
     * @param {string} recordId - Record ID
     * @param {object} verificationInfo - Verification details
     * @returns {object} { success: boolean }
     */
    markVerified(recordId, verificationInfo = {}) {
      const record = records.get(recordId);
      if (!record) {
        return { success: false, errors: ['Record not found'] };
      }

      record.verificationStatus = VERIFICATION_STATUS.VERIFIED;
      record.isValid = true;
      record.lastValidatedAt = new Date().toISOString();
      if (verificationInfo.evidence) {
        record.evidence = [...(record.evidence || []), ...verificationInfo.evidence];
      }
      persistRecord(record);
      return { success: true, recordId, record };
    },

    /**
     * Get stale records that need revalidation
     * @param {number} maxAgeDays - Max age in days before considered stale
     * @returns {object[]} Stale records
     */
    getStaleRecords(maxAgeDays = 30) {
      const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
      return Array.from(records.values()).filter(r => {
        if (r.verificationStatus === VERIFICATION_STATUS.SUPERSEDED) return false;
        if (r.verificationStatus === VERIFICATION_STATUS.REJECTED) return false;
        const lastValidated = new Date(r.lastValidatedAt);
        return lastValidated < cutoff;
      });
    },

    /**
     * Get all records as array
     * @returns {object[]} All records
     */
    getAllRecords() {
      return Array.from(records.values());
    },

    /**
     * Get record count
     * @returns {number} Total record count
     */
    getCount() {
      return records.size;
    },
  };
}

