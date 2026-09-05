import { z } from 'zod';
import {
  createCrudController,
  createCrudRepository,
  createCrudRouter,
  createCrudService,
} from '../../shared/crud';

// priority, sales_role, min_discount, approval_required, and approval_level
// are writable here but reserved/unused by the evaluation engine
// (discountEngine.ts only reads maxDiscount + scope) — a deliberate decision
// to keep the column set future-proof, not an oversight.
export interface DiscountRule {
  id: string;
  name: string;
  priority: number;
  product_id: string | null;
  category_id: string | null;
  customer_tier_id: string | null;
  sales_role: string | null;
  min_discount: string;
  max_discount: string;
  approval_required: boolean;
  approval_level: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// Scope fields (product_id/category_id/customer_tier_id) are all optional —
// a rule may be scoped at any single level, or be global when all three are
// omitted. See database/schema/er-diagram.md § Discount Engine.
const scopeFields = {
  product_id: z.string().uuid().optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  customer_tier_id: z.string().uuid().optional().nullable(),
  sales_role: z.string().trim().max(50).optional().nullable(),
};

export const createDiscountRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    priority: z.coerce.number().int().min(0).optional(),
    ...scopeFields,
    min_discount: z.coerce.number().min(0).max(100),
    max_discount: z.coerce.number().min(0).max(100),
    approval_required: z.coerce.boolean().optional(),
    approval_level: z.coerce.number().int().optional().nullable(),
    active: z.coerce.boolean().optional(),
  })
  .refine((data) => data.max_discount >= data.min_discount, {
    message: 'max_discount must be >= min_discount',
    path: ['max_discount'],
  });

// Partial update: min/max ordering across a partial update is still enforced
// by the DB CHECK constraint (chk_discount_rules_range).
export const updateDiscountRuleSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  priority: z.coerce.number().int().min(0).optional(),
  ...scopeFields,
  min_discount: z.coerce.number().min(0).max(100).optional(),
  max_discount: z.coerce.number().min(0).max(100).optional(),
  approval_required: z.coerce.boolean().optional(),
  approval_level: z.coerce.number().int().optional().nullable(),
  active: z.coerce.boolean().optional(),
});

const COLUMNS = [
  'name',
  'priority',
  'product_id',
  'category_id',
  'customer_tier_id',
  'sales_role',
  'min_discount',
  'max_discount',
  'approval_required',
  'approval_level',
  'active',
] as const;

const repository = createCrudRepository<DiscountRule>({
  table: 'discount_rules',
  columns: COLUMNS,
});

const service = createCrudService(repository, {
  resourceName: 'Discount rule',
  entityType: 'discount_rule',
});

const controller = createCrudController(service, 'Discount rule');

export const discountRulesRouter = createCrudRouter({
  controller,
  createSchema: createDiscountRuleSchema,
  updateSchema: updateDiscountRuleSchema,
});
