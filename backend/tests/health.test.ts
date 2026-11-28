import { it, expect } from 'vitest';
import { formatUptime } from '../src/api/health.ts';

it.each([
  [0, '0m'],
  [59, '0m'],
  [60, '1m'],
  [3540, '59m'],
  [3600, '1h 0m'],
  [3661, '1h 1m'],
  [90300, '25h 5m'],
])('formats %i seconds of uptime as %s', (seconds, expected) => {
  expect(formatUptime(seconds)).toBe(expected);
});
