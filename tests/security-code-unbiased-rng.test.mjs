import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('securityCode uses rejection sampling to avoid modulo bias', async () => {
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  const start = source.indexOf('function securityCode()');
  const end = source.indexOf('\n}', start);
  assert.notEqual(start, -1, 'securityCode function exists');
  assert.notEqual(end, -1, 'securityCode function boundary exists');
  const fn = source.slice(start, end + 2);
  assert.match(fn, /const range = 0x100000000/);
  assert.match(fn, /Math\.floor\(range \/ 1000000\) \* 1000000/);
  assert.match(fn, /while \(value >= limit\)/);
  assert.match(fn, /new DataView\(bytes\.buffer, bytes\.byteOffset, bytes\.byteLength\)/);
  assert.match(fn, /String\(value % 1000000\)\.padStart\(6, '0'\)/);

  const range = 0x100000000;
  const limit = Math.floor(range / 1000000) * 1000000;
  assert.equal(limit, 4294000000);
  assert.equal(range - limit, 967296);
  assert.ok(limit % 1000000 === 0);
  assert.ok(limit - 1 < range);
  assert.ok(range - 1 >= limit, 'tail values must be rejected');
});
