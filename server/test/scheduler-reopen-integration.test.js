import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/db.js';
import { signToken } from '../src/middleware/auth.js';
import { runAutoCloseCheck } from '../src/services/scheduler.js';

describe('Background Scheduler & Customer Reopening Integration Tests', () => {
  let customerUser;
  let customerToken;
  let resolvedTicketId;
  let expiredResolvedTicketId;
  let waitingTicketId;

  beforeAll(async () => {
    customerUser = await prisma.user.findUnique({ where: { email: 'rahul@apexlogistics.com' } });
    customerToken = signToken(customerUser);

    const now = new Date();

    // 1. Ticket in WAITING_FOR_CUSTOMER that has been waiting for 6 working days (simulate 10 calendar days ago)
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const waitingTicket = await prisma.ticket.create({
      data: {
        id: 'INC-7001',
        ticketNumber: 7001,
        subject: 'Scheduler Auto-Close Target Ticket',
        description: 'Customer did not reply for over 5 working days',
        customerId: customerUser.id,
        priority: 'MEDIUM',
        status: 'WAITING_FOR_CUSTOMER',
        firstResponseDeadline: now,
        resolutionDeadline: now,
        pausedAt: tenDaysAgo,
        updatedAt: tenDaysAgo,
      },
    });
    waitingTicketId = waitingTicket.id;

    // 2. Ticket resolved 2 hours ago (within 5 working days)
    const recentResolved = await prisma.ticket.create({
      data: {
        id: 'INC-7002',
        ticketNumber: 7002,
        subject: 'Eligible for Reopening Ticket',
        description: 'Customer unsatisfied with recent resolution',
        customerId: customerUser.id,
        priority: 'SMALL',
        status: 'RESOLVED',
        firstResponseDeadline: now,
        resolutionDeadline: now,
        resolvedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    });
    resolvedTicketId = recentResolved.id;

    // 3. Ticket resolved 12 calendar days ago (exceeds 5 working days)
    const expiredResolved = await prisma.ticket.create({
      data: {
        id: 'INC-7003',
        ticketNumber: 7003,
        subject: 'Expired Reopening Window Ticket',
        description: 'Customer tries to reopen after 5 working days expired',
        customerId: customerUser.id,
        priority: 'SMALL',
        status: 'RESOLVED',
        firstResponseDeadline: now,
        resolutionDeadline: now,
        resolvedAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
      },
    });
    expiredResolvedTicketId = expiredResolved.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { ticketId: { in: [waitingTicketId, resolvedTicketId, expiredResolvedTicketId] } } });
    await prisma.message.deleteMany({ where: { ticketId: { in: [waitingTicketId, resolvedTicketId, expiredResolvedTicketId] } } });
    await prisma.ticket.deleteMany({ where: { id: { in: [waitingTicketId, resolvedTicketId, expiredResolvedTicketId] } } });
    await prisma.$disconnect();
  });

  it('Background scheduler automatically closes inactive tickets after 5 working days', async () => {
    // Run the scheduler job
    const closedIds = await runAutoCloseCheck();
    expect(closedIds).toContain(waitingTicketId);

    // Verify DB status is CLOSED
    const updated = await prisma.ticket.findUnique({ where: { id: waitingTicketId } });
    expect(updated.status).toBe('CLOSED');
    expect(updated.closedAt).not.toBeNull();

    // Verify audit log has TICKET_CLOSED by SYSTEM
    const audit = await prisma.auditLog.findFirst({
      where: { ticketId: waitingTicketId, action: 'TICKET_CLOSED' },
    });
    expect(audit).not.toBeNull();
    expect(audit.userRole).toBe('SYSTEM');
  });

  it('Customer successfully reopens a ticket within the permitted 5-day window', async () => {
    const res = await request(app)
      .post(`/api/customer/tickets/${resolvedTicketId}/reopen`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ reason: 'Issue reoccurred after rebooting workstation.' });

    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe('IN_PROGRESS');

    const checkDb = await prisma.ticket.findUnique({ where: { id: resolvedTicketId } });
    expect(checkDb.status).toBe('IN_PROGRESS');
    expect(checkDb.reopenedAt).not.toBeNull();
  });

  it('Customer is rejected when attempting to reopen a ticket after the 5-day window expires', async () => {
    const res = await request(app)
      .post(`/api/customer/tickets/${expiredResolvedTicketId}/reopen`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ reason: 'Trying to reopen old ticket' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Reopening window of 5 working days has expired/i);

    const checkDb = await prisma.ticket.findUnique({ where: { id: expiredResolvedTicketId } });
    expect(checkDb.status).toBe('RESOLVED'); // Unchanged!
  });
});
