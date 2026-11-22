import cron from 'node-cron';
import prisma from '../db.js';
import { isEligibleForAutoClosure } from './workingHours.js';
import { getActiveHolidays, getSystemSettings } from './systemService.js';
import { logAuditEvent, AuditActions } from './auditLogger.js';

let cronTask = null;

/**
 * Evaluates and auto-closes inactive tickets in 'WAITING_FOR_CUSTOMER' status
 * that have reached the threshold of 5 working days without response.
 */
export async function runAutoCloseCheck() {
  try {
    const holidays = await getActiveHolidays();
    const settings = await getSystemSettings();
    const now = new Date();

    const waitingTickets = await prisma.ticket.findMany({
      where: { status: 'WAITING_FOR_CUSTOMER' },
      include: {
        customer: { select: { id: true, name: true } },
      },
    });

    const closedTickets = [];

    for (const ticket of waitingTickets) {
      if (isEligibleForAutoClosure(ticket, now, holidays, settings.autoCloseDays)) {
        await prisma.$transaction(async (tx) => {
          await tx.ticket.update({
            where: { id: ticket.id },
            data: {
              status: 'CLOSED',
              closedAt: now,
            },
          });

          // Add automated notification message to ticket
          await tx.message.create({
            data: {
              ticketId: ticket.id,
              senderId: ticket.customerId, // or system
              type: 'PUBLIC_REPLY',
              content: `[System Notice] This ticket has been automatically closed after ${settings.autoCloseDays} working days without a customer reply. If you still require assistance, please feel free to open a new support ticket.`,
              createdAt: now,
            },
          });

          // Record in immutable audit log
          await logAuditEvent({
            ticketId: ticket.id,
            action: AuditActions.TICKET_CLOSED,
            user: { id: 'SYSTEM', name: 'Background Auto-Close Scheduler', role: 'SYSTEM' },
            previousValue: 'WAITING_FOR_CUSTOMER',
            newValue: 'CLOSED',
            metadata: {
              reason: `Automatic closure after ${settings.autoCloseDays} working days without customer response`,
              closedAt: now,
            },
            tx,
          });
        });

        closedTickets.push(ticket.id);
      }
    }

    if (closedTickets.length > 0) {
      console.log(`[Auto-Close Scheduler] Closed ${closedTickets.length} inactive tickets:`, closedTickets);
    }

    return closedTickets;
  } catch (err) {
    console.error('[Auto-Close Scheduler] Error running auto-close job:', err);
    return [];
  }
}

/**
 * Initializes the background scheduler (runs every 10 minutes)
 */
export function initScheduler() {
  if (process.env.NODE_ENV === 'test') {
    return; // Don't run background cron in test suites
  }

  // Run every 10 minutes
  cronTask = cron.schedule('*/10 * * * *', async () => {
    await runAutoCloseCheck();
  });

  console.log('[Scheduler] Background ticket auto-closure scheduler initialized (runs every 10 mins).');
}

export function stopScheduler() {
  if (cronTask) {
    cronTask.stop();
  }
}
