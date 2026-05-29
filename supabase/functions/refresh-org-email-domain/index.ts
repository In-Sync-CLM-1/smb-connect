// Refreshes verification status for one or all org email subdomains.
// Triggers Resend verification, polls status, and persists verified state
// to the corresponding associations / companies row.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RefreshRequest {
  org_type?: "association" | "company";
  org_id?: string;
}

interface Pending {
  table: "associations" | "companies";
  id: string;
  resend_id: string;
}

async function triggerVerify(apiKey: string, resendId: string): Promise<void> {
  await fetch(`https://api.resend.com/domains/${resendId}/verify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
  }).catch(() => {});
}

async function getStatus(apiKey: string, resendId: string): Promise<string | null> {
  const res = await fetch(`https://api.resend.com/domains/${resendId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.status ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  let request: RefreshRequest = {};
  try {
    if (req.method === "POST") request = await req.json();
  } catch { /* allow empty body */ }

  const targets: Pending[] = [];

  if (request.org_type && request.org_id) {
    const table = request.org_type === "association" ? "associations" : "companies";
    const { data } = await supabase
      .from(table)
      .select("id, email_domain_resend_id, email_domain_status")
      .eq("id", request.org_id)
      .maybeSingle();
    if (data && (data as any).email_domain_resend_id) {
      targets.push({ table, id: (data as any).id, resend_id: (data as any).email_domain_resend_id });
    }
  } else {
    for (const table of ["associations", "companies"] as const) {
      const { data } = await supabase
        .from(table)
        .select("id, email_domain_resend_id")
        .neq("email_domain_status", "verified")
        .not("email_domain_resend_id", "is", null);
      for (const row of (data || []) as any[]) {
        targets.push({ table, id: row.id, resend_id: row.email_domain_resend_id });
      }
    }
  }

  const results: Array<{ table: string; id: string; status: string | null }> = [];

  for (const t of targets) {
    let status = await getStatus(resendApiKey, t.resend_id);
    if (status !== "verified") {
      await triggerVerify(resendApiKey, t.resend_id);
      await new Promise((r) => setTimeout(r, 500));
      status = await getStatus(resendApiKey, t.resend_id);
    }

    if (status === "verified") {
      await supabase
        .from(t.table)
        .update({
          email_domain_status: "verified",
          email_domain_verified_at: new Date().toISOString(),
        })
        .eq("id", t.id);
    } else if (status === "failure") {
      await supabase
        .from(t.table)
        .update({ email_domain_status: "failed" })
        .eq("id", t.id);
    }
    results.push({ table: t.table, id: t.id, status });

    await new Promise((r) => setTimeout(r, 250));
  }

  return new Response(
    JSON.stringify({ success: true, count: results.length, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
