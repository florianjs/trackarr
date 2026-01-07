import {
  isAnnouncementEnabled,
  getAnnouncementMessage,
  getAnnouncementType,
} from '../utils/settings';

/**
 * GET /api/announcement
 * Public endpoint to get current announcement (no auth required)
 */
export default defineEventHandler(async () => {
  const enabled = await isAnnouncementEnabled();
  
  if (!enabled) {
    return { enabled: false };
  }

  const message = await getAnnouncementMessage();
  const type = await getAnnouncementType();

  return {
    enabled: true,
    message,
    type,
  };
});
