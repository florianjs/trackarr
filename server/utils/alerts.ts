import { securityLogger } from './logger';
import { redis } from '../redis/client';
import { claim } from '../redis/claim';

export interface SecurityAlert {
  type: SecurityAlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  ip?: string;
  userAgent?: string;
  endpoint?: string;
  details?: Record<string, any>;
  timestamp: string;
}

export enum SecurityAlertType {
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  IP_BLACKLISTED = 'ip_blacklisted',
  SQL_INJECTION_ATTEMPT = 'sql_injection_attempt',
  XSS_ATTEMPT = 'xss_attempt',
  AUTHENTICATION_FAILURE = 'authentication_failure',
  BRUTE_FORCE_DETECTED = 'brute_force_detected',
  SUSPICIOUS_PATTERN = 'suspicious_pattern',
  MALICIOUS_USER_AGENT = 'malicious_user_agent',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  ANOMALOUS_BEHAVIOR = 'anomalous_behavior',
  HONEYPOT_TRIGGERED = 'honeypot_triggered',
  RATIO_CHEAT_SUSPECTED = 'ratio_cheat_suspected',
}

// Severity mapping
const SEVERITY_MAP: Record<SecurityAlertType, SecurityAlert['severity']> = {
  [SecurityAlertType.RATE_LIMIT_EXCEEDED]: 'low',
  [SecurityAlertType.IP_BLACKLISTED]: 'medium',
  [SecurityAlertType.SQL_INJECTION_ATTEMPT]: 'critical',
  [SecurityAlertType.XSS_ATTEMPT]: 'critical',
  [SecurityAlertType.AUTHENTICATION_FAILURE]: 'low',
  [SecurityAlertType.BRUTE_FORCE_DETECTED]: 'high',
  [SecurityAlertType.SUSPICIOUS_PATTERN]: 'medium',
  [SecurityAlertType.MALICIOUS_USER_AGENT]: 'medium',
  [SecurityAlertType.UNAUTHORIZED_ACCESS]: 'high',
  [SecurityAlertType.ANOMALOUS_BEHAVIOR]: 'medium',
  [SecurityAlertType.HONEYPOT_TRIGGERED]: 'medium',
  [SecurityAlertType.RATIO_CHEAT_SUSPECTED]: 'high',
};

// Cooldown to avoid alert spam (in milliseconds)
const ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutes
const alertCooldowns = new Map<string, number>();

// Last alerts, shown in the admin dashboard even when no webhook is set
const INBOX_KEY = 'security:alerts';
const INBOX_SIZE = 200;

/**
 * @param subject What the cooldown applies to; defaults to the IP. Set it when
 * one IP can legitimately raise distinct alerts (e.g. a user id).
 */
export async function sendSecurityAlert(
  type: SecurityAlertType,
  details: Omit<SecurityAlert, 'type' | 'severity' | 'timestamp'>,
  subject?: string
): Promise<void> {
  const severity = SEVERITY_MAP[type];
  const alert: SecurityAlert = {
    type,
    severity,
    timestamp: new Date().toISOString(),
    ...details,
  };

  // Check cooldown to avoid spam
  const cooldownKey = `${type}:${subject ?? details.ip ?? 'unknown'}`;
  const lastAlert = alertCooldowns.get(cooldownKey);
  const now = Date.now();

  if (lastAlert && now - lastAlert < ALERT_COOLDOWN) {
    // Skip this alert, too soon
    return;
  }

  alertCooldowns.set(cooldownKey, now);

  // Shared cooldown so several app nodes don't each send the same alert.
  // Fail open: an alert must still go out when Redis is down.
  const firstNode = await claim(redis, `alert:cooldown:${cooldownKey}`, ALERT_COOLDOWN).catch(
    () => true
  );
  if (!firstNode) return;

  // Log the alert
  securityLogger.warn({ alert }, `Security Alert: ${alert.title}`);

  await redis
    .multi()
    .lpush(INBOX_KEY, JSON.stringify(alert))
    .ltrim(INBOX_KEY, 0, INBOX_SIZE - 1)
    .exec()
    .catch((err) => securityLogger.error({ err }, 'Security alert not stored'));

  // Webhooks only in production, unless explicitly enabled
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DEV_ALERTS === 'true') {
    await sendToWebhooks(alert);
  }
}

/** Most recent first */
export async function listSecurityAlerts(limit = INBOX_SIZE): Promise<SecurityAlert[]> {
  const raw = await redis.lrange(INBOX_KEY, 0, Math.min(limit, INBOX_SIZE) - 1);
  return raw.flatMap((entry) => {
    try {
      return [JSON.parse(entry) as SecurityAlert];
    } catch {
      return [];
    }
  });
}

export async function clearSecurityAlerts(): Promise<void> {
  await redis.del(INBOX_KEY);
}

