# CreamRoute ERP - Authentication & User Management System

## 🎯 Overview

Production-grade authentication and user management system for a private Dairy Distributor ERP.

**Key Principles:**
- ❌ No public registration
- ✅ Distributor creates all accounts
- ✅ Role-based access control (RBAC)
- ✅ Email verification via Resend
- ✅ Tenant-aware architecture (future multi-distributor ready)

---

## 📊 Architecture

### Database Schema

| Table | Purpose |
|-------|---------|
| `distributors` | Tenant table (currently 1 row, future-ready for multi-tenant) |
| `users` | Core authentication (employees + retailers) |
| `login_history` | Audit trail for all login attempts |
| `email_verification_tokens` | Secure email verification tokens (24h expiry) |
| `password_reset_tokens` | Password reset tokens (1h expiry) |
| `permissions` | Master list of 30+ permissions across 8 categories |
| `role_permissions` | RBAC mapping (roles ↔ permissions) |
| `audit_logs` | System audit trail |

### Backend Functions (Supabase Edge Functions)

| Function | Purpose |
|----------|---------|
| `/auth/login` | Email/mobile + password authentication |
| `/auth/create-user` | Distributor creates employees/retailers |
| `/auth/verify-email` | Email verification + password creation |
| `/auth/forgot-password` | Request password reset email |
| `/auth/reset-password` | Complete password reset |

### Frontend Pages

| Page | Route | Purpose |
|------|-------|---------|
| Login | `/auth` | Professional login page |
| Email Verification | `/verify-email` | Verify email + create password |
| Forgot Password | `/forgot-password` | Request password reset |
| Reset Password | `/reset-password` | Complete password reset |
| User Management | `/admin/users` | Create/manage employees & retailers |
| Permission Manager | `/admin/permissions` | Configure role permissions |

---

## 🔐 Security Features

### Authentication
- ✅ Email OR mobile number login
- ✅ Bcrypt password hashing (10 rounds)
- ✅ Account lockout after 5 failed attempts (30 min lock)
- ✅ Session management via localStorage
- ✅ Login history tracking (IP, browser, device, success/failure)

### Authorization
- ✅ Role-Based Access Control (RBAC)
- ✅ 30+ granular permissions across 8 categories
- ✅ Permission checks on every route
- ✅ Backend permission validation
- ✅ Dynamic sidebar based on permissions

### Account Status
- ✅ `pending_verification` - Awaiting email verification
- ✅ `active` - Normal operation
- ✅ `inactive` - Temporarily disabled by admin
- ✅ `suspended` - Policy violation
- ✅ `blocked` - Severe violation

### Email Security
- ✅ Resend integration for email delivery
- ✅ Secure tokens (UUID v4)
- ✅ Token expiration (24h for verification, 1h for reset)
- ✅ Single-use tokens
- ✅ API key stored server-side only

---

## 👥 User Roles

### Employee Roles
| Role | Dashboard | Key Permissions |
|------|-----------|-----------------|
| **Distributor** | `/dashboard` | All permissions |
| **Manager** | `/dashboard` | Most permissions except admin |
| **Accountant** | `/ledger` | Invoices, payments, reports, ledger |
| **Warehouse** | `/inventory` | Inventory, products, dispatch |
| **Salesman** | `/orders` | Orders, invoices, customers, payments |
| **Delivery Boy** | `/deliveries` | Deliveries, dispatch, orders |

### Customer Role
| Role | Dashboard | Key Permissions |
|------|-----------|-----------------|
| **Retailer** | `/retailer/orders` | Place orders, view invoices, ledger, payments |

---

## 📋 Permissions System

### Permission Categories

| Category | Permissions |
|----------|-------------|
| **Orders** | `place_order`, `view_orders`, `edit_orders`, `delete_orders` |
| **Invoices** | `create_invoice`, `view_invoices`, `edit_invoices`, `delete_invoices`, `download_invoice`, `revise_invoice` |
| **Customers** | `view_customers`, `edit_customers`, `delete_customers`, `view_ledger` |
| **Inventory** | `view_inventory`, `edit_inventory`, `view_products`, `edit_products` |
| **Payments** | `record_payment`, `view_payments`, `reconcile_payments` |
| **Deliveries** | `view_deliveries`, `manage_deliveries`, `dispatch_orders` |
| **Reports** | `view_reports`, `export_reports` |
| **Admin** | `manage_users`, `manage_roles`, `view_audit_logs`, `manage_settings`, `manage_branches` |

