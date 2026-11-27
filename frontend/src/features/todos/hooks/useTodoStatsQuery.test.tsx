import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { request } from '../../../lib/http'
import { useTodoStatsQuery } from './useTodoStatsQuery'

vi.mock('../../../lib/http', () => ({ request: vi.fn() }))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

it('fetches priority counts from the stats endpoint', async () => {
  vi.mocked(request).mockResolvedValue({ low: 1, medium: 2, high: 3 })
  const { result } = renderHook(() => useTodoStatsQuery(), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toEqual({ low: 1, medium: 2, high: 3 })
  expect(request).toHaveBeenCalledWith('/todos/stats')
})
