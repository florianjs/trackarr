import { z } from 'zod';
import { READ_ACCESS, WRITE_ACCESS } from './shoutboxRules';

/** Admin channel editor payload */
export const channelSchema = z.object({
  name: z.string().trim().min(1).max(40),
  description: z.string().trim().max(200).nullable().optional(),
  position: z.number().int().min(0).max(1000).default(0),
  readAccess: z.enum(READ_ACCESS),
  roleIds: z.array(z.string().min(1).max(64)).max(50).default([]),
  writeAccess: z.enum(WRITE_ACCESS),
  reactionsEnabled: z.boolean().default(true),
});

export type ChannelInput = z.infer<typeof channelSchema>;
