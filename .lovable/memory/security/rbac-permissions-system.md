# Memory: security/rbac-permissions-system
Updated: now

The platform implements a comprehensive Role-Based Access Control (RBAC) system for multi-tenant, organization-specific authorization:

## Database Architecture

### Core Tables
- `permissions`: Stores granular permission codes (GL_READ, GL_POST, INVOICE_CREATE, etc.) with categories
- `role_permissions`: Maps organization roles to permissions (org_role → permission_id)
- `audit_logs`: Tracks all administrative actions (user invites, role changes, removals) with old/new values

### Organization Roles (in organization_members.role)
- `owner`: Full access to all features and settings
- `admin`: Near-full access (except USER_MANAGE)
- `finance_manager`: Full financial access (GL, invoicing, bills, payroll, budgets)
- `accountant`: GL access, reports, invoicing, bills (no approvals)
- `payroll_officer`: Payroll-focused access
- `auditor`: Read-only access across all modules
- `member`: Basic read access

### Permission Categories
- general_ledger: GL_READ, GL_POST, GL_VOID
- reports: FINANCIAL_REPORT_VIEW, FINANCIAL_REPORT_EXPORT, COMPILATION_CREATE
- budgets: BUDGET_VIEW, BUDGET_EDIT, BUDGET_APPROVE
- receivables: INVOICE_VIEW, INVOICE_CREATE, INVOICE_VOID, PAYMENT_RECEIVE
- payables: BILL_VIEW, BILL_CREATE, BILL_APPROVE, PAYMENT_MAKE
- banking: BANK_VIEW, BANK_RECONCILE, BANK_TRANSFER
- payroll: PAYROLL_VIEW, PAYROLL_PROCESS, PAYROLL_APPROVE
- assets: ASSET_VIEW, ASSET_MANAGE, DEPRECIATION_RUN
- users: USER_VIEW, USER_INVITE, USER_MANAGE
- settings: SETTINGS_VIEW, SETTINGS_EDIT
- inventory: INVENTORY_VIEW, INVENTORY_MANAGE
- documents: DOCUMENT_VIEW, DOCUMENT_UPLOAD

## Backend Functions
- `has_org_permission(user_id, org_id, permission_code)`: Check if user has specific permission
- `get_user_org_permissions(user_id, org_id)`: Get all permissions for a user in an org
- `log_audit_event(org_id, action, entity_type, entity_id, old_values, new_values)`: Log audit trail

## Frontend Implementation
- `usePermissions()`: React hook for permission checking
- `useAuditLog()`: React hook for logging events
- `PermissionGate`: Component wrapper for conditional rendering based on permissions

## Usage Example
```tsx
const { hasPermission } = usePermissions();
if (hasPermission('GL_POST')) {
  // Show post journal button
}

<PermissionGate permission="INVOICE_CREATE">
  <CreateInvoiceButton />
</PermissionGate>
```
