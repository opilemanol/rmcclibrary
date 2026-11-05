const DAY_MS = 24 * 60 * 60 * 1000;

export function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(start.getFullYear(), 0, 1)) / DAY_MS) + 1;
}

export function devotionalDay(date: Date): number {
  // Leap day shares day 59 with February 28; the plan always remains 365 days.
  const day = dayOfYear(date);
  return Math.min(day > 59 && isLeapYear(date.getFullYear()) ? day - 1 : day, 365);
}

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function programmeWeek(date: Date, startDate: string, weekStartsOn = 0): number {
  const parsed = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return 1;
  const start = new Date(parsed);
  const offset = (start.getDay() - weekStartsOn + 7) % 7;
  start.setDate(start.getDate() - offset);
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const currentOffset = (current.getDay() - weekStartsOn + 7) % 7;
  current.setDate(current.getDate() - currentOffset);
  return Math.max(1, Math.min(52, Math.floor((current.getTime() - start.getTime()) / (7 * DAY_MS)) + 1));
}
