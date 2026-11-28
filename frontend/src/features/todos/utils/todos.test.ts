import { describe, expect, it } from 'vitest'
import { completionRate, selectTodos } from './todos'
import type { Todo } from '../types'

const base: Todo = {
  id: 1,
  title: 'Sprint plan',
  description: '',
  priority: 'medium',
  completed: false,
  due_date: null,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
}

describe('selectTodos', () => {
  it('combines status with a case-insensitive search in the description', () => {
    const matching = { ...base, description: 'Discuss the API' }
    const todos = [
      matching,
      { ...matching, id: 2, completed: true },
      { ...base, id: 3 },
    ]
    expect(selectTodos(todos, 'active', ' api ', 'newest')).toEqual([matching])
  })

  it('sorts by priority without changing the source array', () => {
    const high: Todo = { ...base, id: 2, priority: 'high' }
    const todos = [base, high]
    expect(selectTodos(todos, 'all', '', 'priority')).toEqual([high, base])
    expect(todos).toEqual([base, high])
  })
})

describe('completionRate', () => {
  it.each([
    { label: 'no todos', todos: [], expected: 0 },
    {
      label: 'none completed',
      todos: [base, { ...base, id: 2 }],
      expected: 0,
    },
    {
      label: 'all completed',
      todos: [
        { ...base, completed: true },
        { ...base, id: 2, completed: true },
      ],
      expected: 100,
    },
    {
      label: 'rounds down when the fraction is below the midpoint',
      todos: [
        { ...base, completed: true },
        { ...base, id: 2 },
        { ...base, id: 3 },
      ],
      expected: 33,
    },
    {
      label: 'rounds up when the fraction is above the midpoint',
      todos: [
        { ...base, completed: true },
        { ...base, id: 2, completed: true },
        { ...base, id: 3 },
      ],
      expected: 67,
    },
  ])('returns $expected for $label', ({ todos, expected }) => {
    expect(completionRate(todos)).toBe(expected)
  })
})
