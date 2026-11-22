# Frontdesk – Customer Support Ticket Management System
### Engineered for Arvo Systems · Production Full-Stack Implementation

Frontdesk is a complete, secure, responsive, database-backed customer support and SLA management platform designed to replace Arvo Systems' legacy shared spreadsheet and WhatsApp group workflow.

---

## 1. Solutions to Arvo's Historical Incidents

| Incident | Root Cause in Legacy Workflow | Frontdesk Architectural Solution | Verification / Test |
|---|---|---|---|
| **INC-0291**<br>*(Two agents claimed the same ticket and sent conflicting answers)* | Concurrency race condition; spreadsheet allowed concurrent writes with no locking. | **Atomic Conditional Database Update & Transaction**: When clicking *"Take This Ticket"*, the backend conditionally executes an atomic `UPDATE` with `assignedToId: null`. If another agent claimed it in the same millisecond, the database rejects the second request with **HTTP 409 Conflict** and alerts the agent. | Verified in `test/api-security-concurrency.test.js` (Test 11) |
| **INC-0304**<br>*(Internal team note was accidentally sent to a customer)* | Lack of boundary between internal notes and public replies. | **Server-Side API Exclusion & Response Serializers**: Complete data-level separation. Messages are typed as `PUBLIC_REPLY` or `INTERNAL_NOTE`. Customer routes strictly query `where: { type: 'PUBLIC_REPLY' }` and pass through a dedicated serializer. Internal notes never reach customer screens, API payloads, or lists. | Verified in `test/api-security-concurrency.test.js` (Tests 13 & 14) |
| **INC-0318**<br>*(Customer disputed response timestamp; no proof existed)* | Spreadsheet showed only current state; no historical record or audit trail. | **Immutable Append-Only Audit Logging**: All ticket creations, assignments, reassignments, priority changes, status updates, public replies, internal notes, SLA pauses, and resumes are recorded with server-generated UTC timestamps. **No update or delete API endpoints exist for audit logs**. | Verified in `test/api-security-concurrency.test.js` (Test 15) |

---

## 2. Working Schedule & SLA Engine Rules

Frontdesk implements the exact business schedule articulated by Support Lead Meera:

- **Working Hours**: Monday to Friday, **9:30 AM to 6:30 PM** (9.0 working hours = 540 working minutes/day).
- **Weekends**: Saturdays and Sundays are non-working days; the SLA clock does not advance.
- **Festival Holidays**: Configurable dates stored in database (`Holiday` entity) that are excluded from working time.
- **Off-Hours Ingestion**: Tickets arriving outside working hours (e.g., Friday 6:00 PM or 9:00 PM) pause until the next working period (Monday at 9:30 AM, or next non-holiday workday).
- **Friday 6:00 PM Guarantee**: An urgent ticket arriving at 6:00 PM on Friday consumes 30 minutes on Friday; its remaining 90 minutes count from Monday 9:30 AM to Monday 11:00 AM. On Sunday morning, **the ticket is 100% on track, not overdue**.

### SLA Commitments (Independent First Response & Resolution)

| Priority | First Response SLA | Resolution SLA | Configurable Default |
|---|---|---|---|
| **Urgent** | **2 working hours** (120 mins) | **Same working day** (9 working hours / 540 mins) | Configurable |
| **Medium** | **Half a working day** (4.5 working hours / 270 mins) | **~3 working days** (27 working hours / 1,620 mins) | Configurable |
| **Small** | **1 working day** (9 working hours / 540 mins) | **~1 working week** (5 working days / 2,700 mins) | Configurable |

### Customer Waiting Time (Resolution SLA Pause/Resume)
- When status changes to `Waiting for Customer`, the resolution SLA timer is paused.
- The working time already consumed up to that exact timestamp is calculated and preserved in `SlaEvent`.
- When the customer sends a public reply, the timer automatically resumes without resetting consumed time, extending the deadline by the exact non-working interval.

### Automatic Ticket Closure (Background Scheduler)
- If a ticket remains in `Waiting for Customer` for **5 working days** without a customer reply, a backend scheduler automatically closes the ticket (`CLOSED`) and records the event in the audit trail.
- Implemented with `node-cron` independently of whether any user has the browser open.

