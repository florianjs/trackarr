import { requireModeratorSession } from '../../../utils/adminAuth';
import { exemptHnr, clearHnr } from '../../../utils/hnr';
import { z } from 'zod';

const actionSchema = z.object({
  action: z.enum(['exempt', 'clear']),
});

export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, message: 'HnR entry ID required' });
  }

  const body = await readBody(event);
  const { action } = actionSchema.parse(body);

  let success = false;
  if (action === 'exempt') {
    success = await exemptHnr(id);
  } else if (action === 'clear') {
    success = await clearHnr(id);
  }

  if (!success) {
    throw createError({ statusCode: 404, message: 'HnR entry not found' });
  }

  return { success: true, action };
});