async function sendToWebhooks(alert: SecurityAlert): Promise<void> {
  const webhooks: string[] = [];

  // Discord webhook
  if (process.env.DISCORD_WEBHOOK_URL) {
    webhooks.push(process.env.DISCORD_WEBHOOK_URL);
  }

  // Slack webhook
  if (process.env.SLACK_WEBHOOK_URL) {
    webhooks.push(process.env.SLACK_WEBHOOK_URL);
  }

  // Generic webhook
  if (process.env.SECURITY_WEBHOOK_URL) {
    webhooks.push(process.env.SECURITY_WEBHOOK_URL);
  }

  if (webhooks.length === 0) {
    // No webhooks configured, only log
    return;
  }

  // Send to all webhooks in parallel
  await Promise.allSettled(
    webhooks.map((webhook) => sendToWebhook(webhook, alert))
  );
}

async function sendToWebhook(
  webhookUrl: string,
  alert: SecurityAlert
): Promise<void> {
  try {
    const isDiscord = webhookUrl.includes('discord.com');
    const isSlack = webhookUrl.includes('slack.com');

    let payload: any;

    if (isDiscord) {
      payload = formatDiscordMessage(alert);
    } else if (isSlack) {
      payload = formatSlackMessage(alert);
    } else {
      // Generic JSON payload
      payload = alert;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      securityLogger.error(
        { status: response.status, statusText: response.statusText },
        'Failed to send security alert to webhook'
      );
    }
  } catch (error) {
    securityLogger.error({ error }, 'Error sending security alert to webhook');
  }
}

function formatDiscordMessage(alert: SecurityAlert): any {
  const color = getColorForSeverity(alert.severity);
  const emoji = getEmojiForSeverity(alert.severity);

  return {
    embeds: [
      {
        title: `${emoji} ${alert.title}`,
        description: alert.description,
        color,
        fields: [
          {
            name: 'Type',
            value: alert.type,
            inline: true,
          },
          {
            name: 'Severity',
            value: alert.severity.toUpperCase(),
            inline: true,
          },
          {
            name: 'Timestamp',
            value: alert.timestamp,
            inline: true,
          },
          ...(alert.ip
            ? [
                {
                  name: 'IP',
                  value: `\`${alert.ip}\``,
                  inline: true,
                },
              ]
            : []),
          ...(alert.endpoint
            ? [
                {
                  name: 'Endpoint',
                  value: `\`${alert.endpoint}\``,
                  inline: true,
                },
              ]
            : []),
          ...(alert.userAgent
            ? [
                {
                  name: 'User Agent',
                  value: `\`${alert.userAgent}\``,
                  inline: false,
                },
              ]
            : []),
          ...(alert.details
            ? [
                {
                  name: 'Details',
                  value: `\`\`\`json\n${JSON.stringify(alert.details, null, 2)}\`\`\``,
                  inline: false,
                },
              ]
            : []),
        ],
        footer: {
          text: 'Trackarr Security System',
        },
        timestamp: alert.timestamp,
      },
    ],
  };
}

function formatSlackMessage(alert: SecurityAlert): any {
  const emoji = getEmojiForSeverity(alert.severity);

  return {
    text: `${emoji} Security Alert: ${alert.title}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${alert.title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: alert.description,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Type:*\n${alert.type}`,
          },
          {
            type: 'mrkdwn',
            text: `*Severity:*\n${alert.severity.toUpperCase()}`,
          },
          ...(alert.ip
            ? [
                {
                  type: 'mrkdwn',
                  text: `*IP:*\n\`${alert.ip}\``,
                },
              ]
            : []),
          ...(alert.endpoint
            ? [
                {
                  type: 'mrkdwn',
                  text: `*Endpoint:*\n\`${alert.endpoint}\``,
                },
              ]
            : []),
        ],
      },
      ...(alert.details
        ? [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Details:*\n\`\`\`${JSON.stringify(alert.details, null, 2)}\`\`\``,
              },
            },
          ]
        : []),
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Trackarr Security System | ${alert.timestamp}`,
          },
        ],
      },
    ],
  };
}

function getColorForSeverity(severity: SecurityAlert['severity']): number {
  switch (severity) {
    case 'critical':
      return 0xff0000; // Red
    case 'high':
      return 0xff6600; // Orange
    case 'medium':
      return 0xffcc00; // Yellow
    case 'low':
      return 0x3498db; // Blue
    default:
      return 0x95a5a6; // Gray
  }
}

function getEmojiForSeverity(severity: SecurityAlert['severity']): string {
  switch (severity) {
    case 'critical':
      return '🚨';
    case 'high':
      return '⚠️';
    case 'medium':
      return '🔔';
    case 'low':
      return 'ℹ️';
    default:
      return '📢';
  }
}

// Cleanup old cooldowns periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of alertCooldowns.entries()) {
    if (now - timestamp > ALERT_COOLDOWN * 2) {
      alertCooldowns.delete(key);
    }
  }
}, ALERT_COOLDOWN);
