// Frontdesk Immutable Audit Logging Service
// Solves Incident INC-0318: Establishes exact, tamper-proof proof of what happened, when, and by whom.
// Enforces append-only operations. No update or delete endpoints are provided anywhere in the system.

import prisma from '../db.js';

export const AuditActions = {
  TICKET_CREATED: 'TICKET_CREATED',
  TICKET_ASSIGNED: 'TICKET_ASSIGNED',
  TICKET_REASSIGNED: 'TICKET_REASSIGNED',
  PRIORITY_CHANGED: 'PRIORITY_CHANGED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  PUBLIC_REPLY_SENT: 'PUBLIC_REPLY_SENT',
  INTERNAL_NOTE_ADDED: 'INTERNAL_NOTE_ADDED',
  SLA_PAUSED: 'SLA_PAUSED',
  SLA_RESUMED: 'SLA_RESUMED',
  TICKET_RESOLVED: 'TICKET_RESOLVED',
  TICKET_CLOSED: 'TICKET_CLOSED',
  TICKET_REOPENED: 'TICKET_REOPENED',
};

/**
 * Creates an immutable audit log record.
 * Can be executed within a Prisma transaction client (tx) or standalone.
 */
export async function logAuditEvent({
  ticketId,
  action,
  user,
  previousValue = null,
  newValue = null,
  metadata = null,
  tx = prisma,
}) {
  const metaString = typeof metadata === 'object' && metadata !== null 
    ? JSON.stringify(metadata) 
    : metadata;

  // If user is SYSTEM or doesn't have an ID in the User table, set foreign key userId to null
  const validUserId = user?.id && user.id !== 'SYSTEM' ? user.id : null;

  return await tx.auditLog.create({
    data: {
      ticketId,
      action,
      userId: validUserId,
      userName: user?.name || 'System Scheduler',
      userRole: user?.role || 'SYSTEM',
      previousValue: previousValue ? String(previousValue) : null,
      newValue: newValue ? String(newValue) : null,
      metadata: metaString,
      createdAt: new Date(), // UTC server-generated timestamp
    },
  });
}

/**
 * Retrieves chronological audit history for a ticket.
 */
export async function getTicketAuditHistory(ticketId) {
  return await prisma.auditLog.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      ticketId: true,
      action: true,
      userId: true,
      userName: true,
      userRole: true,
      previousValue: true,
      newValue: true,
      metadata: true,
      createdAt: true,
    },
  });
}
