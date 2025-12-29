import {
  pgTable,
  text,
  timestamp,
  integer,
  bigint,
  boolean,
  index,
  uniqueIndex,
  customType,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// Custom type for bytea (binary data)
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

// ============================================================================
// Users
// ============================================================================
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(), // UUID
    username: text('username').notNull().unique(),
    // ZKE fields - server never sees password
    authSalt: text('auth_salt'), // Client-generated salt (base64) - nullable for migration
    authVerifier: text('auth_verifier'), // Derived verifier (base64) - nullable for migration
    passkey: text('passkey').notNull().unique(), // For private tracker auth
    isAdmin: boolean('is_admin').default(false).notNull(),
    isModerator: boolean('is_moderator').default(false).notNull(),
    isBanned: boolean('is_banned').default(false).notNull(),
    roleId: text('role_id'),
    lastIp: text('last_ip'),
    uploaded: bigint('uploaded', { mode: 'number' }).default(0).notNull(),
    downloaded: bigint('downloaded', { mode: 'number' }).default(0).notNull(),
    invitesRemaining: integer('invites_remaining').default(0).notNull(),
    panicPasswordHash: text('panic_password_hash'), // Only set for first admin
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastSeen: timestamp('last_seen').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('users_passkey_idx').on(table.passkey)]
);

