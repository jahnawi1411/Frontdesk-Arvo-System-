import express from 'express';
import prisma from '../db.js';
import { authenticate, requireStaff } from '../middleware/auth.js';
import { 
  getTicketSlaStatus, 
  getRemainingWorkingMinutes, 
  formatWorkingDuration,
  pauseResolutionSla,
  resumeResolutionSla,
  recalculateDeadlinesOnPriorityChange
} from '../services/workingHours.js';
import { getActiveHolidays, getSystemSettings } from '../services/systemService.js';
import { logAuditEvent, AuditActions, getTicketAuditHistory } from '../services/auditLogger.js';

const router = express.Router();

// All staff endpoints require authentication and agent/admin role
router.use(authenticate, requireStaff);

/**
 * GET /api/tickets/stats
 * Real-time dashboard KPI metrics backed by database
 */
router.get('/stats', async (req, res) => {
  try {
    const holidays = await getActiveHolidays();
    const now = new Date();
    const userId = req.user.id;

    const tickets = await prisma.ticket.findMany({
      include: {
        customer: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });

    let totalOpen = 0;
    let myAssigned = 0;
    let unassigned = 0;
    let waitingForCustomer = 0;
    let overdue = 0;
    let resolved = 0;
    let closed = 0;

    const priorityCounts = { URGENT: 0, MEDIUM: 0, SMALL: 0 };
    const statusCounts = { 
      OPEN: 0, 
      IN_PROGRESS: 0, 
      WAITING_FOR_CUSTOMER: 0, 
      RESOLVED: 0, 
      CLOSED: 0 
    };

    const overdueList = [];

    for (const t of tickets) {
      const slaState = getTicketSlaStatus(t, now, holidays);
      const isOverdue = slaState === 'OVERDUE';

      if (['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER'].includes(t.status)) {
        totalOpen++;
      }

      if (t.assignedToId === userId && !['RESOLVED', 'CLOSED'].includes(t.status)) {
        myAssigned++;
      }

      if (!t.assignedToId && !['RESOLVED', 'CLOSED'].includes(t.status)) {
        unassigned++;
      }

      if (t.status === 'WAITING_FOR_CUSTOMER') {
        waitingForCustomer++;
      }

      if (t.status === 'RESOLVED') {
        resolved++;
      }

      if (t.status === 'CLOSED') {
        closed++;
      }

      if (isOverdue && !['RESOLVED', 'CLOSED'].includes(t.status)) {
        overdue++;
        overdueList.push({
          id: t.id,
          subject: t.subject,
          priority: t.priority,
          assignedTo: t.assignedTo?.name || 'Unassigned',
          status: t.status,
          resolutionDeadline: t.resolutionDeadline,
          remainingWorkingMinutes: getRemainingWorkingMinutes(t.resolutionDeadline, now, holidays),
        });
      }

      if (priorityCounts[t.priority] !== undefined) {
        priorityCounts[t.priority]++;
      }

      if (statusCounts[t.status] !== undefined) {
        statusCounts[t.status]++;
      }
    }

    const totalActive = totalOpen;
    const slaComplianceRate = totalActive > 0 ? Math.round(((totalActive - overdue) / totalActive) * 100) : 100;

    return res.json({
      summary: {
        totalOpen,
        myAssigned,
        unassigned,
        waitingForCustomer,
        overdue,
        resolved,
        closed,
        slaComplianceRate,
      },
      priorityDistribution: priorityCounts,
      statusDistribution: statusCounts,
      recentOverdue: overdueList.slice(0, 5),
    });
  } catch (err) {
    console.error('Stats error:', err);
    return res.status(500).json({ error: 'Failed to compute dashboard metrics.' });
  }
});

/**
 * GET /api/tickets
 * Query, search, and filter tickets with calculated SLA metrics
 */
router.get('/', async (req, res) => {
  try {
    const { 
      status, 
      priority, 
      assignedToId, 
      unassigned,
      slaState, 
      search, 
      view 
    } = req.query;

    const holidays = await getActiveHolidays();
    const now = new Date();

    const where = {};

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    if (unassigned === 'true') {
      where.assignedToId = null;
    }

    // View shortcuts
    if (view === 'my') {
      where.assignedToId = req.user.id;
      where.status = { notIn: ['RESOLVED', 'CLOSED'] };
    } else if (view === 'unassigned') {
      where.assignedToId = null;
      where.status = { notIn: ['RESOLVED', 'CLOSED'] };
    } else if (view === 'waiting') {
      where.status = 'WAITING_FOR_CUSTOMER';
    } else if (view === 'resolved') {
      where.status = { in: ['RESOLVED', 'CLOSED'] };
    }

    if (search) {
      const q = search.trim();
      where.OR = [
        { id: { contains: q } },
        { subject: { contains: q } },
        { description: { contains: q } },
        { customer: { name: { contains: q } } },
        { customer: { email: { contains: q } } },
      ];
    }

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    const enriched = tickets.map(t => {
      const currentSlaState = getTicketSlaStatus(t, now, holidays);
      const remainingResolutionMinutes = getRemainingWorkingMinutes(t.resolutionDeadline, now, holidays);
      const remainingFirstResponseMinutes = !t.firstResponseAt 
        ? getRemainingWorkingMinutes(t.firstResponseDeadline, now, holidays)
        : null;

      return {
        ...t,
        slaState: currentSlaState,
        remainingResolutionMinutes,
        remainingFirstResponseMinutes,
        slaCountdownText: formatWorkingDuration(remainingResolutionMinutes),
      };
    });

    // Post-filter by calculated SLA state if requested (e.g. overdue)
    let filtered = enriched;
    if (slaState) {
      filtered = enriched.filter(t => t.slaState === slaState.toUpperCase());
    } else if (view === 'overdue') {
      filtered = enriched.filter(t => t.slaState === 'OVERDUE' && !['RESOLVED', 'CLOSED'].includes(t.status));
    }

    return res.json({ tickets: filtered });
  } catch (err) {
    console.error('List tickets error:', err);
    return res.status(500).json({ error: 'Failed to retrieve tickets.' });
  }
});

/**
 * GET /api/tickets/:id
 * Retrieve detailed ticket view with conversation history, internal notes, and audit timeline
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const holidays = await getActiveHolidays();
    const now = new Date();

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, email: true, department: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: { select: { id: true, name: true, role: true } },
          },
        },
        slaEvents: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const auditHistory = await getTicketAuditHistory(ticket.id);
    const slaState = getTicketSlaStatus(ticket, now, holidays);
    const remainingResolutionMinutes = getRemainingWorkingMinutes(ticket.resolutionDeadline, now, holidays);
    const remainingFirstResponseMinutes = !ticket.firstResponseAt
      ? getRemainingWorkingMinutes(ticket.firstResponseDeadline, now, holidays)
      : null;

    return res.json({
      ticket: {
        ...ticket,
        slaState,
        remainingResolutionMinutes,
        remainingFirstResponseMinutes,
        slaCountdownText: formatWorkingDuration(remainingResolutionMinutes),
        auditLogs: auditHistory,
      },
    });
  } catch (err) {
    console.error('Ticket detail error:', err);
    return res.status(500).json({ error: 'Failed to retrieve ticket details.' });
  }
});

/**
 * POST /api/tickets/:id/claim
 * Solves INC-0291: Concurrency Protection on Ticket Claim
 * Atomically assigns an unassigned ticket to the requesting agent.
 * Fails safely with 409 Conflict if another agent has already claimed it.
 */
router.post('/:id/claim', async (req, res) => {
  try {
    const { id } = req.params;
    const agent = req.user;

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Fetch current ticket with lock / verification
      const existing = await tx.ticket.findUnique({
        where: { id },
        include: { assignedTo: { select: { id: true, name: true } } },
      });

      if (!existing) {
        const error = new Error('Ticket not found');
        error.status = 404;
        throw error;
      }

      // 2. Strict concurrency check: Is ticket already assigned?
      if (existing.assignedToId) {
        const error = new Error(`Ticket is already assigned to ${existing.assignedTo?.name || 'another agent'}.`);
        error.status = 409;
        throw error;
      }

      // 3. Atomic conditional update: only update if assignedToId is STILL null!
      const updateResult = await tx.ticket.updateMany({
        where: {
          id,
          assignedToId: null, // Critical concurrency guard!
        },
        data: {
          assignedToId: agent.id,
          status: existing.status === 'OPEN' ? 'IN_PROGRESS' : existing.status,
        },
      });

      if (updateResult.count === 0) {
        const error = new Error('Race condition detected: Ticket was just claimed by another agent.');
        error.status = 409;
        throw error;
      }

      // Fetch the updated ticket with relations
      const ticket = await tx.ticket.findUnique({
        where: { id },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      });

      // 4. Record in audit log in the same atomic transaction
      await logAuditEvent({
        ticketId: id,
        action: AuditActions.TICKET_ASSIGNED,
        user: agent,
        previousValue: 'Unassigned',
        newValue: agent.name,
        metadata: { method: 'Self-Claim (Take Ticket)' },
        tx,
      });

      if (existing.status === 'OPEN') {
        await logAuditEvent({
          ticketId: id,
          action: AuditActions.STATUS_CHANGED,
          user: agent,
          previousValue: 'OPEN',
          newValue: 'IN_PROGRESS',
          metadata: { reason: 'Status progressed to In Progress on claim' },
          tx,
        });
      }

      return ticket;
    });

    return res.json({
      message: 'Ticket claimed successfully.',
      ticket: updated,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Claim error:', err);
    return res.status(500).json({ error: 'Failed to claim ticket.' });
  }
});

/**
 * POST /api/tickets/:id/assign
 * Reassigns ticket to an agent (authorized for Admin or current assignee)
 */
router.post('/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { agentId } = req.body;

    if (!agentId) {
      return res.status(400).json({ error: 'Target agentId is required.' });
    }

    const targetAgent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { id: true, name: true, role: true },
    });

    if (!targetAgent || !['AGENT', 'ADMIN'].includes(targetAgent.role)) {
      return res.status(400).json({ error: 'Invalid target agent.' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { id },
        include: { assignedTo: { select: { id: true, name: true } } },
      });

      if (!ticket) {
        const error = new Error('Ticket not found');
        error.status = 404;
        throw error;
      }

      // Authorization: Admin or currently assigned agent can reassign
      if (req.user.role !== 'ADMIN' && ticket.assignedToId !== req.user.id) {
        const error = new Error('Only an administrator or the currently assigned agent can reassign this ticket.');
        error.status = 403;
        throw error;
      }

      const prevAgentName = ticket.assignedTo?.name || 'Unassigned';

      const resTicket = await tx.ticket.update({
        where: { id },
        data: {
          assignedToId: targetAgent.id,
          status: ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status,
        },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      });

      await logAuditEvent({
        ticketId: id,
        action: AuditActions.TICKET_REASSIGNED,
        user: req.user,
        previousValue: prevAgentName,
        newValue: targetAgent.name,
        metadata: { reassignedBy: req.user.name },
        tx,
      });

      return resTicket;
    });

    return res.json({
      message: 'Ticket reassigned successfully.',
      ticket: updated,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Reassign error:', err);
    return res.status(500).json({ error: 'Failed to reassign ticket.' });
  }
});

