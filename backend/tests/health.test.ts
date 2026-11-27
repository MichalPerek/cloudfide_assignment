import express from 'express';
import request from 'supertest';
import { afterEach, it, expect, vi } from 'vitest';
import { createDatabase } from '../src/core/database.ts';
import { createHealthRouter } from '../src/api/health.ts';

afterEach(() => vi.restoreAllMocks());

function setup() {
  const database = createDatabase('postgresql://test:test@localhost:5432/test');
  const app = express();
  app.use('/api', createHealthRouter(database));
  return { app, database };
}

it('reports ok status and a non-negative uptime once the database responds', async () => {
  const { app, database } = setup();
  const findFirst = vi.spyOn(database.todo, 'findFirst').mockResolvedValue(null);
  const response = await request(app).get('/api/health');
  expect(response.status).toBe(200);
  expect(response.body.status).toBe('ok');
  expect(response.body.uptime).toBeGreaterThanOrEqual(0);
  expect(findFirst).toHaveBeenCalledWith({ select: { id: true } });
});
