import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

/**
 * Health Check Integration Test
 *
 * Tests the /api/v1/health endpoint.
 * This is a lightweight test that verifies the server and route are wired correctly.
 */
describe('GET /api/v1/health', () => {
  it('should return a JSON response with a status field', async () => {
    const response = await request(app).get('/api/v1/health');

    expect([200, 503]).toContain(response.status);
    expect(response.body).toHaveProperty('success');
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('status');
    expect(response.body.data).toHaveProperty('timestamp');
  });

  it('should not expose stack traces or internal details', async () => {
    const response = await request(app).get('/api/v1/health');
    const bodyStr = JSON.stringify(response.body);

    expect(bodyStr).not.toContain('node_modules');
    expect(bodyStr).not.toContain('Error:');
    expect(bodyStr).not.toContain('.ts:');
  });
});

describe('GET /api/v1/nonexistent', () => {
  it('should return 404 for unknown routes', async () => {
    const response = await request(app).get('/api/v1/nonexistent-route');
    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('NOT_FOUND');
  });
});