/**
 * PATCH /api/tickets/:id/priority
 * Updates ticket priority and adjusts SLA according to configurable policy
 */
router.patch('/:id/priority', async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    if (!['URGENT', 'MEDIUM', 'SMALL'].includes(priority?.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid priority. Must be URGENT, MEDIUM, or SMALL.' });
    }

    const newPriority = priority.toUpperCase();
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

      if (ticket.priority === newPriority) {
        return ticket;
      }

      const oldPriority = ticket.priority;

      // Recalculate SLA deadlines based on configured policy
      const { firstResponseDeadline, resolutionDeadline, policyUsed } = recalculateDeadlinesOnPriorityChange(
        ticket,
        newPriority,
        now,
        holidays,
        settings.priorityChangePolicy,
        settings
      );

      const resTicket = await tx.ticket.update({
        where: { id },
        data: {
          priority: newPriority,
          firstResponseDeadline,
          resolutionDeadline,
        },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      });

      // Record SLA event
      await tx.slaEvent.create({
        data: {
          ticketId: id,
          eventType: 'PRIORITY_CHANGE',
          timestamp: now,
          reason: `Priority updated from ${oldPriority} to ${newPriority} using policy ${policyUsed}`,
        },
      });

      // Record immutable audit log
      await logAuditEvent({
        ticketId: id,
        action: AuditActions.PRIORITY_CHANGED,
        user: req.user,
        previousValue: oldPriority,
        newValue: newPriority,
        metadata: {
          policy: policyUsed,
          newFirstResponseDeadline: firstResponseDeadline,
          newResolutionDeadline: resolutionDeadline,
        },
        tx,
      });

      return resTicket;
    });

    return res.json({
      message: `Priority updated to ${newPriority}. SLA deadlines recalculated.`,
      ticket: updated,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Update priority error:', err);
    return res.status(500).json({ error: 'Failed to update priority.' });
  }
});

