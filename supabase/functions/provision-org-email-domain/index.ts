// Provisions a Resend sending subdomain for an association or company,
// writes the DKIM/SPF/MX records into Cloudflare DNS for smbconnect.in,
// and persists the resend domain id + status on the org row.
//
// Idempotent: if the org already has an email_subdomain + resend_id, this
// function only refreshes the verification status from Resend.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PARENT_DOMAIN = "smbconnect.in";
const CLOUDFLARE_ZONE_ID = "498043c01f32fc2f96fe97f7c7c4acf0";
const RESEND_REGION = "eu-west-1";

interface ProvisionRequest {
  org_type: "association" | "company";
  org_id: string;
}

interface ResendDnsRecord {
  record: string;
  name: string;
  type: string;
  value: string;
  ttl?: string | number;
  priority?: number;
  status?: string;
}

interface ResendDomain {
  id: string;
  name: string;
  status: string;
  records?: ResendDnsRecord[];
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function tableFor(orgType: "association" | "company"): string {
  return orgType === "association" ? "associations" : "companies";
}

async function findUniqueSubdomain(
  supabase: ReturnType<typeof createClient>,
  base: string,
): Promise<string> {
  let candidate = base;
  let suffix = 1;
  while (true) {
    const [{ data: assoc }, { data: company }] = await Promise.all([
      supabase.from("associations").select("id").eq("email_subdomain", candidate).maybeSingle(),
      supabase.from("companies").select("id").eq("email_subdomain", candidate).maybeSingle(),
    ]);
    if (!assoc && !company) return candidate;
    suffix++;
    candidate = `${base}-${suffix}`;
  }
}

async function createResendDomain(
  apiKey: string,
  fqdn: string,
): Promise<ResendDomain> {
  const res = await fetch("https://api.resend.com/domains", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: fqdn, region: RESEND_REGION }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend create domain failed (${res.status}): ${text}`);
  }
  return await res.json();
}

async function getResendDomain(
  apiKey: string,
  resendId: string,
): Promise<ResendDomain> {
  const res = await fetch(`https://api.resend.com/domains/${resendId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend get domain failed (${res.status}): ${text}`);
  }
  return await res.json();
}

interface CloudflareRecordCreate {
  type: string;
  name: string;
  content: string;
  ttl?: number;
  priority?: number;
}

async function listCloudflareRecords(
  apiToken: string,
  name: string,
): Promise<Array<{ id: string; type: string; name: string; content: string }>> {
  const url = `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records?name=${encodeURIComponent(name)}&per_page=100`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiToken}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudflare list records failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  return json.result || [];
}

async function createCloudflareRecord(
  apiToken: string,
  record: CloudflareRecordCreate,
): Promise<void> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: 1, ...record }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    if (text.includes("identical record already exists") || text.includes("81057") || text.includes("81058")) {
      return;
    }
    throw new Error(`Cloudflare create record failed (${res.status}) for ${record.name}: ${text}`);
  }
}

function normalizeContent(value: string, type: string): string {
  let v = value.trim();
  if (type === "TXT") {
    if (!v.startsWith('"')) v = `"${v.replace(/"/g, '\\"')}"`;
  }
  return v;
}

async function pushRecordsToCloudflare(
  cfToken: string,
  records: ResendDnsRecord[],
): Promise<void> {
  for (const rec of records) {
    const type = rec.type.toUpperCase();
    const name = rec.name.endsWith(".") ? rec.name.slice(0, -1) : rec.name;
    const cfRecord: CloudflareRecordCreate = {
      type,
      name,
      content: type === "TXT" ? normalizeContent(rec.value, "TXT") : rec.value,
    };
    if (type === "MX") {
      cfRecord.priority = rec.priority ?? 10;
    }
    const existing = await listCloudflareRecords(cfToken, name);
    const same = existing.find(
      (r) => r.type === type && r.content.replace(/^"|"$/g, "") === rec.value.replace(/^"|"$/g, ""),
    );
    if (same) continue;
    await createCloudflareRecord(cfToken, cfRecord);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const cfToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
    if (!resendApiKey || !cfToken) {
      throw new Error("RESEND_API_KEY or CLOUDFLARE_API_TOKEN not configured");
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { org_type, org_id }: ProvisionRequest = await req.json();
    if (!org_type || !org_id) {
      throw new Error("org_type and org_id are required");
    }
    if (org_type !== "association" && org_type !== "company") {
      throw new Error("org_type must be 'association' or 'company'");
    }

    const table = tableFor(org_type);
    const { data: org, error: orgErr } = await supabase
      .from(table)
      .select("id, name, email_subdomain, email_domain_resend_id, email_domain_status")
      .eq("id", org_id)
      .maybeSingle();

    if (orgErr) throw orgErr;
    if (!org) throw new Error(`${org_type} ${org_id} not found`);

    let subdomain: string = (org as any).email_subdomain;
    let resendId: string | null = (org as any).email_domain_resend_id;
    let resendDomain: ResendDomain;

    if (resendId) {
      resendDomain = await getResendDomain(resendApiKey, resendId);
    } else {
      const baseSlug = slugify((org as any).name);
      if (!baseSlug) throw new Error(`org name "${(org as any).name}" produces empty slug`);
      subdomain = await findUniqueSubdomain(supabase, baseSlug);
      const fqdn = `${subdomain}.${PARENT_DOMAIN}`;
      resendDomain = await createResendDomain(resendApiKey, fqdn);
      resendId = resendDomain.id;
    }

    if (resendDomain.records && resendDomain.records.length > 0) {
      await pushRecordsToCloudflare(cfToken, resendDomain.records);
    }

    const verified = resendDomain.status === "verified";
    const status = verified ? "verified" : "pending";

    const { error: updErr } = await supabase
      .from(table)
      .update({
        email_subdomain: subdomain,
        email_domain_resend_id: resendId,
        email_domain_status: status,
        email_domain_verified_at: verified ? new Date().toISOString() : null,
        email_domain_provisioned_at: new Date().toISOString(),
      })
      .eq("id", org_id);

    if (updErr) throw updErr;

    return new Response(
      JSON.stringify({
        success: true,
        org_type,
        org_id,
        subdomain,
        fqdn: `${subdomain}.${PARENT_DOMAIN}`,
        resend_id: resendId,
        status,
        records_pushed: resendDomain.records?.length ?? 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("provision-org-email-domain error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
