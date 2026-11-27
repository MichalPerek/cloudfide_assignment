import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useClearCompletedMutation } from './useClearCompletedMutation'

vi.mock('../api/todos', () => ({ todosApi: { clearCompleted: vi.fn() } }))

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

it('clears completed tasks and invalidates the task list', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
  vi.mocked(todosApi.clearCompleted).mockResolvedValue({ cleared: 2 })

  const { result } = renderHook(() => useClearCompletedMutation(), {
    wrapper: wrapper(queryClient),
  })

  const response = await result.current.mutateAsync()

  expect(response).toEqual({ cleared: 2 })
  expect(todosApi.clearCompleted).toHaveBeenCalledWith()
  await waitFor(() =>
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: todoKeys.list }),
  )
})
