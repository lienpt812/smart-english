import type { UserRow, UserStatsRow } from "../services/userRepository.js";

export function serializeDashboardSummary(
  user: UserRow,
  stats: UserStatsRow | null
) {
  const s = stats;
  return {
    phase: "1",
    user: {
      id: user.id,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      placementCompleted: user.placement_completed,
      placementSkipped: user.placement_skipped,
    },
    skills: {
      listening: s?.skill_listening ?? null,
      speaking: s?.skill_speaking ?? null,
      reading: s?.skill_reading ?? null,
      writing: s?.skill_writing ?? null,
    },
    streak: {
      currentDays: s?.streak_current ?? 0,
      longestDays: s?.streak_longest ?? 0,
    },
    srs: {
      dueToday: s?.srs_due_today ?? 0,
      newCards: s?.srs_new_cards ?? 0,
    },
    roadmap: {
      completedPercent: s?.roadmap_completed_pct ?? 0,
      nextMilestone: s?.next_milestone ?? null,
    },
    notes:
      "Phase 1 — stub dashboard; điểm kỹ năng/SRS/lộ trình sẽ đồng bộ khi làm các module Flashcard, Reading, Mock test.",
  };
}
