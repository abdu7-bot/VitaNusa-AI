#!/usr/bin/env node
/**
 * VitaNusa AI - Context Selector
 *
 * Query-driven context selection for autonomous engineering tasks.
 * Treats all repository content as untrusted data.
 * Enforces configurable context budgets and validates retrieved content.
 */

import { mkdtempSync, rmSync, mkdirSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, basename, extname, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { buildRepositoryIndex, searchIndex, getChangedFiles, isSensitivePath, readFileSafely } from './repository-index.mjs';
import { createMemoryStore, MEMORY_TYPES } from './memory-store.mjs';

const MAX_CONTEXT_FILES = 50;
const MAX_CONTEXT_BYTES = 500 * 1024; // 500KB total context
const MAX_FILE_BYTES = 50 * 1024; // 50KB per file

/**
 * Create a context selector
 * @param {object} options - Configuration options
 * @returns {object} Context selector API
 */
export function createContextSelector(options = {}) {
  const {
    repoRoot = process.cwd(),
    memoryStoreDir,
    maxContextFiles = MAX_CONTEXT_FILES,
    maxContextBytes = MAX_CONTEXT_BYTES,
    maxFileBytes = MAX_FILE_BYTES,
  } = options;

  const memoryStore = memoryStoreDir ? createMemoryStore(memoryStoreDir) : null;
  let repoIndex = null;
  let indexTimestamp = null;

  /**
   * Get or build repository index
   */
  function getRepoIndex(forceRefresh = false) {
    const now = Date.now();
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    if (repoIndex && indexTimestamp && (now - indexTimestamp < CACHE_TTL) && !forceRefresh) {
      return repoIndex;
    }

    repoIndex = buildRepositoryIndex(repoRoot, {
      maxFiles: 5000,
      includeDotfiles: false,
    });
    indexTimestamp = now;
    return repoIndex;
  }

  /**
   * Refresh repository index
   */
  function refreshIndex() {
    repoIndex = buildRepositoryIndex(repoRoot, {
      maxFiles: 5000,
      includeDotfiles: false,
    });
    indexTimestamp = Date.now();
    return repoIndex;
  }

  /**
   * Select relevant context for a task
   * @param {object} task - Task definition with objective, instructions, etc.
   * @param {object} options - Selection options
   * @returns {object} Selected context with evidence
   */
  function selectContext(task, options = {}) {
    const {
      maxFiles = maxContextFiles,
      maxBytes = maxContextBytes,
      maxFileBytes = MAX_FILE_BYTES,
      includeTests = true,
      includeConfig = true,
      includeDocs = false,
    } = options;

    const context = {
      taskId: task.id,
      taskObjective: task.objective || task.instructions || '',
      selectedAt: new Date().toISOString(),
      files: [],
      totalBytes: 0,
      fileCount: 0,
      evidence: [],
      warnings: [],
      errors: [],
    };

    // Get repository index
    const index = getRepoIndex();
    if (!index) {
      context.errors.push('Failed to build repository index');
      return context;
    }

    // Extract keywords from task
    const taskKeywords = extractKeywords(task.objective || task.instructions || '');

    // Score and rank files
    const scoredFiles = scoreFiles(index.files, taskKeywords, task);

    // Select files within budget
    let remainingBytes = maxBytes;
    let remainingFiles = maxFiles;

    for (const fileInfo of scoredFiles) {
      if (remainingFiles <= 0 || remainingBytes <= 0) break;

      const filePath = fileInfo.path;
      const fileSize = fileInfo.size || 0;

      // Skip if too large
      if (fileSize > maxFileBytes) {
        context.warnings.push({
          path: filePath,
          reason: 'file_too_large',
          size: fileSize,
        });
        continue;
      }

      // Skip sensitive files
      if (isSensitivePath(filePath)) {
        context.warnings.push({
          path: filePath,
          reason: 'sensitive_file',
        });
        continue;
      }

      // Read file content
      const fileResult = readFileSafely(fileInfo.absolutePath);
      if (fileInfo.error || !fileResult.content) {
        context.errors.push({
          path: filePath,
          error: fileInfo.error || 'unknown',
        });
        continue;
      }

      // Redact sensitive content
      const redactedContent = redactSensitive(fileResult.content);

      context.files.push({
        path: filePath,
        relativePath: filePath,
        size: redactedContent.length,
        content: redactedContent,
        gitStatus: fileInfo.gitStatus,
        extension: extname(filePath),
        relevanceScore: fileInfo._relevanceScore || 0,
        matchedKeywords: fileInfo._matchedKeywords || [],
      });

      remainingBytes -= redactedContent.length;
      remainingFiles--;
    }

    return context;
  }

  /**
   * Extract keywords from text
   */
  function extractKeywords(text) {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
      'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'must', 'can', 'can',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
      'we', 'they', 'me', 'him', 'her', 'us', 'them',
    ]);

    const words = text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

    // Count frequency
    const freq = {};
    for (const w of words) {
      freq[w] = (freq[w] || 0) + 1;
    }

    // Return top keywords by frequency
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word);
  }

  /**
   * Score files based on keyword matching
   */
  function scoreFiles(files, keywords, task) {
    const scored = [];

    for (const [filePath, fileInfo] of Object.entries(files)) {
      if (!fileInfo.content) continue;

      const content = fileInfo.content.toLowerCase();
      let score = 0;
      const matchedKeywords = [];

      for (const keyword of keywords) {
        if (content.includes(keyword.toLowerCase())) {
          score += 1;
          matchedKeywords.push(keyword);
        }
      }

      // Boost score for test files if task is about testing
      if (task.objective && task.objective.toLowerCase().includes('test')) {
        if (filePath.includes('.test.') || filePath.includes('.spec.')) {
          score += 5;
        }
      }

      // Boost score for config files if task is about config
      if (task.objective && task.objective.toLowerCase().includes('config')) {
        if (filePath.includes('config') || filePath.includes('.json') || filePath.includes('.yaml') || filePath.includes('.yml')) {
          score += 5;
        }
      }

      // Boost score for policy files if task is about policy
      if (task.objective && task.objective.toLowerCase().includes('policy')) {
        if (filePath.includes('policy')) {
          score += 10;
        }
      }

      if (score > 0) {
        scored.push({
          ...fileInfo,
          _relevanceScore: score,
          _matchedKeywords: matchedKeywords,
        });
      }
    }

    // Sort by score descending
    scored.sort((a, b) => b._relevanceScore - a._relevanceScore);
    return scored;
  }

  /**
   * Redact sensitive content from text
   */
  function redactSensitive(text) {
    if (typeof text !== 'string') return text;
    return text
      .replace(/(?:api[_-]?key|token|secret|password|authorization|bearer)\s*[:=]\s*['"]?[^'"\s]+['"]?/gi, '[REDACTED]')
      .replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED]')
      .replace(/ghp_[a-zA-Z0-9]{36,}/g, '[REDACTED]')
      .replace(/x-access-token:[^@]+@/g, 'x-access-token:[REDACTED]@');
  }

  return {
    selectContext,
    refreshIndex,
    getRepoIndex: () => repoIndex,
    extractKeywords,
    redactSensitive,
  };
}

