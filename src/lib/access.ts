import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSetting } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { isNativeApp } from "@/hooks/useMobileApp";

export interface AccessPlan {
  id: string;
  label: string;
  price: number;
  days: number;
  download?: boolean;
}

export interface PaymentSettings {
  /** 0 = everything free */
  price: number;
  /** fraction of a locked page that stays visible (0.25 = 75% hidden) */
  freeRatio: number;
  /** Reveal price in KES. 0 = Reveal is free; non-zero = subscription required. */
  revealPrice: number;
  downloadEnabled: boolean;
  plans: AccessPlan[];
}

export const DEFAULT_PLANS: AccessPlan[] = [
  { id: "semester", label: "Semester pass (3 months)", price: 300, days: 90, download: true },
  { id: "annual", label: "Annual pass (12 months)", price: 1000, days: 365, download: true },
];

export const DEFAULT_SETTINGS: PaymentSettings = {
  price: 0,
  freeRatio: 0.25,
  revealPrice: 5,
  downloadEnabled: true,
  plans: DEFAULT_PLANS,
};

const PASS_KEY = "ompath_access_pass";
const PASS_EVENT = "ompath:access-pass-changed";
let settingsCache: { at: number; value: PaymentSettings } | null = null;
let linkedAccountCache: { key: string; at: number; value: AccountInfo } | null = null;
let linkedAccountPromise: { key: string; promise: Promise<AccountInfo> } | null = null;

export function normalizePassCode(value: string): string {
  return (value || "").trim().toUpperCase().replace(/\s+/g, "-").replace(/[^A-Z0-9-]/g, "");
}

async function accountFields(): Promise<{ email?: string; user_id?: string }> {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return {};
    return { user_id: user.id, email: user.email ?? undefined };
  } catch {
    return {};
  }
}

export async function loadPaymentSettings(force = false): Promise<PaymentSettings> {
  if (!force && settingsCache && Date.now() - settingsCache.at < 5 * 60_000) return settingsCache.value;
  try {
    const [priceRaw, ratioRaw, revealRaw, downloadRaw, plansRaw] = await Promise.all([
      getSetting("access_price_kes"),
      getSetting("paywall_free_ratio"),
      getSetting("reveal_price_kes"),
      getSetting("pdf_download_enabled"),
      getSetting("access_plans"),
    ]);
    let plans = DEFAULT_PLANS;
    try {
      const parsed = JSON.parse(plansRaw || "[]");
      if (Array.isArray(parsed) && parsed.length) plans = parsed as AccessPlan[];
    } catch { /* keep defaults */ }
    const ratio = Number(ratioRaw);
    const sitePrice = priceRaw === "" ? 0 : Math.max(0, Number(priceRaw) || 0);
    const parsedReveal = Number(revealRaw);
    const revealPrice = revealRaw === ""
      ? sitePrice
      : Math.max(0, Number.isFinite(parsedReveal) ? parsedReveal : sitePrice);
    const value: PaymentSettings = {
      price: sitePrice,
      freeRatio: Number.isFinite(ratio) && ratio > 0 && ratio < 1 ? ratio : 0.25,
      revealPrice,
      downloadEnabled: (downloadRaw || "true") !== "false",
      plans,
    };
    settingsCache = { at: Date.now(), value };
    return value;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export interface AccessPass {
  code: string;
  plan: string;
  expires_at: string;
  allow_download: boolean;
}

export function readStoredPass(): AccessPass | null {
  try {
    const raw = localStorage.getItem(PASS_KEY);
    if (!raw) return null;
    const pass = JSON.parse(raw) as AccessPass;
    if (!pass?.code || !pass?.expires_at) return null;
    if (new Date(pass.expires_at).getTime() < Date.now()) {
      localStorage.removeItem(PASS_KEY);
      return null;
    }
    return pass;
  } catch {
    return null;
  }
}

export function storePass(pass: AccessPass) {
  try { localStorage.setItem(PASS_KEY, JSON.stringify(pass)); } catch { /* ignore */ }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PASS_EVENT, { detail: pass }));
}

export function clearPass() {
  try { localStorage.removeItem(PASS_KEY); } catch { /* ignore */ }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PASS_EVENT));
}

export async function verifyCode(code: string): Promise<{ ok: boolean; pass?: AccessPass; error?: string }> {
  const { data, error } = await supabase.functions.invoke("access-code", {
    body: { action: "verify", code: normalizePassCode(code), ...(await accountFields()) },
  });
  if (error) return { ok: false, error: "Could not check that code. Try again." };
  if (!data?.valid) return { ok: false, error: data?.error || "Invalid code." };
  const pass: AccessPass = {
    code: data.code,
    plan: data.plan,
    expires_at: data.expires_at,
    allow_download: data.allow_download !== false,
  };
  storePass(pass);
  return { ok: true, pass };
}