### Ticket Reopening Window
- If a customer is unsatisfied with a `RESOLVED` ticket, they can reopen it within **5 working days**.
- If reopening is requested after 5 working days, the request is rejected with `HTTP 400 Bad Request`, requiring a new ticket.

### Configurable Priority-Change Policy
- Addresses the unresolved meeting question with 3 selectable policies:
  1. `RECALCULATE_FROM_REMAINING_RATIO` (Default): Scales remaining working percentage to the new priority duration.
  2. `RESET_FROM_CREATION`: Recalculates deadline from ticket creation timestamp.
  3. `RECALCULATE_FROM_NOW`: Grants the new priority duration starting from the moment of change.

---

## 3. Technology Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide React icons
- **Backend**: Node.js (v20+ / v22+), Express.js REST APIs
- **Database**: PostgreSQL (Production) / SQLite (Zero-dependency local dev & testing) via Prisma ORM
- **Security**: JWT Bearer authentication, bcrypt password hashing (10 rounds), Role-Based Access Control (RBAC)
- **Background Scheduler**: node-cron automated ticket closure
- **Testing**: Vitest, Supertest

---

## 4. Development Credentials

The seed script (`npm run seed`) populates realistic test accounts:

| Role | Name | Email | Password |
|---|---|---|---|
| **Admin / Manager** | Marcus Vance | `admin@arvo.com` | `Password123!` |
| **Agent Lead** | Meera Nair | `meera@arvo.com` | `Password123!` |
| **Support Agent** | Rohan Sharma | `rohan@arvo.com` | `Password123!` |
| **Support Agent** | Priya Patel | `priya@arvo.com` | `Password123!` |
| **Customer** | Rahul Verma (Apex Logistics) | `rahul@apexlogistics.com` | `Password123!` |
| **Customer 2** | Samantha Reed (BrightWave Media) | `samantha@brightwave.io` | `Password123!` |

*(Note: The login screen also includes 1-click test login buttons for rapid role testing).*

---

## 5. Quick Start Instructions

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Run Automated Test Suite (16 Automated Tests)
```bash
npm test
```
All 16 business requirement and security tests will execute and pass.

### 3. Seed Database
```bash
npm run seed
```

### 4. Build Frontend for Production
```bash
npm run build:client
```

### 5. Start Server
```bash
npm start
```
Visit **http://localhost:5000** in your browser. Both frontend and backend are served together.

Alternatively, for concurrent development:
- Backend: `npm run dev:server` (Port 5000)
- Frontend: `npm run dev:client` (Port 5173 with automatic API proxy)

---

## 6. PostgreSQL Production Deployment

### Option A: Docker Compose (1 Command)
```bash
docker compose up -d
```
Boots PostgreSQL on port 5432 and the Frontdesk application container on port 5000.

### Option B: Cloud PostgreSQL (Neon / Supabase / Render / AWS RDS)
1. Switch Prisma schema to PostgreSQL:
   ```bash
   npm run db:use-postgres
   ```
2. Set your environment variable in `server/.env`:
   ```env
   DATABASE_URL="postgresql://user:password@host:5432/frontdesk?schema=public"
   ```
3. Run migrations and seed:
   ```bash
   npm run prisma:migrate --prefix server
   npm run seed
   ```
4. Start the application:
   ```bash
   npm start
   ```

---

## 7. Verification Checklist

- [x] **Incident INC-0291**: Atomic concurrency protection on ticket claim (HTTP 409 on duplicate claims).
- [x] **Incident INC-0304**: Public vs Private Internal Notes strictly separated; internal notes omitted from all customer APIs.
- [x] **Incident INC-0318**: Append-only immutable audit trail with UTC timestamps; no delete/edit endpoints.
- [x] **Working Hours SLA Engine**: 9:30 AM to 6:30 PM Mon–Fri, excluding weekends & festival holidays.
- [x] **Friday 6 PM Ticket**: Clock preserves time over weekend, resuming Monday 9:30 AM.
- [x] **Pause/Resume**: Consumed working time preserved during customer waiting periods.
- [x] **Auto-Close Scheduler**: Automatically closes inactive tickets after 5 working days.
- [x] **Reopening Window**: Allows customer reopening within 5 working days; rejects thereafter.
- [x] **16 Automated Tests**: 100% passing test suite.
