import { requireAdminSession } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  // Git pull + docker rebuild must be run manually on the server
  // We return helpful commands for the admin
  return {
    success: true,
    message: 'Run these commands on your server to update OpenTracker:',
    commands: [
      {
        step: 1,
        description: 'Navigate to the project directory',
        command: 'cd /path/to/opentracker',
      },
      {
        step: 2,
        description: 'Pull the latest changes from Git',
        command: 'git pull origin main',
      },
      {
        step: 3,
        description: 'Rebuild and restart Docker containers',
        command: 'docker compose -f docker-compose.prod.yml up -d --build',
      },
    ],
    notes: [
      'Backup your database before updating',
      'Check the changelog for breaking changes',
      'The update will cause a brief downtime during container restart',
    ],
  };
});
