import { getLibrary } from "./json-loader";
import { LIBRARIES } from "./library-registry";
import type { ContentRecord, LibraryData, LibraryId } from "./types";

export function getLibraryMetadata(id: LibraryId) {
  const library = LIBRARIES.find((item) => item.id === id);
  if (!library) throw new Error(`Unknown library: ${id}`);
  return library;
}

export function getCollection(data: LibraryData | undefined, id: LibraryId): ContentRecord[] {
  if (!data) return [];
  const collection = data[getLibraryMetadata(id).collection as keyof LibraryData];
  return Array.isArray(collection) ? collection as ContentRecord[] : [];
}

export async function getRecordById(id: LibraryId, contentId: string): Promise<ContentRecord | undefined> {
  const data = await getLibrary(id);
  return getCollection(data, id).find((record) => record.id === contentId);
}

export async function getLessonById(contentId: string): Promise<ContentRecord | undefined> {
  return getRecordById("sunday-school", contentId);
}

export async function getLessonByWeek(week: number): Promise<ContentRecord | undefined> {
  const data = await getLibrary("sunday-school");
  return getCollection(data, "sunday-school").find((record) => record.week === week);
}

export async function getDevotionalByDay(id: "daily-devotionals" | "family-devotionals", day: number): Promise<ContentRecord | undefined> {
  if (!Number.isInteger(day) || day < 1 || day > 365) return undefined;
  const data = await getLibrary(id);
  return getCollection(data, id).find((record) => record.day === day);
}

export async function getSermonByWeek(week: number): Promise<ContentRecord | undefined> {
  const data = await getLibrary("sunday-sermons");
  return getCollection(data, "sunday-sermons").find((record) => record.week === week);
}

export async function getPrayerGuideByWeek(week: number): Promise<ContentRecord | undefined> {
  const data = await getLibrary("prayer-guides");
  return getCollection(data, "prayer-guides").find((record) => record.week === week);
}

export async function getBibleStudyByWeek(week: number): Promise<ContentRecord | undefined> {
  const data = await getLibrary("bible-study");
  return getCollection(data, "bible-study").find((record) => record.week === week);
}

export async function getCourseModule(id: "baptismal-course" | "discipleship-course", moduleId: string): Promise<ContentRecord | undefined> {
  return getRecordById(id, moduleId);
}
