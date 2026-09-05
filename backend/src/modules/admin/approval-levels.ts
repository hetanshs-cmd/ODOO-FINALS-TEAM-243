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
  created_at: string;
  updated_at: string;
}

export const createApprovalLevelSchema = z.object({
  name: z.string().trim().min(1).max(100),
  level: z.coerce.number().int().min(1),
  description: z.string().max(2000).optional().nullable(),
});

export const updateApprovalLevelSchema = createApprovalLevelSchema.partial();

const COLUMNS = ['name', 'level', 'description'] as const;

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
