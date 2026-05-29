import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_TABLES = [
  "profiles",
  "associations",
  "association_managers",
  "association_requests",
  "companies",
  "company_admins",
  "company_invitations",
  "company_requests",
  "connections",
  "members",
  "member_invitations",
  "member_invitation_audit",
  "events",
  "event_registrations",
  "event_landing_pages",
  "event_landing_page_pages",
  "event_coupons",
  "event_coupon_usages",
  "event_requisitions",
  "posts",
  "post_likes",
  "post_comments",
  "post_shares",
  "post_bookmarks",
  "post_mentions",
  "notifications",
  "chats",
  "chat_participants",
  "messages",
  "email_lists",
  "email_list_recipients",
  "email_campaigns",
  "email_campaign_recipients",
  "email_campaign_events",
  "email_conversations",
  "email_messages",
  "email_templates",
  "whatsapp_lists",
  "whatsapp_list_recipients",
  "analytics_events",
  "audit_logs",
  "skills",
  "work_experience",
  "education",
  "certifications",
  "key_functionaries",
  "admin_users",
  "password_reset_otps",
];

function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const headerRow = headers.map(escapeCSVValue).join(",");
  const rows = data.map((row) =>
    headers.map((h) => escapeCSVValue(row[h])).join(",")
  );
  return [headerRow, ...rows].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user identity
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin status using service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: adminData } = await supabaseAdmin
      .from("admin_users")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!adminData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request
    const { table } = await req.json();
    if (!table || !ALLOWED_TABLES.includes(table)) {
      return new Response(
        JSON.stringify({
          error: `Invalid table name. Allowed: ${ALLOWED_TABLES.join(", ")}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch all rows using service role (bypasses RLS), paginated
    let allData: Record<string, unknown>[] = [];
    let from = 0;
    const step = 1000;
    while (true) {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select("*")
        .range(from, from + step - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allData = [...allData, ...data];
      if (data.length < step) break;
      from += step;
    }

    // Convert to CSV
    const csv = convertToCSV(allData);
    const timestamp = new Date().toISOString().slice(0, 10);

    return new Response("\uFEFF" + csv, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${table}_${timestamp}.csv"`,
        "X-Row-Count": String(allData.length),
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
