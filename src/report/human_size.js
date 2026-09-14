const UNITS = ['bytes', 'KB', 'MB', 'GB', 'TB'];

/** Formats a byte count as a human readable string ("1.2 MB"). Pure
 * presentation -- CONTRIBUTING.md #3 means this belongs at the very edge
 * of the CLI, applied only when actually printing text for a person, never
 * inside a library function whose return value a caller (or --json) might
 * still need as a number. */
export function humanSize(bytes) {
  let value = bytes;
  let unit = 0;
  while (Math.abs(value) >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${UNITS[unit]}`;
}
