import { todoSchema } from './validators.js';
import type { TodoRecord, Todo } from './types.js';

export function fromModel(row: TodoRecord): Todo {
  return todoSchema.parse({
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    due_date: row.due_date?.toISOString().slice(0, 10) ?? null,
    completed: row.completed,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  });
}
