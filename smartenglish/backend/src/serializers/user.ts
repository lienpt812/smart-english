import type { UserRow } from "../services/userRepository.js";

export function serializeUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    locale: row.locale,
    placementCompleted: row.placement_completed,
    placementSkipped: row.placement_skipped,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
