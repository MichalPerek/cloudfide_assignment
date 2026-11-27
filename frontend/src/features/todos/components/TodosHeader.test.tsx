import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { TodosHeader } from './TodosHeader'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))

it('hides the high priority count when it is absent or zero', () => {
  const { rerender } = render(
    <TodosHeader disabled={false} onCreate={vi.fn()} />,
  )
  expect(screen.queryByText(/high priority/)).not.toBeInTheDocument()
  rerender(
    <TodosHeader disabled={false} highPriorityCount={0} onCreate={vi.fn()} />,
  )
  expect(screen.queryByText(/high priority/)).not.toBeInTheDocument()
})

it('shows the high priority count when there is at least one', () => {
  render(
    <TodosHeader disabled={false} highPriorityCount={3} onCreate={vi.fn()} />,
  )
  expect(screen.getByText('3 high priority')).toBeVisible()
})

it('invokes creation when enabled and blocks it when disabled', async () => {
  const user = userEvent.setup()
  const onCreate = vi.fn()
  const { rerender } = render(
    <TodosHeader disabled={false} onCreate={onCreate} />,
  )
  expect(screen.getByRole('heading', { name: 'Tasks' })).toBeVisible()
  expect(
    screen.getByText('Create, organize, and complete tasks.'),
  ).toBeVisible()
  const button = screen.getByRole('button', { name: 'New task' })
  await user.click(button)
  expect(onCreate).toHaveBeenCalledTimes(1)
  rerender(<TodosHeader disabled onCreate={onCreate} />)
  expect(button).toBeDisabled()
  await user.click(button)
  expect(onCreate).toHaveBeenCalledTimes(1)
})
