export const MAYA_ADMIN_EMAIL = "deyversonsilvaf@gmail.com";

export function isMayaAdminEmail(email?: string | null) {
  return (email ?? "").trim().toLowerCase() === MAYA_ADMIN_EMAIL;
}
