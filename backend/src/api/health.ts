import { Router } from 'express';
import type { Database } from '../features/todos/types.js';

const startedAt = Date.now();

export function createHealthRouter(database: Database) {
  const router = Router();
  router.get('/health', async (req, res) => {
    await database.todo.findFirst({ select: { id: true } });
    res.json({ status: 'ok', uptime: Math.floor((Date.now() - startedAt) / 1000) });
  });
  return router;
}
