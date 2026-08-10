// Dynamic Permission Types
// Defines all available permissions and helper functions

export type PermissionCategory =
  | 'orders'
  | 'invoices'
  | 'customers'
  | 'inventory'
  | 'payments'
  | 'deliveries'
  | 'reports'
  | 'admin'
  | 'general';

export interface Permission {
  id: string;
  name: string;
  label: string;
  description?: string;
  category: PermissionCategory;
}

export interface RolePermission {
  id: string;
  role: string;
  permission_id: string;
  permission?: Permission;
}

// All available permission names (for type-safe checks)
export const PERMISSION_NAMES = {
  // Orders
  PLACE_ORDER: 'place_order',
  VIEW_ORDERS: 'view_orders',
  EDIT_ORDERS: 'edit_orders',
  DELETE_ORDERS: 'delete_orders',

  // Invoices
  CREATE_INVOICE: 'create_invoice',
  VIEW_INVOICES: 'view_invoices',
  EDIT_INVOICES: 'edit_invoices',
  DELETE_INVOICES: 'delete_invoices',
  DOWNLOAD_INVOICE: 'download_invoice',
  REVISE_INVOICE: 'revise_invoice',

  // Customers
  VIEW_CUSTOMERS: 'view_customers',
  EDIT_CUSTOMERS: 'edit_customers',
  DELETE_CUSTOMERS: 'delete_customers',
  VIEW_LEDGER: 'view_ledger',

  // Inventory
  VIEW_INVENTORY: 'view_inventory',
  EDIT_INVENTORY: 'edit_inventory',
  VIEW_PRODUCTS: 'view_products',
  EDIT_PRODUCTS: 'edit_products',

  // Payments
  RECORD_PAYMENT: 'record_payment',
  VIEW_PAYMENTS: 'view_payments',
  RECONCILE_PAYMENTS: 'reconcile_payments',

  // Deliveries
  VIEW_DELIVERIES: 'view_deliveries',
  MANAGE_DELIVERIES: 'manage_deliveries',

  // Reports
  VIEW_REPORTS: 'view_reports',
  EXPORT_REPORTS: 'export_reports',

  // Admin
  MANAGE_USERS: 'manage_users',
  MANAGE_ROLES: 'manage_roles',
  VIEW_AUDIT_LOGS: 'view_audit_logs',
  MANAGE_SETTINGS: 'manage_settings',
  MANAGE_BRANCHES: 'manage_branches',
} as const;

export type PermissionName = typeof PERMISSION_NAMES[keyof typeof PERMISSION_NAMES];

// Categories for UI grouping
export const PERMISSION_CATEGORIES: { name: PermissionCategory; label: string; icon: string }[] = [
  { name: 'orders', label: 'Orders', icon: 'ShoppingCart' },
  { name: 'invoices', label: 'Invoices', icon: 'ReceiptText' },
  { name: 'customers', label: 'Customers', icon: 'Users' },
  { name: 'inventory', label: 'Inventory', icon: 'Package' },
  { name: 'payments', label: 'Payments', icon: 'Wallet' },
  { name: 'deliveries', label: 'Deliveries', icon: 'Truck' },
  { name: 'reports', label: 'Reports', icon: 'BarChart3' },
  { name: 'admin', label: 'Admin', icon: 'Shield' },
  { name: 'general', label: 'General', icon: 'Settings' },
];
