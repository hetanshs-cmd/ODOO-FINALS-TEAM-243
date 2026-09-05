import { z } from 'zod';

export const createProductCategorySchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().max(2000).optional().nullable(),
  // DB also enforces parent_category_id <> id (a category can't parent itself).
  parent_category_id: z.string().uuid().optional().nullable(),
});

export const updateProductCategorySchema = createProductCategorySchema.partial();
