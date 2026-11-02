import test from "node:test";
import assert from "node:assert/strict";
import { signInToken } from "../src/lib/sign-in-link.mjs";

test("Home Screen sign-in accepts only this project’s complete verification link", () => {
  const project = "https://project.supabase.co";
  const token = "a".repeat(64);
  assert.equal(
    signInToken(
      `${project}/auth/v1/verify?token=${token}&type=magiclink`,
      project,
    ),
    token,
  );
  assert.throws(() =>
    signInToken(
      `https://other.supabase.co/auth/v1/verify?token=${token}`,
      project,
    ),
  );
  assert.throws(() =>
    signInToken(`${project}/other-path?token=${token}`, project),
  );
  assert.throws(() =>
    signInToken(`${project}/auth/v1/verify?token=truncated`, project),
  );
});
