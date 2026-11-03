-- A logical media item can be 100 MB. Storage objects remain at 40 MB or
-- less, so the existing private buckets stay within Supabase Free's limit.
alter table public.media drop constraint if exists media_size_check;
alter table public.media add constraint media_size_check
  check (size between 1 and 100000000);

create or replace function public.reserve_media(p_user uuid,p_meta jsonb)
returns public.media language plpgsql security definer set search_path=public as $$
declare lim public.app_limits; row public.media; used bigint; spent bigint; bytes bigint; media_kind text;
begin
 perform pg_advisory_xact_lock(873401);
 select * into lim from public.app_limits where id=true;
 if not lim.uploads_enabled then raise exception 'Uploads are paused by the administrator.'; end if;
 bytes:=(p_meta->>'size')::bigint; media_kind:=p_meta->>'kind';
 if bytes is null or bytes<1 or bytes>100000000 then raise exception 'Files must be between 1 byte and 100 MB.'; end if;
 if media_kind not in ('music','clip') or media_kind is null then raise exception 'Invalid media type.'; end if;
 if (media_kind='music' and p_meta->>'mime' not in ('audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/aac','audio/ogg','audio/wav','audio/x-wav','audio/flac','audio/webm')) or (media_kind='clip' and p_meta->>'mime' not in ('video/mp4','video/webm','video/quicktime')) then raise exception 'Unsupported file format.'; end if;
 select coalesce(sum(size),0) into used from public.media where status<>'deleted';
 if used+bytes>lim.storage_cap then raise exception 'Shared library full. Uploads paused; existing files are kept.'; end if;
 select coalesce(reserved_bytes,0) into spent from public.bandwidth_ledger where month=date_trunc('month',now())::date;
 if coalesce(spent,0)+bytes*3+16384>lim.monthly_egress_cap then raise exception 'Monthly media bandwidth reached. Uploads resume next month.'; end if;
 if (select count(*) from public.media where owner_id=p_user and created_at>now()-interval '1 day')>=20 then raise exception 'Daily upload limit reached. Try again tomorrow.'; end if;
 insert into public.media(owner_id,kind,title,artist,duration,cover,size,mime,category,source,permission,rights_confirmed)
 values(p_user,media_kind,trim(p_meta->>'title'),coalesce(nullif(trim(p_meta->>'artist'),''),'Unknown artist'),coalesce((p_meta->>'duration')::float,0),nullif(p_meta->>'cover',''),bytes,p_meta->>'mime',p_meta->>'category',p_meta->>'source',p_meta->>'permission',coalesce((p_meta->>'rights_confirmed')::boolean,false)) returning * into row;
 return row;
end $$;

create or replace function public.reserve_stream(p_bytes bigint)
returns void language plpgsql security definer set search_path=public as $$
declare cap bigint; spent bigint; enabled boolean; period date:=date_trunc('month',now())::date; charge bigint;
begin
 perform pg_advisory_xact_lock(873401);
 if p_bytes is null or p_bytes<1 or p_bytes>100000000 then raise exception 'Invalid stream size.'; end if;
 select monthly_egress_cap,streams_enabled into cap,enabled from public.app_limits where id=true;
 if not enabled then raise exception 'Streaming is paused by the administrator.'; end if;
 charge:=p_bytes*3+16384;
 insert into public.bandwidth_ledger(month) values(period) on conflict do nothing;
 select reserved_bytes into spent from public.bandwidth_ledger where month=period;
 if spent+charge>cap then raise exception 'Monthly media bandwidth reached. Try local music until next month.'; end if;
 update public.bandwidth_ledger set reserved_bytes=reserved_bytes+charge where month=period;
end $$;

-- CREATE OR REPLACE preserves existing function privileges. Keep the helpers
-- callable only by the gateway's service role.
revoke execute on function public.reserve_media(uuid,jsonb),public.reserve_stream(bigint)
  from public,anon,authenticated;
grant execute on function public.reserve_media(uuid,jsonb),public.reserve_stream(bigint)
  to service_role;