// ============================================================================
// Banned IPs
// ============================================================================
export const bannedIps = pgTable('banned_ips', {
  ip: text('ip').primaryKey(),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// Roles (Flexible permission management)
// ============================================================================
export const roles = pgTable('roles', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color').default('#6b7280').notNull(),
  canUploadWithoutModeration: boolean('can_upload_without_moderation')
    .default(false)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// Categories (with subcategories support via parentId)
// ============================================================================
export const categories = pgTable(
  'categories',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    parentId: text('parent_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('categories_parent_idx').on(table.parentId)]
);

// ============================================================================
// Torrents
// ============================================================================
export const torrents = pgTable(
  'torrents',
  {
    id: text('id').primaryKey(), // UUID
    infoHash: text('info_hash').notNull().unique(), // 40-char hex
    name: text('name').notNull(),
    size: bigint('size', { mode: 'number' }).notNull(), // Bytes
    description: text('description'), // Rich text/Markdown description
    torrentData: bytea('torrent_data'), // Raw .torrent file for download
    uploaderId: text('uploader_id').references(() => users.id),
    categoryId: text('category_id').references(() => categories.id),
    isActive: boolean('is_active').default(true).notNull(),
    isApproved: boolean('is_approved').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('torrents_info_hash_idx').on(table.infoHash),
    index('torrents_uploader_idx').on(table.uploaderId),
    index('torrents_category_idx').on(table.categoryId),
    index('torrents_name_trgm_idx').using(
      'gist',
      sql`${table.name} gist_trgm_ops`
    ),
  ]
);

// ============================================================================
// Torrent Stats (Aggregated, updated periodically from Redis)
// ============================================================================
export const torrentStats = pgTable('torrent_stats', {
  infoHash: text('info_hash')
    .primaryKey()
    .references(() => torrents.infoHash, { onDelete: 'cascade' }),
  seeders: integer('seeders').default(0).notNull(),
  leechers: integer('leechers').default(0).notNull(),
  completed: integer('completed').default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// Announce Log (For tracking/debugging, optional)
// ============================================================================
export const announceLog = pgTable(
  'announce_log',
  {
    id: text('id').primaryKey(),
    infoHash: text('info_hash').notNull(),
    peerId: text('peer_id').notNull(),
    event: text('event'), // started, stopped, completed, or null
    ipHash: text('ip_hash').notNull(), // SHA256 hash of IP (privacy)
    port: integer('port').notNull(),
    uploaded: bigint('uploaded', { mode: 'number' }).default(0).notNull(),
    downloaded: bigint('downloaded', { mode: 'number' }).default(0).notNull(),
    left: bigint('left', { mode: 'number' }).default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('announce_log_info_hash_idx').on(table.infoHash),
    index('announce_log_created_at_idx').on(table.createdAt),
  ]
);

// ============================================================================
// Forum
// ============================================================================
export const forumCategories = pgTable('forum_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  order: integer('order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const forumTopics = pgTable('forum_topics', {
  id: text('id').primaryKey(),
  categoryId: text('category_id')
    .notNull()
    .references(() => forumCategories.id, { onDelete: 'cascade' }),
  authorId: text('author_id')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  isPinned: boolean('is_pinned').default(false).notNull(),
  isLocked: boolean('is_locked').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const forumPosts = pgTable('forum_posts', {
  id: text('id').primaryKey(),
  topicId: text('topic_id')
    .notNull()
    .references(() => forumTopics.id, { onDelete: 'cascade' }),
  authorId: text('author_id')
    .notNull()
    .references(() => users.id),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// Torrent Comments
// ============================================================================
export const torrentComments = pgTable('torrent_comments', {
  id: text('id').primaryKey(),
  torrentId: text('torrent_id')
    .notNull()
    .references(() => torrents.id, { onDelete: 'cascade' }),
  authorId: text('author_id')
    .notNull()
    .references(() => users.id),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// Relations
// ============================================================================
export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
  torrents: many(torrents),
  forumTopics: many(forumTopics),
  forumPosts: many(forumPosts),
  torrentComments: many(torrentComments),
  hnrTracking: many(hnrTracking),
  invitesCreated: many(invitations, { relationName: 'invitesCreated' }),
  reportsCreated: many(reports, { relationName: 'reportsCreated' }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  torrents: many(torrents),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'subcategories',
  }),
  subcategories: many(categories, { relationName: 'subcategories' }),
}));

export const forumCategoriesRelations = relations(
  forumCategories,
  ({ many }) => ({
    topics: many(forumTopics),
  })
);

export const forumTopicsRelations = relations(forumTopics, ({ one, many }) => ({
  category: one(forumCategories, {
    fields: [forumTopics.categoryId],
    references: [forumCategories.id],
  }),
  author: one(users, {
    fields: [forumTopics.authorId],
    references: [users.id],
  }),
  posts: many(forumPosts),
}));

export const forumPostsRelations = relations(forumPosts, ({ one }) => ({
  topic: one(forumTopics, {
    fields: [forumPosts.topicId],
    references: [forumTopics.id],
  }),
  author: one(users, {
    fields: [forumPosts.authorId],
    references: [users.id],
  }),
}));

export const torrentCommentsRelations = relations(
  torrentComments,
  ({ one }) => ({
    torrent: one(torrents, {
      fields: [torrentComments.torrentId],
      references: [torrents.id],
    }),
    author: one(users, {
      fields: [torrentComments.authorId],
      references: [users.id],
    }),
  })
);

export const torrentsRelations = relations(torrents, ({ one, many }) => ({
  uploader: one(users, {
    fields: [torrents.uploaderId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [torrents.categoryId],
    references: [categories.id],
  }),
  stats: one(torrentStats, {
    fields: [torrents.infoHash],
    references: [torrentStats.infoHash],
  }),
  comments: many(torrentComments),
  torrentTags: many(torrentTags),
}));

// ============================================================================
// Settings (Key-Value store for tracker configuration)
// ============================================================================
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// Panic State (Emergency database encryption status)
// ============================================================================
export const panicState = pgTable('panic_state', {
  id: text('id').primaryKey().default('singleton'), // Always one row
  isEncrypted: boolean('is_encrypted').default(false).notNull(),
  encryptedAt: timestamp('encrypted_at'),
  encryptionSalt: text('encryption_salt'), // For key derivation (base64)
  encryptionIv: text('encryption_iv'), // AES-GCM IV (base64)
});

// ============================================================================
// Tags (Flexible labels for torrents: resolution, codec, source, etc.)
// ============================================================================
export const tags = pgTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  color: text('color').default('#6b7280').notNull(), // Tailwind gray-500 default
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const torrentTags = pgTable(
  'torrent_tags',
  {
    torrentId: text('torrent_id')
      .notNull()
      .references(() => torrents.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('torrent_tags_torrent_idx').on(table.torrentId),
    index('torrent_tags_tag_idx').on(table.tagId),
  ]
);

// ============================================================================
// Hit and Run Tracking
// ============================================================================
export const hnrTracking = pgTable(
  'hnr_tracking',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    torrentId: text('torrent_id')
      .notNull()
      .references(() => torrents.id, { onDelete: 'cascade' }),
    downloadedAt: timestamp('downloaded_at').defaultNow().notNull(),
    seedTime: integer('seed_time').default(0).notNull(), // Seconds seeded
    requiredSeedTime: integer('required_seed_time').default(86400).notNull(), // 24h default
    isHnr: boolean('is_hnr').default(false).notNull(),
    isExempt: boolean('is_exempt').default(false).notNull(), // Manual exemption
    completedAt: timestamp('completed_at'), // When requirement was met
  },
  (table) => [
    index('hnr_user_idx').on(table.userId),
    index('hnr_torrent_idx').on(table.torrentId),
    index('hnr_status_idx').on(table.isHnr),
    uniqueIndex('hnr_user_torrent_idx').on(table.userId, table.torrentId),
  ]
);

// ============================================================================
// Invitations
// ============================================================================
export const invitations = pgTable(
  'invitations',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    usedBy: text('used_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    usedAt: timestamp('used_at'),
    expiresAt: timestamp('expires_at'), // Optional expiration
  },
  (table) => [
    index('invitations_created_by_idx').on(table.createdBy),
    index('invitations_code_idx').on(table.code),
  ]
);

// ============================================================================
// Reports
// ============================================================================
export const reports = pgTable(
  'reports',
  {
    id: text('id').primaryKey(),
    reporterId: text('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: text('target_type').notNull(), // 'torrent' | 'user' | 'post' | 'comment'
    targetId: text('target_id').notNull(),
    reason: text('reason').notNull(),
    details: text('details'), // Additional context
    status: text('status').default('pending').notNull(), // pending | resolved | dismissed
    resolvedBy: text('resolved_by').references(() => users.id),
    resolvedAt: timestamp('resolved_at'),
    resolution: text('resolution'), // Action taken
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('reports_reporter_idx').on(table.reporterId),
    index('reports_target_idx').on(table.targetType, table.targetId),
    index('reports_status_idx').on(table.status),
  ]
);

// ============================================================================
// Site Stats (Historical data for charts)
// ============================================================================
export const siteStats = pgTable(
  'site_stats',
  {
    id: text('id').primaryKey(),
    usersCount: integer('users_count').notNull(),
    torrentsCount: integer('torrents_count').notNull(),
    peersCount: integer('peers_count').notNull(),
    seedersCount: integer('seeders_count').notNull(),
    redisMemoryUsage: bigint('redis_memory_usage', {
      mode: 'number',
    }).notNull(),
    dbSize: bigint('db_size', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('site_stats_created_at_idx').on(table.createdAt)]
);

// ============================================================================
// Relations for new tables
// ============================================================================
export const tagsRelations = relations(tags, ({ many }) => ({
  torrentTags: many(torrentTags),
}));

export const torrentTagsRelations = relations(torrentTags, ({ one }) => ({
  torrent: one(torrents, {
    fields: [torrentTags.torrentId],
    references: [torrents.id],
  }),
  tag: one(tags, {
    fields: [torrentTags.tagId],
    references: [tags.id],
  }),
}));

export const hnrTrackingRelations = relations(hnrTracking, ({ one }) => ({
  user: one(users, {
    fields: [hnrTracking.userId],
    references: [users.id],
  }),
  torrent: one(torrents, {
    fields: [hnrTracking.torrentId],
    references: [torrents.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  creator: one(users, {
    fields: [invitations.createdBy],
    references: [users.id],
    relationName: 'invitesCreated',
  }),
  usedByUser: one(users, {
    fields: [invitations.usedBy],
    references: [users.id],
    relationName: 'inviteUsed',
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, {
    fields: [reports.reporterId],
    references: [users.id],
    relationName: 'reportsCreated',
  }),
  resolver: one(users, {
    fields: [reports.resolvedBy],
    references: [users.id],
    relationName: 'reportsResolved',
  }),
}));

// ============================================================================
// Types
// ============================================================================
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type BannedIp = typeof bannedIps.$inferSelect;
export type NewBannedIp = typeof bannedIps.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Torrent = typeof torrents.$inferSelect;
export type NewTorrent = typeof torrents.$inferInsert;
export type TorrentStats = typeof torrentStats.$inferSelect;
export type AnnounceLogEntry = typeof announceLog.$inferSelect;
export type Setting = typeof settings.$inferSelect;

export type ForumCategory = typeof forumCategories.$inferSelect;
export type NewForumCategory = typeof forumCategories.$inferInsert;
export type ForumTopic = typeof forumTopics.$inferSelect;
export type NewForumTopic = typeof forumTopics.$inferInsert;
export type ForumPost = typeof forumPosts.$inferSelect;
export type NewForumPost = typeof forumPosts.$inferInsert;

export type TorrentComment = typeof torrentComments.$inferSelect;
export type NewTorrentComment = typeof torrentComments.$inferInsert;

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type TorrentTag = typeof torrentTags.$inferSelect;
export type NewTorrentTag = typeof torrentTags.$inferInsert;

export type HnrTracking = typeof hnrTracking.$inferSelect;
export type NewHnrTracking = typeof hnrTracking.$inferInsert;

export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;

export type SiteStats = typeof siteStats.$inferSelect;
export type NewSiteStats = typeof siteStats.$inferInsert;

export type PanicState = typeof panicState.$inferSelect;
export type NewPanicState = typeof panicState.$inferInsert;
