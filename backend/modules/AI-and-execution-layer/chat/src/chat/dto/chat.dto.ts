import { z } from 'zod';

export const createConversationSchema = z.object({
  title: z.string().min(1).optional(),
  mode: z.enum(['chat', 'agent']).optional(),
});
export type CreateConversationDto = z.infer<typeof createConversationSchema>;

export const postMessageSchema = z.object({
  content: z.string().min(1),
});
export type PostMessageDto = z.infer<typeof postMessageSchema>;
