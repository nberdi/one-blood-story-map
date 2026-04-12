// Update this domain if your Berea community email policy changes.
export const ALLOWED_SIGNUP_DOMAIN = "berea.edu";

export function isAllowedCommunityEmail(email) {
  if (typeof email !== "string") return false;
  const normalizedEmail = email.trim().toLowerCase();
  return normalizedEmail.endsWith(`@${ALLOWED_SIGNUP_DOMAIN}`);
}
