# Testing Guide for Invoice Revision & Cash Reconciliation

## ️ Important: Run Migrations First!

Before testing, you MUST run these two SQL migrations in Supabase:

### Step 1: Run Invoice Revisions Migration
1. Open Supabase Dashboard → SQL Editor
2. Open file: `supabase/migrations/20260725130000_invoice_revisions.sql`
3. Copy entire contents
4. Paste into SQL Editor
5. Click "Run"
6. Verify success message

### Step 2: Run Cash Reconciliation Migration
1. Open Supabase Dashboard → SQL Editor
2. Open file: `supabase/migrations/20260725140000_driver_cash_reconciliation.sql`
3. Copy entire contents
4. Paste into SQL Editor
5. Click "Run"
6. Verify success message

---

## 🧪 Test 1: Invoice Revision System

### Setup
1. Open your Lovable preview
2. Go to **Invoices** page
3. Find any **unpaid** invoice (or create a test invoice)

### Test Steps
1. **Open the invoice** by clicking on it
2. **Look for the "Revise Invoice" button** in the action bar (next to "Edit items")
3. **Click "Revise Invoice"**
4. **Dialog should open** showing:
   - All invoice items with quantities
   - +/- buttons for each item
   - Reason text field at top
   - Live totals showing difference

5. **Make changes:**
   - Change quantity of first item (e.g., 10 → 8)
   - Notice the "Difference" column shows red "-2"
   - Enter reason: "Test revision - retailer refused 2 units"

6. **Click "Revise Invoice"** button
7. **Verify:**
   - Success toast: "Invoice revised! New invoice: INV-XXX-R1"
   - Original invoice now shows "Revised" status
   - New invoice created with "-R1" suffix

8. **Scroll down** to see "Revision History" section
9. **Verify timeline shows:**
   - Rev #1 with your reason
   - Changes list showing what changed
   - Original total → Revised total → Difference

10. **Click "Share"** button on the revised invoice
11. **Send via WhatsApp** to test PDF generation

### Expected Results
✅ New invoice created with revision number
✅ Original marked as superseded
✅ Full history preserved
✅ PDF shows revised quantities

---

##  Test 2: Cash Reconciliation

### Setup
1. Make sure you have **unpaid invoices** for today's date
2. Or create test invoices with today's date and status "unpaid"

### Test Steps
1. Go to **Sales → Cash Reconciliation** in sidebar
2. **Page should load** showing:
   - Driver name input
   - Delivery date picker (default: today)
   - Search box
   - 3 summary cards (Expected, Collected, Mismatch)
   - Two panels: Unpaid Invoices (left), Collected Cash (right)

3. **Enter driver name:** "Test Driver"

4. **Look at left panel** - should show unpaid invoices for selected date

5. **Click "Add"** on 2-3 invoices
6. **Verify:**
   - Invoices move to right panel
   - "Collected" total updates
   - "Expected" stays same

7. **Adjust amounts** using +/- buttons:
   - Reduce one invoice amount by ₹100
   - Notice "Mismatch" shows negative (short)

8. **Click "Save Reconciliation"**
9. **Verify:**
   - Success toast with collection number
   - If balanced: "Collection COL-XXX saved! Balanced"
   - If mismatch: "Collection COL-XXX saved! Mismatch: ₹XXX"

10. **Go back to Invoices page**
11. **Check the invoices** you allocated:
    - Should now show "Paid" status
    - Balance should be 0

### Expected Results
✅ Can add/remove allocations
✅ Totals update in real-time
✅ Mismatch detection works
✅ Invoices auto-marked as paid
✅ Collection record saved

---

## 🐛 Common Issues & Fixes

### Issue: "Revise Invoice" button not visible
**Cause:** Invoice is already void or being edited
**Fix:** Make sure invoice status is "unpaid" or "partial", not "void"

### Issue: Migration fails with "relation already exists"
**Cause:** Tables already created
**Fix:** This is OK - migration uses "IF NOT EXISTS" so it's safe to run again

### Issue: Cash reconciliation shows no invoices
**Cause:** No unpaid invoices for selected date
**Fix:** 
1. Check the delivery date picker
2. Create test invoices with today's date
3. Make sure invoices have balance > 0

### Issue: "Failed to reconcile" error
**Cause:** Database permissions or missing tables
**Fix:** 
1. Verify migrations ran successfully
2. Check Supabase logs for detailed error
3. Ensure RLS policies are enabled

---

## ✅ Test Checklist

### Invoice Revision
- [ ] "Revise Invoice" button appears
- [ ] Dialog opens with items
- [ ] Can adjust quantities
- [ ] Live preview shows difference
- [ ] Reason field is required
- [ ] New invoice created with -R1
- [ ] Original marked as revised
- [ ] History timeline shows
- [ ] Can share revised invoice

### Cash Reconciliation
- [ ] Page loads without errors
- [ ] Unpaid invoices show for date
- [ ] Can add allocations
- [ ] Can remove allocations
- [ ] Can adjust amounts
- [ ] Totals update correctly
- [ ] Mismatch detection works
- [ ] Save creates collection
- [ ] Invoices marked as paid
- [ ] Can reconcile with mismatch

---

## 📸 Report Issues

If you find any bugs, share:
1. **Screenshot** of the error
2. **Steps to reproduce**
3. **Browser console errors** (F12 → Console tab)
4. **What you expected** vs **what happened**

---

##  Success Criteria

Both features are working if:
- ✅ Invoice revision creates new invoice with history
- ✅ Cash reconciliation marks invoices as paid
- ✅ No errors in browser console
- ✅ All database tables exist
- ✅ RLS policies allow operations

---

**Once you've tested, report back with:**
1. What worked ✅
2. What didn't work ❌
3. Any bugs or issues 🐛

Then we'll fix any issues and move to Priority #3 (Sudha Challan Entry)!
