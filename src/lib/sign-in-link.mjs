// A Home Screen app can finish its email link without opening a different
// Safari storage context. Only accept this project's actual verification URL.
export function signInToken(link, projectUrl) {
  const url = new URL(link);
  if (
    url.origin !== new URL(projectUrl).origin ||
    url.protocol !== "https:" ||
    url.pathname !== "/auth/v1/verify"
  )
    throw new Error("Paste the Sign in link from this player’s email.");
  const token =
    url.searchParams.get("token") || url.searchParams.get("token_hash");
  if (!token || !/^[A-Za-z0-9_-]{20,512}$/.test(token))
    throw new Error(
      "This sign-in link is incomplete. Copy the link from the email again.",
    );
  const rawType = url.searchParams.get("type");
  const type =
    rawType === "signup"
      ? "signup"
      : rawType === "magiclink"
        ? "magiclink"
        : "email";
  return { token, type };
}
