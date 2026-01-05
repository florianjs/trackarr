/**
 * Zod Validation Schemas
 * Centralized request validation schemas for all API endpoints
 */

import { z } from 'zod';

// ============================================================================
// Base Schemas
// ============================================================================

export const uuidSchema = z
  .string()
  .uuid('Invalid UUID format')
  .transform((val) => val.toLowerCase());

export const infoHashSchema = z
  .string()
  .regex(
    /^[a-fA-F0-9]{40}$/,
    'Invalid info hash format. Expected 40 hex characters'
  )
  .transform((val) => val.toLowerCase());

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const passkeySchema = z
  .string()
  .length(40, 'Passkey must be exactly 40 characters')
  .regex(/^[a-f0-9]{40}$/, 'Invalid passkey format');

// ============================================================================
// Auth Schemas (Zero Knowledge Encryption)
// ============================================================================

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').max(100),
  challenge: z.string().length(64, 'Invalid challenge'),
  proof: z.string().length(64, 'Invalid proof'),
});

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, underscores, and hyphens'
    ),
  // ZKE fields - server never sees password
  authSalt: z.string().min(40, 'Invalid salt'),
  authVerifier: z.string().min(40, 'Invalid verifier'),
  // Proof of Work
  powChallenge: z.string().length(64, 'Invalid PoW challenge'),
  powNonce: z.string().min(1, 'Invalid PoW nonce'),
  powHash: z.string().length(64, 'Invalid PoW hash'),
  // Optional
  inviteCode: z.string().length(32).optional(),
  panicPassword: z
    .string()
    .min(12, 'Panic password must be at least 12 characters')
    .max(128)
    .optional(),
});

// ============================================================================
// Torrent Schemas
// ============================================================================

export const torrentUploadSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID').optional(),
  description: z.string().max(10000, 'Description too long').optional(),
});

export const torrentQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  categoryId: z.string().uuid().optional(),
  search: z.string().max(255).optional(),
  sortBy: z
    .enum(['uploaded', 'name', 'size', 'seeders', 'leechers'])
    .default('uploaded'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const torrentCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(5000, 'Comment too long'),
});

// ============================================================================
// Admin Schemas
// ============================================================================

export const adminUserRoleSchema = z.object({
  role: z.enum(['user', 'moderator', 'admin']),
});

export const adminBanSchema = z.object({
  reason: z.string().min(1, 'Ban reason is required').max(500),
  duration: z.coerce.number().int().positive().optional(),
});

export const adminCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  slug: z
    .string()
    .max(100)
    .regex(
      /^[a-z0-9-]+$/,
      'Slug can only contain lowercase letters, numbers, and hyphens'
    )
    .optional(),
  parentId: z.string().uuid('Invalid parent category ID').nullable().optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(50).optional(),
});

export const adminSettingsSchema = z.object({
  registrationOpen: z.boolean().optional(),
  announceInterval: z.coerce.number().int().positive().max(3600).optional(),
  minAnnounceInterval: z.coerce.number().int().positive().max(1800).optional(),
  maxPeersPerTorrent: z.coerce.number().int().positive().max(1000).optional(),
  peerTTL: z.coerce.number().int().positive().max(86400).optional(),
  minRatio: z.coerce.number().min(0).max(10).optional(),
  starterUpload: z.coerce.number().int().min(0).optional(),
  siteName: z.string().min(1).max(50).optional(),
  siteLogo: z.string().min(1).max(100).optional(),
  siteLogoImage: z.string().max(500).optional().nullable(),
  siteSubtitle: z.string().max(100).optional().nullable(),
  announcementEnabled: z.boolean().optional(),
  announcementMessage: z.string().max(500).optional(),
  announcementType: z.enum(['info', 'warning', 'error']).optional(),
  // Homepage content
  heroTitle: z.string().max(50).optional(),
  heroTitleSplitPosition: z.coerce.number().int().min(1).optional(),
  heroSubtitle: z.string().max(500).optional(),
  statusBadgeText: z.string().max(100).optional(),
  feature1Title: z.string().max(100).optional(),
  feature1Desc: z.string().max(500).optional(),
  feature2Title: z.string().max(100).optional(),
  feature2Desc: z.string().max(500).optional(),
  feature3Title: z.string().max(100).optional(),
  feature3Desc: z.string().max(500).optional(),
});

// ============================================================================
// Forum Schemas
// ============================================================================

export const forumCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  slug: z
    .string()
    .min(1, 'Category slug is required')
    .max(100)
    .regex(
      /^[a-z0-9-]+$/,
      'Slug can only contain lowercase letters, numbers, and hyphens'
    ),
  description: z.string().max(500).optional(),
  order: z.coerce.number().int().min(0).default(0),
});

export const forumTopicSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required').max(50000),
  categoryId: z.string().uuid('Invalid category ID'),
});

export const forumPostSchema = z.object({
  content: z.string().min(1, 'Content is required').max(50000),
  topicId: z.string().uuid('Invalid topic ID'),
});

export const forumTopicUpdateSchema = z.object({
  isPinned: z.boolean().optional(),
  isLocked: z.boolean().optional(),
});

// ============================================================================
// Tracker Schemas (for announce/scrape validation)
// ============================================================================

export const announceQuerySchema = z.object({
  info_hash: infoHashSchema,
  peer_id: z.string().length(20, 'Peer ID must be 20 characters'),
  port: z.coerce.number().int().min(1).max(65535),
  uploaded: z.coerce.number().int().min(0),
  downloaded: z.coerce.number().int().min(0),
  left: z.coerce.number().int().min(0),
  compact: z.coerce.number().int().optional(),
  no_peer_id: z.coerce.number().int().optional(),
  event: z.enum(['started', 'stopped', 'completed', '']).optional(),
  ip: z.string().optional(),
  numwant: z.coerce.number().int().min(0).max(200).optional(),
  key: z.string().optional(),
  trackerid: z.string().optional(),
});

export const scrapeQuerySchema = z.object({
  info_hash: z.union([infoHashSchema, z.array(infoHashSchema)]).optional(),
});

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate and parse request body with Zod schema
 * Throws HTTP 400 error with validation messages on failure
 */
export async function validateBody<T>(
  event: any,
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    const body = await readBody(event);
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map(
        (e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`
      );
      throw createError({
        statusCode: 400,
        message: messages.join('; '),
      });
    }
    throw error;
  }
}

/**
 * Validate and parse query parameters with Zod schema
 * Throws HTTP 400 error with validation messages on failure
 */
export function validateQuery<T>(event: any, schema: z.ZodSchema<T>): T {
  try {
    const query = getQuery(event);
    return schema.parse(query);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map(
        (e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`
      );
      throw createError({
        statusCode: 400,
        message: messages.join('; '),
      });
    }
    throw error;
  }
}

/**
 * Validate route parameter with Zod schema
 * Throws HTTP 400 error with validation messages on failure
 */
export function validateParam<T>(
  event: any,
  paramName: string,
  schema: z.ZodSchema<T>
): T {
  try {
    const param = getRouterParam(event, paramName);
    return schema.parse(param);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map((e: z.ZodIssue) => e.message);
      throw createError({
        statusCode: 400,
        message: messages.join('; '),
      });
    }
    throw error;
  }
}
