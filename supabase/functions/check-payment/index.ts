import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractMpesaCode(input: string): string {
  const cleanInput = (input || "").trim().toUpperCase();
  if (!cleanInput) return "";

  if (/^[A-Z0-9]{8,12}$/.test(cleanInput)) return cleanInput;

  const patterns = [
    /\b([A-Z]{2,4}[A-Z0-9]{6,10})\b/,
    /transaction\s+([A-Z0-9]{8,12})/i,
    /code\s*:?\s*([A-Z0-9]{8,12})/i,
    /\b([A-Z][A-Z0-9]{8,11})\b/,
  ];

  for (const pattern of patterns) {
    const match = cleanInput.match(pattern);
    if (match?.[1]) return match[1];
  }

  return cleanInput;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error("Supabase credentials not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
    const { data: authData } = bearer ? await supabase.auth.getUser(bearer) : { data: { user: null } };
    const authUser = authData.user;
    if (!authUser?.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Sign in to check this payment" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const url = new URL(req.url);

    let rawInput = url.searchParams.get("transaction_id") || url.searchParams.get("mpesa_code") || "";

    if (!rawInput && req.method !== "GET") {
      const rawBody = await req.text();
      if (rawBody) {
        try {
          const body = JSON.parse(rawBody);
          rawInput = body?.transaction_id || body?.mpesa_code || "";
        } catch {
          rawInput = rawBody;
        }
      }
    }

    if (!rawInput) {
      return new Response(
        JSON.stringify({ success: false, error: "Transaction ID required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalized = extractMpesaCode(rawInput);

    // 1) Try internal reference first
    let { data: payment, error } = await supabase
      .from("payments")
      .select("*")
      .eq("transaction_id", normalized)
      .eq("user_id", authUser.id)
      .maybeSingle();

    // 2) Fallback to M-Pesa receipt code lookup
    if (error || !payment) {
      const result = await supabase
        .from("payments")
        .select("*")
        .eq("mpesa_code", normalized)
        .eq("user_id", authUser.id)
        .maybeSingle();
      payment = result.data;
      error = result.error;
    }

    if (error || !payment) {
      return new Response(
        JSON.stringify({ success: false, error: "Payment not found", status: "not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Still pending? Ask Palpluss directly (webhook may not have landed yet).
    const PALPLUSS_API_KEY = Deno.env.get("PALPLUSS_API_KEY");
    if (payment.payment_status === "pending" && payment.provider_txn_id && PALPLUSS_API_KEY) {
      try {
        const res = await fetch(`https://api.palpluss.com/v1/transactions/${payment.provider_txn_id}`, {
          // PalPlus uses the API key itself as the Basic credential value.
          headers: { Authorization: `Basic ${PALPLUSS_API_KEY}` },
        });
        const json = await res.json().catch(() => ({}));
        const remote = String(json?.data?.status || "").toUpperCase();
        if (remote && remote !== "PENDING") {
          const newStatus = remote === "SUCCESS" ? "completed" : "failed";
          const receipt = json?.data?.mpesaReceipt ?? json?.data?.mpesa_receipt ?? null;
          const { data: updated } = await supabase
            .from("payments")
            .update({ payment_status: newStatus, mpesa_code: receipt, updated_at: new Date().toISOString() })
            .eq("id", payment.id)
            .select()
            .maybeSingle();
          if (updated) payment = updated;
        }
      } catch (e) {
        console.error("Palpluss status poll failed:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: payment.payment_status,
        mpesa_code: payment.mpesa_code,
        amount: Number(payment.amount || 0),
        transaction_id: payment.transaction_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
