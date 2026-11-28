import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useNotice } from './useNotice'

it('starts without a notice and exposes a notification callback', () => {
  const { result } = renderHook(() => useNotice())
  expect(result.current.message).toBe('')
  expect(result.current.notify).toEqual(expect.any(Function))
})

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('clears the notice after the given duration', () => {
  const { result } = renderHook(() => useNotice(1000))
  act(() => result.current.notify('Saved'))
  expect(result.current.message).toBe('Saved')

  act(() => vi.advanceTimersByTime(999))
  expect(result.current.message).toBe('Saved')

  act(() => vi.advanceTimersByTime(1))
  expect(result.current.message).toBe('')
})

it('defaults to a 4000ms duration when none is given', () => {
  const { result } = renderHook(() => useNotice())
  act(() => result.current.notify('Saved'))

  act(() => vi.advanceTimersByTime(3999))
  expect(result.current.message).toBe('Saved')

  act(() => vi.advanceTimersByTime(1))
  expect(result.current.message).toBe('')
})
