export function getScheduledContent<T extends { day?: number; week?: number }>(
  items: T[],
  period: "day" | "week",
  value: number,
): T | undefined {
  return items.find((item) => item[period] === value);
}

export function getAvailableScheduledContent<T extends { day?: number; week?: number }>(
  items: T[],
  period: "day" | "week",
  value: number,
): T | undefined {
  const exact = getScheduledContent(items, period, value);
  if (exact) return exact;

  let previous: T | undefined;
  let next: T | undefined;
  for (const item of items) {
    const scheduledValue = item[period];
    if (typeof scheduledValue !== "number" || !Number.isInteger(scheduledValue)) continue;

    if (scheduledValue < value && (!previous || scheduledValue > previous[period]!)) previous = item;
    if (scheduledValue > value && (!next || scheduledValue < next[period]!)) next = item;
  }
  return previous ?? next;
}