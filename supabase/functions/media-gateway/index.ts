import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const allowed = (
  Deno.env.get("ALLOWED_ORIGINS") ||
  "http://127.0.0.1:5173,http://localhost:5173,https://feraz-hub.github.io"
)
  .split(",")
  .map((s) => s.trim());
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const check = (result: any) => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};
async function readBounded(req: Request, limit: number) {
  const declared = Number(req.headers.get("Content-Length"));
  if (declared && declared !== limit)
    throw new Error("File size does not match its reservation.");
  const reader = req.body?.getReader();
  if (!reader) throw new Error("Empty upload.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error("File exceeds its reserved size.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (size !== limit)
    throw new Error("File size does not match its reservation.");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  const cors: Record<string, string> = {
    "Access-Control-Allow-Origin": allowed.includes(origin)
      ? origin
      : allowed[0],
    Vary: "Origin",
    "Access-Control-Allow-Headers": "authorization,apikey,content-type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  if (origin && !allowed.includes(origin))
    return json(
      { error: "This origin is not configured for Nightshift." },
      403,
    );
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  try {
    const parts = new URL(req.url).pathname.split("/").filter(Boolean);
    const gateway = parts.indexOf("media-gateway");
    const action = parts[gateway + 1];
    const id = parts[gateway + 2];
    const token = req.headers.get("Authorization")?.replace(/^Bearer /i, "");
    let user: any = null;
    if (token) {
      const { data, error } = await admin.auth.getUser(token);
      if (error) throw new Error("Your session expired. Sign in again.");
      user = data.user;
    }
    const requireUser = () => {
      if (!user) throw new Error("Sign in to use this feature.");
    };
    const body = async () => {
      const text = await req.text();
      if (text.length > 200000) throw new Error("Request is too large.");
      return JSON.parse(text);
    };
    const isMod = async () =>
      user &&
      !!check(
        await admin
          .from("moderators")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle(),
      );
    const getMedia = async (mediaId: string) => {
      if (!uuid.test(mediaId || ""))
        throw new Error("Invalid media identifier.");
      const row = check(
        await admin
          .from("media")
          .select("*")
          .eq("id", mediaId)
          .neq("status", "deleted")
          .single(),
      );
      if (!row) throw new Error("Upload not found.");
      return row;
    };
    const bucket = (m: any) =>
      m.kind === "music" ? "private-music" : "community-clips";
    const path = (m: any) => `${m.owner_id}/${m.id}`;
    if (action === "usage" && req.method === "GET")
      return json(check(await admin.rpc("media_usage")));
    if (action === "me" && req.method === "GET") {
      requireUser();
      return json({ moderator: await isMod() });
    }
    if (action === "reserve" && req.method === "POST") {
      requireUser();
      const meta = await body();
      if (meta.kind === "clip" && meta.rights_confirmed !== true)
        throw new Error("Confirm ownership or permission before sharing.");
      if (typeof meta.title !== "string" || !meta.title.trim())
        throw new Error("Add a title.");
      if (meta.kind === "clip")
        meta.artist = (
          user.user_metadata?.display_name || "Community member"
        ).slice(0, 120);
      const row = check(
        await admin.rpc("reserve_media", { p_user: user.id, p_meta: meta }),
      );
      return json({ id: row.id });
    }
    if (action === "upload" && req.method === "PUT") {
      requireUser();
      const row = await getMedia(id);
      if (row.owner_id !== user.id || row.status !== "reserved")
        throw new Error("This upload reservation is unavailable.");
      // Atomic claim prevents concurrent overwrites of a reservation.
      const claimed = check(
        await admin
          .from("media")
          .update({ status: "uploading" })
          .eq("id", id)
          .eq("status", "reserved")
          .select("id"),
      );
      if (!claimed?.length)
        throw new Error("This upload is already in progress.");
      const bytes = await readBounded(req, row.size);
      if (
        bytes.byteLength !== row.size ||
        req.headers.get("Content-Type") !== row.mime
      ) {
        await admin.from("media").update({ status: "reserved" }).eq("id", id);
        throw new Error("File size or format does not match its reservation.");
      }
      // MIME is allowlisted by SQL; the browser also checks codec playability.
      const { error } = await admin.storage
        .from(bucket(row))
        .upload(path(row), bytes, {
          contentType: row.mime,
          upsert: false,
          cacheControl: "0",
        });
      if (error)
        throw new Error(
          "Storage upload failed. Reservation retained; delete it from My account before retrying.",
        );
      check(
        await admin
          .from("media")
          .update({
            status: row.kind === "music" ? "private" : "pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", id),
      );
      return json({ ok: true });
    }
    if (action === "stream" && req.method === "GET") {
      const row = await getMedia(id);
      const publicClip = row.kind === "clip" && row.status === "approved";
      if (
        !publicClip &&
        (!user || row.owner_id !== user.id) &&
        !(row.kind === "clip" && (await isMod()))
      )
        throw new Error("This upload is private or not approved.");
      if (["reserved", "uploading", "deleting"].includes(row.status))
        throw new Error("This upload is not ready.");
      check(await admin.rpc("reserve_stream", { p_bytes: row.size }));
      // Full-object fetching enables local seeking without range-request egress surprises.
      // No signed storage URL or service credential ever reaches the browser.
      const { data, error } = await admin.storage
        .from(bucket(row))
        .download(path(row));
      if (error || !data)
        throw new Error(
          "This file is unavailable. Its bandwidth reservation is retained conservatively.",
        );
      return new Response(data, {
        headers: {
          ...cors,
          "Content-Type": row.mime,
          "Content-Length": String(data.size),
        },
      });
    }
    if (action === "delete" && req.method === "POST") {
      requireUser();
      const input = await body();
      const row = await getMedia(input.id);
      if (row.owner_id !== user.id && !(row.kind === "clip" && (await isMod())))
        throw new Error("You can only delete your own uploads.");
      if (row.status === "uploading")
        throw new Error(
          "Wait for this upload to finish. An administrator can recover interrupted uploads after checking Storage.",
        );
      const claimed = check(
        await admin
          .from("media")
          .update({ status: "deleting" })
          .eq("id", row.id)
          .eq("status", row.status)
          .select("id"),
      );
      if (!claimed?.length)
        throw new Error("The upload changed. Refresh and try deleting again.");
      check(await admin.storage.from(bucket(row)).remove([path(row)]));
      check(
        await admin
          .from("media")
          .update({
            status: "deleted",
            cover: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id),
      );
      return json({ ok: true });
    }
    if (action === "edit" && req.method === "POST") {
      requireUser();
      const input = await body();
      const row = await getMedia(input.id);
      if (row.owner_id !== user.id || row.kind !== "music")
        throw new Error("You can only edit your own music.");
      if (
        !String(input.title || "").trim() ||
        !String(input.artist || "").trim()
      )
        throw new Error("Title and artist are required.");
      check(
        await admin
          .from("media")
          .update({
            title: input.title.trim(),
            artist: input.artist.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id),
      );
      return json({ ok: true });
    }
    if (action === "report" && req.method === "POST") {
      requireUser();
      const input = await body();
      if (!uuid.test(input.id || "")) throw new Error("Invalid clip.");
      check(
        await admin.rpc("submit_report", {
          p_user: user.id,
          p_clip: input.id,
          p_reason: String(input.reason || ""),
        }),
      );
      return json({ ok: true });
    }
    if (action === "moderate" && req.method === "POST") {
      requireUser();
      if (!(await isMod())) throw new Error("Moderator access required.");
      const input = await body();
      const row = await getMedia(input.id);
      if (
        row.kind !== "clip" ||
        !["pending", "approved", "hidden"].includes(row.status) ||
        !["approved", "hidden"].includes(input.status)
      )
        throw new Error("Invalid moderation action.");
      check(
        await admin
          .from("media")
          .update({
            status: input.status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id),
      );
      return json({ ok: true });
    }
    if (action === "state") {
      requireUser();
      if (req.method === "GET")
        return json(
          check(
            await admin
              .from("player_state")
              .select("state")
              .eq("owner_id", user.id)
              .maybeSingle(),
          ) || { state: {} },
        );
      if (req.method === "POST") {
        const input = await body();
        if (JSON.stringify(input.state).length > 10000)
          throw new Error("Playlist state is too large.");
        check(
          await admin.from("player_state").upsert({
            owner_id: user.id,
            state: input.state,
            updated_at: new Date().toISOString(),
          }),
        );
        return json({ ok: true });
      }
    }
    return json({ error: "Unknown media operation." }, 404);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed.";
    return json(
      { error: message },
      message.includes("Sign in") || message.includes("session expired")
        ? 401
        : 400,
    );
  }
});