export async function issuePassForPayment(transactionId: string, plan?: string): Promise<AccessPass | null> {
  const { data, error } = await supabase.functions.invoke("access-code", {
    body: { action: "issue", transaction_id: transactionId, plan, ...(await accountFields()) },
  });
  if (error || !data?.success) return null;
  const pass: AccessPass = {
    code: data.code,
    plan: data.plan,
    expires_at: data.expires_at,
    allow_download: data.allow_download !== false,
  };
  storePass(pass);
  return pass;
}

export async function renamePassCode(currentCode: string, newCode: string): Promise<{ ok: boolean; pass?: AccessPass; error?: string }> {
  const { data, error } = await supabase.functions.invoke("access-code", {
    body: { action: "rename", code: currentCode, new_code: normalizePassCode(newCode), ...(await accountFields()) },
  });
  if (error) return { ok: false, error: "Could not change the code. Try again." };
  if (!data?.success) return { ok: false, error: data?.error || "Could not change the code." };
  const pass: AccessPass = {
    code: data.code,
    plan: data.plan,
    expires_at: data.expires_at,
    allow_download: data.allow_download !== false,
  };
  storePass(pass);
  return { ok: true, pass };
}

export interface AccountInfo {
  found: boolean;
  code?: string;
  plan?: string;
  amount?: number;
  expires_at?: string;
  expired?: boolean;
  allow_download?: boolean;
}

export async function fetchAccount(code?: string): Promise<AccountInfo> {
  const account = await accountFields();
  const { data, error } = await supabase.functions.invoke("access-code", {
    body: { action: "account", code: account.user_id ? undefined : (code ? normalizePassCode(code) : undefined), ...account },
  });
  if (error || !data) return { found: false };
  return data as AccountInfo;
}

function loadLinkedAccount(key: string): Promise<AccountInfo> {
  if (linkedAccountCache?.key === key && Date.now() - linkedAccountCache.at < 60_000) {
    return Promise.resolve(linkedAccountCache.value);
  }
  if (linkedAccountPromise?.key === key) return linkedAccountPromise.promise;
  const promise = fetchAccount()
    .then((value) => {
      linkedAccountCache = { key, at: Date.now(), value };
      return value;
    })
    .finally(() => {
      if (linkedAccountPromise?.key === key) linkedAccountPromise = null;
    });
  linkedAccountPromise = { key, promise };
  return promise;
}

export function useAccess() {
  const { isAdmin, user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [pass, setPass] = useState<AccessPass | null>(() => readStoredPass());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const syncPass = () => setPass(readStoredPass());
    window.addEventListener(PASS_EVENT, syncPass);
    window.addEventListener("storage", syncPass);
    return () => {
      window.removeEventListener(PASS_EVENT, syncPass);
      window.removeEventListener("storage", syncPass);
    };
  }, []);

  useEffect(() => {
    let active = true;
    loadPaymentSettings().then((s) => {
      if (!active) return;
      setSettings(s);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    const accountKey = `${user.id}:${user.email || ""}`;
    loadLinkedAccount(accountKey).then((info) => {
      if (!active || !info.found || info.expired || !info.code || !info.expires_at) return;
      const linked: AccessPass = {
        code: info.code,
        plan: info.plan || "subscription",
        expires_at: info.expires_at,
        allow_download: info.allow_download !== false,
      };
      storePass(linked);
      setPass(linked);
    });
    return () => { active = false; };
  }, [authLoading, user]);

  const refresh = useCallback(() => {
    setPass(readStoredPass());
    loadPaymentSettings(true).then(setSettings);
  }, []);

  const isApp = isNativeApp();
  const isFree = (settings?.price ?? 0) <= 0;
  const hasPass = !!pass;
  const ownerAccess = isAdmin;
  const revealIsFree = (settings?.revealPrice ?? DEFAULT_SETTINGS.revealPrice) <= 0;
  return {
    loading,
    settings: settings ?? DEFAULT_SETTINGS,
    pass,
    isFree,
    hasPass,
    isApp,
    unlocked: isFree || hasPass || ownerAccess,
    /** Reveal is independently controlled: 0 = free; otherwise a valid paid pass is required. */
    canReveal: revealIsFree || hasPass,
    canDownload: ownerAccess || ((settings?.downloadEnabled ?? true) && !!pass?.allow_download),
    applyPass: (p: AccessPass) => setPass(p),
    signOutPass: () => { clearPass(); setPass(null); },
    refresh,
  };
}

export function freeItemCount(total: number, freeRatio: number): number {
  if (total <= 2) return total;
  return Math.max(1, Math.floor(total * freeRatio));
}
