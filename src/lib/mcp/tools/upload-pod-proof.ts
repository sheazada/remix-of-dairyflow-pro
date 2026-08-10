import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireRole } from "./_roles";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"]);
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

export default defineTool({
  name: "upload_pod_proof",
  title: "Upload proof of delivery (POD)",
  description:
    "Upload a POD photo/PDF for a delivery stop into the private 'pod' bucket and save its path on the delivery. Accepts a base64-encoded file up to 8 MB. Use list_pending_deliveries to find the delivery id.",
  inputSchema: {
    delivery_id: z.string().uuid().describe("Delivery id from list_pending_deliveries."),
    content_base64: z.string().describe("File bytes, base64-encoded (no data: prefix)."),
    content_type: z
      .string()
      .describe("MIME type: image/jpeg, image/png, image/webp, image/heic, or application/pdf."),
    signature_note: z.string().optional().describe("Optional signature name/note to store alongside the POD."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ delivery_id, content_base64, content_type, signature_note }, ctx) => {
    const denied = await requireRole(ctx, "upload_pod_proof");
    if (denied) return denied;

    if (!ALLOWED.has(content_type)) {
      return {
        content: [{ type: "text", text: `Unsupported content_type "${content_type}". Allowed: ${[...ALLOWED].join(", ")}.` }],
        isError: true,
      };
    }

    let bytes: Buffer;
    try {
      bytes = Buffer.from(content_base64.replace(/^data:[^;]+;base64,/, ""), "base64");
    } catch {
      return { content: [{ type: "text", text: "content_base64 is not valid base64." }], isError: true };
    }
    if (bytes.byteLength === 0) {
      return { content: [{ type: "text", text: "content_base64 decoded to 0 bytes." }], isError: true };
    }
    if (bytes.byteLength > MAX_BYTES) {
      return {
        content: [{ type: "text", text: `File too large: ${bytes.byteLength} bytes. Max ${MAX_BYTES}.` }],
        isError: true,
      };
    }

    const client = sb(ctx);
    const { data: d, error: dErr } = await client
      .from("deliveries")
      .select("id, invoice_id")
      .eq("id", delivery_id)
      .maybeSingle();
    if (dErr) return { content: [{ type: "text", text: dErr.message }], isError: true };
    if (!d) return { content: [{ type: "text", text: `No delivery found with id ${delivery_id}` }], isError: true };

    const folder = d.invoice_id ?? delivery_id;
    const ext = EXT[content_type] ?? "bin";
    const path = `${folder}/${Date.now()}-mcp.${ext}`;

    const up = await client.storage.from("pod").upload(path, bytes, {
      upsert: true,
      contentType: content_type,
    });
    if (up.error) {
      return { content: [{ type: "text", text: `Storage upload failed: ${up.error.message}` }], isError: true };
    }

    const update: Record<string, unknown> = { pod_photo_url: path };
    if (signature_note) update.pod_signature = signature_note;
    const { error: uErr } = await client.from("deliveries").update(update).eq("id", delivery_id);
    if (uErr) return { content: [{ type: "text", text: `Delivery update failed: ${uErr.message}` }], isError: true };

    return {
      content: [{ type: "text", text: `POD uploaded for delivery ${delivery_id} (${bytes.byteLength} bytes) at ${path}.` }],
      structuredContent: { delivery_id, pod_path: path, bucket: "pod", size_bytes: bytes.byteLength },
    };
  },
});
