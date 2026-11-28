import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useNotice } from './useNotice'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('starts without a notice and exposes a notification callback', () => {
  const { result } = renderHook(() => useNotice())
  expect(result.current.message).toBe('')
  expect(result.current.notify).toEqual(expect.any(Function))
})

it('clears the notice after the default 4000ms duration', () => {
  const { result } = renderHook(() => useNotice())
  act(() => result.current.notify('Task duplicated.'))
  expect(result.current.message).toBe('Task duplicated.')
  act(() => vi.advanceTimersByTime(3999))
  expect(result.current.message).toBe('Task duplicated.')
  act(() => vi.advanceTimersByTime(1))
  expect(result.current.message).toBe('')
})

it('clears the notice after a custom duration', () => {
  const { result } = renderHook(() => useNotice(1000))
  act(() => result.current.notify('Task duplicated.'))
  act(() => vi.advanceTimersByTime(999))
  expect(result.current.message).toBe('Task duplicated.')
  act(() => vi.advanceTimersByTime(1))
  expect(result.current.message).toBe('')
})