/**
 * PATCH /api/tickets/:id/status
 * Updates ticket status (Open, In Progress, Waiting for Customer, Resolved, Closed)
 * Handles SLA pause and resume logic with full history preservation
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'];
    if (!validStatuses.includes(status?.toUpperCase())) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const newStatus = status.toUpperCase();
    const holidays = await getActiveHolidays();
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id } });
      if (!ticket) {
        const error = new Error('Ticket not found');
        error.status = 404;
        throw error;
      }

      const oldStatus = ticket.status;
      if (oldStatus === newStatus) {
        return ticket;
      }

      const updateData = { status: newStatus };

      // Case 1: Transitioning TO 'WAITING_FOR_CUSTOMER' -> PAUSE SLA!
      if (newStatus === 'WAITING_FOR_CUSTOMER' && oldStatus !== 'WAITING_FOR_CUSTOMER') {
        const pauseDetails = pauseResolutionSla(ticket, now, holidays);
        updateData.pausedAt = pauseDetails.pausedAt;

        await tx.slaEvent.create({
          data: {
            ticketId: id,
            eventType: 'PAUSE',
            timestamp: now,
            consumedWorkingMinutes: pauseDetails.consumedWorkingMinutes,
            remainingWorkingMinutes: pauseDetails.remainingWorkingMinutes,
            reason: 'Ticket set to Waiting for Customer',
          },
        });

        await logAuditEvent({
          ticketId: id,
          action: AuditActions.SLA_PAUSED,
          user: req.user,
          previousValue: 'Active',
          newValue: 'Paused',
          metadata: {
            consumedWorkingMinutes: pauseDetails.consumedWorkingMinutes,
            remainingWorkingMinutes: pauseDetails.remainingWorkingMinutes,
          },
          tx,
        });
      }

      // Case 2: Transitioning FROM 'WAITING_FOR_CUSTOMER' -> RESUME SLA!
      if (oldStatus === 'WAITING_FOR_CUSTOMER' && newStatus !== 'WAITING_FOR_CUSTOMER') {
        const resumeDetails = resumeResolutionSla(ticket, now, holidays);
        updateData.resolutionDeadline = resumeDetails.resolutionDeadline;
        updateData.pausedAt = null;
        updateData.totalPausedSeconds = resumeDetails.totalPausedSeconds;

        await tx.slaEvent.create({
          data: {
            ticketId: id,
            eventType: 'RESUME',
            timestamp: now,
            remainingWorkingMinutes: resumeDetails.remainingWorkingMinutes,
            reason: `Status changed from Waiting for Customer to ${newStatus}`,
          },
        });

        await logAuditEvent({
          ticketId: id,
          action: AuditActions.SLA_RESUMED,
          user: req.user,
          previousValue: 'Paused',
          newValue: 'Active',
          metadata: {
            newResolutionDeadline: resumeDetails.resolutionDeadline,
            totalPausedSeconds: resumeDetails.totalPausedSeconds,
          },
          tx,
        });
      }

      // Case 3: Transitioning TO 'RESOLVED'
      if (newStatus === 'RESOLVED') {
        updateData.resolvedAt = now;
        await logAuditEvent({
          ticketId: id,
          action: AuditActions.TICKET_RESOLVED,
          user: req.user,
          previousValue: oldStatus,
          newValue: 'RESOLVED',
          metadata: { resolvedAt: now },
          tx,
        });
      }

      // Case 4: Transitioning TO 'CLOSED'
      if (newStatus === 'CLOSED') {
        updateData.closedAt = now;
        await logAuditEvent({
          ticketId: id,
          action: AuditActions.TICKET_CLOSED,
          user: req.user,
          previousValue: oldStatus,
          newValue: 'CLOSED',
          metadata: { closedAt: now },
          tx,
        });
      }

      // Standard status change audit log
      await logAuditEvent({
        ticketId: id,
        action: AuditActions.STATUS_CHANGED,
        user: req.user,
        previousValue: oldStatus,
        newValue: newStatus,
        tx,
      });

      const resTicket = await tx.ticket.update({
        where: { id },
        data: updateData,
        include: {
          customer: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      });

      return resTicket;
    });

    return res.json({
      message: `Status updated to ${newStatus}.`,
      ticket: updated,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Update status error:', err);
    return res.status(500).json({ error: 'Failed to update status.' });
  }
});

/**
 * POST /api/tickets/:id/messages
 * Solves INC-0304: Distinguishes Public Replies and Private Internal Notes
 * Enforces server-side type validation.
 */
