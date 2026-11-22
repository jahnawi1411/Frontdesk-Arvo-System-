import express from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { invalidateHolidayCache, getActiveHolidays, getSystemSettings } from '../services/systemService.js';
import { getTicketSlaStatus, getRemainingWorkingMinutes } from '../services/workingHours.js';

const router = express.Router();

// All routes require ADMIN role
router.use(authenticate, requireAdmin);

/**
 * GET /api/admin/agents
 * List support agents and their current workloads
 */
router.get('/agents', async (req, res) => {
  try {
    const agents = await prisma.user.findMany({
      where: { role: { in: ['AGENT', 'ADMIN'] } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        createdAt: true,
        assignedTickets: {
          select: {
            id: true,
            status: true,
            priority: true,
          },
        },
      },
    });

    const agentList = agents.map(a => {
      const activeTickets = a.assignedTickets.filter(
        t => !['RESOLVED', 'CLOSED'].includes(t.status)
      );
      const urgentTickets = activeTickets.filter(t => t.priority === 'URGENT');

      return {
        id: a.id,
        name: a.name,
        email: a.email,
        role: a.role,
        department: a.department,
        totalAssigned: a.assignedTickets.length,
        activeWorkload: activeTickets.length,
        urgentWorkload: urgentTickets.length,
        createdAt: a.createdAt,
      };
    });

    return res.json({ agents: agentList });
  } catch (err) {
    console.error('List agents error:', err);
    return res.status(500).json({ error: 'Failed to retrieve agents.' });
  }
});

/**
 * POST /api/admin/agents
 * Create a new support agent
 */
router.post('/agents', async (req, res) => {
  try {
    const { name, email, password, role = 'AGENT', department = 'Support Tier 1' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return res.status(409).json({ error: 'User with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const agent = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        role: ['ADMIN', 'AGENT'].includes(role) ? role : 'AGENT',
        department,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      message: 'Agent created successfully.',
      agent,
    });
  } catch (err) {
    console.error('Create agent error:', err);
    return res.status(500).json({ error: 'Failed to create agent.' });
  }
});

/**
 * GET /api/admin/holidays
 * List configured festival holidays
 */
router.get('/holidays', async (req, res) => {
  try {
    const holidays = await prisma.holiday.findMany({
      orderBy: { date: 'asc' },
    });
    return res.json({ holidays });
  } catch (err) {
    console.error('List holidays error:', err);
    return res.status(500).json({ error: 'Failed to retrieve holidays.' });
  }
});

/**
 * POST /api/admin/holidays
 * Add a new festival holiday
 */
router.post('/holidays', async (req, res) => {
  try {
    const { name, date, description } = req.body;

    if (!name || !date) {
      return res.status(400).json({ error: 'Holiday name and date (YYYY-MM-DD) are required.' });
    }

    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Date must be in format YYYY-MM-DD.' });
    }

    const holiday = await prisma.holiday.create({
      data: {
        name: name.trim(),
        date: date.trim(),
        description: description?.trim(),
      },
    });

    invalidateHolidayCache();

    return res.status(201).json({
      message: 'Holiday added successfully.',
      holiday,
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A holiday with this date already exists.' });
    }
    console.error('Add holiday error:', err);
    return res.status(500).json({ error: 'Failed to add holiday.' });
  }
});

/**
 * DELETE /api/admin/holidays/:id
 * Remove a festival holiday
 */
router.delete('/holidays/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.holiday.delete({ where: { id } });
    invalidateHolidayCache();

    return res.json({ message: 'Holiday removed successfully.' });
  } catch (err) {
    console.error('Delete holiday error:', err);
    return res.status(500).json({ error: 'Failed to delete holiday.' });
  }
});

/**
 * GET /api/admin/settings
 * View system configuration
 */
router.get('/settings', async (req, res) => {
  try {
    const settings = await getSystemSettings();
    return res.json({ settings });
  } catch (err) {
    console.error('Get settings error:', err);
    return res.status(500).json({ error: 'Failed to retrieve settings.' });
  }
});

/**
 * PUT /api/admin/settings
 * Update system settings (working hours, SLA commitments, policy)
 */
router.put('/settings', async (req, res) => {
  try {
    const updates = req.body; // Key-value object

    for (const [key, value] of Object.entries(updates)) {
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }

    const updated = await getSystemSettings();
    return res.json({
      message: 'System settings updated successfully.',
      settings: updated,
    });
  } catch (err) {
    console.error('Update settings error:', err);
    return res.status(500).json({ error: 'Failed to update system settings.' });
  }
});

/**
 * GET /api/admin/audit-logs
 * View global audit trail with search and filtering
 */
router.get('/audit-logs', async (req, res) => {
  try {
    const { ticketId, action, userId, limit = 100 } = req.query;

    const where = {};
    if (ticketId) where.ticketId = ticketId;
    if (action) where.action = action;
    if (userId) where.userId = userId;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit, 10), 500),
      include: {
        ticket: { select: { id: true, subject: true } },
      },
    });

    return res.json({ auditLogs: logs });
  } catch (err) {
    console.error('Audit logs error:', err);
    return res.status(500).json({ error: 'Failed to retrieve audit logs.' });
  }
});

/**
 * GET /api/admin/sla-reports
 * Comprehensive SLA report explaining which tickets were late and why
 */
router.get('/sla-reports', async (req, res) => {
  try {
    const holidays = await getActiveHolidays();
    const now = new Date();

    const tickets = await prisma.ticket.findMany({
      include: {
        customer: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        slaEvents: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    let total = tickets.length;
    let lateCount = 0;
    const lateTickets = [];

    for (const t of tickets) {
      const slaState = getTicketSlaStatus(t, now, holidays);
      const isLate = slaState === 'OVERDUE' || (t.resolvedAt && new Date(t.resolvedAt) > new Date(t.resolutionDeadline));

      if (isLate) {
        lateCount++;
        lateTickets.push({
          id: t.id,
          subject: t.subject,
          priority: t.priority,
          status: t.status,
          assignedTo: t.assignedTo?.name || 'Unassigned',
          customer: t.customer?.name,
          createdAt: t.createdAt,
          resolutionDeadline: t.resolutionDeadline,
          resolvedAt: t.resolvedAt,
          slaEvents: t.slaEvents,
          totalPausedSeconds: t.totalPausedSeconds,
        });
      }
    }

    const onTimeRate = total > 0 ? Math.round(((total - lateCount) / total) * 100) : 100;

    return res.json({
      totalTickets: total,
      lateTicketsCount: lateCount,
      onTimePercentage: onTimeRate,
      lateTicketsAnalysis: lateTickets,
    });
  } catch (err) {
    console.error('SLA report error:', err);
    return res.status(500).json({ error: 'Failed to generate SLA report.' });
  }
});

export default router;
