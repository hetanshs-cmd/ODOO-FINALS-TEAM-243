import { z } from 'zod';

export const idParamSchema = z.object({ id: z.string().uuid('id must be a valid UUID') });
