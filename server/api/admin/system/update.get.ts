import { requireAdminSession } from '../../../utils/adminAuth';

/** Default install folder (see the getting started guide) */
const INSTALL_DIR = '/opt/trackarr';

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  // Git pull + docker rebuild must be run manually on the server
  return {
    success: true,
    directory: INSTALL_DIR,
    commands: [
      `cd ${INSTALL_DIR}`,
      'git checkout main',
      'git pull origin main',
      'docker compose -f docker-compose.prod.yml down',
      'docker compose -f docker-compose.prod.yml up -d --build',
    ],
    notes: [
      'Backup your database before updating',
      'Check the changelog for breaking changes',
      'The update will cause a brief downtime during container restart',
    ],
  };
});
