#!/usr/bin/env node
/**
 * VitaNusa AI - Repository Index
 *
 * Builds a structured, bounded index of the repository for context retrieval.
 * Handles deleted, renamed, generated, binary, and ignored files explicitly.
 * Never indexes secrets, credentials, or unnecessary generated output.
 */

import { mkdtempSync, rmSync, mkdirSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename, extname, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const MAX_FILE_SIZE = 500 * 1024; // 500KB max per file
const MAX_FILES_PER_INDEX = 5000;

// Sensitive file patterns that should NOT be indexed
const SENSITIVE_PATTERNS = [
  /\.env$/,
  /\.env\.[^.]+$/,
  /\.secret/,
  /secrets?/,
  /\.pem$/,
  /\.key$/,
  /\.crt$/,
  /id_rsa/,
  /id_dsa/,
  /github_token/,
  /api_key/,
  /access_token/,
  /\.aws\/credentials/,
  /config\/secrets/,
  /\.env\.local/,
  /\.env\.development/,
  /\.env\.production/,
  /\.env\.staging/,
];

// Generated/cache directories to skip
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.cache',
  '__pycache__',
  '.venv',
  'vendor',
  'target',
  'bin',
  'obj',
]);

// Binary file extensions that should not be indexed as text
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
  '.mp3', '.mp4', '.wav', '.flac', '.ogg',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
]);

/**
 * Check if a path matches any sensitive pattern
 */
export function isSensitivePath(filePath) {
  const basenameLower = basename(filePath).toLowerCase();
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(basenameLower)) ||
         SENSITIVE_PATTERNS.some(pattern => pattern.test(filePath.toLowerCase()));
}

/**
 * Check if a path should be skipped (generated/cache directories)
 */
function isSkippedDir(dirPath) {
  const parts = dirPath.split(/[/\\]/);
  return parts.some(part => SKIP_DIRS.has(part));
}

/**
 * Check if a file extension is binary
 */
