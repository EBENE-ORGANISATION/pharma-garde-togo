-- Secret partagé, conservé uniquement dans Vault.
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'fetch_garde_cron') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'fetch_garde_cron', 'Secret partagé cron → fetch-garde'
    );
  end if;
end;
$$;

create or replace function public.verifier_secret_cron(p_secret text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(p_secret <> '' and p_secret = (
    select decrypted_secret from vault.decrypted_secrets where name = 'fetch_garde_cron'
  ), false);
$$;

revoke execute on function public.verifier_secret_cron(text) from public, anon, authenticated;
grant execute on function public.verifier_secret_cron(text) to service_role;

-- Conserver la commande existante, sa clé et les fins de ligne du cron.
do $$
declare
  v_job cron.job%rowtype;
  v_anchor constant text := 'jsonb_build_object(';
  v_entry constant text := '''x-cron-secret'', (select decrypted_secret from vault.decrypted_secrets where name = ''fetch_garde_cron''),';
  v_command text;
begin
  if (select count(*) from cron.job where jobname = 'garde-auto') <> 1 then
    raise exception 'Le job garde-auto doit être unique.';
  end if;
  select * into strict v_job from cron.job where jobname = 'garde-auto';
  if v_job.active is not true then
    raise exception 'Le job garde-auto doit être actif.';
  end if;
  if position('''x-cron-secret''' in v_job.command) > 0 then
    return;
  end if;
  if v_job.command is null or
     (length(v_job.command) - length(replace(v_job.command, v_anchor, ''))) / length(v_anchor) <> 1 then
    raise exception 'Ancre jsonb_build_object( absente ou non unique.';
  end if;
  v_command := replace(v_job.command, v_anchor, v_anchor || v_entry);
  perform cron.alter_job(v_job.jobid, command := v_command);
  if not exists (
    select 1 from cron.job
    where jobid = v_job.jobid and jobname = 'garde-auto' and active
      and schedule = v_job.schedule and command = v_command
      and position(v_entry in command) > 0
  ) then
    raise exception 'Échec de la mise à jour du job garde-auto.';
  end if;
end;
$$;
