import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCustomers from "./tools/list-customers";
import listProducts from "./tools/list-products";
import recentInvoices from "./tools/recent-invoices";
import dailyDemand from "./tools/daily-demand";
import pendingDeliveries from "./tools/pending-deliveries";
import markDeliveryCollected from "./tools/mark-delivery-collected";
import uploadPodProof from "./tools/upload-pod-proof";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "dairy-erp-mcp",
  title: "Dairy Distribution ERP",
  version: "0.1.0",
  instructions:
    "Tools for the dairy distribution ERP. Every call runs as the signed-in user and is filtered by role. Read tools: list customers, products, recent invoices, daily pickup demand, pending deliveries. Field tools: mark_delivery_collected updates a stop's status/receiver and optionally records a payment; upload_pod_proof stores a base64 POD photo/PDF in the private 'pod' bucket and links it to the delivery. Admin & manager can use everything; salesperson can list customers/products/invoices/demand; driver & helper can list customers/products/demand/pending deliveries and mark stops collected with POD. Not-allowed calls return a friendly error listing the roles that may use the tool.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCustomers, listProducts, recentInvoices, dailyDemand, pendingDeliveries, markDeliveryCollected, uploadPodProof],
});
