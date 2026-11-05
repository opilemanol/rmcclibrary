"use client";

import {
  ArrowLeft, Bookmark, BookMarked, BookOpen, Check, ChevronLeft, ChevronRight,
  ClipboardList, Download, FileText, Heart, House, LockKeyhole, Mic2,
  NotebookPen, Search, Share2, Sun, Trash2, UsersRound, Waves, X,
  HandHeart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { devotionalDay, programmeWeek } from "@/lib/date-manager";
import { getCollection } from "@/lib/content-service";
import { getLibrary } from "@/lib/json-loader";
import { LIBRARIES } from "@/lib/library-registry";
import { clearUserData, getDatabase } from "@/lib/offline-storage";
import { createDocumentPdf } from "@/lib/pdf-generator";
import { requestAdBeforeShare, sharePdf, shareText } from "@/lib/native-share";
import { searchAllLibraries } from "@/lib/search-service";
import type { BookmarkRecord, ContentRecord, CourseProgressRecord, FormDraft, FormTemplate, LibraryData, LibraryId, NoteRecord, ReadingRecord, ReportHistoryRecord } from "@/lib/types";

type Screen = "home" | "library" | "reader" | "jotter" | "bookmarks" | "search" | "donate" | "privacy";
type IconName = "book-open" | "sun" | "house" | "clipboard-list" | "mic-2" | "book-marked" | "hands-praying" | "waves" | "users-round";
const ICONS: Record<IconName, LucideIcon> = {
  "book-open": BookOpen, sun: Sun, house: House, "clipboard-list": ClipboardList,
  "mic-2": Mic2, "book-marked": BookMarked, "hands-praying": HandHeart,
  waves: Waves, "users-round": UsersRound,
};

const nowDate = () => new Date().toISOString();
const itemId = (libraryId: string, contentId: string) => `${libraryId}:${contentId}`;

function collectionOf(data: LibraryData | undefined, libraryId: LibraryId): ContentRecord[] {
  return getCollection(data, libraryId);
}

function textValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join("\n");
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, child]) => `${key}: ${textValue(child)}`)
      .filter((line) => !line.endsWith(": "))
      .join("\n");
  }
  return "";
}

function contentText(record: ContentRecord): string {
  return Object.entries(record)
    .filter(([key]) => !["id", "contentStatus"].includes(key))
    .map(([key, value]) => `${key} ${textValue(value)}`)
    .join(" ");
}

