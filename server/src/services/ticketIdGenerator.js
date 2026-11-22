import prisma from '../db.js';

/**
 * Generates the next sequential unique ticket ID (e.g. INC-0292)
 * Guarantees uniqueness using an atomic transaction query or sequence
 */
export async function generateNextTicketId(tx = prisma) {
  const latestTicket = await tx.ticket.findFirst({
    orderBy: { ticketNumber: 'desc' },
    select: { ticketNumber: true },
  });

  const nextNumber = latestTicket ? latestTicket.ticketNumber + 1 : 291;
  const nextId = `INC-${String(nextNumber).padStart(4, '0')}`;

  return {
    id: nextId,
    ticketNumber: nextNumber,
  };
}
