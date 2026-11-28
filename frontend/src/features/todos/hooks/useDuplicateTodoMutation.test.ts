import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { todosApi } from '../api/todos'
import { todoKeys } from '../api/queryKeys'
import type { Todo } from '../types'
import { useDuplicateTodoMutation } from './useDuplicateTodoMutation'

vi.mock('../api/todos', () => ({ todosApi: { duplicate: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const { result } = renderHook(() => useDuplicateTodoMutation(), {
    wrapper: wrapper(queryClient),
  })
  return { queryClient, result }
}

it('duplicates a task through the API', async () => {
  const created = {
    ...todoFixture,
    id: 8,
    title: `${todoFixture.title} (copy)`,
  }
  vi.mocked(todosApi.duplicate).mockResolvedValue(created)
  const { result } = setup()
  await act(async () => {
    await result.current.mutateAsync(todoFixture.id)
  })
  expect(todosApi.duplicate).toHaveBeenCalledWith(todoFixture.id)
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
})

it('prepends the duplicated task to the cached list', async () => {
  const created = {
    ...todoFixture,
    id: 8,
    title: `${todoFixture.title} (copy)`,
  }
  vi.mocked(todosApi.duplicate).mockResolvedValue(created)
  const { queryClient, result } = setup()
  queryClient.setQueryData<Todo[]>(todoKeys.list, [todoFixture])
  await act(async () => {
    await result.current.mutateAsync(todoFixture.id)
  })
  expect(queryClient.getQueryData<Todo[]>(todoKeys.list)).toEqual([
    created,
    todoFixture,
  ])
})

it('seeds the cached list when none exists yet', async () => {
  const created = {
    ...todoFixture,
    id: 8,
    title: `${todoFixture.title} (copy)`,
  }
  vi.mocked(todosApi.duplicate).mockResolvedValue(created)
  const { queryClient, result } = setup()
  await act(async () => {
    await result.current.mutateAsync(todoFixture.id)
  })
  expect(queryClient.getQueryData<Todo[]>(todoKeys.list)).toEqual([created])
})
