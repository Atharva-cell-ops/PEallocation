import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';

describe('API Security and Role-Based Access Control (RBAC)', () => {
  let studentCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    // 1. Authenticate Student 1
    const studentRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'student1@college.edu', password: 'Student@123' });

    expect(studentRes.status).toBe(200);
    const sCookies = studentRes.headers['set-cookie'];
    studentCookie = Array.isArray(sCookies) ? sCookies[0] : sCookies || '';

    // 2. Authenticate Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@college.edu', password: 'Admin@123' });

    expect(adminRes.status).toBe(200);
    const aCookies = adminRes.headers['set-cookie'];
    adminCookie = Array.isArray(aCookies) ? aCookies[0] : aCookies || '';
  });

  it('rejects unauthenticated requests to /api/v1/student/cycle/current with 401', async () => {
    const res = await request(app).get('/api/v1/student/cycle/current');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects unauthenticated requests to /api/v1/admin/cycles with 401', async () => {
    const res = await request(app).get('/api/v1/admin/cycles');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('blocks a student from accessing administrator routes with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/v1/admin/cycles')
      .set('Cookie', [studentCookie]);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('do not have permission');
  });

  it('allows an administrator to access /api/v1/admin/cycles', async () => {
    const res = await request(app)
      .get('/api/v1/admin/cycles')
      .set('Cookie', [adminCookie]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('rejects invalid login credentials with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@college.edu', password: 'WrongPassword!123' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
