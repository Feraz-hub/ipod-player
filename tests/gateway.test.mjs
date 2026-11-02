import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const alice = "10000000-0000-4000-8000-000000000001",
  bob = "10000000-0000-4000-8000-000000000002";
const songId = "20000000-0000-4000-8000-000000000001",
  clipId = "20000000-0000-4000-8000-000000000002";
let tables,
  events,
  objects,
  handler,
  failRemoval = false;
class Query {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.op = "read";
    this.payload = null;
  }
  select() {
    return this;
  }
  eq(key, value) {
    this.filters.push((r) => r[key] === value);
    return this;
  }
  neq(key, value) {
    this.filters.push((r) => r[key] !== value);
    return this;
  }
  update(value) {
    this.op = "update";
    this.payload = value;
    return this;
  }
  insert(value) {
    this.op = "insert";
    this.payload = value;
    return this;
  }
  upsert(value) {
    this.op = "upsert";
    this.payload = value;
    return this;
  }
  single() {
    return this.run(true);
  }
  maybeSingle() {
    return this.run(true);
  }
  then(resolve, reject) {
    return this.run(false).then(resolve, reject);
  }
  async run(single) {
    let rows = tables[this.table].filter((r) =>
      this.filters.every((f) => f(r)),
    );
    if (this.op === "update") {
      for (const r of rows) Object.assign(r, this.payload);
      events.push(`update:${this.payload.status || this.table}`);
    }
    if (this.op === "insert") {
      tables[this.table].push(this.payload);
      rows = [this.payload];
    }
    if (this.op === "upsert") {
      const row = tables[this.table].find(
        (r) => r.owner_id === this.payload.owner_id,
      );
      if (row) Object.assign(row, this.payload);
      else tables[this.table].push(this.payload);
      rows = [this.payload];
    }
    return {
      data: single ? rows[0] || null : rows.map((r) => ({ ...r })),
      error: null,
    };
  }
}
const admin = {
  auth: {
    getUser: async (token) =>
      token === alice || token === bob
        ? {
            data: {
              user: { id: token, user_metadata: { display_name: "Tester" } },
            },
            error: null,
          }
        : { data: {}, error: { message: "invalid" } },
  },
  from: (table) => new Query(table),
  rpc: async (name, params) => {
    events.push(`rpc:${name}`);
    if (name === "reserve_stream") return { data: null, error: null };
    if (name === "media_usage")
      return {
        data: { used: 0, cap: 850000000, egress: 0, egressCap: 4000000000 },
        error: null,
      };
    return { data: null, error: null };
  },
  storage: {
    from: (bucket) => ({
      download: async (path) => {
        events.push("download");
        return { data: objects.get(`${bucket}/${path}`), error: null };
      },
      upload: async (path, bytes) => {
        events.push("upload");
        objects.set(`${bucket}/${path}`, new Blob([bytes]));
        return { data: {}, error: null };
      },
      remove: async (paths) => {
        events.push("remove");
        if (failRemoval)
          return { data: null, error: { message: "storage unavailable" } };
        paths.forEach((p) => objects.delete(`${bucket}/${p}`));
        return { data: [], error: null };
      },
    }),
  },
};
globalThis.__nightshiftTestClient = () => admin;
globalThis.Deno = {
  env: {
    get: (name) =>
      name === "SUPABASE_URL"
        ? "https://test.supabase.co"
        : name === "ALLOWED_ORIGINS"
          ? "http://localhost:5173"
          : "test-only-server-secret",
  },
  serve: (fn) => {
    handler = fn;
  },
};
const source = (
  await readFile(
    new URL("../supabase/functions/media-gateway/index.ts", import.meta.url),
    "utf8",
  )
).replace(
  /import \{ createClient \} from "npm:@supabase\/supabase-js@2";/,
  "const createClient=globalThis.__nightshiftTestClient;",
);
const js = ts.transpile(source, {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
});
await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);
test.beforeEach(() => {
  tables = {
    media: [
      {
        id: songId,
        owner_id: alice,
        kind: "music",
        status: "private",
        size: 4,
        mime: "audio/mpeg",
      },
      {
        id: clipId,
        owner_id: alice,
        kind: "clip",
        status: "pending",
        size: 4,
        mime: "video/mp4",
      },
    ],
    moderators: [],
    player_state: [],
    clip_reports: [],
  };
  events = [];
  objects = new Map([
    ["private-music/" + alice + "/" + songId, new Blob(["song"])],
    ["community-clips/" + alice + "/" + clipId, new Blob(["clip"])],
  ]);
  failRemoval = false;
});
async function call(
  action,
  {
    user,
    method = "GET",
    body,
    origin = "http://localhost:5173",
    raw = false,
  } = {},
) {
  const headers = {
    Origin: origin,
    ...(user ? { Authorization: `Bearer ${user}` } : {}),
  };
  if (body !== undefined)
    headers["Content-Type"] = raw ? "audio/mpeg" : "application/json";
  return handler(
    new Request(
      `https://test.supabase.co/functions/v1/media-gateway/${action}`,
      {
        method,
        headers,
        body:
          body === undefined ? undefined : raw ? body : JSON.stringify(body),
      },
    ),
  );
}
test("gateway rejects private music for guests, other accounts and clip moderators", async () => {
  assert.equal((await call(`stream/${songId}`)).status, 400);
  assert.equal((await call(`stream/${songId}`, { user: bob })).status, 400);
  tables.moderators.push({ user_id: bob });
  assert.equal((await call(`stream/${songId}`, { user: bob })).status, 400);
  assert.ok(!events.includes("download"));
  const response = await call(`stream/${songId}`, { user: alice });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "song");
  assert.ok(events.indexOf("rpc:reserve_stream") < events.indexOf("download"));
});
test("public clips must be approved and response contains media rather than a storage URL", async () => {
  assert.equal((await call(`stream/${clipId}`)).status, 400);
  tables.media[1].status = "approved";
  const response = await call(`stream/${clipId}`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "clip");
  assert.equal(response.headers.get("Content-Type"), "video/mp4");
  assert.equal(response.headers.get("Location"), null);
});
test("music deletion is owner-only even for moderators, and storage failure retains reservation", async () => {
  tables.moderators.push({ user_id: bob });
  assert.equal(
    (await call("delete", { method: "POST", user: bob, body: { id: songId } }))
      .status,
    400,
  );
  failRemoval = true;
  assert.equal(
    (
      await call("delete", {
        method: "POST",
        user: alice,
        body: { id: songId },
      })
    ).status,
    400,
  );
  assert.equal(tables.media[0].status, "deleting");
  failRemoval = false;
  assert.equal(
    (
      await call("delete", {
        method: "POST",
        user: alice,
        body: { id: songId },
      })
    ).status,
    200,
  );
  assert.equal(tables.media[0].status, "deleted");
  assert.ok(events.indexOf("remove") < events.indexOf("update:deleted"));
});
test("upload claims are atomic and mismatched sizes cannot be stored", async () => {
  tables.media[0].status = "reserved";
  const results = await Promise.all([
    call(`upload/${songId}`, {
      method: "PUT",
      user: alice,
      body: "abcd",
      raw: true,
    }),
    call(`upload/${songId}`, {
      method: "PUT",
      user: alice,
      body: "abcd",
      raw: true,
    }),
  ]);
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(events.filter((e) => e === "upload").length, 1);
  tables.media[0].status = "reserved";
  assert.equal(
    (
      await call(`upload/${songId}`, {
        method: "PUT",
        user: alice,
        body: "too-long",
        raw: true,
      })
    ).status,
    400,
  );
  assert.equal(events.filter((e) => e === "upload").length, 1);
});
test("sharing requires a verified user and explicit rights confirmation", async () => {
  assert.equal(
    (await call("reserve", { method: "POST", body: { kind: "clip" } })).status,
    401,
  );
  assert.equal(
    (
      await call("reserve", {
        method: "POST",
        user: alice,
        body: { kind: "clip", title: "Night", rights_confirmed: false },
      })
    ).status,
    400,
  );
  assert.ok(!events.includes("rpc:reserve_media"));
});
test("gateway rejects unconfigured origins and invalid sessions", async () => {
  assert.equal(
    (await call("usage", { origin: "https://unconfigured.example" })).status,
    403,
  );
  assert.equal((await call("usage", { user: "invalid" })).status, 401);
});
