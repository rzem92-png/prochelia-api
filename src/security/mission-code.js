/**
 * Secure six-digit mission code generator.
 * Uses rejection sampling to avoid modulo bias.
 * A six-digit code is still low entropy; the caller MUST enforce online
 * throttling, short expiry, purpose binding, single-use consumption and lockout.
 */
export function generateMissionCode() {
  const range = 1_000_000;
  const limit = Math.floor(0x1_0000_0000 / range) * range;
  const buffer = new Uint32Array(1);
  let value;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return String(value % range).padStart(6, '0');
}
