// Shared helper for picking the From address on outbound email.
// Uses the sending org's verified Resend subdomain when available, falls
// back to SMB Connect's apex domain when the org is missing, unverified,
// or the caller is the Apex Superadmin context.

const FALLBACK_DOMAIN = "smbconnect.in";
const FALLBACK_NAME = "SMB Connect";

export interface OrgIdent {
  type: "association" | "company";
  id: string;
}

interface OrgRow {
  name?: string | null;
  email_subdomain?: string | null;
  email_domain_status?: string | null;
}

function formatFrom(displayName: string, localPart: string, domain: string): string {
  return `${displayName} <${localPart}@${domain}>`;
}

export async function getOrgFromAddress(
  supabase: any,
  org: OrgIdent | null | undefined,
  options?: { displayName?: string | null; localPart?: string },
): Promise<string> {
  const localPart = options?.localPart || "noreply";
  if (!org?.id || !org?.type) {
    return formatFrom(options?.displayName || FALLBACK_NAME, localPart, FALLBACK_DOMAIN);
  }

  const table = org.type === "association" ? "associations" : "companies";
  const { data } = await supabase
    .from(table)
    .select("name, email_subdomain, email_domain_status")
    .eq("id", org.id)
    .maybeSingle();
  const row = data as OrgRow | null;

  const displayName = options?.displayName || row?.name || FALLBACK_NAME;

  if (row?.email_domain_status === "verified" && row?.email_subdomain) {
    return formatFrom(displayName, localPart, `${row.email_subdomain}.${FALLBACK_DOMAIN}`);
  }
  return formatFrom(displayName, localPart, FALLBACK_DOMAIN);
}
