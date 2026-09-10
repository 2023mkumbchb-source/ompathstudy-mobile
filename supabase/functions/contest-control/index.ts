import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: { user }, error: authError } = await admin.auth.getUser(bearer);
    if (authError || !user) return json({ error: "Authentication required" }, 401);
    const body = await req.json();
    const action = String(body?.action || "");

    if (action === "import_questions") {
      const { data: allowed } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!allowed) return json({ error: "Administrator access required" }, 403);
      const roundId = String(body?.roundId || "");
      const questions = Array.isArray(body?.questions) ? body.questions : [];
      const { data: count, error } = await admin.rpc("admin_replace_contest_questions", { p_round_id: roundId, p_questions: questions });
      if (error) throw error;
      return json({ success: true, count });
    }

    if (action === "submit_attempt") {
      const attemptId = String(body?.attemptId || "");
      const { data: attempt } = await admin.from("contest_attempts").select("id,user_id,status,round_id").eq("id", attemptId).maybeSingle();
      if (!attempt || attempt.user_id !== user.id) return json({ error: "Attempt not found" }, 404);
      if (attempt.status !== "active") return json({ error: "Attempt is no longer active" }, 409);
      const { data: score, error } = await admin.rpc("score_contest_attempt", { p_attempt_id: attemptId });
      if (error) throw error;
      return json({ success: true, score });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("contest-control", error);
    return json({ error: error instanceof Error ? error.message : "Contest operation failed" }, 400);
  }
});
