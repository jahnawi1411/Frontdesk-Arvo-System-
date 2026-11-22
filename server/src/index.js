import app from './app.js';
import { initScheduler } from './services/scheduler.js';
import { ensureConfiguredAdmin } from './services/initialAdmin.js';

const PORT = process.env.PORT || 5000;

await ensureConfiguredAdmin();

const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Frontdesk Support Management Server`);
  console.log(`Arvo Systems - Customer Support Platform`);
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`====================================================`);

  // Initialize background ticket closure scheduler
  initScheduler();
});

export default server;
