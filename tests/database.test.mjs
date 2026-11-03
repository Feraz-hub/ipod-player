import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Runs the actual migration against PostgreSQL in WASM. Supabase-owned schemas
// are minimal fixtures; no remote project or credentials are used.
const alice = "10000000-0000-4000-8000-000000000001",
  bob = "10000000-0000-4000-8000-000000000002",
  carol = "10000000-0000-4000-8000-000000000003";
const db = new PGlite();
await db.exec(
  `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; create table auth.users(id uuid primary key); insert into auth.users values ('${alice}'),('${bob}'),('${carol}'); create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); grant usage on schema public,auth to anon,authenticated,service_role;`,
);
const migration = await readFile(
  new URL(
    "../supabase/migrations/202611020001_nightshift.sql",
    import.meta.url,
  ),
  "utf8",
);
await db.exec(
  migration.replace(
    "create extension if not exists pgcrypto;",
    "-- gen_random_uuid is built into this test Postgres.",
  ),
);
await db.exec(await readFile(
  new URL("../supabase/migrations/202611030001_allow_100mb_media.sql", import.meta.url),
  "utf8",
));
const reserve = async (owner, extra = {}) =>
  (
    await db.query("select * from public.reserve_media($1,$2)", [
      owner,
      JSON.stringify({
        kind: "music",
        title: "Private song",
        artist: "Artist",
        duration: 60,
        size: 30_000_000,
        mime: "audio/mpeg",
        ...extra,
      }),
    ])
  ).rows[0];
test("a logical media file can be 100 MB but no larger", async () => {
  const item = await reserve(alice, { size: 100_000_000 });
  assert.equal(Number(item.size), 100_000_000);
  await assert.rejects(
    reserve(alice, { size: 100_000_001 }),
    /100 MB/,
  );
  await db.query("select public.reserve_stream($1)", [100_000_000]);
  await db.exec("delete from public.bandwidth_ledger");
  await db.query("delete from public.media where id=$1", [item.id]);
});
async function asUser(role, id, query, params = []) {
  await db.exec(
    `set role ${role}; select set_config('request.jwt.claim.sub','${id || ""}',false);`,
  );
  try {
    return await db.query(query, params);
  } finally {
    await db.exec("reset role");
  }
}

test("private music is visible only to its owner; approved clips are public", async () => {
  const music = await reserve(alice);
  await db.query("update public.media set status='private' where id=$1", [
    music.id,
  ]);
  const clip = await reserve(alice, {
    kind: "clip",
    title: "Shared night",
    size: 1_000_000,
    mime: "video/mp4",
    rights_confirmed: true,
    source: "https://example.org/original",
    permission: "My original clip, CC0",
  });
  assert.equal(
    (await asUser("anon", null, "select id from public.media")).rows.length,
    0,
  );
  assert.equal(
    (await asUser("authenticated", bob, "select id from public.media")).rows
      .length,
    0,
  );
  assert.equal(
    (await asUser("authenticated", alice, "select id from public.media")).rows
      .length,
    2,
  );
  await db.query("update public.media set status='approved' where id=$1", [
    clip.id,
  ]);
  assert.deepEqual(
    (await asUser("anon", null, "select id from public.media")).rows.map(
      (r) => r.id,
    ),
    [clip.id],
  );
});
test("frontend roles cannot bypass reservations, change metadata or grant moderation", async () => {
  await assert.rejects(
    asUser("authenticated", bob, "select public.reserve_media($1,$2)", [
      bob,
      JSON.stringify({}),
    ]),
    /permission denied/,
  );
  await assert.rejects(
    asUser("anon", null, "select public.reserve_stream(100)"),
    /permission denied/,
  );
  await assert.rejects(
    asUser("authenticated", alice, "update public.media set status='approved'"),
    /permission denied/,
  );
  await assert.rejects(
    asUser("authenticated", alice, "insert into public.moderators values($1)", [
      alice,
    ]),
    /permission denied/,
  );
});
test("aggregate storage includes pending, private and incomplete reservations", async () => {
  await db.exec("update public.app_limits set storage_cap=85000000");
  const row = await reserve(bob);
  await assert.rejects(reserve(bob), /Shared library full/);
  await db.query("update public.media set status='deleting' where id=$1", [
    row.id,
  ]);
  await assert.rejects(reserve(bob), /Shared library full/);
  await db.query("update public.media set status='deleted' where id=$1", [
    row.id,
  ]);
  await assert.doesNotReject(reserve(bob));
});
test("stream reservations stop before the bandwidth ceiling", async () => {
  await db.exec("update public.app_limits set monthly_egress_cap=100000");
  await db.query("select public.reserve_stream(10000)");
  await db.query("select public.reserve_stream(10000)");
  await assert.rejects(
    db.query("select public.reserve_stream(10000)"),
    /Monthly media bandwidth reached/,
  );
  await assert.rejects(
    reserve(bob, { size: 1_000_000 }),
    /Monthly media bandwidth reached/,
  );
  await db.exec("update public.app_limits set monthly_egress_cap=4000000000");
});
test("sharing needs permission; three distinct reports hide a clip", async () => {
  await assert.rejects(
    reserve(bob, {
      kind: "clip",
      size: 100,
      mime: "video/mp4",
      source: "https://example.com/",
      permission: "mine",
    }),
    /check constraint/,
  );
  const clip = (await db.query("select id from public.media where kind='clip'"))
    .rows[0];
  for (const user of [alice, bob, carol])
    await db.query("select public.submit_report($1,$2,$3)", [
      user,
      clip.id,
      "Unlicensed content; please review.",
    ]);
  assert.equal(
    (await db.query("select status from public.media where id=$1", [clip.id]))
      .rows[0].status,
    "hidden",
  );
  assert.equal(
    (
      await asUser("anon", null, "select id from public.media where id=$1", [
        clip.id,
      ])
    ).rows.length,
    0,
  );
});
test("users cannot read another user’s playback state; moderators can see the queue", async () => {
  await db.query(
    "insert into public.player_state(owner_id,state) values($1,$2)",
    [alice, JSON.stringify({ volume: 0.4 })],
  );
  assert.equal(
    (await asUser("authenticated", bob, "select * from public.player_state"))
      .rows.length,
    0,
  );
  assert.equal(
    (await asUser("authenticated", alice, "select * from public.player_state"))
      .rows.length,
    1,
  );
  await db.query("insert into public.moderators values($1)", [carol]);
  const visible = (
    await asUser("authenticated", carol, "select kind from public.media")
  ).rows;
  assert.ok(visible.length > 0);
  assert.ok(
    visible.every((row) => row.kind === "clip"),
    "moderators must not see other users’ private music",
  );
});
test.after(async () => {
  await db.close();
});