### Role Permission Mapping (Default)

**Distributor**: All permissions

**Manager**: All except `manage_users`, `manage_roles`, `manage_branches`, `manage_settings`

**Accountant**: 
- ✅ `view_invoices`, `edit_invoices`, `download_invoice`
- ✅ `view_ledger`, `record_payment`, `view_payments`, `reconcile_payments`
- ✅ `view_reports`, `export_reports`
- ✅ `view_orders`, `view_customers`

**Warehouse**:
- ✅ `view_inventory`, `edit_inventory`
- ✅ `view_products`, `edit_products`
- ✅ `view_orders`, `edit_orders`, `dispatch_orders`
- ✅ `view_deliveries`, `manage_deliveries`

**Salesman**:
- ✅ `place_order`, `view_orders`, `edit_orders`
- ✅ `create_invoice`, `view_invoices`, `download_invoice`
- ✅ `view_customers`, `edit_customers`, `view_ledger`
- ✅ `record_payment`, `view_payments`
- ✅ `view_products`, `view_inventory`, `view_deliveries`

**Delivery Boy**:
- ✅ `view_deliveries`, `dispatch_orders`
- ✅ `view_orders`, `view_customers`

**Retailer**:
- ✅ `place_order`, `view_orders`
- ✅ `view_invoices`, `download_invoice`
- ✅ `view_ledger`, `record_payment`

---

## 🚀 Implementation Status

### ✅ Completed

**Phase 1: Database Schema**
- [x] `distributors` table
- [x] `users` table with email/mobile auth
- [x] `login_history` table
- [x] `email_verification_tokens` table
- [x] `password_reset_tokens` table
- [x] `permissions` table (30 permissions)
- [x] `role_permissions` table
- [x] `audit_logs` table
- [x] Auto-generation triggers (RET-XXXXXX, EMP-XXXXXX)
- [x] RLS policies on all tables

**Phase 2: Backend Functions**
- [x] `/auth/login` - Email/mobile login with rate limiting
- [x] `/auth/create-user` - User creation with email invitation
- [x] `/auth/verify-email` - Email verification + password creation
- [x] `/auth/forgot-password` - Password reset email
- [x] `/auth/reset-password` - Complete password reset

**Phase 3: Frontend Pages**
- [x] Professional login page (`/auth`)
- [x] Email verification page (`/verify-email`)
- [x] Forgot password page (`/forgot-password`)
- [x] Reset password page (`/reset-password`)
- [x] User management page (`/admin/users`)
- [x] Route guards with permission checks

**Phase 4: Security**
- [x] Bcrypt password hashing
- [x] Account lockout mechanism
- [x] Login history tracking
- [x] Audit logging
- [x] Token expiration
- [x] Single-use tokens

### 🔄 In Progress

**Phase 5: UI Polish**
- [ ] Password strength indicator
- [ ] Loading states
- [ ] Error handling
- [ ] Success animations

### 📋 Pending

**Phase 6: Advanced Features**
- [ ] Device management (active sessions)
- [ ] Logout from all devices
- [ ] Distributor settings page
- [ ] Email template customization
- [ ] SMS verification (optional)

**Phase 7: Testing**
- [ ] Unit tests for backend functions
- [ ] Integration tests
- [ ] E2E tests for auth flow
- [ ] Security audit

---

## 🔧 Setup Instructions

### 1. Database Migration

Run in Supabase SQL Editor:

```bash
supabase/migrations/20260808000000_core_authentication.sql
```

This will:
- Create all tables
- Seed default distributor
- Seed 30 permissions
- Seed role permissions for all 7 roles
- Enable RLS policies
- Create helper functions

### 2. Environment Variables

