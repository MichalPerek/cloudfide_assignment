import { it, expect } from 'vitest';
import { formatUptime } from '../src/api/health.ts';

it.each([
  { seconds: 0, expected: '0m' },
  { seconds: 59, expected: '0m' },
  { seconds: 60, expected: '1m' },
  { seconds: 3599, expected: '59m' },
  { seconds: 3600, expected: '1h 0m' },
  { seconds: 3660, expected: '1h 1m' },
  { seconds: 7325, expected: '2h 2m' },
])('formats $seconds seconds as $expected', ({ seconds, expected }) => {
  expect(formatUptime(seconds)).toBe(expected);
});
