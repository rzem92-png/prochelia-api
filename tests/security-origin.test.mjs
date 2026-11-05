import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');

function extractFunction(sourceText, name) {
  const start = sourceText.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Function ${name} must exist in src/index.js`);
  const brace = sourceText.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = brace; i < sourceText.length; i++) {
    const ch = sourceText[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return sourceText.slice(start, i + 1);
    }
  }
  throw new Error(`Unclosed function ${name}`);
}

const helperSource = extractFunction(source, 'securityOriginAllowed');
const securityOriginAllowed = new Function(
  'getCookie', 'SESSION_COOKIE', 'clean',
  `${helperSource}; return securityOriginAllowed;`
)(
  (request, name) => {
    const raw = request.headers.get('cookie') || '';
    const pair = raw.split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
    return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
  },
  'prochelia_session',
  value => String(value ?? '').trim()
);

function request({ origin, cookie } = {}) {
  const headers = new Map();
  if (origin !== undefined) headers.set('origin', origin);
  if (cookie !== undefined) headers.set('cookie', cookie);
  return { headers: { get: key => headers.get(key) ?? null } };
}

test('rejects a session cookie when Origin is missing (CSRF regression)', () => {
  assert.equal(securityOriginAllowed(request({ cookie: 'prochelia_session=abc' }), {}), false);
});

test('allows no-Origin requests without a session cookie (non-browser/webhook compatibility)', () => {
  assert.equal(securityOriginAllowed(request(), {}), true);
});

test('allows configured exact Origin', () => {
  assert.equal(
    securityOriginAllowed(request({ origin: 'https://app.example.test', cookie: 'prochelia_session=abc' }),
      { CORS_ORIGIN: 'https://app.example.test, https://other.example.test' }),
    true
  );
});

test('rejects an unconfigured Origin even with a session cookie', () => {
  assert.equal(
    securityOriginAllowed(request({ origin: 'https://evil.example.test', cookie: 'prochelia_session=abc' }),
      { CORS_ORIGIN: 'https://app.example.test' }),
    false
  );
});

test('rejects a configured Origin with trailing whitespace mismatch only after normalization', () => {
  assert.equal(
    securityOriginAllowed(request({ origin: 'https://app.example.test' }),
      { CORS_ORIGIN: ' https://app.example.test , https://other.example.test ' }),
    true
  );
});

test('allows known default Pages origin', () => {
  assert.equal(
    securityOriginAllowed(request({ origin: 'https://prochelia.pages.dev' }), {}),
    true
  );
});
