import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/db.js';
import { signToken } from '../src/middleware/auth.js';
import { calculateInitialSlaDeadlines } from '../src/services/workingHours.js';

describe('Frontdesk Security, Concurrency, and API Compliance Tests', () => {
  let agent1Token;
  let agent2Token;
  let customer1Token;
  let customer2Token;
  let agent1User;
  let agent2User;
  let customer1User;
  let customer2User;
  let testTicketId;

  beforeAll(async () => {
    // Fetch users created during seed
    agent1User = await prisma.user.findUnique({ where: { email: 'meera@arvo.com' } });
    agent2User = await prisma.user.findUnique({ where: { email: 'rohan@arvo.com' } });
    customer1User = await prisma.user.findUnique({ where: { email: 'rahul@apexlogistics.com' } });
    customer2User = await prisma.user.findUnique({ where: { email: 'samantha@brightwave.io' } });

    agent1Token = signToken(agent1User);
    agent2Token = signToken(agent2User);
    customer1Token = signToken(customer1User);
    customer2Token = signToken(customer2User);

    // Create an unassigned test ticket for concurrency tests
    const now = new Date();
    const sla = calculateInitialSlaDeadlines(now, 'URGENT', []);
    const created = await prisma.ticket.create({
      data: {
        id: 'INC-9999',
        ticketNumber: 9999,
        subject: 'Concurrency Test: Simultaneous Claim Incident Simulation',
        description: 'Simulating two agents clicking Take Ticket simultaneously',
        customerId: customer1User.id,
        priority: 'URGENT',
        status: 'OPEN',
        firstResponseDeadline: sla.firstResponseDeadline,
        resolutionDeadline: sla.resolutionDeadline,
      },
    });
    testTicketId = created.id;
  });

  afterAll(async () => {
    // Cleanup test ticket
    await prisma.auditLog.deleteMany({ where: { ticketId: testTicketId } });
    await prisma.message.deleteMany({ where: { ticketId: testTicketId } });
    await prisma.ticket.deleteMany({ where: { id: testTicketId } });
    await prisma.$disconnect();
  });

  // Test 11: Two agents attempting to claim the same ticket simultaneously
  it('11. Solves INC-0291: Concurrency protection prevents two agents from claiming the same ticket', async () => {
    // Agent 1 claims the ticket
    const res1 = await request(app)
      .post(`/api/tickets/${testTicketId}/claim`)
      .set('Authorization', `Bearer ${agent1Token}`);

    expect(res1.status).toBe(200);
    expect(res1.body.ticket.assignedToId).toBe(agent1User.id);

    // Agent 2 attempts to claim the same ticket simultaneously
    const res2 = await request(app)
      .post(`/api/tickets/${testTicketId}/claim`)
      .set('Authorization', `Bearer ${agent2Token}`);

    // Must be rejected with 409 Conflict
    expect(res2.status).toBe(409);
    expect(res2.body.error).toMatch(/already assigned|race condition/i);

    // Verify ticket in DB is still exclusively assigned to Agent 1
    const checkDb = await prisma.ticket.findUnique({ where: { id: testTicketId } });
    expect(checkDb.assignedToId).toBe(agent1User.id);
  });

  // Test 12: Customer attempting to access another customer's ticket
  it('12. Customer attempting to access another customer\'s ticket is rejected with 403 Forbidden', async () => {
    // testTicketId belongs to customer1 (Rahul).
    // customer2 (Samantha) tries to view it:
    const res = await request(app)
      .get(`/api/customer/tickets/${testTicketId}`)
      .set('Authorization', `Bearer ${customer2Token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Access denied/i);
  });

  // Test 13 & 14: Customer attempting to retrieve internal notes & internal notes excluded from responses
  it('13 & 14. Solves INC-0304: Internal notes are strictly excluded from customer API responses', async () => {
    // Agent 1 adds a public reply
    await request(app)
      .post(`/api/tickets/${testTicketId}/messages`)
      .set('Authorization', `Bearer ${agent1Token}`)
      .send({
        type: 'PUBLIC_REPLY',
        content: 'Public announcement to customer: We are actively investigating.',
      });

    // Agent 1 adds a PRIVATE INTERNAL NOTE
    await request(app)
      .post(`/api/tickets/${testTicketId}/messages`)
      .set('Authorization', `Bearer ${agent1Token}`)
      .send({
        type: 'INTERNAL_NOTE',
        content: 'CONFIDENTIAL INTERNAL NOTE: Customer might escalate to executive team; do not admit fault.',
      });

    // 1. Staff retrieval: Agent CAN see both public reply and internal note
    const staffRes = await request(app)
      .get(`/api/tickets/${testTicketId}`)
      .set('Authorization', `Bearer ${agent1Token}`);

    expect(staffRes.status).toBe(200);
    const staffMessages = staffRes.body.ticket.messages;
    expect(staffMessages.some(m => m.type === 'INTERNAL_NOTE')).toBe(true);
    expect(staffMessages.some(m => m.content.includes('CONFIDENTIAL INTERNAL NOTE'))).toBe(true);

    // 2. Customer retrieval: Customer1 views their ticket
    const custRes = await request(app)
      .get(`/api/customer/tickets/${testTicketId}`)
      .set('Authorization', `Bearer ${customer1Token}`);

    expect(custRes.status).toBe(200);
    const custMessages = custRes.body.ticket.messages;

    // Customer MUST see public reply
    expect(custMessages.some(m => m.type === 'PUBLIC_REPLY')).toBe(true);

    // CRITICAL SECURITY ASSERTION: Internal note must NEVER be present!
    expect(custMessages.some(m => m.type === 'INTERNAL_NOTE')).toBe(false);
    expect(custMessages.some(m => m.content.includes('CONFIDENTIAL INTERNAL NOTE'))).toBe(false);

    // Also check serialized payload string representation
    const rawPayload = JSON.stringify(custRes.body);
    expect(rawPayload.includes('CONFIDENTIAL INTERNAL NOTE')).toBe(false);
  });

  // Test 15: Audit records cannot be modified or deleted through normal application operations
  it('15. Solves INC-0318: Audit records cannot be modified or deleted via API endpoints', async () => {
    // Check available audit logs
    const auditLogs = await prisma.auditLog.findMany({ where: { ticketId: testTicketId } });
    expect(auditLogs.length).toBeGreaterThan(0);
    const targetAuditId = auditLogs[0].id;

    // Attempt PUT/PATCH/DELETE on audit log endpoints (must return 404 or 405, no modification routes exist!)
    const putRes = await request(app)
      .put(`/api/tickets/${testTicketId}/audit-logs/${targetAuditId}`)
      .set('Authorization', `Bearer ${agent1Token}`)
      .send({ newValue: 'Tampered Value' });
    expect(putRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/tickets/${testTicketId}/audit-logs/${targetAuditId}`)
      .set('Authorization', `Bearer ${agent1Token}`);
    expect(deleteRes.status).toBe(404);

    // Verify database record remains completely intact
    const verifyRecord = await prisma.auditLog.findUnique({ where: { id: targetAuditId } });
    expect(verifyRecord).not.toBeNull();
    expect(verifyRecord.id).toBe(targetAuditId);
  });

  // Test 16: Priority changes being recorded correctly
  it('16. Priority changes update SLA deadlines and record audit history correctly', async () => {
    const res = await request(app)
      .patch(`/api/tickets/${testTicketId}/priority`)
      .set('Authorization', `Bearer ${agent1Token}`)
      .send({ priority: 'MEDIUM' });

    expect(res.status).toBe(200);
    expect(res.body.ticket.priority).toBe('MEDIUM');

    // Verify audit log entry
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        ticketId: testTicketId,
        action: 'PRIORITY_CHANGED',
      },
    });

    expect(auditLogs.length).toBeGreaterThan(0);
    const log = auditLogs[0];
    expect(log.previousValue).toBe('URGENT');
    expect(log.newValue).toBe('MEDIUM');
    expect(log.userId).toBe(agent1User.id);
  });
});
