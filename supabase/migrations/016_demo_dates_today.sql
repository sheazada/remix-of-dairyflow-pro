-- Keep the demand-consolidation demo visible "today".
-- (Earlier partial runs of 015 stamped rows with the run-day's date;
--  re-date them to CURRENT_DATE so today's Pickup/Delivery-Demand pages show data.)

UPDATE public.orders
   SET order_date = CURRENT_DATE
 WHERE id IN (
   'd1000000-0000-4000-8000-000000000d11',
   'd1000000-0000-4000-8000-000000000d12',
   'd1000000-0000-4000-8000-000000000d13',
   'd1000000-0000-4000-8000-000000000d14'
 );

UPDATE public.delivery_cycles
   SET order_date = CURRENT_DATE, delivery_date = CURRENT_DATE
 WHERE id = 'd1000000-0000-4000-8000-000000000dc1';

UPDATE public.demand_consolidations
   SET consolidation_date = CURRENT_DATE
 WHERE id = 'd1000000-0000-4000-8000-000000000db1';
