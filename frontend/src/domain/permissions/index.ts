/**
 * DealFlow360 — Role-Based Access Control (RBAC) & Governance Security Engine
 * Enforces business-layer action authorization beyond cosmetic UI hiding.
 */

import { User, UserRole, Quotation } from '../../types';

export type ActionType =
  | 'create_quotation'
  | 'edit_quotation'
  | 'submit_quotation'
  | 'approve_quotation'
  | 'reject_quotation'
  | 'return_quotation'
  | 'modify_admin_config'
  | 'manage_fulfillment'
  | 'override_warehouse'
  | 'record_payment'
  | 'modify_subscription'
  | 'cancel_subscription'
  | 'submit_customer_negotiation'
  | 'confirm_customer_order'
  | 'view_reports'
  | 'export_reports';

export function canUserPerformAction(
  user: User,
  action: ActionType,
  resource?: { quotation?: Quotation; targetRole?: string }
): { allowed: boolean; reason?: string } {
  const role = user.role.toLowerCase();

  // 1. Customer restrictions
  if (role === 'customer') {
    if (action === 'submit_customer_negotiation' || action === 'confirm_customer_order') {
      return { allowed: true };
    }
    if (action === 'view_reports' || action === 'export_reports') {
      return {
        allowed: false,
        reason: 'Customer portal accounts are strictly forbidden from viewing executive and commercial reports.',
      };
    }
    return {
      allowed: false,
      reason: 'Customer portal accounts are strictly limited to negotiation and order confirmation.',
    };
  }

  // 2. Admin has full administrative and oversight capabilities
  if (role === 'admin') {
    return { allowed: true };
  }

  // 3. Sales Representative capabilities & constraints
  if (role === 'sales_rep' || role === 'salesrep') {
    if (
      action === 'approve_quotation' ||
      action === 'reject_quotation' ||
      action === 'return_quotation'
    ) {
      return {
        allowed: false,
        reason: 'Sales Representatives are forbidden from approving their own quotations.',
      };
    }
    if (action === 'modify_admin_config') {
      return {
        allowed: false,
        reason: 'Access to system governance settings requires Administrator role.',
      };
    }
    if (action === 'manage_fulfillment' || action === 'override_warehouse') {
      return {
        allowed: false,
        reason: 'Warehouse fulfillment modifications require Operations, Finance, or Admin authorization.',
      };
    }
    if (action === 'modify_subscription' || action === 'cancel_subscription') {
      return {
        allowed: false,
        reason: 'Subscription modifications and cancellations require Finance, Operations, or Admin authorization.',
      };
    }
    if (action === 'record_payment') {
      return {
        allowed: false,
        reason: 'Payment recording and cash ledger adjustments are strictly reserved for Finance, Operations, and Administration.',
      };
    }
    return { allowed: true };
  }

  // 4. Sales Manager capabilities
  if (role === 'sales_manager' || role === 'salesmanager') {
    if (action === 'approve_quotation' || action === 'reject_quotation' || action === 'return_quotation') {
      if (resource?.quotation) {
        const q = resource.quotation;
        const currentStepRole = q.requiredApprovers?.[q.currentApprovalStep - 1] || q.assignedApproverRole;
        if (currentStepRole) {
          const normCurrentRole = currentStepRole.toLowerCase().replace('_', '');
          if (normCurrentRole !== 'salesmanager') {
            return {
              allowed: false,
              reason: `Current approval step requires ${currentStepRole === 'finance' ? 'Finance' : currentStepRole} review, not Sales Manager.`,
            };
          }
        }
      }
      return { allowed: true };
    }
    if (action === 'modify_subscription' || action === 'cancel_subscription') {
      return {
        allowed: false,
        reason: 'Subscription contractual changes require Finance or Operations execution.',
      };
    }
    if (action === 'modify_admin_config') {
      return { allowed: true }; // Allowed to configure discount rules
    }
    return { allowed: true };
  }

  // 5. Finance capabilities
  if (role === 'finance') {
    if (action === 'approve_quotation' || action === 'reject_quotation' || action === 'return_quotation') {
      if (resource?.quotation) {
        const q = resource.quotation;
        const currentStepRole = q.requiredApprovers?.[q.currentApprovalStep - 1] || q.assignedApproverRole;
        if (currentStepRole) {
          const normCurrentRole = currentStepRole.toLowerCase().replace('_', '');
          if (normCurrentRole !== 'finance') {
            return {
              allowed: false,
              reason: `Current approval step requires ${currentStepRole === 'sales_manager' ? 'Sales Manager' : currentStepRole} review before Finance can act.`,
            };
          }
        }
      }
      return { allowed: true };
    }
    if (action === 'record_payment' || action === 'modify_subscription' || action === 'cancel_subscription') {
      return { allowed: true };
    }
    if (action === 'modify_admin_config') {
      return { allowed: true };
    }
    return { allowed: true };
  }

  // 6. Operations capabilities
  if (role === 'operations') {
    if (
      action === 'manage_fulfillment' ||
      action === 'override_warehouse' ||
      action === 'modify_subscription' ||
      action === 'cancel_subscription'
    ) {
      return { allowed: true };
    }
    if (action === 'approve_quotation') {
      return {
        allowed: false,
        reason: 'Commercial deal approvals are reserved for Sales Management and Finance.',
      };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: `Action "${action}" is not permitted for role "${user.role}".` };
}
