import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PALPLUSS_BASE = 'https://api.palpluss.com/v1';

function normalizePhoneNumber(phone: string): string {
  phone = (phone || '').trim().replace(/\D+/g, '');
  if (/^254\d{9}$/.test(phone)) return phone;
  if (/^0\d{9}$/.test(phone)) return '254' + phone.substring(1);
  if (/^\d{9}$/.test(phone)) return '254' + phone;
  return phone;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PALPLUSS_API_KEY = Deno.env.get('PALPLUSS_API_KEY');
    const PALPLUSS_CHANNEL_ID = Deno.env.get('PALPLUSS_CHANNEL_ID');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!PALPLUSS_API_KEY) {
      throw new Error('Palpluss API key not configured');
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('Backend credentials not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const bearer = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
    const { data: authData } = bearer ? await supabase.auth.getUser(bearer) : { data: { user: null } };
    const authUser = authData.user;
    if (!authUser?.id || !authUser.email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sign in before making a payment' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const { phone, amount, package_type } = await req.json();

    if (!phone || !amount || amount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Phone and valid amount required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    // accountReference must be <= 12 chars
    const externalReference = `OMP${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`.slice(0, 12);
    const callbackUrl = `${SUPABASE_URL}/functions/v1/payment-callback`;

    const payload: Record<string, unknown> = {
      amount: Number(amount),
      phone: normalizedPhone,
      accountReference: externalReference,
      transactionDesc: 'OmpathStudy'.slice(0, 13),
      callbackUrl,
    };
    if (PALPLUSS_CHANNEL_ID) payload.channelId = PALPLUSS_CHANNEL_ID;

    console.log('Initiating Palpluss STK push:', { ...payload, phone: '***' });

    const res = await fetch(`${PALPLUSS_BASE}/payments/stk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // PalPlus expects its pk_live_/pk_test_ key directly after "Basic".
        // This is intentionally not RFC 7617 username/password Base64.
        'Authorization': `Basic ${PALPLUSS_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json().catch(() => ({}));
    console.log('Palpluss response status:', res.status, JSON.stringify(result?.error ?? result?.data?.status ?? ''));

    if (!res.ok || result?.success === false) {
      const message = typeof result?.error === 'string'
        ? result.error
        : result?.error?.message || 'Payment initiation failed';
      return new Response(
        JSON.stringify({
          success: false,
          error: message,
          code: result?.error?.code,
          details: result?.error?.details,
          request_id: result?.requestId,
        }),
        { status: res.status >= 400 && res.status < 500 ? res.status : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const providerTxnId: string | null = result?.data?.transactionId ?? null;

    const { data: payment, error: dbError } = await supabase
      .from('payments')
      .insert({
        phone_number: normalizedPhone,
        amount: Number(amount),
        payment_status: 'pending',
        transaction_id: externalReference,
        provider_txn_id: providerTxnId,
        package_type: package_type || 'exam',
        buyer_email: authUser.email.toLowerCase(),
        user_id: authUser.id,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save payment record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: payment.id,
        transaction_id: externalReference,
        message: 'STK Push sent. Check your phone.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