router.post('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, content } = req.body;

    if (!['PUBLIC_REPLY', 'INTERNAL_NOTE'].includes(type)) {
      return res.status(400).json({ error: 'Message type must be PUBLIC_REPLY or INTERNAL_NOTE.' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content cannot be empty.' });
    }

    const now = new Date();

    const created = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id } });
      if (!ticket) {
        const error = new Error('Ticket not found');
        error.status = 404;
        throw error;
      }

      // If public reply and this is the first staff response:
      let firstResponseUpdate = {};
      if (type === 'PUBLIC_REPLY' && !ticket.firstResponseAt) {
        firstResponseUpdate = { firstResponseAt: now };
      }

      // If ticket is Open and agent replies, progress status to In Progress
      if (type === 'PUBLIC_REPLY' && ticket.status === 'OPEN') {
        firstResponseUpdate.status = 'IN_PROGRESS';
      }

      if (Object.keys(firstResponseUpdate).length > 0) {
        await tx.ticket.update({
          where: { id },
          data: firstResponseUpdate,
        });

        if (firstResponseUpdate.firstResponseAt) {
          await logAuditEvent({
            ticketId: id,
            action: 'FIRST_RESPONSE_SENT',
            user: req.user,
            previousValue: 'Pending',
            newValue: 'Responded',
            metadata: { firstResponseAt: now },
            tx,
          });
        }
      }

      const message = await tx.message.create({
        data: {
          ticketId: id,
          senderId: req.user.id,
          type,
          content: content.trim(),
          createdAt: now,
        },
        include: {
          sender: { select: { id: true, name: true, role: true } },
        },
      });

      // Audit log distinguishing public reply vs internal note
      const auditAction = type === 'PUBLIC_REPLY' 
        ? AuditActions.PUBLIC_REPLY_SENT 
        : AuditActions.INTERNAL_NOTE_ADDED;

      await logAuditEvent({
        ticketId: id,
        action: auditAction,
        user: req.user,
        newValue: type === 'PUBLIC_REPLY' ? 'Public Reply to Customer' : 'Private Internal Note for Team',
        metadata: {
          messageId: message.id,
          snippet: content.substring(0, 100),
        },
        tx,
      });

      return message;
    });

    return res.status(201).json({
      message: `${type === 'PUBLIC_REPLY' ? 'Public reply sent' : 'Internal note saved'} successfully.`,
      messageRecord: created,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Send message error:', err);
    return res.status(500).json({ error: 'Failed to post message.' });
  }
});

export default router;
