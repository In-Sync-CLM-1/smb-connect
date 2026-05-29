// smb-connect external scheduler — ONE Cloudflare Worker per task.
// Each deployed Worker sets TARGET_FN (and optional BODY) in its config and
// runs its own cron trigger, POSTing to that single function. Replaces in-DB
// pg_cron + pg_net.
const FN_BASE = "https://zcmfxpknsybponbudyqb.supabase.co/functions/v1";
const RPC_BASE = "https://zcmfxpknsybponbudyqb.supabase.co/rest/v1/rpc";

async function tick(env) {
  if (!env.TARGET_FN) return new Response("no TARGET_FN configured\n", { status: 500 });
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  let url, headers;
  if (env.TARGET_FN.startsWith("rpc:")) {
    url = `${RPC_BASE}/${env.TARGET_FN.slice(4)}`;
    headers = { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` };
  } else {
    url = `${FN_BASE}/${env.TARGET_FN}`;
    headers = { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
  }
  const body = env.BODY || "{}";
  const res = await fetch(url, { method: "POST", headers, body }).catch((e) => new Response(String(e), { status: 502 }));
  return new Response(`${env.TARGET_FN}: ${res.status}\n`);
}

export default {
  async scheduled(_event, env, _ctx) { await tick(env); },
  async fetch(_req, env) { return tick(env); },
};
