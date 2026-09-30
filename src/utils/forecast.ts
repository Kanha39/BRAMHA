import { Freshness, LinkState, type Forecast, type ForecastPoint, type HQBatteryObservation, type HQMetric } from '../types';

const FORECAST_HORIZON_MINUTES = 10;

/** Project battery from HQ-delivered samples only. Age and link penalties widen the cone;
 * recent change per sample is damped and capped so a short synthetic trend stays readable. */
export function buildBatteryForecast(
  history: HQBatteryObservation[],
  metric: HQMetric,
  linkState: LinkState,
  generatedAt: number,
): Forecast {
  const observations = history.length > 0
    ? history.slice(-12)
    : [{ timestamp: metric.lastUpdated, value: Number(metric.value) }];
  const latest = observations[observations.length - 1];
  const changes = observations.slice(1).map((point, index) => point.value - observations[index].value);
  const meanChange = changes.length ? changes.reduce((sum, value) => sum + value, 0) / changes.length : 0;
  const variance = changes.length
    ? changes.reduce((sum, value) => sum + (value - meanChange) ** 2, 0) / changes.length
    : 0;
  const volatility = Math.sqrt(variance);
  const ageSeconds = Math.max(0, metric.age / 1000);
  const linkPenalty = linkState === LinkState.OFFLINE ? 24 : linkState === LinkState.DEGRADED ? 12 : 0;
  const freshnessPenalty = metric.freshness === Freshness.STALE ? 8 : metric.freshness === Freshness.AGING ? 3 : 0;
  const confidence = Math.max(18, Math.min(96, Math.round(96 - ageSeconds * 0.65 - linkPenalty - freshnessPenalty - Math.min(12, volatility * 8))));

  const points: ForecastPoint[] = observations.map((point) => ({
    timestamp: point.timestamp,
    actual: point.value,
    forecast: point.value,
    upperBound: point.value,
    lowerBound: point.value,
    confidence,
  }));
  // Limit trend influence to avoid extending second-by-second simulation noise as a real rate.
  const trendPerMinute = Math.max(-0.4, Math.min(0.4, meanChange * 0.2));
  for (let minute = 0; minute <= FORECAST_HORIZON_MINUTES; minute++) {
    const value = Math.max(0, Math.min(100, latest.value + trendPerMinute * minute));
    // Uncertainty combines a small base spread, data age, link quality and observed variation;
    // sqrt(time) makes the cone widen gradually instead of jumping at its endpoint.
    const linkSpread = linkState === LinkState.OFFLINE ? 1.2 : linkState === LinkState.DEGRADED ? 0.6 : 0;
    const spread = (0.35 + ageSeconds / 15 + volatility * 0.8 + linkSpread) * Math.sqrt(minute);
    points.push({
      timestamp: generatedAt + minute * 60_000,
      forecast: value,
      upperBound: Math.min(100, value + spread),
      lowerBound: Math.max(0, value - spread),
      confidence,
    });
  }

  return {
    metric: 'Battery reserve',
    generatedAt,
    horizonMinutes: FORECAST_HORIZON_MINUTES,
    dataAgeSeconds: ageSeconds,
    points,
    overallConfidence: confidence,
  };
}
