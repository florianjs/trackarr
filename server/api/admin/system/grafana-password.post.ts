import { requireAdminSession } from '../../../utils/adminAuth';
import { z } from 'zod';

const schema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const body = await readBody(event);
  const { currentPassword, newPassword } = schema.parse(body);

  // Get Grafana config from environment
  const grafanaUrl = process.env.GRAFANA_INTERNAL_URL || 'http://grafana:3000';
  const grafanaUser = process.env.GRAFANA_ADMIN_USER || 'admin';

  try {
    // Use Grafana API to change password
    // https://grafana.com/docs/grafana/latest/developers/http_api/user/#change-password
    const response = await fetch(`${grafanaUrl}/api/user/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${grafanaUser}:${currentPassword}`).toString('base64')}`,
      },
      body: JSON.stringify({
        oldPassword: currentPassword,
        newPassword: newPassword,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      if (response.status === 401) {
        throw createError({
          statusCode: 401,
          message: 'Invalid current password',
        });
      }

      throw createError({
        statusCode: response.status,
        message: `Grafana API error: ${errorText}`,
      });
    }

    return {
      success: true,
      message: 'Grafana password updated successfully',
    };
  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }

    // Network error - Grafana might not be reachable
    throw createError({
      statusCode: 503,
      message: 'Could not connect to Grafana. Make sure Grafana is running.',
    });
  }
});
