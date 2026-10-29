import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');

test('préproduction déclare le Cron quotidien attendu', () => {
  assert.deepEqual(config.triggers?.crons, ['0 3 * * *']);
});

test('préproduction lie le bucket R2 aux sauvegardes', () => {
  assert.ok(config.r2_buckets?.some(x => x.binding === 'BACKUP_BUCKET' && x.bucket_name === 'prochelia-preview-backups'));
});

test('le code fail-closed si le bucket ou le secret manque', () => {
  assert.match(source, /BACKUP_R2_NOT_CONFIGURED/);
  assert.match(source, /BACKUP_ENCRYPTION_KEY_REQUIRED/);
});

test('le déclenchement manuel est réservé au rôle Gérante', () => {
  assert.match(source, /request\.method==='POST'&&url\.pathname==='\/api\/system\/backup\/run'[\s\S]{0,220}a\.role!=='GERANTE'/);
});

test('les journaux de sauvegarde ne sont pas réexportés récursivement', () => {
  assert.match(source, /filter\(name=>!\['backup_runs','backup_objects'\]\.includes\(name\)\)/);
});

test('le Cron déclaré est géré par le Worker', () => {
  assert.match(source, /async scheduled\(event,env,ctx\)[\s\S]{0,180}event\.cron==='0 3 \* \* \*'[\s\S]{0,100}runNationalBackup\(env,'AUTOMATIC'\)/);
});
