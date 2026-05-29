-- pg_cron jobs retired 2026-05-30. All scheduled tasks are now Cloudflare Workers,
-- one Worker per task, deployed by .github/workflows/cron-worker-deploy.yml from
-- cron-worker/jobs.txt. The historical migrations that originally created
-- cron.schedule(...) entries with embedded pg_net.http_post(...) calls are
-- baselined as applied; this migration is idempotent — it just confirms the
-- cleanup for fresh clones.
do $$
declare j record;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for j in select jobid from cron.job loop
      perform cron.unschedule(j.jobid);
    end loop;
  end if;
end $$;