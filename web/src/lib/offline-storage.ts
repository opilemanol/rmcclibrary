"use client";

import Dexie, { type Table } from "dexie";
import type { BookmarkRecord, CourseProgressRecord, FormDraft, NoteRecord, ReadingRecord, ReportHistoryRecord } from "./types";

class RMCCDatabase extends Dexie {
  bookmarks!: Table<BookmarkRecord, string>;
  jotter_notes!: Table<NoteRecord, string>;
  reading_history!: Table<ReadingRecord, string>;
  course_progress!: Table<CourseProgressRecord, string>;
  form_drafts!: Table<FormDraft, string>;
  report_history!: Table<ReportHistoryRecord, string>;
  user_settings!: Table<{ id: string; settingName: string; settingValue: string }, string>;

  constructor() {
    super("rmcc_church_library_db");
    this.version(1).stores({
      bookmarks: "id, libraryId, contentId, createdAt",
      jotter_notes: "id, title, libraryId, contentId, createdAt, updatedAt",
      reading_history: "id, libraryId, contentId, completed, lastOpenedAt",
      course_progress: "id, courseId, moduleId, completed, completedAt",
      form_drafts: "id, formId, formTitle, updatedAt",
      user_settings: "id, settingName",
    });
    this.version(2).stores({
      bookmarks: "id, libraryId, contentId, createdAt",
      jotter_notes: "id, title, libraryId, contentId, createdAt, updatedAt",
      reading_history: "id, libraryId, contentId, completed, lastOpenedAt",
      course_progress: "id, courseId, moduleId, completed, completedAt",
      form_drafts: "id, formId, formTitle, updatedAt",
      report_history: "id, formId, formTitle, cadence, createdAt, updatedAt",
      user_settings: "id, settingName",
    });
  }
}

let database: RMCCDatabase | undefined;

export function getDatabase(): RMCCDatabase {
  if (typeof window === "undefined") throw new Error("Local storage is only available in the browser.");
  database ??= new RMCCDatabase();
  return database;
}

export async function clearUserData(): Promise<void> {
  const db = getDatabase();
  await db.transaction("rw", [db.bookmarks, db.jotter_notes, db.reading_history, db.course_progress, db.form_drafts, db.report_history, db.user_settings], async () => {
    await Promise.all([
      db.bookmarks.clear(), db.jotter_notes.clear(), db.reading_history.clear(),
      db.course_progress.clear(), db.form_drafts.clear(), db.report_history.clear(), db.user_settings.clear(),
    ]);
  });
}
