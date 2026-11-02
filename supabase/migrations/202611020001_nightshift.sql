-- Run once in a new Supabase Free project. Never expose a service-role key.
create extension if not exists pgcrypto;
create table public.moderators (user_id uuid primary key references auth.users on delete cascade);
alter table public.moderators enable row level security;
create policy "Read own role" on public.moderators for select to authenticated using (user_id=auth.uid());
create function public.is_moderator() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.moderators where user_id=auth.uid())$$;

create table public.app_limits (
 id boolean primary key default true check(id),
 storage_cap bigint not null default 850000000 check(storage_cap between 40000000 and 850000000),
 monthly_egress_cap bigint not null default 4000000000 check(monthly_egress_cap between 1 and 4000000000),
 uploads_enabled boolean not null default true,
 streams_enabled boolean not null default true
);
insert into public.app_limits default values;
alter table public.app_limits enable row level security;
-- No client access. Usage is returned by the gateway, without exposing private rows.
create table public.bandwidth_ledger (month date primary key, reserved_bytes bigint not null default 0 check(reserved_bytes>=0));
alter table public.bandwidth_ledger enable row level security;

create table public.media (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users,
 kind text not null check(kind in ('music','clip')), title text not null check(length(title) between 1 and 120),
 artist text not null default 'Unknown artist' check(length(artist)<=120),
 duration double precision not null default 0 check(duration>=0 and duration<86400),
 cover text check(cover is null or (length(cover)<170000 and cover ~ '^data:image/(jpeg|png|webp);base64,')),
 size bigint not null check(size between 1 and 40000000), mime text not null,
 category text check(length(category)<=100), source text check(length(source)<=500),
 permission text check(length(permission)<=1500), rights_confirmed boolean not null default false,
 status text not null default 'reserved' check(status in ('reserved','uploading','private','pending','approved','hidden','deleting','deleted')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(kind='music' or (rights_confirmed and length(permission)>0 and source ~ '^https?://'))
);
create index media_owner on public.media(owner_id,created_at);
create index media_status on public.media(kind,status);
alter table public.media enable row level security;
create policy "Private music and approved community" on public.media for select to anon,authenticated
 using ((kind='clip' and (status='approved' or public.is_moderator())) or owner_id=auth.uid());
-- No direct INSERT/UPDATE/DELETE: gateway validates all mutations.

create table public.player_state (owner_id uuid primary key references auth.users on delete cascade,state jsonb not null default '{}',updated_at timestamptz not null default now(),check(octet_length(state::text)<12000));
alter table public.player_state enable row level security;
create policy "Read own playback state" on public.player_state for select to authenticated using(owner_id=auth.uid());
-- Gateway owns writes and validates the state payload size.
create table public.clip_reports (id uuid primary key default gen_random_uuid(),clip_id uuid not null references public.media,user_id uuid not null references auth.users,reason text not null check(length(reason) between 10 and 1000),created_at timestamptz not null default now(),unique(clip_id,user_id));
alter table public.clip_reports enable row level security;
create policy "Moderators read reports" on public.clip_reports for select to authenticated using(public.is_moderator());

-- Serialized reservations include in-flight and failed uploads. Never release an
-- uncertain reservation until the Storage API has confirmed file removal.
create function public.reserve_media(p_user uuid,p_meta jsonb) returns public.media
 language plpgsql security definer set search_path=public as $$
declare lim public.app_limits; row public.media; used bigint; spent bigint; bytes bigint; media_kind text;
begin
 perform pg_advisory_xact_lock(873401);
 select * into lim from public.app_limits where id=true;
 if not lim.uploads_enabled then raise exception 'Uploads are paused by the administrator.'; end if;
 bytes:=(p_meta->>'size')::bigint; media_kind:=p_meta->>'kind';
 if bytes is null or bytes<1 or bytes>40000000 then raise exception 'Files must be between 1 byte and 40 MB.'; end if;
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

create function public.reserve_stream(p_bytes bigint) returns void language plpgsql security definer set search_path=public as $$
declare cap bigint; spent bigint; enabled boolean; period date:=date_trunc('month',now())::date; charge bigint;
begin
 perform pg_advisory_xact_lock(873401);
 if p_bytes is null or p_bytes<1 or p_bytes>40000000 then raise exception 'Invalid stream size.'; end if;
 select monthly_egress_cap,streams_enabled into cap,enabled from public.app_limits where id=true;
 if not enabled then raise exception 'Streaming is paused by the administrator.'; end if;
 -- Conservative allowance for Storage→Edge→browser transfer plus request overhead.
 charge:=p_bytes*3+16384;
 insert into public.bandwidth_ledger(month) values(period) on conflict do nothing;
 select reserved_bytes into spent from public.bandwidth_ledger where month=period;
 if spent+charge>cap then raise exception 'Monthly media bandwidth reached. Try local music until next month.'; end if;
 update public.bandwidth_ledger set reserved_bytes=reserved_bytes+charge where month=period;
end $$;

create function public.submit_report(p_user uuid,p_clip uuid,p_reason text) returns void language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(873402);
 if not exists(select 1 from public.media where id=p_clip and kind='clip' and status='approved') then raise exception 'Clip is unavailable.'; end if;
 if (select count(*) from public.clip_reports where user_id=p_user and created_at>now()-interval '1 day')>=5 then raise exception 'Daily report limit reached.'; end if;
 insert into public.clip_reports(clip_id,user_id,reason) values(p_clip,p_user,trim(p_reason));
 if (select count(*) from public.clip_reports where clip_id=p_clip)>=3 then update public.media set status='hidden',updated_at=now() where id=p_clip; end if;
end $$;

create function public.media_usage() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('used',(select coalesce(sum(size),0) from public.media where status<>'deleted'),'cap',storage_cap,'egress',(select coalesce(max(reserved_bytes),0) from public.bandwidth_ledger where month=date_trunc('month',now())::date),'egressCap',monthly_egress_cap) from public.app_limits where id=true
$$;

-- SECURITY DEFINER helpers must never be callable by frontend roles.
revoke execute on function public.reserve_media(uuid,jsonb),public.reserve_stream(bigint),public.submit_report(uuid,uuid,text),public.media_usage() from public,anon,authenticated;
grant execute on function public.reserve_media(uuid,jsonb),public.reserve_stream(bigint),public.submit_report(uuid,uuid,text),public.media_usage() to service_role;
grant execute on function public.is_moderator() to anon,authenticated;
revoke all on public.media,public.moderators,public.player_state,public.clip_reports,public.app_limits,public.bandwidth_ledger from anon,authenticated;
grant select on public.media to anon,authenticated;
grant select on public.moderators,public.player_state,public.clip_reports to authenticated;
grant all on public.media,public.moderators,public.player_state,public.clip_reports,public.app_limits,public.bandwidth_ledger to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('private-music','private-music',false,40000000,array['audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/aac','audio/ogg','audio/wav','audio/x-wav','audio/flac','audio/webm']),
 ('community-clips','community-clips',false,40000000,array['video/mp4','video/webm','video/quicktime'])
 on conflict(id) do nothing;
-- Both buckets stay PRIVATE, including approved clips. Do not add client
-- storage.objects policies. Only the gateway can read/write media objects.
-- Public approved playback is provided by that gateway, not public bucket URLs.
