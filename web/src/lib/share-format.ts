import type { ContentRecord } from "./types";

export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=app.hosted.us_central1.studio__studio_6860217494_f174b.twa";

function prettyLabel(value: string): string {
  return value.replace(/([A-Z])/g, " $1").replace(/[-_]/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => `- ${formatValue(item)}`).join("\n");
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${prettyLabel(key)}: ${formatValue(item)}`)
      .join("\n");
  }
  return value === undefined || value === null ? "" : String(value);
}

export function formatContentShare(libraryName: string, record: ContentRecord): string {
  const period = record.day ? `Day ${record.day} of 365`
    : record.week ? `Week ${record.week} of 52`
      : record.moduleNumber ? `Module ${record.moduleNumber}` : "";
  const sections = Object.entries(record)
    .filter(([key]) => !["id", "title", "day", "week", "moduleNumber", "contentStatus"].includes(key))
    .map(([key, value]) => `${prettyLabel(key)}:\n${formatValue(value)}`);
  return ["RMCC Church Library", libraryName, period, record.title, ...sections].filter(Boolean).join("\n\n");
}

export function appendPlayStoreLink(text: string): string {
  const body = text.trim();
  if (body.includes(PLAY_STORE_URL)) return body;
  return `${body}${body ? "\n\n" : ""}Get RMCC Church Library on Google Play:\n${PLAY_STORE_URL}`;
}