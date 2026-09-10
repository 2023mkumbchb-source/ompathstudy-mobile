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
    const isAdmin = async () => {
      const { data } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      return Boolean(data);
    };

    if (action === "import_questions") {
      if (!await isAdmin()) return json({ error: "Administrator access required" }, 403);
      const roundId = String(body?.roundId || "");
      const questions = Array.isArray(body?.questions) ? body.questions : [];
      const { data: count, error } = await admin.rpc("admin_replace_contest_questions", { p_round_id: roundId, p_questions: questions });
      if (error) throw error;
      return json({ success: true, count });
    }

    if (action === "configure_round") {
      if (!await isAdmin()) return json({ error: "Administrator access required" }, 403);
      const roundId = String(body?.roundId || "");
      const status = String(body?.status || "scheduled");
      if (!["scheduled", "lobby", "live", "closed", "cancelled"].includes(status)) return json({ error: "Invalid round status" }, 400);
      const { data: current } = await admin.from("contest_rounds").select("question_count,locked_at").eq("id", roundId).maybeSingle();
      if (!current) return json({ error: "Round not found" }, 404);
      if (["lobby", "live", "closed"].includes(status) && Number(current.question_count) < 1) return json({ error: "Import questions before opening the round" }, 409);
      const startsAt = body?.startsAt || null;
      const endsAt = body?.endsAt || null;
      if (status === "live" && (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt))) return json({ error: "A live round needs valid start and end times" }, 400);
      const { error } = await admin.from("contest_rounds").update({
        status, starts_at: startsAt, ends_at: endsAt,
        duration_seconds: Math.max(60, Math.min(14400, Number(body?.durationSeconds) || 1800)),
        tab_switch_limit: Math.max(1, Math.min(20, Number(body?.tabSwitchLimit) || 2)),
        focus_loss_limit: Math.max(1, Math.min(30, Number(body?.focusLossLimit) || 3)),
        auto_eliminate: Boolean(body?.autoEliminate),
        locked_at: status === "scheduled" ? current.locked_at : (current.locked_at || new Date().toISOString()),
        updated_at: new Date().toISOString(),
      }).eq("id", roundId);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "registration_status") {
      if (!await isAdmin()) return json({ error: "Administrator access required" }, 403);
      const status = String(body?.status || "");
      if (!["pending", "verified", "rejected", "withdrawn"].includes(status)) return json({ error: "Invalid registration status" }, 400);
      const { error } = await admin.from("contest_registrations").update({ status, updated_at: new Date().toISOString() }).eq("id", String(body?.registrationId || ""));
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "log_integrity_event") {
      const attemptId = String(body?.attemptId || "");
      const eventType = String(body?.eventType || "");
      const allowedEvents = ["tab_hidden","focus_lost","fullscreen_exit","copy_attempt","paste_attempt","context_menu","disconnected","reconnected"];
      if (!allowedEvents.includes(eventType)) return json({ error: "Invalid integrity event" }, 400);
      const { data: attempt } = await admin.from("contest_attempts").select("id,user_id,status,round_id").eq("id", attemptId).maybeSingle();
      if (!attempt || attempt.user_id !== user.id || attempt.status !== "active") return json({ error: "Active attempt not found" }, 404);
      const { error: insertError } = await admin.from("contest_integrity_events").insert({ attempt_id: attemptId, user_id: user.id, event_type: eventType });
      if (insertError) throw insertError;
      const { data: round } = await admin.from("contest_rounds").select("auto_eliminate,tab_switch_limit,focus_loss_limit").eq("id", attempt.round_id).single();
      let eliminated = false;
      if (round?.auto_eliminate && ["tab_hidden", "focus_lost"].includes(eventType)) {
        const { count } = await admin.from("contest_integrity_events").select("id", { count: "exact", head: true }).eq("attempt_id", attemptId).eq("event_type", eventType);
        const limit = eventType === "tab_hidden" ? round.tab_switch_limit : round.focus_loss_limit;
        if ((count || 0) >= limit) {
          await admin.from("contest_attempts").update({ status: "eliminated", eliminated_at: new Date().toISOString() }).eq("id", attemptId).eq("status", "active");
          eliminated = true;
        }
      }
      return json({ success: true, eliminated });
    }

    if (action === "publish_results") {
      if (!await isAdmin()) return json({ error: "Administrator access required" }, 403);
      const roundId = String(body?.roundId || "");
      const { data: round } = await admin.from("contest_rounds").select("contest_id,status").eq("id", roundId).maybeSingle();
      if (!round || round.status !== "closed") return json({ error: "Close the round before publishing results" }, 409);
      const { data: attempts } = await admin.from("contest_attempts").select("registration_id,score").eq("round_id", roundId).eq("status", "submitted").not("score", "is", null);
      const registrationIds = [...new Set((attempts || []).map((item) => item.registration_id))];
      const { data: registrations } = registrationIds.length ? await admin.from("contest_registrations").select("id,university_id").in("id", registrationIds) : { data: [] };
      const universityByRegistration = new Map((registrations || []).map((item) => [item.id, item.university_id]));
      const grouped = new Map<string, number[]>();
      for (const attempt of attempts || []) { const universityId = universityByRegistration.get(attempt.registration_id); if (universityId) grouped.set(universityId, [...(grouped.get(universityId) || []), Number(attempt.score)]); }
      const rows = [...grouped.entries()].map(([university_id, scores]) => ({ university_id, participant_count: scores.length, average_score: scores.reduce((a,b) => a+b,0)/scores.length, total_points: scores.reduce((a,b) => a+b,0) })).sort((a,b) => b.total_points-a.total_points).map((item,index) => ({ ...item, rank:index+1, contest_id:round.contest_id, round_id:roundId, published:true, published_at:new Date().toISOString() }));
      await admin.from("contest_university_results").delete().eq("round_id", roundId);
      if (rows.length) { const { error } = await admin.from("contest_university_results").insert(rows); if (error) throw error; }
      return json({ success: true, count: rows.length });
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
