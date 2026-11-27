import { describe, expect, it } from 'vitest'
import { completionRate, countOverdue, selectTodos } from './todos'
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

describe('countOverdue', () => {
  it('returns 0 for an empty list', () => {
    expect(countOverdue([])).toBe(0)
  })

  it('counts only incomplete todos with a past due date', () => {
    const overdue: Todo = { ...base, id: 2, due_date: '2000-01-01' }
    const todos = [
      overdue,
      { ...base, id: 3, due_date: '2099-12-31' },
      { ...base, id: 4, due_date: null },
      { ...base, id: 5, due_date: '2000-01-02', completed: true },
    ]
    expect(countOverdue(todos)).toBe(1)
  })

  it('counts multiple overdue todos', () => {
    const todos = [
      { ...base, id: 2, due_date: '2000-01-01' },
      { ...base, id: 3, due_date: '2000-01-02' },
    ]
    expect(countOverdue(todos)).toBe(2)
  })
})