Add to Supabase Edge Functions secrets:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RESEND_API_KEY=your_resend_api_key
APP_URL=https://your-app-url.com
```

### 3. Deploy Edge Functions

```bash
supabase functions deploy auth/login
supabase functions deploy auth/create-user
supabase functions deploy auth/verify-email
supabase functions deploy auth/forgot-password
supabase functions deploy auth/reset-password
```

### 4. Frontend Configuration

Update `.env`:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

---

## 📱 User Flows

### Employee Creation Flow

```
Distributor Dashboard
  ↓
Users → Create User
  ↓
Fill form (name, email, role, password)
  ↓
Backend creates user (status: pending_verification)
  ↓
Email sent with verification link
  ↓
Employee clicks link
  ↓
Verify email + create new password
  ↓
Status → active
  ↓
Login → Role-based dashboard
```

### Retailer Creation Flow

```
Distributor Dashboard
  ↓
Users → Create User → Role: Retailer
  ↓
Fill form (shop name, owner name, email, mobile)
  ↓
Backend creates retailer (status: pending_verification)
  ↓
Generates RET-XXXXXX code automatically
  ↓
Email sent with verification link
  ↓
Retailer clicks link
  ↓
Verify email + create password
  ↓
Status → active
  ↓
Login → Retailer portal
```

### Login Flow

```
User enters email/mobile + password
  ↓
Backend validates credentials
  ↓
Check account status
  ↓
Check failed login attempts
  ↓
If valid:
  - Reset failed attempts
  - Create login history record
  - Return user data + permissions
  - Store in localStorage
  - Redirect to role-based dashboard
  ↓
If invalid:
  - Increment failed attempts
  - Lock account if ≥ 5 attempts
  - Return error message
```

### Password Reset Flow

```
User clicks "Forgot Password"
  ↓
Enters email address
  ↓
Backend generates reset token (1h expiry)
  ↓
Resend sends reset email
  ↓
User clicks reset link
  ↓
Enters new password
  ↓
Backend validates token
  ↓
Hashes new password
  ↓
Marks token as used
  ↓
Redirect to login
```

---

## 🎨 UI/UX Design

### Login Page
- Clean, minimal design
- Blue gradient background
- Email OR mobile login
- Password visibility toggle
- Professional error states
- Loading animations

### Email Verification
- Success/error icons
- Password strength indicator (4 levels)
- Clear instructions
- Auto-redirect after success

### User Management
- Table view with all users
- Status badges (color-coded)
- Role icons
- Create user dialog
- Filter/search capability

---

## 🔒 Security Best Practices

### Password Security
- ✅ Bcrypt hashing (10 rounds)
- ✅ Minimum 8 characters
- ✅ Strength indicator
- ✅ Never stored in plain text
- ✅ Never exposed in API responses

### Token Security
- ✅ UUID v4 tokens
- ✅ Expiration times (24h/1h)
- ✅ Single-use (marked as used)
- ✅ Stored hashed in database
- ✅ Server-side validation only

### Session Security
- ✅ localStorage with expiry check
- ✅ Account status verification on every route
- ✅ Permission checks on every route
- ✅ Login history tracking
- ✅ Audit logging

### API Security
- ✅ CORS headers
- ✅ API key validation
- ✅ Service role key for sensitive operations
- ✅ Input validation
- ✅ Error messages don't reveal sensitive info

---

## 📈 Future Enhancements

### Multi-Distributor Support
- [ ] Distributor registration
- [ ] Subscription plans
- [ ] Billing system
- [ ] Platform owner dashboard

### Advanced Security
- [ ] Two-factor authentication (2FA)
- [ ] Biometric login (mobile)
- [ ] IP whitelisting
- [ ] Device fingerprinting

### User Experience
- [ ] Social login (Google, Microsoft)
- [ ] Remember me functionality
- [ ] Auto-logout on inactivity
- [ ] Session management UI

### Analytics
- [ ] Login analytics dashboard
- [ ] User activity reports
- [ ] Security alerts
- [ ] Audit log viewer

---

##  Known Issues

None at this time.

---

## 📞 Support

For issues or questions:
- Check Supabase logs for backend errors
- Check browser console for frontend errors
- Review audit_logs table for security events
- Review login_history table for login issues

---

## 📄 License

Private - CreamRoute ERP © 2026
