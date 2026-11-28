import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useDuplicateTodoMutation } from './useDuplicateTodoMutation'

vi.mock('../api/todos', () => ({ todosApi: { duplicate: vi.fn() } }))

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

it('duplicates a task and prepends it to the cached list', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const existing = { ...todoFixture, id: 1, title: 'Existing task' }
  queryClient.setQueryData(todoKeys.list, [existing])
  const created = { ...todoFixture, id: 2, title: 'Existing task (copy)' }
  vi.mocked(todosApi.duplicate).mockResolvedValue(created)

  const { result } = renderHook(() => useDuplicateTodoMutation(), {
    wrapper: wrapper(queryClient),
  })
  await result.current.mutateAsync(1)

  expect(todosApi.duplicate).toHaveBeenCalledWith(1)
  await waitFor(() =>
    expect(queryClient.getQueryData(todoKeys.list)).toEqual([
      created,
      existing,
    ]),
  )
})

it('seeds the cache when no list is cached yet', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const created = { ...todoFixture, id: 3 }
  vi.mocked(todosApi.duplicate).mockResolvedValue(created)

  const { result } = renderHook(() => useDuplicateTodoMutation(), {
    wrapper: wrapper(queryClient),
  })
  await result.current.mutateAsync(3)

  await waitFor(() =>
    expect(queryClient.getQueryData(todoKeys.list)).toEqual([created]),
  )
})