function prettyLabel(value: string): string {
  return value.replace(/([A-Z])/g, " $1").replace(/[-_]/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

function displayDate(date = new Date()): string {
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function AppButton({ children, onClick, secondary = false, disabled = false, className = "" }: {
  children: React.ReactNode; onClick: () => void; secondary?: boolean; disabled?: boolean; className?: string;
}) {
  return <button className={`button ${secondary ? "button-secondary" : ""} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

function SignatureInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value.startsWith("data:image/")) return;
    const image = new Image();
    image.onload = () => canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.src = value;
  }, [value]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * canvas.width / bounds.width,
      y: (event.clientY - bounds.top) * canvas.height / bounds.height,
    };
  };

  return <div className="signature-control">
    <canvas
      ref={canvasRef}
      width={640}
      height={180}
      aria-label="Draw signature"
      onPointerDown={(event) => {
        const context = event.currentTarget.getContext("2d");
        if (!context) return;
        drawing.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        const point = getPoint(event);
        context.beginPath();
        context.moveTo(point.x, point.y);
      }}
      onPointerMove={(event) => {
        if (!drawing.current) return;
        const context = event.currentTarget.getContext("2d");
        if (!context) return;
        const point = getPoint(event);
        context.lineWidth = 4;
        context.lineCap = "round";
        context.strokeStyle = "#172033";
        context.lineTo(point.x, point.y);
        context.stroke();
      }}
      onPointerUp={(event) => {
        drawing.current = false;
        const canvas = event.currentTarget;
        onChange(canvas.toDataURL("image/png"));
      }}
      onPointerCancel={() => { drawing.current = false; }}
    />
    <button type="button" className="signature-clear" onClick={() => {
      const canvas = canvasRef.current;
      canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      onChange("");
    }}>Clear signature</button>
  </div>;
}

export default function Home() {
  const [libraries, setLibraries] = useState<Partial<Record<LibraryId, LibraryData>>>({});
  const [loadError, setLoadError] = useState("");
  const [screen, setScreen] = useState<Screen>("home");
  const [libraryId, setLibraryId] = useState<LibraryId>("sunday-school");
  const [record, setRecord] = useState<ContentRecord | null>(null);
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<BookmarkRecord[]>([]);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [drafts, setDrafts] = useState<FormDraft[]>([]);
  const [reportHistory, setReportHistory] = useState<ReportHistoryRecord[]>([]);
  const [recentReads, setRecentReads] = useState<Array<ReadingRecord | CourseProgressRecord>>([]);
  const [prayerChecks, setPrayerChecks] = useState<Record<string, boolean>>({});
  const [noteSearch, setNoteSearch] = useState("");
  const [bookmarkSearch, setBookmarkSearch] = useState("");
  const [bookmarkFilter, setBookmarkFilter] = useState<LibraryId | "all">("all");
  const [previewForm, setPreviewForm] = useState(false);
  const [readerFontSize, setReaderFontSize] = useState(16);
  const [reading, setReading] = useState<Record<string, boolean>>({});
  const [selectedForm, setSelectedForm] = useState<FormTemplate | null>(null);
  const [formDraftId, setFormDraftId] = useState<string | null>(null);
  const [reportHistoryId, setReportHistoryId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string | boolean>>({});
  const [noteDraft, setNoteDraft] = useState<NoteRecord | null>(null);
  const [notice, setNotice] = useState("");
  const [programmeStart, setProgrammeStart] = useState("2026-01-04");
  const [weekStartsOn, setWeekStartsOn] = useState(0);
  const [listIndex, setListIndex] = useState(0);

  const loadSavedData = useCallback(async () => {
    const db = getDatabase();
    const [savedBookmarks, savedNotes, savedDrafts, savedReports, savedReading, savedCourses, start, weekStart, settings] = await Promise.all([
      db.bookmarks.toArray(), db.jotter_notes.toArray(), db.form_drafts.toArray(), db.report_history.toArray(),
      db.reading_history.toArray(), db.course_progress.toArray(),
      db.user_settings.get("programmeStart"), db.user_settings.get("weekStartsOn"), db.user_settings.toArray(),
    ]);
    setRecords(savedBookmarks);
    setNotes(savedNotes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    setDrafts(savedDrafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    setReportHistory(savedReports.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    const readHistory = [...savedReading, ...savedCourses].sort((a, b) => {
      const aTime = "lastOpenedAt" in a ? a.lastOpenedAt : a.completedAt ?? "";
      const bTime = "lastOpenedAt" in b ? b.lastOpenedAt : b.completedAt ?? "";
      return bTime.localeCompare(aTime);
    });
    setRecentReads(readHistory);
    setReading(Object.fromEntries(readHistory.map((item) => [item.id, item.completed])));
    setPrayerChecks(Object.fromEntries(settings.filter((setting) => setting.settingName.startsWith("prayer:")).map((setting) => [setting.settingName, setting.settingValue === "true"])));
    setProgrammeStart(start?.settingValue ?? "2026-01-04");
    setWeekStartsOn(weekStart?.settingValue ? Number(weekStart.settingValue) : 0);
    const savedFontSize = settings.find((setting) => setting.settingName === "readerFontSize")?.settingValue;
    setReaderFontSize(savedFontSize ? Math.min(24, Math.max(14, Number(savedFontSize))) : 16);
  }, []);

  useEffect(() => {
    window.rmccHandleBack = () => {
      if (screen === "home") return false;
      setScreen("home");
      setSelectedForm(null);
      setNoteDraft(null);
      return true;
    };
    return () => { delete window.rmccHandleBack; };
  }, [screen]);

  useEffect(() => {
    let active = true;
    Promise.all(LIBRARIES.map(async (library) => [library.id, await getLibrary(library.id)] as const))
      .then((loaded) => { if (active) setLibraries(Object.fromEntries(loaded)); })
      .catch((error: unknown) => { if (active) setLoadError(error instanceof Error ? error.message : "The bundled library content could not be loaded."); });
    loadSavedData().catch(() => { if (active) setNotice("Local storage could not be opened. Check available device storage and restart the app."); });
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => setNotice("Offline cache setup failed. The bundled Android content is still available."));
    }
    return () => { active = false; };
  }, [loadSavedData]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const currentLibrary = LIBRARIES.find((item) => item.id === libraryId)!;
  const currentItems = useMemo(() => collectionOf(libraries[libraryId], libraryId), [libraries, libraryId]);
  const dayIndex = devotionalDay(new Date()) - 1;
  const weekIndex = programmeWeek(new Date(), programmeStart, weekStartsOn) - 1;
  const todayDevotional = collectionOf(libraries["daily-devotionals"], "daily-devotionals")[dayIndex];
  const thisWeekLesson = collectionOf(libraries["sunday-school"], "sunday-school")[weekIndex];
  const completedCounts = useMemo(() => Object.fromEntries(LIBRARIES.map((library) => [
    library.id,
    collectionOf(libraries[library.id], library.id).filter((item) => reading[itemId(library.id, item.id)]).length,
  ])) as Record<LibraryId, number>, [libraries, reading]);

  const enterLibrary = useCallback((id: LibraryId, preferred?: ContentRecord) => {
    const items = collectionOf(libraries[id], id);
    const value = preferred ?? items[id === "daily-devotionals" || id === "family-devotionals" ? dayIndex : id === "reports-forms" ? 0 : id.endsWith("-course") ? 0 : weekIndex] ?? items[0] ?? null;
    setLibraryId(id);
    setSelectedForm(null);
    setRecord(value);
    setListIndex(Math.max(0, items.findIndex((item) => item.id === value?.id)));
    setScreen(id === "reports-forms" ? "library" : value ? "reader" : "library");
    if (value && id !== "reports-forms") {
      const progressId = itemId(id, value.id);
      const db = getDatabase();
      const progress = { id: progressId, libraryId: id, contentId: value.id, lastOpenedAt: nowDate(), completed: reading[progressId] ?? false };
      const saveProgress = id.endsWith("-course")
        ? db.course_progress.put({ id: progressId, courseId: id, moduleId: value.id, completed: progress.completed })
        : db.reading_history.put(progress);
      saveProgress
        .then(loadSavedData)
        .catch(() => setNotice("Could not save reading history on this device."));
    }
  }, [dayIndex, libraries, loadSavedData, reading, weekIndex]);

  const openRecord = useCallback((id: LibraryId, item: ContentRecord) => {
    if (id === "reports-forms") {
      const form = (libraries[id]?.forms ?? []).find((candidate) => candidate.id === item.id);
      if (form) {
        setSelectedForm(form);
        setFormDraftId(null);
        setFormData({});
        setScreen("reader");
      }
      return;
    }
    enterLibrary(id, item);
  }, [enterLibrary, libraries]);

  const updateProgrammeCalendar = async (field: "start" | "week", value: string) => {
    const db = getDatabase();
    if (field === "start") {
      setProgrammeStart(value);
      await db.user_settings.put({ id: "programmeStart", settingName: "programmeStart", settingValue: value });
    } else {
      setWeekStartsOn(Number(value));
      await db.user_settings.put({ id: "weekStartsOn", settingName: "weekStartsOn", settingValue: value });
    }
  };

  const updateReaderFontSize = async (size: number) => {
    const value = Math.min(24, Math.max(14, size));
    setReaderFontSize(value);
    await getDatabase().user_settings.put({ id: "readerFontSize", settingName: "readerFontSize", settingValue: String(value) });
  };

  const toggleBookmark = async (id: LibraryId, item: ContentRecord) => {
    const bookmarkId = itemId(id, item.id);
    const db = getDatabase();
    if (await db.bookmarks.get(bookmarkId)) await db.bookmarks.delete(bookmarkId);
    else await db.bookmarks.put({ id: bookmarkId, libraryId: id, contentId: item.id, contentTitle: item.title, createdAt: nowDate() });
    await loadSavedData();
  };

  const markCompleted = async (id: LibraryId, item: ContentRecord) => {
    const progressId = itemId(id, item.id);
    const completed = !reading[progressId];
    const progress = { id: progressId, libraryId: id, contentId: item.id, lastOpenedAt: nowDate(), completed };
    const db = getDatabase();
    if (id.endsWith("-course")) {
      await db.course_progress.put({ id: progressId, courseId: id, moduleId: item.id, completed, completedAt: completed ? nowDate() : undefined });
    } else {
      await db.reading_history.put(progress);
    }
    await loadSavedData();
  };

  const createPdf = async (title: string, libraryName: string, content: Record<string, unknown>, requireAd = true) => {
    try {
      const blob = await createDocumentPdf(title, libraryName, content);
      if (requireAd && !await requestAdBeforeShare()) setNotice("An ad was unavailable; continuing with PDF sharing.");
      await sharePdf(blob, `${title.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}.pdf`);
    } catch {
      setNotice("The PDF could not be created or shared. Please try again.");
    }
  };

  const shareTextWithAd = async (title: string, text: string) => {
    if (!await requestAdBeforeShare()) setNotice("An ad was unavailable; continuing with text sharing.");
    await shareText(title, text);
  };

  const formValidationError = (template: FormTemplate, data: Record<string, string | boolean>) => {
    const missing = template.fields.find((field) => field.required && !data[field.id]);
    if (missing) return `Please complete the required field: ${missing.label}.`;
    const invalidEmail = template.fields.find((field) =>
      field.type === "email" && data[field.id] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data[field.id])),
    );
    return invalidEmail ? `Enter a valid email address for ${invalidEmail.label}.` : null;
  };

  const reportFieldValue = (field: FormTemplate["fields"][number], data: Record<string, string | boolean>) =>
    field.type === "signature" ? (data[field.id] ? "Signature captured" : "") : String(data[field.id] ?? "");

  const reportText = (template: FormTemplate, data: Record<string, string | boolean>) =>
    `${template.title}\n${template.cadence} report\n\n${template.fields
      .map((field) => `${field.label}: ${reportFieldValue(field, data) || "—"}`)
      .join("\n")}`;

  const openNoteEditor = (note?: NoteRecord, linked?: { id: LibraryId; record: ContentRecord }) => {
    setNoteDraft(note ?? {
      id: crypto.randomUUID(), title: linked ? `Note: ${linked.record.title}` : "", content: "",
      libraryId: linked?.id, contentId: linked?.record.id, createdAt: nowDate(), updatedAt: nowDate(),
    });
    setScreen("jotter");
  };

  const saveNote = async (keepEditing = false) => {
    if (!noteDraft?.title.trim()) { setNotice("Add a title to save this note."); return; }
    const updatedNote = { ...noteDraft, updatedAt: nowDate() };
    await getDatabase().jotter_notes.put(updatedNote);
    setNoteDraft(keepEditing ? updatedNote : null);
    await loadSavedData();
    if (!keepEditing) setNotice("Note saved on this device.");
  };

  const removeNote = async (note: NoteRecord) => {
    if (!window.confirm(`Permanently delete "${note.title}"?`)) return;
    await getDatabase().jotter_notes.delete(note.id);
    await loadSavedData();
  };

  const saveFormDraft = async (template: FormTemplate, data: Record<string, string | boolean>, existingId?: string | null) => {
    const current = existingId ? await getDatabase().form_drafts.get(existingId) : undefined;
    const draft: FormDraft = {
      id: existingId ?? crypto.randomUUID(), formId: template.id, formTitle: template.title, formData: data,
      createdAt: current?.createdAt ?? nowDate(), updatedAt: nowDate(),
    };
    await getDatabase().form_drafts.put(draft);
    await loadSavedData();
    setNotice("Form draft saved locally on this device.");
    return draft.id;
  };

  const saveReport = async () => {
    if (!selectedForm) return;
    const validationError = formValidationError(selectedForm, formData);
    if (validationError) { setNotice(validationError); return; }
    const current = reportHistoryId ? await getDatabase().report_history.get(reportHistoryId) : undefined;
    const now = nowDate();
    const report: ReportHistoryRecord = {
      id: reportHistoryId ?? crypto.randomUUID(),
      formId: selectedForm.id,
      formTitle: selectedForm.title,
      cadence: selectedForm.cadence,
      formData: { ...formData },
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };
    await getDatabase().report_history.put(report);
    setReportHistoryId(report.id);
    await loadSavedData();
    setNotice("Report saved on this device.");
  };

  const openReport = (report: ReportHistoryRecord) => {
    const template = (libraries["reports-forms"]?.forms ?? []).find((form) => form.id === report.formId);
    if (!template) { setNotice("This report's form template is unavailable."); return; }
    setLibraryId("reports-forms");
    setSelectedForm(template);
    setFormDraftId(null);
    setReportHistoryId(report.id);
    setFormData(report.formData);
    setScreen("reader");
  };

  const deleteReport = async (report: ReportHistoryRecord) => {
    if (!window.confirm(`Permanently delete "${report.formTitle}" from report history?`)) return;
    await getDatabase().report_history.delete(report.id);
    if (reportHistoryId === report.id) setReportHistoryId(null);
    await loadSavedData();
  };

  const openFormDraft = async (draft: FormDraft) => {
    const template = (libraries["reports-forms"]?.forms ?? []).find((form) => form.id === draft.formId);
    if (!template) { setNotice("This form template is unavailable."); return; }
    setLibraryId("reports-forms");
    setSelectedForm(template);
    setFormDraftId(draft.id);
    setReportHistoryId(null);
    setFormData(draft.formData);
    setScreen("reader");
  };

  const deleteFormDraft = async (draft: FormDraft) => {
    if (!window.confirm(`Delete the saved draft "${draft.formTitle}"?`)) return;
    await getDatabase().form_drafts.delete(draft.id);
    await loadSavedData();
  };

  const togglePrayerPoint = async (index: number) => {
    if (!record) return;
    const settingName = `prayer:${libraryId}:${record.id}:${index}`;
    const value = !prayerChecks[settingName];
    setPrayerChecks({ ...prayerChecks, [settingName]: value });
    await getDatabase().user_settings.put({ id: settingName, settingName, settingValue: String(value) });
  };

  const allSearchResults = useMemo(() => searchAllLibraries(libraries, search), [libraries, search]);

  const goBack = () => {
    if (selectedForm) { setSelectedForm(null); setScreen("library"); }
    else if (screen === "reader") setScreen("library");
    else setScreen("home");
  };

  const nav = [
    { key: "home" as const, label: "Home", icon: House },
    { key: "jotter" as const, label: "Jotter", icon: NotebookPen },
    { key: "donate" as const, label: "Donate", icon: Heart },
    { key: "privacy" as const, label: "Privacy", icon: LockKeyhole },
  ];

  const renderReaderField = (key: string, value: unknown) => {
    const content = textValue(value);
    if (!content) return null;
    return <section className="reader-section" key={key}><h3>{prettyLabel(key)}</h3><p>{content}</p></section>;
  };

  const renderFormField = (field: FormTemplate["fields"][number]) => {
    const value = formData[field.id];
    const change = (newValue: string | boolean) => setFormData({ ...formData, [field.id]: newValue });
    const label = <span>{field.label}{field.required && <i> *</i>}</span>;
    if (field.type === "signature") {
      return <div className="form-field" key={field.id}>{label}<SignatureInput value={String(value ?? "")} onChange={change} /></div>;
    }
    if (field.type === "textarea") {
      return <label className="form-field" key={field.id}>{label}<textarea required={field.required} value={String(value ?? "")} onChange={(event) => change(event.target.value)} rows={4} /></label>;
    }
    if (field.type === "checkbox") {
      return <label className="form-field form-checkbox" key={field.id}>{label}<input type="checkbox" checked={Boolean(value)} onChange={(event) => change(event.target.checked)} /></label>;
    }
    if (field.type === "select") {
      return <label className="form-field" key={field.id}>{label}<select required={field.required} value={String(value ?? "")} onChange={(event) => change(event.target.value)}><option value="">Select an option</option>{(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
    }
    if (field.type === "radio") {
      return <fieldset className="form-field radio-field" key={field.id}><legend>{field.label}{field.required && <i> *</i>}</legend><div className="radio-options">{(field.options ?? []).map((option) => <label key={option}><input type="radio" name={field.id} value={option} checked={value === option} onChange={() => change(option)} />{option}</label>)}</div></fieldset>;
    }
    return <label className="form-field" key={field.id}>{label}<input type={field.type} required={field.required} value={String(value ?? "")} onChange={(event) => change(event.target.value)} /></label>;
  };

  const activeItems = currentItems.filter((item) => {
    const query = search.trim().toLocaleLowerCase();
    return !query || contentText(item).toLocaleLowerCase().includes(query);
  });

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setScreen("home")} aria-label="RMCC Church Library home">
          <span className="brand-mark">R</span><span><strong>RMCC Intl</strong><small>CHURCH LIBRARY</small></span>
        </button>
        <div className="topbar-actions">
          <button className="icon-button" aria-label="Search all libraries" onClick={() => { setSearch(""); setScreen("search"); }}><Search size={20} /></button>
          <button className="icon-button" aria-label="View bookmarks" onClick={() => setScreen("bookmarks")}><Bookmark size={20} /></button>
        </div>
      </header>

      <div className="workspace">
        <aside className="side-nav">
          <div className="nav-caption">MENU</div>
          {nav.map(({ key, label, icon: Icon }) => <button key={key} className={`side-link ${screen === key ? "active" : ""}`} onClick={() => { setScreen(key); setSelectedForm(null); setNoteDraft(null); }}><Icon size={18} />{label}</button>)}
          <div className="nav-caption nav-caption-library">YOUR LIBRARY</div>
          <button className={`side-link ${screen === "bookmarks" ? "active" : ""}`} onClick={() => setScreen("bookmarks")}><Bookmark size={18} />Bookmarks</button>
          <div className="sidebar-note">Your resources and personal data stay available offline.</div>
        </aside>

        <section className="main-content">
          {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}
          {loadError && <div className="error-banner" role="alert">{loadError}</div>}

          {screen === "home" && <div className="page home-page">
            <div className="welcome-panel">
              <div><p className="eyebrow">WELCOME TO YOUR LIBRARY</p><h1>Faith for every day.</h1><p className="welcome-copy">A quiet place to read, learn and grow together.</p><span className="date-label">{displayDate()}</span></div>
              <div className="welcome-art" aria-hidden="true"><BookOpen size={72} strokeWidth={1.3} /><span>RMCC</span></div>
            </div>
            <div className="quick-row">
              <article className="quick-card devotional-card">
                <div className="quick-icon"><Sun size={20} /></div><div className="quick-meta"><span>TODAY&apos;S READING</span><strong>{todayDevotional?.title ?? "Daily Devotional"}</strong><small>Day {devotionalDay(new Date())} of 365</small></div>
                <button className="text-button" onClick={() => enterLibrary("daily-devotionals", todayDevotional)}>Read today <ChevronRight size={16} /></button>
              </article>
              <article className="quick-card">
                <div className="quick-icon blue"><BookOpen size={20} /></div><div className="quick-meta"><span>THIS WEEK</span><strong>{thisWeekLesson?.title ?? "Sunday School"}</strong><small>Programme week {weekIndex + 1} of 52</small></div>
                <button className="text-button" onClick={() => enterLibrary("sunday-school", thisWeekLesson)}>Open lesson <ChevronRight size={16} /></button>
              </article>
            </div>
            <div className="section-heading"><div><p className="eyebrow">EXPLORE</p><h2>Your libraries</h2></div><button className="plain-button" onClick={() => setScreen("search")}><Search size={16} /> Search all</button></div>
            <div className="library-grid">
              {LIBRARIES.map((library) => {
                const Icon = ICONS[library.icon as IconName];
                const count = collectionOf(libraries[library.id], library.id).length;
                return <button className="library-card" key={library.id} onClick={() => enterLibrary(library.id)}>
                  <span className={`library-icon icon-${library.id}`}><Icon size={22} strokeWidth={1.8} /></span>
                  <span className="library-card-content"><strong>{library.name}</strong><small>{library.shortDescription}</small><em>{count || library.capacity} {count ? "resources" : ""}</em></span>
                  <ChevronRight className="library-arrow" size={18} />
                </button>;
              })}
            </div>
            {recentReads.length > 0 && <><div className="section-heading progress-heading"><div><p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p><h2>Continue reading</h2></div></div><div className="content-list">{recentReads.slice(0, 3).map((recent) => {
              const libraryId = "libraryId" in recent ? recent.libraryId : recent.courseId;
              const contentId = "contentId" in recent ? recent.contentId : recent.moduleId;
              const library = LIBRARIES.find((item) => item.id === libraryId);
              const item = collectionOf(libraries[libraryId], libraryId).find((candidate) => candidate.id === contentId);
              if (!library || !item) return null;
              return <button className="content-row" key={recent.id} onClick={() => openRecord(libraryId, item)}><span className="library-icon"><BookOpen size={18} /></span><span className="content-row-text"><strong>{item.title}</strong><small>{library.name}</small></span><ChevronRight size={18} /></button>;
            })}</div></>}
            <div className="section-heading progress-heading"><div><p className="eyebrow">KEEP GOING</p><h2>Your reading progress</h2></div></div>
            <div className="progress-card">
              {[LIBRARIES[0], LIBRARIES[1], LIBRARIES[2], LIBRARIES[7], LIBRARIES[8]].map((library) => {
                const count = completedCounts[library.id] ?? 0;
                const total = collectionOf(libraries[library.id], library.id).length;
                return <div className="progress-item" key={library.id}><span>{library.name}</span><b>{count}/{total}</b><div className="progress-track"><span style={{ width: `${total ? count / total * 100 : 0}%` }} /></div></div>;
              })}
            </div>
            <div className="programme-settings">
              <div><strong>Programme calendar</strong><small>Year {new Date(`${programmeStart}T12:00:00`).getFullYear()} · The week containing your selected start date is Week 1.</small></div>
              <label>Start date <input type="date" value={programmeStart} onChange={(event) => updateProgrammeCalendar("start", event.target.value).catch(() => setNotice("Could not save programme settings."))} /></label>
              <label>Week starts <select value={weekStartsOn} onChange={(event) => updateProgrammeCalendar("week", event.target.value).catch(() => setNotice("Could not save programme settings."))}><option value={0}>Sunday</option><option value={1}>Monday</option></select></label>
            </div>
          </div>}

          {screen === "library" && <div className="page">
            <div className="page-heading"><button className="back-button" onClick={() => setScreen("home")}><ArrowLeft size={17} /> Back</button><p className="eyebrow">LIBRARY</p><h1>{currentLibrary.name}</h1><p className="muted">{currentLibrary.description}</p></div>
            {libraryId === "reports-forms" ? <div className="form-list">
              {(libraries["reports-forms"]?.forms ?? []).map((form) => <button className="form-card" key={form.id} onClick={() => { setSelectedForm(form); setFormData({}); setFormDraftId(null); setReportHistoryId(null); setScreen("reader"); }}><span className="library-icon"><FileText size={22} /></span><span><strong>{form.title}</strong><small>{form.cadence} · {form.description}</small></span><ChevronRight size={18} /></button>)}
              <h2 className="subheading">Saved drafts</h2>
              {drafts.length === 0 ? <p className="muted">Saved form drafts will appear here.</p> : drafts.map((draft) => <article className="saved-draft" key={draft.id}><button className="draft-open" onClick={() => openFormDraft(draft)}><FileText size={18} /><span><b>{draft.formTitle}</b><small>Updated {new Date(draft.updatedAt).toLocaleDateString()}</small></span></button><button className="icon-button danger-icon" aria-label="Delete draft" onClick={() => deleteFormDraft(draft).catch(() => setNotice("Could not delete the draft."))}><Trash2 size={17} /></button></article>)}
              <h2 className="subheading">Report history</h2>
              {reportHistory.length === 0 ? <p className="muted">Saved reports will appear here.</p> : reportHistory.map((report) => <article className="saved-draft" key={report.id}><button className="draft-open" onClick={() => openReport(report)}><FileText size={18} /><span><b>{report.formTitle}</b><small>{report.cadence} · Updated {new Date(report.updatedAt).toLocaleDateString()}</small></span></button><button className="icon-button danger-icon" aria-label={`Delete ${report.formTitle}`} onClick={() => deleteReport(report).catch(() => setNotice("Could not delete this report."))}><Trash2 size={17} /></button></article>)}
            </div> : <>
              <div className="list-tools">
                <div className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${currentLibrary.name.toLowerCase()}...`} /><button aria-label="Clear search" onClick={() => setSearch("")}><X size={15} /></button></div>
                {currentLibrary.id !== "baptismal-course" && currentLibrary.id !== "discipleship-course" && <label className="selector-label">{currentLibrary.id.includes("devotional") ? "Day" : "Week"} <select value={record?.id ?? ""} onChange={(event) => { const selected = currentItems.find((item) => item.id === event.target.value); if (selected) openRecord(libraryId, selected); }}><option value="" disabled>Select</option>{currentItems.map((item, index) => <option key={item.id} value={item.id}>{currentLibrary.id.includes("devotional") ? `Day ${item.day ?? index + 1}` : `Week ${item.week ?? index + 1}`} · {item.title}</option>)}</select>{currentLibrary.id.includes("devotional") && <><span className="date-picker-label">Date</span><input aria-label="Select devotional date" type="date" onChange={(event) => { if (!event.target.value) return; const selected = currentItems[devotionalDay(new Date(`${event.target.value}T12:00:00`)) - 1]; if (selected) openRecord(libraryId, selected); }} /></>}</label>}
              </div>
              {(currentLibrary.id === "baptismal-course" || currentLibrary.id === "discipleship-course") && <div className="library-grid course-grid">{activeItems.map((item) => <button className="library-card" key={item.id} onClick={() => openRecord(libraryId, item)}><span className="library-icon"><BookOpen size={22} /></span><span className="library-card-content"><strong>{item.title}</strong><small>{textValue(item.description)}</small><em>Module {item.moduleNumber}</em></span><ChevronRight size={18} /></button>)}</div>}
              {currentLibrary.id !== "baptismal-course" && currentLibrary.id !== "discipleship-course" && <div className="content-list">{activeItems.slice(0, 100).map((item) => <button className="content-row" key={item.id} onClick={() => openRecord(libraryId, item)}><span className="row-number">{String(item.day ?? item.week ?? 0).padStart(2, "0")}</span><span className="content-row-text"><strong>{item.title}</strong><small>{textValue(item.theme ?? item.topic ?? item.scripture ?? item.description)}</small></span>{reading[itemId(libraryId, item.id)] && <Check className="done-check" size={18} />}<ChevronRight size={18} /></button>)}</div>}
              {activeItems.length === 0 && <div className="empty-state"><Search size={30} /><h3>No matching content</h3><p>Try a different title, topic or scripture reference.</p></div>}
            </>}
          </div>}

          {screen === "reader" && selectedForm && <div className="page">
            <div className="page-heading"><button className="back-button" onClick={() => { setSelectedForm(null); setScreen("library"); }}><ArrowLeft size={17} /> Forms</button><p className="eyebrow">REPORTS & FORMS</p><h1>{selectedForm.title}</h1><p className="muted">{selectedForm.description}</p></div>
            <div className="form-editor">
              {selectedForm.fields.map(renderFormField)}
              <div className="form-actions"><AppButton onClick={() => saveFormDraft(selectedForm, formData, formDraftId).then(setFormDraftId).catch(() => setNotice("Could not save this form draft."))}>Save draft</AppButton><AppButton onClick={() => saveReport().catch(() => setNotice("Could not save this report."))}>Save report</AppButton><AppButton secondary onClick={() => {
                const validationError = formValidationError(selectedForm, formData);
                if (validationError) { setNotice(validationError); return; }
                shareTextWithAd(selectedForm.title, reportText(selectedForm, formData)).catch(() => setNotice("Could not share this form as text."));
              }}>Share as text</AppButton><AppButton secondary onClick={() => setPreviewForm(!previewForm)}>{previewForm ? "Hide preview" : "Preview form"}</AppButton><AppButton secondary onClick={async () => { if (!await requestAdBeforeShare()) setNotice("An ad was unavailable; continuing to print."); window.print(); }}>Print</AppButton><AppButton secondary onClick={async () => {
                const validationError = formValidationError(selectedForm, formData);
                if (validationError) { setNotice(validationError); return; }
                const pdfRecord = Object.fromEntries(selectedForm.fields.map((field) => [field.label, reportFieldValue(field, formData)]));
                await createPdf(selectedForm.title, "Reports and Forms", pdfRecord);
              }}>Generate & share PDF</AppButton></div>
              {previewForm && <div className="form-preview"><h2>Form preview</h2>{selectedForm.fields.map((field) => <div key={field.id}><strong>{field.label}</strong><span>{reportFieldValue(field, formData) || "—"}</span></div>)}</div>}
              <p className="form-privacy">Your responses stay on this device. They are never uploaded to a server.</p>
            </div>
          </div>}

          {screen === "reader" && !selectedForm && record && <div className="page reader-page">
            <div className="reader-top"><button className="back-button" onClick={goBack}><ArrowLeft size={17} /> {currentLibrary.name}</button><span>{record.day ? `DAY ${record.day} OF 365` : record.week ? `WEEK ${record.week} OF 52` : `MODULE ${record.moduleNumber ?? ""}`}</span></div>
            <article className="reader-card" style={{ "--reader-font-size": `${readerFontSize}px` } as React.CSSProperties}>
              <div className="reader-title-row"><div><p className="eyebrow">{currentLibrary.name.toUpperCase()}</p><h1>{record.title}</h1><p className="scripture">{textValue(record.scripture ?? record.scriptureReferences ?? "")}</p></div><button className={`icon-button ${records.some((entry) => entry.id === itemId(libraryId, record.id)) ? "bookmarked" : ""}`} aria-label="Bookmark" onClick={() => toggleBookmark(libraryId, record).catch(() => setNotice("Could not update bookmarks."))}><Bookmark size={20} fill={records.some((entry) => entry.id === itemId(libraryId, record.id)) ? "currentColor" : "none"} /></button></div>
              {record.contentStatus === "placeholder" && <div className="content-warning"><strong>Church content pending</strong><span>This entry is a placeholder. Replace it with church-approved material before publishing.</span></div>}
              {record.contentStatus === "sample" && <div className="content-warning"><strong>Demonstration content</strong><span>This original sample is for testing only. Replace it with church-approved material before publishing.</span></div>}
              <div className="reader-body">              {Object.entries(record).filter(([key]) => !["id", "title", "day", "week", "moduleNumber", "contentStatus"].includes(key)).map(([key, value]) => {
                if (key !== "prayerPoints" || !Array.isArray(value)) return renderReaderField(key, value);
                return <section className="reader-section prayer-checklist" key={key}><h3>Prayer Points</h3>{value.map((point, index) => {
                  const settingName = `prayer:${libraryId}:${record.id}:${index}`;
                  return <label key={index}><input type="checkbox" checked={Boolean(prayerChecks[settingName])} onChange={() => togglePrayerPoint(index).catch(() => setNotice("Could not save prayer progress."))} /><span>{textValue(point)}</span></label>;
                })}</section>;
              })}</div>
              <div className="reader-actions">
                <button className="action-button" aria-label="Decrease reading text size" onClick={() => updateReaderFontSize(readerFontSize - 1).catch(() => setNotice("Could not save reading appearance."))}>A−</button>
                <button className="action-button" aria-label="Increase reading text size" onClick={() => updateReaderFontSize(readerFontSize + 1).catch(() => setNotice("Could not save reading appearance."))}>A+</button>
                <button className="action-button" onClick={() => openNoteEditor(undefined, { id: libraryId, record })}><NotebookPen size={17} /> Jot a note</button>
                <button className="action-button" onClick={() => shareTextWithAd(record.title, contentText(record)).catch(() => setNotice("Sharing was cancelled or is unavailable."))}><Share2 size={17} /> Share</button>
                <button className="action-button" onClick={() => createPdf(record.title, currentLibrary.name, record)}><Download size={17} /> PDF</button>
              </div>
              <div className="complete-row"><span>{reading[itemId(libraryId, record.id)] ? "Marked as completed" : "Finished reading?"}</span><AppButton secondary onClick={() => markCompleted(libraryId, record).catch(() => setNotice("Could not save your reading progress."))}>{reading[itemId(libraryId, record.id)] ? "Undo completion" : "Mark completed"}</AppButton></div>
              <div className="reader-pager"><button disabled={listIndex <= 0} onClick={() => { const previous = currentItems[listIndex - 1]; if (previous) openRecord(libraryId, previous); }}><ChevronLeft size={18} /> Previous</button><button disabled={listIndex >= currentItems.length - 1} onClick={() => { const next = currentItems[listIndex + 1]; if (next) openRecord(libraryId, next); }}>Next <ChevronRight size={18} /></button></div>
            </article>
          </div>}

          {screen === "jotter" && <div className="page">
            <div className="page-heading"><p className="eyebrow">PERSONAL SPACE</p><h1>Jotter</h1><p className="muted">Your notes are saved on this device and work offline.</p></div>
            {noteDraft ? <div className="note-editor"><label>Title<input value={noteDraft.title} onChange={(event) => setNoteDraft({ ...noteDraft, title: event.target.value })} onBlur={() => { if (noteDraft.title.trim()) saveNote(true).catch(() => setNotice("Could not automatically save your note.")); }} placeholder="Give your note a title" /></label><label>Note<textarea rows={10} value={noteDraft.content} onChange={(event) => setNoteDraft({ ...noteDraft, content: event.target.value })} onBlur={() => { if (noteDraft.title.trim()) saveNote(true).catch(() => setNotice("Could not automatically save your note.")); }} placeholder="Write a reflection, prayer or reminder..." /></label>{noteDraft.libraryId && <p className="linked-note">Linked to {LIBRARIES.find((item) => item.id === noteDraft.libraryId)?.name}</p>}<div className="form-actions"><AppButton onClick={() => saveNote().catch(() => setNotice("Could not save your note. Please check device storage."))}>Save note</AppButton><AppButton secondary onClick={() => setNoteDraft(null)}>Cancel</AppButton></div></div> : <>
              <div className="section-heading"><div><h2>Your notes</h2><p className="muted">{notes.length} saved</p></div><AppButton onClick={() => openNoteEditor()}>+ New note</AppButton></div>
              {notes.length === 0 ? <div className="empty-state"><NotebookPen size={32} /><h3>Your jotter is ready</h3><p>Create a note to keep a reflection, prayer or reminder.</p></div> : <><div className="search-field note-search"><Search size={17} /><input value={noteSearch} onChange={(event) => setNoteSearch(event.target.value)} placeholder="Search your notes..." /><button aria-label="Clear note search" onClick={() => setNoteSearch("")}><X size={15} /></button></div><div className="notes-grid">{notes.filter((note) => `${note.title} ${note.content}`.toLocaleLowerCase().includes(noteSearch.toLocaleLowerCase())).map((note) => <article className="note-card" key={note.id}><button className="note-open" onClick={() => openNoteEditor(note)}><strong>{note.title}</strong><p>{note.content || "No note text yet."}</p><small>Created {new Date(note.createdAt).toLocaleDateString()} · Updated {new Date(note.updatedAt).toLocaleDateString()}</small></button><div className="note-card-actions"><button onClick={() => shareText(note.title, note.content).catch(() => setNotice("Sharing is unavailable."))}><Share2 size={16} /> Share</button><button onClick={() => createPdf(note.title, "Jotter", { Note: note.content }, false)}><Download size={16} /> PDF</button><button aria-label="Delete note" onClick={() => removeNote(note).catch(() => setNotice("Could not delete note."))}><Trash2 size={16} /></button></div></article>)}</div></>}
            </>}
          </div>}

          {screen === "bookmarks" && <div className="page">
            <div className="page-heading"><p className="eyebrow">SAVED FOR LATER</p><h1>Bookmarks</h1><p className="muted">Your bookmarked lessons and resources.</p></div>
            {records.length === 0 ? <div className="empty-state"><Bookmark size={32} /><h3>No bookmarks yet</h3><p>Use the bookmark button in any resource to save it here.</p></div> : <><div className="bookmark-tools"><div className="search-field note-search"><Search size={17} /><input value={bookmarkSearch} onChange={(event) => setBookmarkSearch(event.target.value)} placeholder="Search bookmarks..." /><button aria-label="Clear bookmark search" onClick={() => setBookmarkSearch("")}><X size={15} /></button></div><select aria-label="Filter bookmarks by library" value={bookmarkFilter} onChange={(event) => setBookmarkFilter(event.target.value as LibraryId | "all")}><option value="all">All libraries</option>{LIBRARIES.map((library) => <option key={library.id} value={library.id}>{library.name}</option>)}</select></div><div className="content-list">{records.filter((saved) => (bookmarkFilter === "all" || saved.libraryId === bookmarkFilter) && `${saved.contentTitle} ${saved.libraryId}`.toLocaleLowerCase().includes(bookmarkSearch.toLocaleLowerCase())).map((saved) => <div className="bookmark-row" key={saved.id}><button className="content-row" onClick={async () => { const data = await getLibrary(saved.libraryId); const item = collectionOf(data, saved.libraryId).find((candidate) => candidate.id === saved.contentId); if (item) openRecord(saved.libraryId, item); else setNotice("The bookmarked content is no longer available."); }}><span className="library-icon"><Bookmark size={18} /></span><span className="content-row-text"><strong>{saved.contentTitle}</strong><small>{LIBRARIES.find((library) => library.id === saved.libraryId)?.name}</small></span><ChevronRight size={18} /></button><button className="icon-button danger-icon" aria-label="Remove bookmark" onClick={() => getDatabase().bookmarks.delete(saved.id).then(loadSavedData).catch(() => setNotice("Could not remove bookmark."))}><X size={17} /></button></div>)}</div></>}
          </div>}

          {screen === "search" && <div className="page">
            <div className="page-heading"><p className="eyebrow">FIND A RESOURCE</p><h1>Search library</h1><p className="muted">Search titles, scripture references and lesson content offline.</p></div>
            <div className="search-field search-large"><Search size={19} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search all libraries..." /><button aria-label="Clear search" onClick={() => setSearch("")}><X size={16} /></button></div>
            {search.trim() && <><p className="result-count">{allSearchResults.length} results</p><div className="content-list">{allSearchResults.map(({ library, item, excerpt }) => <button className="content-row result-row" key={`${library.id}:${item.id}`} onClick={() => openRecord(library.id, item)}><span className="library-icon"><Search size={17} /></span><span className="content-row-text"><strong>{item.title}</strong><small>{library.name} · {excerpt}</small></span><ChevronRight size={18} /></button>)}</div>{allSearchResults.length === 0 && <div className="empty-state"><Search size={30} /><h3>No results found</h3><p>Try another title, topic or scripture reference.</p></div>}</>}
          </div>}

          {screen === "donate" && <div className="page narrow-page"><div className="page-heading"><p className="eyebrow">SUPPORT THE MINISTRY</p><h1>Donate</h1><p className="muted">Thank you for supporting the work of RMCC Intl.</p></div><div className="donate-card"><span className="library-icon"><Heart size={24} /></span><h2>Giving information</h2><p>Official donation details have not been supplied for this version of the app.</p><dl><div><dt>Bank name</dt><dd>To be provided by the church</dd></div><div><dt>Account name</dt><dd>To be provided by the church</dd></div><div><dt>Account number</dt><dd>To be provided by the church</dd></div></dl><small>No payment is collected through this app.</small></div></div>}

          {screen === "privacy" && <div className="page narrow-page"><div className="page-heading"><p className="eyebrow">YOUR INFORMATION</p><h1>Privacy</h1><p className="muted">How RMCC Church Library handles your data.</p></div><div className="privacy-card"><section><h2>Stored on this device</h2><p>Bookmarks, jotter notes, reading history, course progress, programme settings, form drafts and saved reports are stored in the app&apos;s local IndexedDB database. They remain available offline and are not uploaded to a church server.</p></section><section><h2>Advertising</h2><p>The Android app includes the Google Mobile Ads SDK. Before sharing library resources or reports as text or PDF, the app requests an interstitial ad. If an ad is unavailable, you can continue sharing. Google may process data as described in its privacy information when an ad loads.</p></section><section><h2>Manage local data</h2><p>Deleting local data permanently removes notes, bookmarks, saved forms, reports and reading progress from this device.</p><button className="button button-danger" onClick={async () => { if (!window.confirm("Clear all notes, bookmarks, form drafts, saved reports and reading progress from this device? This cannot be undone.")) return; try { await clearUserData(); await loadSavedData(); setNotice("Local application data cleared."); } catch { setNotice("Could not clear local data. Please try again."); } }}>Clear local data</button></section><p className="app-version">RMCC Church Library · Version 1.0</p></div></div>}
        </section>
      </div>

      <nav className="bottom-nav" aria-label="Main navigation">
        {nav.map(({ key, label, icon: Icon }) => <button key={key} className={screen === key ? "active" : ""} onClick={() => { setScreen(key); setNoteDraft(null); setSelectedForm(null); }}><Icon size={20} /><span>{label}</span></button>)}
      </nav>
      <footer className="ad-placeholder"><span>RMCC CHURCH LIBRARY</span><small>Works offline</small></footer>
    </main>
  );
}
