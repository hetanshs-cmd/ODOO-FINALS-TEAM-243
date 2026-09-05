import { createCrudController, createCrudRepository, createCrudRouter, createCrudService } from '../../../shared/crud';
import { ApprovalLevel } from './approval-levels.model';
import { createApprovalLevelSchema, updateApprovalLevelSchema } from './approval-levels.validator';

const COLUMNS = ['name', 'level', 'description'] as const;

const repository = createCrudRepository<ApprovalLevel>({ table: 'approval_levels', columns: COLUMNS });

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
