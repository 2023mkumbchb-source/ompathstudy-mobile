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

    const slugify = (value: string) =>
      value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || `contest-${Date.now()}`;

    const uniqueSlug = async (table: string, base: string) => {
      let slug = slugify(base);
      for (let attempt = 0; attempt < 25; attempt += 1) {
        const { data } = await admin.from(table).select("id").eq("slug", slug).maybeSingle();
        if (!data) return slug;
        slug = `${slugify(base)}-${attempt + 2}`;
      }
      return `${slugify(base)}-${Date.now()}`;
    };

    if (action === "create_contest" || action === "update_contest") {
      if (!await isAdmin()) return json({ error: "Administrator access required" }, 403);
      const title = String(body?.title || "").trim();
      if (title.length < 4) return json({ error: "Give the contest a title of at least 4 characters" }, 400);
      const subjects = Array.isArray(body?.subjects) ? body.subjects.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 12) : [];
      const years = Array.isArray(body?.years) ? [...new Set(body.years.map((item: unknown) => Number(item)).filter((year: number) => year >= 1 && year <= 6))] : [];
      const payload: Record<string, unknown> = {
        title,
        subtitle: String(body?.subtitle || "").trim().slice(0, 400),
        subjects,
        eligible_years: years,
        competition_format: String(body?.format || "").trim().slice(0, 200),
        registration_opens_at: body?.registrationOpensAt || null,
        registration_closes_at: body?.registrationClosesAt || null,
        starts_at: body?.startsAt || null,
        share_image_url: body?.shareImageUrl || null,
        published: Boolean(body?.published),
        updated_at: new Date().toISOString(),
      };
      if (action === "update_contest") {
        const contestId = String(body?.contestId || "");
        const { data, error } = await admin.from("contests").update(payload).eq("id", contestId).select("id,slug").single();
        if (error) throw error;
        return json({ success: true, contest: data });
      }
      payload.slug = await uniqueSlug("contests", body?.slug ? String(body.slug) : title);
      payload.status = "concept";
      const { data, error } = await admin.from("contests").insert(payload).select("id,slug").single();
      if (error) throw error;
      return json({ success: true, contest: data });
    }

    if (action === "create_round") {
      if (!await isAdmin()) return json({ error: "Administrator access required" }, 403);
      const contestId = String(body?.contestId || "");
      const title = String(body?.title || "").trim() || "Round";
      const { data: existing } = await admin.from("contest_rounds").select("round_number").eq("contest_id", contestId).order("round_number", { ascending: false }).limit(1);
      const roundNumber = Number(body?.roundNumber) > 0 ? Number(body.roundNumber) : (Number(existing?.[0]?.round_number) || 0) + 1;
      const { data, error } = await admin.from("contest_rounds").insert({
        contest_id: contestId,
        title,
        round_number: roundNumber,
        duration_seconds: Math.max(60, Math.min(14400, Number(body?.durationSeconds) || 1800)),
      }).select("id,title,round_number,status,question_count,duration_seconds").single();
      if (error) throw error;
      return json({ success: true, round: data });
    }

    if (action === "delete_round") {
      if (!await isAdmin()) return json({ error: "Administrator access required" }, 403);
      const roundId = String(body?.roundId || "");
      const { data: round } = await admin.from("contest_rounds").select("id,status").eq("id", roundId).maybeSingle();
      if (!round) return json({ error: "Round not found" }, 404);
      if (["live", "closed"].includes(round.status)) return json({ error: "A live or closed round cannot be deleted" }, 409);
      const { error } = await admin.from("contest_rounds").delete().eq("id", roundId);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "add_university") {
      if (!await isAdmin()) return json({ error: "Administrator access required" }, 403);
      const name = String(body?.name || "").trim();
      if (name.length < 3) return json({ error: "Enter the full university name" }, 400);
      const { data, error } = await admin.from("contest_universities").insert({
        name,
        slug: await uniqueSlug("contest_universities", name),
        abbreviation: String(body?.abbreviation || "").trim().slice(0, 16) || null,
        verified: true,
        active: true,
      }).select("id,name,slug,abbreviation,verified").single();
      if (error) throw error;
      return json({ success: true, university: data });
    }

    if (action === "propose_university") {
      const name = String(body?.name || "").trim().replace(/\s+/g, " ");
      const abbreviation = String(body?.abbreviation || "").trim().slice(0, 16) || null;
      if (name.length < 3 || name.length > 140) return json({ error: "Enter a university name between 3 and 140 characters" }, 400);
      const { data: existing, error: existingError } = await admin.from("contest_universities")
        .select("id,name,slug,abbreviation,verified,active,proposed_by").ilike("name", name).limit(1).maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        if (existing.active || existing.proposed_by === user.id) return json({ success: true, university: existing });
        return json({ error: "This university is already awaiting administrator review" }, 409);
      }
      const { data, error } = await admin.from("contest_universities").insert({
        name,
        slug: await uniqueSlug("contest_universities", name),
        abbreviation,
        verified: false,
        active: false,
        proposed_by: user.id,
      }).select("id,name,slug,abbreviation,verified,active").single();
      if (error) throw error;
      return json({ success: true, university: data });
    }

    if (action === "set_university_active") {
      if (!await isAdmin()) return json({ error: "Administrator access required" }, 403);
      const { error } = await admin.from("contest_universities")
        .update({ active: Boolean(body?.active), verified: Boolean(body?.active), updated_at: new Date().toISOString() })
        .eq("id", String(body?.universityId || ""));
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "create_sample_contest") {
      if (!await isAdmin()) return json({ error: "Administrator access required" }, 403);
      const title = String(body?.title || "").trim() || "Sample Inter-University Medical Challenge";
      const slug = await uniqueSlug("contests", title);
      const now = Date.now();
      const { data: contest, error: contestError } = await admin.from("contests").insert({
        slug,
        title,
        subtitle: "A published demonstration contest showing the complete participant journey.",
        status: "registration",
        subjects: ["Anatomy", "Physiology", "Pathology"],
        eligible_years: [1, 2, 3],
        competition_format: "Qualifier → Semifinal → Grand final",
        registration_opens_at: new Date(now - 3600_000).toISOString(),
        registration_closes_at: new Date(now + 14 * 86_400_000).toISOString(),
        starts_at: new Date(now + 86_400_000).toISOString(),
        published: true,
      }).select("id,slug,title").single();
      if (contestError) throw contestError;

      const universities = [
        { name: "Mount Kenya University", abbreviation: "MKU" },
        { name: "University of Nairobi", abbreviation: "UON" },
        { name: "Kenyatta University", abbreviation: "KU" },
        { name: "Moi University", abbreviation: "MU" },
        { name: "Jomo Kenyatta University of Agriculture and Technology", abbreviation: "JKUAT" },
      ];
      for (const item of universities) {
        const { data: found } = await admin.from("contest_universities").select("id").ilike("name", item.name).maybeSingle();
        if (found) { await admin.from("contest_universities").update({ active: true, verified: true }).eq("id", found.id); continue; }
        await admin.from("contest_universities").insert({ name: item.name, slug: await uniqueSlug("contest_universities", item.name), abbreviation: item.abbreviation, verified: true, active: true });
      }

      const { data: round, error: roundError } = await admin.from("contest_rounds").insert({
        contest_id: contest.id, title: "Qualifier round", round_number: 1, duration_seconds: 1200,
      }).select("id").single();
      if (roundError) throw roundError;

      const sample = [
        { stem: "Which structure forms the floor of the anatomical snuffbox?", options: ["Scaphoid and trapezium", "Lunate and capitate", "Radius and ulna", "Pisiform and hamate"], correctIndex: 0, explanation: "The scaphoid and trapezium form the floor of the snuffbox." },
        { stem: "The nerve most at risk in a mid-shaft humeral fracture is the", options: ["Radial nerve", "Median nerve", "Ulnar nerve", "Axillary nerve"], correctIndex: 0, explanation: "The radial nerve runs in the spiral groove of the humeral shaft." },
        { stem: "Which hormone is secreted by the zona glomerulosa?", options: ["Aldosterone", "Cortisol", "Adrenaline", "Testosterone"], correctIndex: 0, explanation: "The zona glomerulosa produces the mineralocorticoid aldosterone." },
        { stem: "Caseating granulomas are most characteristic of", options: ["Tuberculosis", "Sarcoidosis", "Crohn disease", "Silicosis"], correctIndex: 0, explanation: "Central caseous necrosis is typical of tuberculous granulomas." },
        { stem: "The commonest causative organism of acute osteomyelitis in children is", options: ["Staphylococcus aureus", "Escherichia coli", "Salmonella typhi", "Haemophilus influenzae"], correctIndex: 0, explanation: "Staphylococcus aureus is the leading cause in children." },
      ];
      const { error: importError } = await admin.rpc("admin_replace_contest_questions", { p_round_id: round.id, p_questions: sample });
      if (importError) throw importError;
      const { error: openError } = await admin.from("contest_rounds").update({
        status: "lobby",
        starts_at: new Date(now + 86_400_000).toISOString(),
        ends_at: new Date(now + 86_400_000 + 1200_000).toISOString(),
        locked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", round.id);
      if (openError) throw openError;
      return json({ success: true, contest, roundId: round.id });
    }


    if (action === "import_questions") {
      if (!await isAdmin()) return json({ error: "Administrator access required" }, 403);
      const roundId = String(body?.roundId || "");
      const questions = Array.isArray(body?.questions) ? body.questions : [];
      const { data: count, error } = await admin.rpc("admin_replace_contest_questions", { p_round_id: roundId, p_questions: questions });
      if (error) throw error;
      return json({ success: true, count });
    }

    if (action === "import_exam_paper") {
      if (!await isAdmin()) return json({ error: "Administrator access required" }, 403);
      const roundId = String(body?.roundId || "");
      const examId = String(body?.examId || "");
      const { data: exam, error: examError } = await admin.from("mcq_sets")
        .select("id,title,questions,published,deleted_at")
        .eq("id", examId)
        .eq("published", true)
        .is("deleted_at", null)
        .maybeSingle();
      if (examError) throw examError;
      if (!exam) return json({ error: "Published exam paper not found" }, 404);

      const questions = (Array.isArray(exam.questions) ? exam.questions : []).flatMap((item: any) => {
        const stem = String(item?.question || item?.stem || "").trim();
        const options = Array.isArray(item?.options) ? item.options.map((option: unknown) => String(option).trim()).filter(Boolean) : [];
        const correctIndex = Number(item?.correct_answer ?? item?.correctIndex);
        if (!stem || options.length < 2 || options.length > 8 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) return [];
        return [{ stem, options, correctIndex, explanation: String(item?.explanation || "").trim() || undefined }];
      });
      if (!questions.length) return json({ error: "This exam has no valid multiple-choice questions with answer keys" }, 409);

      const { data: count, error: importError } = await admin.rpc("admin_replace_contest_questions", { p_round_id: roundId, p_questions: questions });
      if (importError) throw importError;
      const { error: sourceError } = await admin.from("contest_rounds").update({
        source_mcq_set_id: exam.id,
        source_exam_title: exam.title,
        updated_at: new Date().toISOString(),
      }).eq("id", roundId);
      if (sourceError) throw sourceError;
      return json({ success: true, count, title: exam.title });
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
        auto_open: body?.autoOpen !== false,
        auto_close: body?.autoClose !== false,
        entry_grace_minutes: Math.max(0, Math.min(60, Number(body?.entryGraceMinutes) || 10)),
        results_visible: Boolean(body?.resultsVisible),
        locked_at: status === "scheduled" ? current.locked_at : (current.locked_at || new Date().toISOString()),
        updated_at: new Date().toISOString(),
      }).eq("id", roundId);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "update_contest_stage") {
      if (!await isAdmin()) return json({ error: "Administrator access required" }, 403);
      const contestId = String(body?.contestId || "");
      const stage = String(body?.stage || "");
      if (!["concept", "registration", "live", "completed"].includes(stage)) return json({ error: "Invalid contest stage" }, 400);
      const { data: contest } = await admin.from("contests").select("id,status").eq("id", contestId).maybeSingle();
      if (!contest) return json({ error: "Contest not found" }, 404);
      if (stage === "live") {
        const { count } = await admin.from("contest_rounds").select("id", { count: "exact", head: true }).eq("contest_id", contestId).in("status", ["lobby", "live"]).gt("question_count", 0);
        if (!count) return json({ error: "Open a question-bearing round before making the contest live" }, 409);
      }
      const { error } = await admin.from("contests").update({ status: stage, updated_at: new Date().toISOString() }).eq("id", contestId);
      if (error) throw error;
      return json({ success: true, previousStage: contest.status, stage });
    }

    if (action === "registration_status") {
      if (!await isAdmin()) return json({ error: "Administrator access required" }, 403);
      const status = String(body?.status || "");
      if (!["pending", "verified", "rejected", "withdrawn"].includes(status)) return json({ error: "Invalid registration status" }, 400);
      const { error } = await admin.from("contest_registrations").update({ status, updated_at: new Date().toISOString() }).eq("id", String(body?.registrationId || ""));
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "rehearsal_score") {
      if (!await isAdmin()) return json({ error: "Administrator access required" }, 403);
      const roundId = String(body?.roundId || "");
      const answers = body?.answers && typeof body.answers === "object" ? body.answers : {};
      const { data: questions, error: questionError } = await admin.from("contest_questions").select("id,position").eq("round_id", roundId).order("position");
      if (questionError) throw questionError;
      const ids = (questions || []).map((item) => item.id);
      const { data: keys, error: keyError } = ids.length ? await admin.schema("private").from("contest_answer_keys").select("question_id,correct_index,explanation").in("question_id", ids) : { data: [], error: null };
      if (keyError) throw keyError;
      const keyByQuestion = new Map((keys || []).map((item) => [item.question_id, item]));
      let correct = 0;
      const details = (questions || []).map((question) => {
        const key = keyByQuestion.get(question.id);
        const isCorrect = Boolean(key) && Number(answers[question.id]) === Number(key.correct_index);
        if (isCorrect) correct += 1;
        return { questionId: question.id, correct: isCorrect, explanation: key?.explanation || null };
      });
      const total = details.length;
      return json({ score: total ? Math.round((correct / total) * 10000) / 100 : 0, correct, total, details });
    }

    if (action === "override_attempt") {
      if (!await isAdmin()) return json({ error: "Administrator access required" }, 403);
      const attemptId = String(body?.attemptId || ""), status = String(body?.status || ""), reason = String(body?.reason || "").trim();
      if (!["active","submitted","eliminated","expired","void"].includes(status)) return json({ error: "Invalid attempt status" }, 400);
      if (reason.length < 3 || reason.length > 500) return json({ error: "A 3–500 character reason is required" }, 400);
      const { data: before } = await admin.from("contest_attempts").select("id,status,score,submitted_at,eliminated_at").eq("id", attemptId).maybeSingle();
      if (!before) return json({ error: "Attempt not found" }, 404);
      const changes = { status, submitted_at: status === "submitted" ? (before.submitted_at || new Date().toISOString()) : null, eliminated_at: status === "eliminated" ? (before.eliminated_at || new Date().toISOString()) : null };
      const { data: after, error } = await admin.from("contest_attempts").update(changes).eq("id", attemptId).select("id,status,score,submitted_at,eliminated_at").single();
      if (error) throw error;
      const { error: auditError } = await admin.from("contest_moderator_actions").insert({ actor_id: user.id, action_type: "attempt_override", target_type: "contest_attempt", target_id: attemptId, reason, before_state: before, after_state: after });
      if (auditError) throw auditError;
      return json({ success: true, attempt: after });
    }

    if (action === "advance_registration") {
      if (!await isAdmin()) return json({ error: "Administrator access required" }, 403);
      const registrationId = String(body?.registrationId || ""), sourceRoundId = String(body?.sourceRoundId || ""), targetRoundId = body?.targetRoundId ? String(body.targetRoundId) : null;
      const decision = String(body?.decision || ""), reason = String(body?.reason || "").trim();
      if (!["advanced","eliminated","wildcard"].includes(decision)) return json({ error: "Invalid advancement decision" }, 400);
      if (reason.length < 3 || reason.length > 500) return json({ error: "A 3–500 character reason is required" }, 400);
      const { data: registration } = await admin.from("contest_registrations").select("id,contest_id,status").eq("id", registrationId).maybeSingle();
      const { data: sourceRound } = await admin.from("contest_rounds").select("id,contest_id,round_number").eq("id", sourceRoundId).maybeSingle();
      if (!registration || !sourceRound || registration.contest_id !== sourceRound.contest_id) return json({ error: "Registration and source round do not match" }, 400);
      if (targetRoundId) { const { data: target } = await admin.from("contest_rounds").select("contest_id,round_number").eq("id", targetRoundId).maybeSingle(); if (!target || target.contest_id !== sourceRound.contest_id || target.round_number <= sourceRound.round_number) return json({ error: "Target must be a later round in this contest" }, 400); }
      const { data: before } = await admin.from("contest_advancements").select("*").eq("registration_id", registrationId).eq("source_round_id", sourceRoundId).maybeSingle();
      const row = { contest_id: registration.contest_id, registration_id: registrationId, source_round_id: sourceRoundId, target_round_id: targetRoundId, decision, reason, decided_by: user.id, updated_at: new Date().toISOString() };
      const { data: after, error } = await admin.from("contest_advancements").upsert(row, { onConflict: "registration_id,source_round_id" }).select("*").single();
      if (error) throw error;
      const { error: auditError } = await admin.from("contest_moderator_actions").insert({ actor_id: user.id, action_type: "advancement_decision", target_type: "contest_registration", target_id: registrationId, reason, before_state: before || {}, after_state: after });
      if (auditError) throw auditError;
      return json({ success: true, advancement: after });
    }

    if (action === "submit_appeal") {
      const contestId = String(body?.contestId || ""), registrationId = String(body?.registrationId || "");
      const attemptId = body?.attemptId ? String(body.attemptId) : null, advancementId = body?.advancementId ? String(body.advancementId) : null;
      const category = String(body?.category || ""), statement = String(body?.statement || "").trim();
      if (!["integrity","score","advancement","technical"].includes(category)) return json({ error: "Invalid appeal category" }, 400);
      if (statement.length < 20 || statement.length > 2000) return json({ error: "Appeal statement must contain 20–2000 characters" }, 400);
      if (!attemptId && !advancementId) return json({ error: "Select a decision or attempt to appeal" }, 400);
      const { data: registration } = await admin.from("contest_registrations").select("id,contest_id,user_id").eq("id", registrationId).maybeSingle();
      if (!registration || registration.user_id !== user.id || registration.contest_id !== contestId) return json({ error: "Registration not found" }, 404);
      if (attemptId) { const { data: attempt } = await admin.from("contest_attempts").select("registration_id").eq("id", attemptId).maybeSingle(); if (!attempt || attempt.registration_id !== registrationId) return json({ error: "Attempt does not belong to this registration" }, 403); }
      if (advancementId) { const { data: advancement } = await admin.from("contest_advancements").select("registration_id").eq("id", advancementId).maybeSingle(); if (!advancement || advancement.registration_id !== registrationId) return json({ error: "Decision does not belong to this registration" }, 403); }
      const { error } = await admin.from("contest_appeals").insert({ contest_id: contestId, registration_id: registrationId, attempt_id: attemptId, advancement_id: advancementId, user_id: user.id, category, statement });
      if (error?.code === "23505") return json({ error: "An open appeal already exists for this item" }, 409);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "resolve_appeal") {
      if (!await isAdmin()) return json({ error: "Administrator access required" }, 403);
      const appealId = String(body?.appealId || ""), status = String(body?.status || ""), resolution = String(body?.resolution || "").trim();
      if (!["reviewing","upheld","overturned","dismissed"].includes(status)) return json({ error: "Invalid appeal status" }, 400);
      if (resolution.length < 10 || resolution.length > 2000) return json({ error: "Resolution must contain 10–2000 characters" }, 400);
      const { data: before } = await admin.from("contest_appeals").select("id,status,resolution").eq("id", appealId).maybeSingle();
      if (!before) return json({ error: "Appeal not found" }, 404);
      const final = ["upheld","overturned","dismissed"].includes(status);
      const { error } = await admin.from("contest_appeals").update({ status, resolution, resolved_by: final ? user.id : null, resolved_at: final ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", appealId);
      if (error) throw error;
      const after = { status, resolution, resolved_by: final ? user.id : null };
      const { error: auditError } = await admin.from("contest_moderator_actions").insert({ actor_id: user.id, action_type: "appeal_resolution", target_type: "contest_appeal", target_id: appealId, reason: resolution, before_state: before, after_state: after });
      if (auditError) throw auditError;
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

    if (action === "save_answer") {
      const attemptId = String(body?.attemptId || "");
      const questionId = String(body?.questionId || "");
      const selectedIndex = Number(body?.selectedIndex);
      const responseMs = Math.max(0, Math.min(14_400_000, Number(body?.responseMs) || 0));
      const { data: attempt } = await admin.from("contest_attempts").select("id,user_id,status,round_id,started_at").eq("id", attemptId).maybeSingle();
      if (!attempt || attempt.user_id !== user.id || attempt.status !== "active") return json({ error: "Active attempt not found" }, 404);
      const { data: round } = await admin.from("contest_rounds").select("status,starts_at,ends_at,duration_seconds").eq("id", attempt.round_id).maybeSingle();
      const now = Date.now();
      const attemptDeadline = new Date(attempt.started_at).getTime() + Number(round?.duration_seconds || 0) * 1000;
      const roundDeadline = round?.ends_at ? new Date(round.ends_at).getTime() : Number.POSITIVE_INFINITY;
      if (!round || round.status !== "live" || now < new Date(round.starts_at || 0).getTime() || now >= Math.min(attemptDeadline, roundDeadline)) return json({ error: "The answer window has closed" }, 409);
      const { data: question } = await admin.from("contest_questions").select("id,options").eq("id", questionId).eq("round_id", attempt.round_id).maybeSingle();
      if (!question || !Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= (Array.isArray(question.options) ? question.options.length : 0)) return json({ error: "Invalid question answer" }, 400);
      const { error } = await admin.from("contest_answers").upsert({ attempt_id: attemptId, question_id: questionId, user_id: user.id, selected_index: selectedIndex, response_ms: responseMs, submitted_at: new Date().toISOString() }, { onConflict: "attempt_id,question_id" });
      if (error) throw error;
      return json({ success: true });
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
      await admin.from("contest_rounds").update({ results_visible: true, updated_at: new Date().toISOString() }).eq("id", roundId);
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
