export type SrsState = {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
};

export type SrsResult = SrsState & {
  next_review_at: string;
};

export function applySm2(state: SrsState, quality: number, reviewedAt = new Date()): SrsResult {
  const boundedQuality = Math.max(0, Math.min(5, Math.round(quality)));
  let ease = Number(state.ease_factor || 2.5);
  let repetitions = Number(state.repetitions || 0);
  let interval = Number(state.interval_days || 0);

  if (boundedQuality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.max(1, Math.round(interval * ease));
    }
  }

  ease += 0.1 - (5 - boundedQuality) * (0.08 + (5 - boundedQuality) * 0.02);
  ease = Math.max(1.3, Number(ease.toFixed(2)));

  const nextReview = new Date(reviewedAt);
  nextReview.setDate(reviewedAt.getDate() + interval);

  return {
    ease_factor: ease,
    interval_days: interval,
    repetitions,
    next_review_at: nextReview.toISOString(),
  };
}
