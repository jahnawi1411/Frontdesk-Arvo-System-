import express from 'express';
import prisma from '../db.js';
import { authenticate, requireCustomer } from '../middleware/auth.js';
import { 
  calculateInitialSlaDeadlines,
  resumeResolutionSla,
  isEligibleForReopening,
  getTicketSlaStatus,
  getRemainingWorkingMinutes,
  formatWorkingDuration
} from '../services/workingHours.js';
import { getActiveHolidays, getSystemSettings } from '../services/systemService.js';
import { logAuditEvent, AuditActions } from '../services/auditLogger.js';
import { generateNextTicketId } from '../services/ticketIdGenerator.js';
import { serializeTicketForCustomer } from '../services/ticketSerializer.js';

const router = express.Router();

// All customer routes require authentication and CUSTOMER role
router.use(authenticate, requireCustomer);

/**
 * POST /api/customer/tickets
 * Customer creates a support ticket
 */
router.post('/tickets', async (req, res) => {
  try {
    const { subject, description, priority = 'MEDIUM' } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: 'Subject is required.' });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required.' });
    }

    const validPriority = ['URGENT', 'MEDIUM', 'SMALL'].includes(priority.toUpperCase())
      ? priority.toUpperCase()
      : 'MEDIUM';

    const holidays = await getActiveHolidays();
    const settings = await getSystemSettings();
    const now = new Date();

    // Calculate independent SLA deadlines
    const sla = calculateInitialSlaDeadlines(now, validPriority, holidays, settings);

    const ticket = await prisma.$transaction(async (tx) => {
      const { id, ticketNumber } = await generateNextTicketId(tx);

      const created = await tx.ticket.create({
        data: {
          id,
          ticketNumber,
          subject: subject.trim(),
          description: description.trim(),
          customerId: req.user.id,
          priority: validPriority,
          status: 'OPEN',
          firstResponseDeadline: sla.firstResponseDeadline,
          resolutionDeadline: sla.resolutionDeadline,
          createdAt: now,
        },
        include: {
          customer: { select: { id: true, name: true, email: true } },
        },
      });

      // Record in immutable audit log
      await logAuditEvent({
        ticketId: id,
        action: AuditActions.TICKET_CREATED,
        user: req.user,
        newValue: validPriority,
        metadata: {
          subject: created.subject,
          firstResponseDeadline: sla.firstResponseDeadline,
          resolutionDeadline: sla.resolutionDeadline,
        },
        tx,
      });

      return created;
    });

    return res.status(201).json({
      message: 'Support ticket created successfully.',
      ticket: serializeTicketForCustomer(ticket),
    });
  } catch (err) {
    console.error('Customer create ticket error:', err);
    return res.status(500).json({ error: 'Failed to create support ticket.' });
  }
});

/**
 * GET /api/customer/tickets
 * Customer views their own tickets ONLY.
 * Strictly prevents viewing other customers' tickets and excludes all internal notes.
 */
router.get('/tickets', async (req, res) => {
  try {
    const holidays = await getActiveHolidays();
    const now = new Date();

    const tickets = await prisma.ticket.findMany({
      where: { customerId: req.user.id }, // Ownership guarantee!
      orderBy: { createdAt: 'desc' },
      include: {
        assignedTo: { select: { id: true, name: true } },
      },
    });

    const serialized = tickets.map(t => {
      const slaState = getTicketSlaStatus(t, now, holidays);
      const remainingResolutionMinutes = getRemainingWorkingMinutes(t.resolutionDeadline, now, holidays);

      return {
        ...serializeTicketForCustomer(t),
        slaState,
        slaCountdownText: formatWorkingDuration(remainingResolutionMinutes),
      };
    });

    return res.json({ tickets: serialized });
  } catch (err) {
    console.error('Customer ticket list error:', err);
    return res.status(500).json({ error: 'Failed to retrieve tickets.' });
  }
});

/**
 * GET /api/customer/tickets/:id
 * Customer views ticket details.
 * Strictly enforces that ticket belongs to the authenticated customer.
 * Strictly filters out any INTERNAL_NOTE at database query and serializer levels.
 */
router.get('/tickets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const holidays = await getActiveHolidays();
    const settings = await getSystemSettings();
    const now = new Date();

    // Defense-in-depth: query ONLY messages where type is 'PUBLIC_REPLY'
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true } },
        messages: {
          where: { type: 'PUBLIC_REPLY' }, // Database-level exclusion of internal notes!
          orderBy: { createdAt: 'asc' },
          include: {
            sender: { select: { id: true, name: true, role: true } },
          },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    // Access control: Customer can only access their own ticket!
    if (ticket.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You do not own this ticket.' });
    }

    const canReopen = ticket.status === 'RESOLVED' 
      ? isEligibleForReopening(ticket, now, holidays, settings.reopenDays)
      : false;

    const remainingResolutionMinutes = getRemainingWorkingMinutes(ticket.resolutionDeadline, now, holidays);

    return res.json({
      ticket: {
        ...serializeTicketForCustomer(ticket),
        canReopen,
        slaCountdownText: formatWorkingDuration(remainingResolutionMinutes),
      },
    });
  } catch (err) {
    console.error('Customer ticket view error:', err);
    return res.status(500).json({ error: 'Failed to retrieve ticket.' });
  }
});

