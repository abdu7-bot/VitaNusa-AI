const ALLOWED_TAGS = new Set([
  'a',
  'article',
  'aside',
  'b',
  'blockquote',
  'br',
  'caption',
  'code',
  'dd',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  'section',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
]);

const VOID_TAGS = new Set(['br', 'hr', 'img']);
const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'plaintext']);
const FORBIDDEN_TAGS = new Set([
  'applet',
  'base',
  'button',
  'embed',
  'form',
  'frame',
  'frameset',
  'iframe',
  'input',
  'link',
  'math',
  'meta',
  'noembed',
  'noframes',
  'noscript',
  'object',
  'option',
  'plaintext',
  'portal',
  'script',
  'select',
  'slot',
  'style',
  'svg',
  'template',
  'textarea',
  'title',
  'xmp',
]);
const GLOBAL_ATTRIBUTES = new Set(['class']);
const TAG_ATTRIBUTES = Object.freeze({
  a: new Set(['href', 'rel', 'target', 'title']),
  img: new Set(['alt', 'height', 'src', 'title', 'width']),
  ol: new Set(['start', 'type']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
});
const URL_ATTRIBUTES = new Set(['href', 'src']);
const ALWAYS_REJECTED_ATTRIBUTES = new Set(['action', 'formaction', 'srcdoc', 'xlink:href']);
const SAFE_CLASS_PATTERN = /^[A-Za-z0-9_-]+(?:\s+[A-Za-z0-9_-]+)*$/u;
const SAFE_FRAGMENT_PATTERN = /^#[A-Za-z][A-Za-z0-9:._-]*$/u;
const SAFE_DIMENSION_PATTERN = /^(?:[1-9]\d{0,3})$/u;
const SAFE_INTEGER_PATTERN = /^(?:0|[1-9]\d{0,5})$/u;
const SAFE_OL_TYPE_PATTERN = /^[1AaIi]$/u;
const SAFE_SCOPE_VALUES = new Set(['col', 'colgroup', 'row', 'rowgroup']);
const SAFE_TARGET_VALUES = new Set(['_blank', '_self']);
const NAMED_ENTITIES = new Map([
  ['amp', '&'],
  ['apos', "'"],
  ['colon', ':'],
  ['copy', '©'],
  ['hellip', '…'],
  ['gt', '>'],
  ['lt', '<'],
  ['mdash', '—'],
  ['middot', '·'],
  ['ndash', '–'],
  ['newline', '\n'],
  ['nbsp', '\u00a0'],
  ['quot', '"'],
  ['rsquo', '’'],
  ['lsquo', '‘'],
  ['rdquo', '”'],
  ['ldquo', '“'],
  ['tab', '\t'],
]);
const CONTROL_OR_FORMAT_PATTERN = /[\u0000-\u001f\u007f-\u009f\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\u3164\ufeff\ufff9-\ufffb]/u;
const SOURCE_CONTROL_OR_FORMAT_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\u3164\ufeff\ufff9-\ufffb]/u;
const COMPACT_SEPARATOR_PATTERN = /[\s\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/gu;
const ENCODED_MARKUP_PATTERN = /<(?:\/?\s*)?(?:applet|base|button|embed|form|frame|frameset|iframe|input|link|math|meta|noembed|noframes|noscript|object|option|plaintext|portal|script|select|slot|style|svg|template|textarea|title|xmp)\b/i;
const HTML_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9:-]*$/u;
const PHRASING_TAGS = new Set(['a', 'b', 'br', 'code', 'em', 'i', 'img', 'small', 'span', 'strong', 'sub', 'sup', 'u']);
const PHRASING_PARENTS = new Set(['a', 'b', 'code', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'i', 'p', 'small', 'span', 'strong', 'sub', 'sup', 'u']);
const TABLE_CHILDREN = Object.freeze({
  table: new Set(['caption', 'tbody', 'tfoot', 'thead']),
  tbody: new Set(['tr']),
  tfoot: new Set(['tr']),
  thead: new Set(['tr']),
  tr: new Set(['td', 'th']),
});
const REQUIRED_PARENTS = Object.freeze({
  caption: new Set(['table']),
  dd: new Set(['dl']),
  dt: new Set(['dl']),
  li: new Set(['ol', 'ul']),
  tbody: new Set(['table']),
  td: new Set(['tr']),
  tfoot: new Set(['table']),
  th: new Set(['tr']),
  thead: new Set(['table']),
  tr: new Set(['tbody', 'tfoot', 'thead']),
});

