import { z } from 'zod';
import {
  createCrudController,
  createCrudRepository,
  createCrudRouter,
  createCrudService,
} from '../../shared/crud';

export interface ApprovalLevel {
  id: string;
  name: string;
  level: number;
  description: string | null;
  /** roles.name of the staff role that may action a request at this level. */
  required_role: string;
  created_at: string;
  updated_at: string;
}

const APPROVAL_ROLES = ['SALES_MANAGER', 'FINANCE', 'OPERATIONS', 'ADMIN'] as const;

export const createApprovalLevelSchema = z.object({
  name: z.string().trim().min(1).max(100),
  level: z.coerce.number().int().min(1),
  description: z.string().max(2000).optional().nullable(),
  required_role: z.enum(APPROVAL_ROLES).optional(),
});

export const updateApprovalLevelSchema = createApprovalLevelSchema.partial();

const COLUMNS = ['name', 'level', 'description', 'required_role'] as const;

const repository = createCrudRepository<ApprovalLevel>({
  table: 'approval_levels',
  columns: COLUMNS,
});

const service = createCrudService(repository, {
  resourceName: 'Approval level',
  entityType: 'approval_level',
});

const controller = createCrudController(service, 'Approval level');

export const approvalLevelsRouter = createCrudRouter({
  controller,
  createSchema: createApprovalLevelSchema,
  updateSchema: updateApprovalLevelSchema,
});
