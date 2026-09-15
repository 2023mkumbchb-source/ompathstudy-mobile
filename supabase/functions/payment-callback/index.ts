import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PALPLUSS_BASE = 'https://api.palpluss.com/v1';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[char] || char));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const PALPLUSS_API_KEY = Deno.env.get('PALPLUSS_API_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Backend credentials not configured');
    if (!PALPLUSS_API_KEY) throw new Error('PalPlus API key not configured');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const rawBody = await req.text();
    console.log('Palpluss callback received:', rawBody);
    const data = JSON.parse(rawBody);

    const txn = data.transaction || {};
    const providerTxnId: string | undefined = txn.id;

    if (!providerTxnId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing transaction ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the callback against PalPlus before changing payment/access state.
    const verification = await fetch(`${PALPLUSS_BASE}/transactions/${encodeURIComponent(providerTxnId)}`, {
      headers: { Authorization: `Basic ${PALPLUSS_API_KEY}` },
    });
    const verified = await verification.json().catch(() => ({}));
    if (!verification.ok || verified?.success === false || verified?.data?.transactionId !== providerTxnId) {
      console.error('PalPlus callback verification failed:', verification.status, verified?.error?.code || '');
      return new Response(
        JSON.stringify({ success: false, error: 'Could not verify transaction' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const verifiedTxn = verified.data;
    const externalReference: string | undefined = verifiedTxn.accountReference;
    const status = String(verifiedTxn.status || '').toUpperCase();
    const mpesaCode: string | null = verifiedTxn.mpesaReceipt ?? verifiedTxn.mpesa_receipt ?? null;
    if (!externalReference || !status) {
      return new Response(
        JSON.stringify({ success: false, error: 'Verified transaction is incomplete' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newStatus = status === 'SUCCESS' ? 'completed' : 'failed';

    const { data: existing, error: lookupError } = await supabase
      .from('payments')
      .select('id, amount, provider_txn_id, payment_status, buyer_email, buyer_name, user_id, package_type')
      .eq('transaction_id', externalReference)
      .eq('provider_txn_id', providerTxnId)
      .maybeSingle();

    if (lookupError || !existing || Number(existing.amount) !== Number(verifiedTxn.amount)) {
      console.error('Verified payment did not match a local record:', lookupError?.message || providerTxnId);
      return new Response(
        JSON.stringify({ success: false, error: 'Payment record mismatch' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const wasAlreadyCompleted = existing.payment_status === 'completed';

    const { data: payment, error: updateError } = await supabase
      .from('payments')
      .update({
        payment_status: newStatus,
        mpesa_code: mpesaCode,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .maybeSingle();

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update payment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // A successful payment gets one confirmation email and one in-app notification.
    // The idempotency check prevents repeated provider callbacks from sending duplicates.
    if (newStatus === 'completed' && !wasAlreadyCompleted && existing.user_id) {
      const userId = existing.user_id;
      const amount = Number(existing.amount || verifiedTxn.amount || 0);
      const packageLabel = String(existing.package_type || 'subscription');
      const receipt = mpesaCode || externalReference;
      const title = 'Subscription payment confirmed';
      const message = `Your Ompath Study payment of KES ${amount.toLocaleString()} has been confirmed. M-Pesa receipt: ${receipt}. Your paid access is being activated.`;
      const actionUrl = '/account';

      // Create a campaign record so the payment notification fits the existing
      // notification system and can be opened from the notification centre.
      const { data: campaign, error: campaignError } = await supabase
        .from('notification_campaigns')
        .insert({
          title,
          message,
          action_url: actionUrl,
          audience: 'all_users',
          study_year: null,
          status: 'sent',
          recipient_count: 1,
          delivered_count: 1,
          failed_count: 0,
          created_by: userId,
          sent_at: new Date().toISOString(),
          type: 'general',
          priority: 'urgent',
        })
        .select('id')
        .single();

      if (campaignError) {
        console.error('Payment notification campaign creation failed:', campaignError);
      } else {
        const { error: notificationError } = await supabase
          .from('user_notifications')
          .insert({
            campaign_id: campaign.id,
            user_id: userId,
            title,
            message,
            action_url: actionUrl,
            type: 'general',
            priority: 'urgent',
            study_year: null,
            email_status: 'pending',
          });
        if (notificationError) console.error('Payment in-app notification failed:', notificationError);

        const recipientEmail = String(existing.buyer_email || '').trim();
        const resendKey = Deno.env.get('RESEND_API_KEY');
        const from = Deno.env.get('NOTIFICATION_FROM_EMAIL') || 'Ompath Study <notifications@ompathstudy.com>';

        if (recipientEmail && resendKey) {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from,
              to: [recipientEmail],
              subject: title,
              text: `${message}\n\nPackage: ${packageLabel}\nTransaction: ${externalReference}\n\nOpen Ompath Study: https://www.ompathstudy.com/account`,
              html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h2 style="color:#0f766e">Ompath Study</h2><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><p><strong>Package:</strong> ${escapeHtml(packageLabel)}</p><p><strong>Transaction:</strong> ${escapeHtml(externalReference)}</p><p><a href="https://www.ompathstudy.com/account" style="display:inline-block;padding:12px 18px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px">Open My Account</a></p><p style="font-size:12px;color:#64748b">This is your payment confirmation from Ompath Study.</p></div>`,
            }),
          });

          if (response.ok) {
            await supabase.from('user_notifications')
              .update({ email_status: 'sent', email_error: null })
              .eq('campaign_id', campaign.id).eq('user_id', userId);
          } else {
            const errorText = (await response.text()).slice(0, 500);
            console.error('Payment confirmation email failed:', errorText);
            await supabase.from('user_notifications')
              .update({ email_status: 'failed', email_error: errorText })
              .eq('campaign_id', campaign.id).eq('user_id', userId);
          }
        } else {
          const reason = !recipientEmail ? 'No buyer email on payment record' : 'Email provider is not configured';
          console.warn('Payment confirmation email skipped:', reason);
          await supabase.from('user_notifications')
            .update({ email_status: 'skipped', email_error: reason })
            .eq('campaign_id', campaign.id).eq('user_id', userId);
        }
      }
    }

    console.log('Payment updated:', payment?.id, 'Status:', newStatus);

    return new Response(
      JSON.stringify({ success: true, status: newStatus, transaction_id: externalReference ?? providerTxnId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