function decodeCharacterReferences(value) {
  return String(value || '').replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z][a-z0-9]+);?/gi, (match, entity) => {
    if (entity[0] === '#') {
      const hexadecimal = entity[1]?.toLowerCase() === 'x';
      const digits = entity.slice(hexadecimal ? 2 : 1);
      const codePoint = Number.parseInt(digits, hexadecimal ? 16 : 10);
      if (!Number.isInteger(codePoint) || codePoint <= 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
        return '\ufffd';
      }
      return String.fromCodePoint(codePoint);
    }
    return NAMED_ENTITIES.get(entity.toLowerCase()) ?? match;
  });
}

function decodePercentEncoding(value) {
  let decoded = String(value || '');
  for (let index = 0; index < 4; index += 1) {
    const next = decoded.replace(/(?:%[0-9a-f]{2})+/gi, (sequence) => {
      try {
        return decodeURIComponent(sequence);
      } catch {
        return sequence.replace(/%([0-9a-f]{2})/gi, (_match, byte) => String.fromCharCode(Number.parseInt(byte, 16)));
      }
    });
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

function decodeForInspection(value) {
  let decoded = String(value || '');
  for (let index = 0; index < 4; index += 1) {
    const next = decodeCharacterReferences(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  return decodePercentEncoding(decoded);
}

function escapeText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttribute(value) {
  return escapeText(value)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inspectDangerousEncoding(source) {
  const decoded = decodeForInspection(source);
  if (SOURCE_CONTROL_OR_FORMAT_PATTERN.test(decoded)) return false;
  if (decoded !== source && ENCODED_MARKUP_PATTERN.test(decoded)) return false;
  return true;
}

function isSafeUrl(value, attributeName) {
  const decoded = decodeForInspection(value);
  if (!decoded || CONTROL_OR_FORMAT_PATTERN.test(decoded)) return false;

  const normalized = decoded.normalize('NFKC').trim();
  const compact = normalized.replace(COMPACT_SEPARATOR_PATTERN, '');
  if (!compact || /^(?:data|javascript|vbscript):/i.test(compact)) return false;
  if (attributeName === 'href' && SAFE_FRAGMENT_PATTERN.test(normalized)) return true;
  if (normalized.startsWith('#')) return false;

  const schemeMatch = compact.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!schemeMatch) {
    return !normalized.startsWith('//') && !normalized.startsWith('\\') && !normalized.includes('\\');
  }

  const protocol = schemeMatch[1].toLowerCase();
  if (attributeName === 'src') return protocol === 'http' || protocol === 'https';
  return protocol === 'http' || protocol === 'https' || protocol === 'mailto' || protocol === 'tel';
}

function normalizeAttribute(tagName, name, value) {
  const lowerName = name.toLowerCase();
  if (
    lowerName.startsWith('on')
    || ALWAYS_REJECTED_ATTRIBUTES.has(lowerName)
    || lowerName.includes(':')
  ) {
    return null;
  }

  const allowedForTag = TAG_ATTRIBUTES[tagName];
  if (!GLOBAL_ATTRIBUTES.has(lowerName) && !allowedForTag?.has(lowerName)) return null;
  if (CONTROL_OR_FORMAT_PATTERN.test(value)) return null;

  const decoded = decodeCharacterReferences(value).normalize('NFKC').trim();
  if (lowerName === 'class') {
    return decoded && SAFE_CLASS_PATTERN.test(decoded) ? decoded : null;
  }
  if (URL_ATTRIBUTES.has(lowerName)) {
    return isSafeUrl(value, lowerName) ? decoded : null;
  }
  if (lowerName === 'target') return SAFE_TARGET_VALUES.has(decoded) ? decoded : null;
  if (lowerName === 'rel') {
    const tokens = decoded.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.every((token) => token === 'noopener' || token === 'noreferrer')) return null;
    return [...new Set(tokens)].join(' ');
  }
  if (lowerName === 'width' || lowerName === 'height') return SAFE_DIMENSION_PATTERN.test(decoded) ? decoded : null;
  if (lowerName === 'colspan' || lowerName === 'rowspan' || lowerName === 'start') {
    return SAFE_INTEGER_PATTERN.test(decoded) ? decoded : null;
  }
  if (lowerName === 'type') return SAFE_OL_TYPE_PATTERN.test(decoded) ? decoded : null;
  if (lowerName === 'scope') return SAFE_SCOPE_VALUES.has(decoded.toLowerCase()) ? decoded.toLowerCase() : null;
  return decoded;
}

function parseOpeningTag(token) {
  const selfClosing = /\/\s*>$/u.test(token);
  const inner = token.slice(1, selfClosing ? token.lastIndexOf('/') : -1).trim();
  const nameMatch = inner.match(/^([A-Za-z][A-Za-z0-9:-]*)/u);
  if (!nameMatch) return null;

  const tagName = nameMatch[1].toLowerCase();
  if (!HTML_NAME_PATTERN.test(nameMatch[1])) return null;
  let cursor = nameMatch[0].length;
  const attributes = [];
  const seen = new Set();

  while (cursor < inner.length) {
    const whitespace = inner.slice(cursor).match(/^\s+/u);
    if (!whitespace) return null;
    cursor += whitespace[0].length;
    if (cursor >= inner.length) break;

    const attributeMatch = inner.slice(cursor).match(/^([^\s"'<>/=]+)\s*=\s*/u);
    if (!attributeMatch) return null;
    const name = attributeMatch[1];
    cursor += attributeMatch[0].length;
    const quote = inner[cursor];
    if (quote !== '"' && quote !== "'") return null;
    cursor += 1;
    const endQuote = inner.indexOf(quote, cursor);
    if (endQuote < 0) return null;
    const value = inner.slice(cursor, endQuote);
    cursor = endQuote + 1;

    const lowerName = name.toLowerCase();
    if (seen.has(lowerName)) return null;
    seen.add(lowerName);
    attributes.push({ name, value });
  }

  return { attributes, selfClosing, tagName };
}

function findTagEnd(source, start) {
  let quote = '';
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '>') return index;
    if (character === '<') return -1;
  }
  return -1;
}

function isAllowedChild(stack, tagName) {
  const parent = stack.at(-1);
  if (REQUIRED_PARENTS[tagName] && !REQUIRED_PARENTS[tagName].has(parent)) return false;
  if (!parent) return true;
  if (PHRASING_PARENTS.has(parent) && !PHRASING_TAGS.has(tagName)) return false;
  if (parent === 'a' && tagName === 'a') return false;
  if ((parent === 'ol' || parent === 'ul') && tagName !== 'li') return false;
  if (parent === 'dl' && tagName !== 'dt' && tagName !== 'dd') return false;
  if (TABLE_CHILDREN[parent] && !TABLE_CHILDREN[parent].has(tagName)) return false;
  if (['caption', 'dt'].includes(parent) && !PHRASING_TAGS.has(tagName)) return false;
  return true;
}

export function inspectContentHtml(html) {
  const source = String(html || '').trim();
  if (!source) return { ok: true, html: '', reason: '' };
  if (!inspectDangerousEncoding(source)) {
    return { ok: false, html: '', reason: 'encoded-or-control-payload' };
  }

  const stack = [];
  const output = [];
  let cursor = 0;

  while (cursor < source.length) {
    const nextTag = source.indexOf('<', cursor);
    if (nextTag < 0) {
      output.push(escapeText(decodeCharacterReferences(source.slice(cursor))));
      cursor = source.length;
      break;
    }

    output.push(escapeText(decodeCharacterReferences(source.slice(cursor, nextTag))));
    if (source.startsWith('<!--', nextTag) || /^<!|^<\?/u.test(source.slice(nextTag, nextTag + 3))) {
      return { ok: false, html: '', reason: 'markup-declaration' };
    }

    const tagEnd = findTagEnd(source, nextTag);
    if (tagEnd < 0) return { ok: false, html: '', reason: 'malformed-tag' };
    const token = source.slice(nextTag, tagEnd + 1);
    const closingMatch = token.match(/^<\s*\/\s*([A-Za-z][A-Za-z0-9:-]*)\s*>$/u);

    if (closingMatch) {
      const tagName = closingMatch[1].toLowerCase();
      if (!ALLOWED_TAGS.has(tagName) || VOID_TAGS.has(tagName) || stack.pop() !== tagName) {
        return { ok: false, html: '', reason: 'malformed-or-forbidden-closing-tag' };
      }
      output.push(`</${tagName}>`);
      cursor = tagEnd + 1;
      continue;
    }

    const parsed = parseOpeningTag(token);
    if (!parsed || FORBIDDEN_TAGS.has(parsed.tagName) || RAW_TEXT_TAGS.has(parsed.tagName) || !ALLOWED_TAGS.has(parsed.tagName)) {
      return { ok: false, html: '', reason: 'forbidden-or-malformed-tag' };
    }
    if (parsed.selfClosing && !VOID_TAGS.has(parsed.tagName)) {
      return { ok: false, html: '', reason: 'malformed-self-closing-tag' };
    }
    if (!isAllowedChild(stack, parsed.tagName)) {
      return { ok: false, html: '', reason: 'invalid-html-nesting' };
    }

    const safeAttributes = [];
    for (const attribute of parsed.attributes) {
      const safeValue = normalizeAttribute(parsed.tagName, attribute.name, attribute.value);
      if (safeValue === null) return { ok: false, html: '', reason: 'forbidden-or-invalid-attribute' };
      safeAttributes.push([attribute.name.toLowerCase(), safeValue]);
    }

    if (parsed.tagName === 'a' && safeAttributes.some(([name, value]) => name === 'target' && value === '_blank')) {
      const relIndex = safeAttributes.findIndex(([name]) => name === 'rel');
      const relTokens = new Set(relIndex >= 0 ? safeAttributes[relIndex][1].split(/\s+/) : []);
      relTokens.add('noopener');
      relTokens.add('noreferrer');
      const safeRel = ['rel', [...relTokens].join(' ')];
      if (relIndex >= 0) safeAttributes[relIndex] = safeRel;
      else safeAttributes.push(safeRel);
    }

    const serializedAttributes = safeAttributes
      .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
      .join('');
    output.push(`<${parsed.tagName}${serializedAttributes}>`);
    if (!VOID_TAGS.has(parsed.tagName)) stack.push(parsed.tagName);
    cursor = tagEnd + 1;
  }

  if (stack.length) return { ok: false, html: '', reason: 'unclosed-tag' };
  return { ok: true, html: output.join(''), reason: '' };
}

export function sanitizeContentHtml(html) {
  return inspectContentHtml(html).html;
}

export function createSanitizedContentFragment(html, ownerDocument = document) {
  const safeHtml = sanitizeContentHtml(html);
  const template = ownerDocument.createElement('template');
  template.innerHTML = safeHtml;
  if (template.innerHTML !== safeHtml) {
    return ownerDocument.createDocumentFragment();
  }
  return template.content;
}

export function htmlToPlainText(html) {
  const result = inspectContentHtml(html);
  if (!result.ok) return '';
  return decodeCharacterReferences(result.html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}