/**
 * POST /api/customer/tickets/:id/reply
 * Customer responds to support agents.
 * Resumes resolution SLA if ticket was paused in 'WAITING_FOR_CUSTOMER'.
 */
router.post('/tickets/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Reply content cannot be empty.' });
    }

    const holidays = await getActiveHolidays();
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id } });

      if (!ticket) {
        const error = new Error('Ticket not found');
        error.status = 404;
        throw error;
      }

      if (ticket.customerId !== req.user.id) {
        const error = new Error('Access denied. You do not own this ticket.');
        error.status = 403;
        throw error;
      }

      if (ticket.status === 'CLOSED') {
        const error = new Error('Cannot reply to a closed ticket. Please open a new support ticket.');
        error.status = 400;
        throw error;
      }

      // Check if ticket was WAITING_FOR_CUSTOMER -> RESUME SLA!
      const updateData = {};
      let resumedSlaDetails = null;

      if (ticket.status === 'WAITING_FOR_CUSTOMER') {
        resumedSlaDetails = resumeResolutionSla(ticket, now, holidays);
        updateData.status = 'IN_PROGRESS';
        updateData.resolutionDeadline = resumedSlaDetails.resolutionDeadline;
        updateData.pausedAt = null;
        updateData.totalPausedSeconds = resumedSlaDetails.totalPausedSeconds;

        await tx.slaEvent.create({
          data: {
            ticketId: id,
            eventType: 'RESUME',
            timestamp: now,
            remainingWorkingMinutes: resumedSlaDetails.remainingWorkingMinutes,
            reason: 'Customer replied, SLA resumed automatically',
          },
        });

        await logAuditEvent({
          ticketId: id,
          action: AuditActions.SLA_RESUMED,
          user: req.user,
          previousValue: 'Paused',
          newValue: 'Active',
          metadata: {
            reason: 'Customer replied',
            newResolutionDeadline: resumedSlaDetails.resolutionDeadline,
          },
          tx,
        });

        await logAuditEvent({
          ticketId: id,
          action: AuditActions.STATUS_CHANGED,
          user: req.user,
          previousValue: 'WAITING_FOR_CUSTOMER',
          newValue: 'IN_PROGRESS',
          metadata: { reason: 'Automatic status update upon customer response' },
          tx,
        });
      }

      if (Object.keys(updateData).length > 0) {
        await tx.ticket.update({
          where: { id },
          data: updateData,
        });
      }

      // Create message (always PUBLIC_REPLY for customers)
      const message = await tx.message.create({
        data: {
          ticketId: id,
          senderId: req.user.id,
          type: 'PUBLIC_REPLY',
          content: content.trim(),
          createdAt: now,
        },
        include: {
          sender: { select: { id: true, name: true, role: true } },
        },
      });

      await logAuditEvent({
        ticketId: id,
        action: AuditActions.PUBLIC_REPLY_SENT,
        user: req.user,
        newValue: 'Customer Public Reply',
        metadata: {
          messageId: message.id,
          snippet: content.substring(0, 100),
        },
        tx,
      });

      return message;
    });

    return res.status(201).json({
      message: 'Reply sent successfully.',
      reply: {
        id: result.id,
        content: result.content,
        createdAt: result.createdAt,
        senderName: req.user.name,
      },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Customer reply error:', err);
    return res.status(500).json({ error: 'Failed to send reply.' });
  }
});

/**
 * POST /api/customer/tickets/:id/reopen
 * Customer reopens a resolved ticket within the 5 working days window.
 * Preserves original ticket and its full activity history.
 * Rejects after permitted period has expired.
 */
router.post('/tickets/:id/reopen', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const holidays = await getActiveHolidays();
    const settings = await getSystemSettings();
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id } });

      if (!ticket) {
        const error = new Error('Ticket not found');
        error.status = 404;
        throw error;
      }

      if (ticket.customerId !== req.user.id) {
        const error = new Error('Access denied. You do not own this ticket.');
        error.status = 403;
        throw error;
      }

      if (ticket.status !== 'RESOLVED') {
        const error = new Error(`Only tickets in RESOLVED status can be reopened (Current status: ${ticket.status}).`);
        error.status = 400;
        throw error;
      }

      // Check reopening eligibility window (default 5 working days)
      const eligible = isEligibleForReopening(ticket, now, holidays, settings.reopenDays);
      if (!eligible) {
        const error = new Error(
          `Reopening window of ${settings.reopenDays} working days has expired. Please create a new ticket.`
        );
        error.status = 400;
        throw error;
      }

      const resTicket = await tx.ticket.update({
        where: { id },
        data: {
          status: 'IN_PROGRESS',
          reopenedAt: now,
          resolvedAt: null,
        },
      });

      await logAuditEvent({
        ticketId: id,
        action: AuditActions.TICKET_REOPENED,
        user: req.user,
        previousValue: 'RESOLVED',
        newValue: 'IN_PROGRESS',
        metadata: {
          reason: reason || 'Customer requested ticket reopening',
          reopenedAt: now,
        },
        tx,
      });

      return resTicket;
    });

    return res.json({
      message: 'Ticket reopened successfully.',
      ticket: serializeTicketForCustomer(updated),
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Customer reopen error:', err);
    return res.status(500).json({ error: 'Failed to reopen ticket.' });
  }
});

export default router;