export function isBinaryFile(filePath) {
  const ext = extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * Read file content safely, handling binary files and size limits
 */
export function readFileSafely(filePath) {
  try {
    const stat = statSync(filePath);
    if (stat.size > MAX_FILE_SIZE) {
      return { content: null, error: 'file_too_large', size: stat.size };
    }
    if (isBinaryFile(filePath)) {
      return { content: null, error: 'binary_file', ext: extname(filePath) };
    }
    const content = readFileSync(filePath, 'utf8');
    return { content, error: null, size: stat.size };
  } catch (e) {
    return { content: null, error: e.message };
  }
}

/**
 * Get git status for a file (tracked, untracked, modified, deleted)
 */
function getGitStatus(repoRoot, filePath) {
  try {
    const relativePath = relative(repoRoot, filePath);
    const result = execFileSync('git', ['status', '--porcelain', '--', relativePath], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
    if (!result) return 'unchanged';
    const firstChar = result.charAt(0);
    const secondChar = result.charAt(1);
    const statusMap = {
      ' ': 'unmodified',
      'M': 'modified',
      'A': 'added',
      'D': 'deleted',
      'R': 'renamed',
      'C': 'copied',
      'U': 'updated_but_unmerged',
      '?': 'untracked',
      '!': 'ignored',
    };
    return statusMap[firstChar] || 'unknown';
  } catch (e) {
    return 'error';
  }
}

/**
 * Build a repository index from a given root directory
 * @param {string} repoRoot - Absolute path to repository root
 * @param {object} options - Indexing options
 * @returns {object} Repository index
 */
export function buildRepositoryIndex(repoRoot, options = {}) {
  const {
    maxFiles = MAX_FILES_PER_INDEX,
    includeDotfiles = false,
    customIgnores = [],
  } = options;

  const index = {
    version: '1.0',
    repoRoot,
    indexedAt: new Date().toISOString(),
    fileCount: 0,
    totalSize: 0,
    files: {},
    directories: {},
    languageStats: {},
    securityFlags: [],
    errors: [],
  };

  function walkDirectory(dirPath, relativePath = '') {
    let entries;
    try {
      entries = readdirSync(dirPath, { withFileTypes: true });
    } catch (e) {
      index.errors.push({ path: dirPath, error: e.message });
      return;
    }

    for (const entry of entries) {
      if (index.fileCount >= maxFiles) {
        index.errors.push({ path: dirPath, error: 'max_files_limit_reached' });
        return;
      }

      const fullPath = join(dirPath, entry.name);
      const relPath = relativePath ? join(relativePath, entry.name) : entry.name;

      // Skip sensitive files - record but don't index content
      if (isSensitivePath(fullPath)) {
        index.files[relPath] = {
          path: relPath,
          absolutePath: fullPath,
          type: 'sensitive',
          extension: extname(entry.name),
          size: statSync(fullPath).size || 0,
          indexed: false,
          reason: 'sensitive_file_pattern',
        };
        index.securityFlags.push({
          path: relPath,
          reason: 'sensitive_file_pattern',
          action: 'skipped',
        });
        index.fileCount++;
        continue;
      }

      // Skip directories
      if (entry.isDirectory()) {
        if (isSkippedDir(fullPath) || (entry.name.startsWith('.') && !includeDotfiles)) {
          continue;
        }
        walkDirectory(fullPath, relPath);
        continue;
      }

      // Skip binary files
      if (isBinaryFile(fullPath)) {
        index.files[relPath] = {
          path: relPath,
          absolutePath: fullPath,
          type: 'binary',
          extension: extname(entry.name),
          size: statSync(fullPath).size,
          indexed: false,
          reason: 'binary_file',
        };
        continue;
      }

      // Read file content
      const fileInfo = readFileSafely(fullPath);
      if (fileInfo.error) {
        index.files[relPath] = {
          path: relPath,
          absolutePath: fullPath,
          type: 'error',
          error: fileInfo.error,
          indexed: false,
        };
        continue;
      }

      // Get git status
      const gitStatus = getGitStatus(repoRoot, fullPath);

      index.files[relPath] = {
        path: relPath,
        absolutePath: fullPath,
        type: 'text',
        extension: extname(entry.name),
        size: fileInfo.size,
        content: fileInfo.content,
        gitStatus,
        indexed: true,
        indexedAt: new Date().toISOString(),
      };

      index.fileCount++;
      index.totalSize += fileInfo.size || 0;

      // Track language stats
      const ext = extname(entry.name).toLowerCase();
      index.languageStats[ext] = (index.languageStats[ext] || 0) + 1;

      // Track directory
      const dirName = relative(relativePath, '.') || '.';
      if (!index.directories[dirName]) {
        index.directories[dirName] = { fileCount: 0, totalSize: 0 };
      }
      index.directories[dirName].fileCount++;
      index.directories[dirName].totalSize += fileInfo.size || 0;
    }
  }

  walkDirectory(repoRoot);

  return index;
}

/**
 * Search index for files matching criteria
 */
export function searchIndex(index, options = {}) {
  const {
    extension,
    pathPattern,
    gitStatus,
    minSize,
    maxSize,
    limit = 50,
  } = options;

  const results = [];
  for (const [filePath, fileInfo] of Object.entries(index.files)) {
    if (extension && !filePath.endsWith(extension)) continue;
    if (pathPattern && !filePath.includes(pathPattern)) continue;
    if (gitStatus && fileInfo.gitStatus !== gitStatus) continue;
    if (minSize !== undefined && fileInfo.size < minSize) continue;
    if (maxSize !== undefined && fileInfo.size > maxSize) continue;

    results.push({ ...fileInfo });
    if (results.length >= limit) break;
  }

  return results;
}

/**
 * Get files changed since last commit
 */
export function getChangedFiles(repoRoot) {
  try {
    const output = execFileSync('git', ['diff', '--name-only', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
    if (!output) return [];
    return output.split('\n').filter(Boolean);
  } catch (e) {
    return [];
  }
}

