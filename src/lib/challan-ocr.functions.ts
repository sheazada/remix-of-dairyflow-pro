import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole, SALES_ROLES } from "@/lib/authz";
import { z } from "zod";

const InputSchema = z.object({
  fileDataUrl: z.string().min(20), // data:image/...;base64,... OR data:application/pdf;base64,...
});

export type ChallanExtractionItem = {
  product_name: string;
  hsn: string | null;
  quantity: number;
  unit: string | null;
  rate: number;
  gst_rate: number;
  amount: number;
};

export type ChallanExtraction = {
  challan_no: string | null;
  challan_date: string | null; // ISO date
  supplier_name: string | null;
  supplier_gstin: string | null;
  items: ChallanExtractionItem[];
  subtotal: number;
  gst: number;
  total: number;
  notes: string | null;
};

const EXTRACTION_PROMPT = `You are an OCR + data-extraction engine for Indian dairy/FMCG supplier challans and invoices (e.g. Sudha Dairy delivery challans).

Extract every field you can read from the attached challan image or PDF and return STRICT JSON that matches this TypeScript type:

{
  "challan_no": string | null,          // Challan / Invoice / Bill number
  "challan_date": string | null,        // ISO date YYYY-MM-DD
  "supplier_name": string | null,       // e.g. "Sudha Dairy" / "Bihar State Milk Co-op"
  "supplier_gstin": string | null,
  "items": [
    {
      "product_name": string,           // e.g. "Sudha Toned Milk 500ml"
      "hsn": string | null,
      "quantity": number,               // numeric quantity
      "unit": string | null,            // "pcs" | "ltr" | "kg" | "crate" | "pkt"
      "rate": number,                   // per-unit rate excluding GST if visible; else the printed rate
      "gst_rate": number,               // GST percent (0, 5, 12, 18, 28). If not printed, use 5 for dairy.
      "amount": number                  // line total (qty * rate), before GST
    }
  ],
  "subtotal": number,                   // sum of item amounts (pre-GST)
  "gst": number,                        // total GST
  "total": number,                      // grand total
  "notes": string | null                // vehicle no, driver, route, remarks — anything useful
}

Rules:
- Return ONLY the JSON object. No prose, no markdown fences.
- Use null for anything you truly cannot read. Never invent values.
- Numbers must be plain numbers (no commas, no currency symbols).
- If the challan lists case/crate + loose units, keep one row per printed line.`;

export const extractChallan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<ChallanExtraction> => {
    // Paid AI endpoint — staff only, never any signed-in account.
    await requireRole(context.supabase, context.userId, SALES_ROLES);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const isPdf = data.fileDataUrl.startsWith("data:application/pdf");
    const contentBlocks = isPdf
      ? [
          { type: "text", text: EXTRACTION_PROMPT },
          {
            type: "file",
            file: {
              filename: "challan.pdf",
              file_data: data.fileDataUrl,
            },
          },
        ]
      : [
          { type: "text", text: EXTRACTION_PROMPT },
          { type: "image_url", image_url: { url: data.fileDataUrl } },
        ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [{ role: "user", content: contentBlocks }],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please top up in Settings → Plans & credits.");
      throw new Error(`OCR failed (${res.status}): ${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? "";
    let parsed: ChallanExtraction;
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Could not parse extraction. Please retry with a clearer image.");
    }

    // Normalize + defensive defaults
    parsed.items = Array.isArray(parsed.items) ? parsed.items : [];
    parsed.items = parsed.items.map((it) => ({
      product_name: String(it.product_name ?? "").trim(),
      hsn: it.hsn ? String(it.hsn) : null,
      quantity: Number(it.quantity) || 0,
      unit: it.unit ? String(it.unit) : null,
      rate: Number(it.rate) || 0,
      gst_rate: Number(it.gst_rate ?? 5) || 0,
      amount: Number(it.amount) || Number(it.quantity) * Number(it.rate) || 0,
    }));
    parsed.subtotal = Number(parsed.subtotal) || parsed.items.reduce((s, i) => s + i.amount, 0);
    parsed.gst = Number(parsed.gst) || parsed.items.reduce((s, i) => s + (i.amount * i.gst_rate) / 100, 0);
    parsed.total = Number(parsed.total) || parsed.subtotal + parsed.gst;
    return parsed;
  });
