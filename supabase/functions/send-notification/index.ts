import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
}[char] || char));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: userError } = await caller.auth.getUser();
    if (userError || !user) return json({ error: "Authentication required" }, 401);
    const { data: isAdmin } = await caller.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Administrator access required" }, 403);

    const body = await req.json();
    const action = ["create", "update", "delete"].includes(body.action) ? body.action : "create";
    const campaignId = String(body.campaign_id || "");
    if ((action === "update" || action === "delete") && !/^[0-9a-f-]{36}$/i.test(campaignId)) {
      return json({ error: "A valid campaign ID is required" }, 400);
    }

    if (action === "delete") {
      const { error } = await admin.from("notification_campaigns").delete().eq("id", campaignId);
      if (error) throw error;
      return json({ success: true, deleted: campaignId });
    }

    const title = String(body.title || "").trim().slice(0, 120);
    const message = String(body.message || "").trim().slice(0, 4000);
    const type = ["exam", "update", "note", "general"].includes(body.type) ? body.type : "general";
    const priority = body.priority === "urgent" ? "urgent" : "normal";
    const audience = ["all_users", "subscribers", "study_year"].includes(body.audience) ? body.audience : "all_users";
    const studyYear = audience === "study_year" ? Number(body.study_year) : null;
    const rawUrl = String(body.action_url || "").trim();
    const actionUrl = rawUrl && (/^\/[a-z0-9/_?=&%#.-]*$/i.test(rawUrl) || /^https:\/\/(www\.)?ompathstudy\.com(?:\/|$)/i.test(rawUrl)) ? rawUrl : null;
    const emailActionUrl = actionUrl?.startsWith("/") ? `https://www.ompathstudy.com${actionUrl}` : actionUrl;
    if (!title || !message) return json({ error: "Title and message are required" }, 400);
    if (audience === "study_year" && (!Number.isInteger(studyYear) || studyYear < 1 || studyYear > 6)) {
      return json({ error: "Choose a study year from 1 to 6" }, 400);
    }

    if (action === "update") {
      const patch = { title, message, type, priority, action_url: actionUrl, audience, study_year: studyYear };
      const { data: campaign, error } = await admin.from("notification_campaigns")
        .update(patch).eq("id", campaignId).select("*").single();
      if (error) throw error;
      const { error: recipientError } = await admin.from("user_notifications")
        .update({ title, message, type, priority, study_year: studyYear, action_url: actionUrl })
        .eq("campaign_id", campaignId);
      if (recipientError) throw recipientError;
      return json({ success: true, campaign });
    }

    let page = 1;
    const users: Array<{ id: string; email?: string }> = [];
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      users.push(...data.users.map((u) => ({ id: u.id, email: u.email })));
      if (data.users.length < 1000) break;
      page += 1;
    }

    let eligibleIds = new Set(users.map((u) => u.id));
    if (audience === "study_year") {
      const { data } = await admin.from("profiles").select("user_id").eq("study_year", studyYear);
      eligibleIds = new Set((data || []).map((row) => row.user_id));
    } else if (audience === "subscribers") {
      const { data } = await admin.from("access_grants").select("user_id,email").gt("expires_at", new Date().toISOString());
      const ids = new Set((data || []).map((row) => row.user_id).filter(Boolean));
      const emails = new Set((data || []).map((row) => String(row.email || "").toLowerCase()).filter(Boolean));
      eligibleIds = new Set(users.filter((u) => ids.has(u.id) || (u.email && emails.has(u.email.toLowerCase()))).map((u) => u.id));
    }
    const recipients = users.filter((u) => eligibleIds.has(u.id) && u.email);

    const { data: campaign, error: campaignError } = await admin.from("notification_campaigns").insert({
      title, message, type, priority, action_url: actionUrl, audience, study_year: studyYear,
      status: "sending", recipient_count: recipients.length, created_by: user.id,
    }).select("id").single();
    if (campaignError) throw campaignError;

    if (recipients.length) {
      const rows = recipients.map((recipient) => ({
        campaign_id: campaign.id, user_id: recipient.id, title, message, type, priority,
        study_year: studyYear, action_url: actionUrl,
      }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await admin.from("user_notifications").insert(rows.slice(i, i + 500));
        if (error) throw error;
      }
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("NOTIFICATION_FROM_EMAIL") || "Ompath Study <notifications@ompathstudy.com>";
    let delivered = 0;
    let failed = 0;
    if (resendKey) {
      const { data: preferences } = await admin.from("notification_preferences").select("user_id,email_enabled").eq("email_enabled", false);
      const optedOut = new Set((preferences || []).map((row) => row.user_id));
      for (const recipient of recipients) {
        if (optedOut.has(recipient.id)) {
          await admin.from("user_notifications").update({ email_status: "skipped" }).eq("campaign_id", campaign.id).eq("user_id", recipient.id);
          continue;
        }
        const link = emailActionUrl ? `<p><a href="${escapeHtml(emailActionUrl)}" style="display:inline-block;padding:12px 18px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px">Open Ompath Study</a></p>` : "";
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from, to: [recipient.email], subject: title,
            text: `${message}${emailActionUrl ? `\n\nOpen: ${emailActionUrl}` : ""}\n\nManage notifications in your Ompath Study account.`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h1 style="color:#0f766e">${escapeHtml(title)}</h1><p style="white-space:pre-wrap">${escapeHtml(message)}</p>${link}<p style="font-size:12px;color:#64748b">You received this account notification from Ompath Study. Manage email notifications in your account.</p></div>`,
          }),
        });
        const emailStatus = response.ok ? "sent" : "failed";
        const errorText = response.ok ? null : (await response.text()).slice(0, 500);
        await admin.from("user_notifications").update({ email_status: emailStatus, email_error: errorText }).eq("campaign_id", campaign.id).eq("user_id", recipient.id);
        if (response.ok) delivered++;
        else failed++;
      }
    } else {
      await admin.from("user_notifications").update({ email_status: "skipped", email_error: "Email provider is not configured" }).eq("campaign_id", campaign.id);
    }

    const status = !resendKey ? "partial" : failed ? (delivered ? "partial" : "failed") : "sent";
    await admin.from("notification_campaigns").update({ status, delivered_count: delivered, failed_count: failed, sent_at: new Date().toISOString() }).eq("id", campaign.id);
    const { data: completedCampaign } = await admin.from("notification_campaigns").select("*").eq("id", campaign.id).single();
    return json({ success: true, campaign: completedCampaign, campaign_id: campaign.id, recipients: recipients.length, email_configured: Boolean(resendKey), delivered, failed, status });
  } catch (error) {
    console.error("send-notification", error);
    return json({ error: error instanceof Error ? error.message : "Notification failed" }, 500);
  }
});
