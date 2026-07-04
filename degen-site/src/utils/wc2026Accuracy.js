/** Accuracy log stats and over-projection bias signal (handoff §6). */

export function computeAccuracySummary(log = []) {
  const rows = (log || []).filter((r) => r.actTotal != null && r.projTotal != null);
  if (!rows.length) {
    return { count: 0, mae: null, rmse: null, meanBias: null, underRate: null };
  }

  const errors = rows.map((r) => Number(r.error ?? (r.projTotal - r.actTotal)));
  const absErrors = rows.map((r) => Number(r.absError ?? Math.abs(r.error ?? (r.projTotal - r.actTotal))));
  const underCount = rows.filter((r) => Number(r.actTotal) < Number(r.projTotal)).length;

  const mae = absErrors.reduce((s, x) => s + x, 0) / rows.length;
  const rmse = Math.sqrt(errors.reduce((s, x) => s + x ** 2, 0) / rows.length);
  const meanBias = errors.reduce((s, x) => s + x, 0) / rows.length;
  const underRate = underCount / rows.length;

  return {
    count: rows.length,
    mae,
    rmse,
    meanBias,
    underRate,
    underCount,
  };
}

/**
 * Over-projection read: model systematically high when meanBias > 0 and most games land under.
 * Handoff withholds strong judgment until n ≈ 8; show caution banner from n ≥ 4.
 */
export function getOverProjectionBanner(summary) {
  const n = summary?.count || 0;
  if (n < 4) return null;

  const meanBias = Number(summary.meanBias);
  const underRate = Number(summary.underRate);
  if (!Number.isFinite(meanBias) || !Number.isFinite(underRate)) return null;

  const strongSignal = n >= 6 && meanBias > 1 && underRate >= 5 / 6;
  const moderateSignal = meanBias > 0.5 && underRate >= 0.6;

  if (!moderateSignal && !strongSignal) return null;

  const underPct = Math.round(underRate * 100);
  const level = strongSignal ? 'strong' : 'moderate';

  return {
    level,
    count: n,
    meanBias,
    underRate,
    underCount: summary.underCount,
    message: strongSignal
      ? `Over-projection signal (${n} graded WC games): mean bias ${meanBias > 0 ? '+' : ''}${meanBias.toFixed(2)} corners — ${summary.underCount}/${n} (${underPct}%) landed under the model. Trust unders more than the model’s over-flags; revisit calibration at n≈8–10.`
      : `Early over-projection read (${n} games): bias ${meanBias > 0 ? '+' : ''}${meanBias.toFixed(2)}, ${underPct}% under the model. Signal strengthens at n≥8.`,
  };
}
