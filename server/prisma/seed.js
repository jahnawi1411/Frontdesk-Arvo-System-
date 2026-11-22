import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { calculateInitialSlaDeadlines, addWorkingMinutes } from '../src/services/workingHours.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Frontdesk database for Arvo Systems...');

  // Clean existing data
  await prisma.auditLog.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.slaEvent.deleteMany({});
  await prisma.ticket.deleteMany({});
  await prisma.holiday.deleteMany({});
  await prisma.systemSetting.deleteMany({});
  await prisma.user.deleteMany({});

  const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

  // 1. Seed Administrator
  const admin = await prisma.user.create({
    data: {
      email: 'admin@arvo.com',
      passwordHash: defaultPasswordHash,
      name: 'Marcus Vance',
      role: 'ADMIN',
      department: 'Support Leadership',
    },
  });

  // 2. Seed Nine Support Agents (as documented in Arvo team structure)
  const agentData = [
    { name: 'Meera Nair', email: 'meera@arvo.com', department: 'Support Lead / Tier 2' },
    { name: 'Rohan Sharma', email: 'rohan@arvo.com', department: 'Technical Support' },
    { name: 'Priya Patel', email: 'priya@arvo.com', department: 'Enterprise Support' },
    { name: 'Alex Chen', email: 'alex@arvo.com', department: 'Integration Support' },
    { name: 'Sarah Jenkins', email: 'sarah@arvo.com', department: 'Technical Support' },
    { name: 'David Kumar', email: 'david@arvo.com', department: 'Technical Support' },
    { name: 'Fatima Al-Mansoor', email: 'fatima@arvo.com', department: 'Customer Success' },
    { name: 'Vikram Joshi', email: 'vikram@arvo.com', department: 'Billing & Account' },
    { name: 'Elena Rostova', email: 'elena@arvo.com', department: 'Technical Support' },
  ];

  const agents = [];
  for (const a of agentData) {
    const createdAgent = await prisma.user.create({
      data: {
        name: a.name,
        email: a.email,
        passwordHash: defaultPasswordHash,
        role: 'AGENT',
        department: a.department,
      },
    });
    agents.push(createdAgent);
  }

  // 3. Seed Realistic Customers
  const customerData = [
    { name: 'Rahul Verma', email: 'rahul@apexlogistics.com', department: 'Apex Logistics' },
    { name: 'Samantha Reed', email: 'samantha@brightwave.io', department: 'BrightWave Media' },
    { name: 'James Peterson', email: 'james@cloudsync.net', department: 'CloudSync Tech' },
    { name: 'Natasha Williams', email: 'natasha@zenithfin.com', department: 'Zenith FinTech' },
  ];

  const customers = [];
  for (const c of customerData) {
    const createdCustomer = await prisma.user.create({
      data: {
        name: c.name,
        email: c.email,
        passwordHash: defaultPasswordHash,
        role: 'CUSTOMER',
        department: c.department,
      },
    });
    customers.push(createdCustomer);
  }

  // 4. Seed Festival Holidays
  const holidays = [
    { name: 'New Year Holiday', date: '2026-01-01', description: 'National New Year Holiday' },
    { name: 'Republic Day', date: '2026-01-26', description: 'National Holiday' },
    { name: 'Festival of Lights (Diwali)', date: '2026-11-09', description: 'Festival holiday' },
    { name: 'Christmas Day', date: '2026-12-25', description: 'Christmas Holiday' },
  ];

  for (const h of holidays) {
    await prisma.holiday.create({ data: h });
  }

  const holidayDates = holidays.map(h => h.date);

  // 5. Seed System Settings
  const settings = [
    { key: 'SLA_WORK_START', value: '09:30', description: 'Workday start time' },
    { key: 'SLA_WORK_END', value: '18:30', description: 'Workday end time' },
    { key: 'SLA_WORK_DAYS', value: '1,2,3,4,5', description: 'Monday to Friday' },
    { key: 'SLA_URGENT_FIRST_RESPONSE_HOURS', value: '2', description: 'Urgent first response (hours)' },
    { key: 'SLA_URGENT_RESOLUTION_HOURS', value: '9', description: 'Urgent resolution (same working day / 9 hours)' },
    { key: 'SLA_MEDIUM_FIRST_RESPONSE_HOURS', value: '4.5', description: 'Medium first response (half working day)' },
    { key: 'SLA_MEDIUM_RESOLUTION_HOURS', value: '27', description: 'Medium resolution (3 working days)' },
    { key: 'SLA_SMALL_FIRST_RESPONSE_HOURS', value: '9', description: 'Small first response (1 working day)' },
    { key: 'SLA_SMALL_RESOLUTION_HOURS', value: '45', description: 'Small resolution (1 working week / 5 days)' },
    { key: 'SLA_AUTO_CLOSE_WORKING_DAYS', value: '5', description: 'Automatic closure period (working days)' },
    { key: 'SLA_REOPEN_WINDOW_WORKING_DAYS', value: '5', description: 'Permitted reopening period (working days)' },
    { key: 'SLA_PRIORITY_CHANGE_POLICY', value: 'RECALCULATE_FROM_REMAINING_RATIO', description: 'Policy for mid-flight priority adjustment' },
  ];

  for (const s of settings) {
    await prisma.systemSetting.create({ data: s });
  }

  // 6. Seed Sample Tickets
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  // Ticket 1: INC-0291 (Urgent, Unassigned - referenced in Incident 1 concurrency problem)
  const sla291 = calculateInitialSlaDeadlines(twoHoursAgo, 'URGENT', holidayDates);
  const ticket291 = await prisma.ticket.create({
    data: {
      id: 'INC-0291',
      ticketNumber: 291,
      subject: 'Critical: Production API Authentication Service Failure',
      description: 'Our mobile and web clients are receiving HTTP 500 errors during customer login. Production operations are completely blocked.',
      customerId: customers[0].id,
      assignedToId: null, // Unassigned! Perfect for testing atomic claim / concurrency
      priority: 'URGENT',
      status: 'OPEN',
      firstResponseDeadline: sla291.firstResponseDeadline,
      resolutionDeadline: sla291.resolutionDeadline,
      createdAt: twoHoursAgo,
      updatedAt: twoHoursAgo,
    },
  });

  await prisma.auditLog.create({
    data: {
      ticketId: ticket291.id,
      action: 'TICKET_CREATED',
      userId: customers[0].id,
      userName: customers[0].name,
      userRole: 'CUSTOMER',
      newValue: 'URGENT',
      metadata: JSON.stringify({ subject: ticket291.subject }),
      createdAt: twoHoursAgo,
    },
  });

  // Ticket 2: INC-0304 (Medium, In Progress - referenced in Incident 2 private notes leak)
  const sla304 = calculateInitialSlaDeadlines(oneDayAgo, 'MEDIUM', holidayDates);
  const ticket304 = await prisma.ticket.create({
    data: {
      id: 'INC-0304',
      ticketNumber: 304,
      subject: 'Billing discrepancy on Enterprise tier renewal invoice',
      description: 'We were billed for 50 additional user seats that were decommissioned last month. Please adjust invoice #INV-8821.',
      customerId: customers[1].id,
      assignedToId: agents[0].id, // Meera Nair
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      firstResponseDeadline: sla304.firstResponseDeadline,
      resolutionDeadline: sla304.resolutionDeadline,
      firstResponseAt: new Date(oneDayAgo.getTime() + 45 * 60 * 1000),
      createdAt: oneDayAgo,
      updatedAt: now,
    },
  });

  await prisma.auditLog.create({
    data: {
      ticketId: ticket304.id,
      action: 'TICKET_CREATED',
      userId: customers[1].id,
      userName: customers[1].name,
      userRole: 'CUSTOMER',
      newValue: 'MEDIUM',
      createdAt: oneDayAgo,
    },
  });

  await prisma.auditLog.create({
    data: {
      ticketId: ticket304.id,
      action: 'TICKET_ASSIGNED',
      userId: agents[0].id,
      userName: agents[0].name,
      userRole: 'AGENT',
      previousValue: 'Unassigned',
      newValue: agents[0].name,
      createdAt: new Date(oneDayAgo.getTime() + 10 * 60 * 1000),
    },
  });

  // Public Reply on INC-0304
  await prisma.message.create({
    data: {
      ticketId: ticket304.id,
      senderId: agents[0].id,
      type: 'PUBLIC_REPLY',
      content: 'Hello Samantha, thank you for reaching out. We have received your query regarding invoice #INV-8821 and are currently reviewing your account deprovisioning audit records with Finance.',
      createdAt: new Date(oneDayAgo.getTime() + 45 * 60 * 1000),
    },
  });

  // PRIVATE INTERNAL NOTE on INC-0304 (MUST NEVER REACH CUSTOMER)
  await prisma.message.create({
    data: {
      ticketId: ticket304.id,
      senderId: agents[0].id,
      type: 'INTERNAL_NOTE',
      content: 'INTERNAL NOTE: Account manager confirmed BrightWave decommissioned the seats on Oct 18, but finance batch jobs ran before the sync. Do not issue a refund yet; prepare a credit memo for approval by Marcus.',
      createdAt: new Date(oneDayAgo.getTime() + 50 * 60 * 1000),
    },
  });

  await prisma.auditLog.create({
    data: {
      ticketId: ticket304.id,
      action: 'INTERNAL_NOTE_ADDED',
      userId: agents[0].id,
      userName: agents[0].name,
      userRole: 'AGENT',
      newValue: 'Private Internal Note for Team',
      createdAt: new Date(oneDayAgo.getTime() + 50 * 60 * 1000),
    },
  });

  // Ticket 3: INC-0318 (Urgent, Waiting for Customer - referenced in Incident 3 timestamp audit dispute)
  const sla318 = calculateInitialSlaDeadlines(threeDaysAgo, 'URGENT', holidayDates);
  const ticket318 = await prisma.ticket.create({
    data: {
      id: 'INC-0318',
      ticketNumber: 318,
      subject: 'Severe webhook delivery timeout across US-East gateway',
      description: 'Webhooks failing with ECONNRESET after 30 seconds timeout during peak load.',
      customerId: customers[2].id,
      assignedToId: agents[1].id, // Rohan Sharma
      priority: 'URGENT',
      status: 'WAITING_FOR_CUSTOMER',
      firstResponseDeadline: sla318.firstResponseDeadline,
      resolutionDeadline: sla318.resolutionDeadline,
      firstResponseAt: new Date(threeDaysAgo.getTime() + 40 * 60 * 1000), // Disproved customer dispute!
      pausedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      createdAt: threeDaysAgo,
      updatedAt: now,
    },
  });

  await prisma.auditLog.create({
    data: {
      ticketId: ticket318.id,
      action: 'TICKET_CREATED',
      userId: customers[2].id,
      userName: customers[2].name,
      userRole: 'CUSTOMER',
      newValue: 'URGENT',
      createdAt: threeDaysAgo,
    },
  });

  await prisma.auditLog.create({
    data: {
      ticketId: ticket318.id,
      action: 'PUBLIC_REPLY_SENT',
      userId: agents[1].id,
      userName: agents[1].name,
      userRole: 'AGENT',
      newValue: 'Public Reply to Customer',
      metadata: JSON.stringify({ verifiedServerTimestamp: new Date(threeDaysAgo.getTime() + 40 * 60 * 1000).toISOString() }),
      createdAt: new Date(threeDaysAgo.getTime() + 40 * 60 * 1000),
    },
  });

  await prisma.message.create({
    data: {
      ticketId: ticket318.id,
      senderId: agents[1].id,
      type: 'PUBLIC_REPLY',
      content: 'Hi James, we investigated the gateway logs and noticed retry attempts are exhausting the connection pool. Could you verify if your receiver endpoint supports HTTP/2 keep-alive?',
      createdAt: new Date(threeDaysAgo.getTime() + 40 * 60 * 1000),
    },
  });

  // Ticket 4: INC-0321 (Small, Resolved - eligible for reopening within 5 days)
  const sla321 = calculateInitialSlaDeadlines(twoHoursAgo, 'SMALL', holidayDates);
  const ticket321 = await prisma.ticket.create({
    data: {
      id: 'INC-0321',
      ticketNumber: 321,
      subject: 'Inquiry regarding OAuth2 refresh token expiration policy',
      description: 'Could you confirm if refresh tokens expire after 30 days of inactivity or absolute lifetime?',
      customerId: customers[3].id,
      assignedToId: agents[2].id, // Priya Patel
      priority: 'SMALL',
      status: 'RESOLVED',
      firstResponseDeadline: sla321.firstResponseDeadline,
      resolutionDeadline: sla321.resolutionDeadline,
      firstResponseAt: new Date(twoHoursAgo.getTime() + 30 * 60 * 1000),
      resolvedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000), // Resolved 1 hour ago (within 5 working days)
      createdAt: twoHoursAgo,
      updatedAt: now,
    },
  });

  await prisma.message.create({
    data: {
      ticketId: ticket321.id,
      senderId: agents[2].id,
      type: 'PUBLIC_REPLY',
      content: 'Hi Natasha, refresh tokens have a rolling 30-day inactivity lifetime with a maximum absolute cap of 90 days. Hope this helps!',
      createdAt: new Date(twoHoursAgo.getTime() + 30 * 60 * 1000),
    },
  });

  await prisma.auditLog.create({
    data: {
      ticketId: ticket321.id,
      action: 'TICKET_RESOLVED',
      userId: agents[2].id,
      userName: agents[2].name,
      userRole: 'AGENT',
      previousValue: 'IN_PROGRESS',
      newValue: 'RESOLVED',
      createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
    },
  });

  console.log('Seeding completed successfully!');
  console.log('----------------------------------------------------');
  console.log('Development Credentials:');
  console.log('Admin:       admin@arvo.com / Password123!');
  console.log('Agent Lead:  meera@arvo.com / Password123!');
  console.log('Agent:       rohan@arvo.com / Password123!');
  console.log('Customer:    rahul@apexlogistics.com / Password123!');
  console.log('Customer 2:  samantha@brightwave.io / Password123!');
  console.log('----------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
