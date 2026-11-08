export function getScheduledContent<T extends { day?: number; week?: number }>(
  items: T[],
  period: "day" | "week",
  value: number,
): T | undefined {
  return items.find((item) => item[period] === value);
}