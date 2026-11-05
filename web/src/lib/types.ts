export type LibraryId =
  | "sunday-school"
  | "daily-devotionals"
  | "sunday-sermons"
  | "family-devotionals"
  | "prayer-guides"
  | "bible-study"
  | "reports-forms"
  | "baptismal-course"
  | "discipleship-course";

export type ContentRecord = {
  id: string;
  title: string;
  week?: number;
  day?: number;
  moduleNumber?: number;
  scripture?: string;
  theme?: string;
  topic?: string;
  description?: string;
  [key: string]: unknown;
};

export type SundaySchoolLesson = ContentRecord & {
  week: number;
  theme: string;
  memoryVerse: string;
  lessonObjectives: string[];
  lessonOutline: string[];
  lessonContent: string;
  discussionQuestions: string[];
  practicalApplication: string;
  conclusion: string;
  prayer: string;
};

export type DailyDevotional = ContentRecord & {
  day: number;
  keyVerse: string;
  introduction: string;
  reflection: string;
  lesson: string;
  prayer: string;
  actionPoint: string;
};

export type SundaySermon = ContentRecord & {
  week: number;
  theme: string;
  preacher: string;
  keyVerse: string;
  mainPoints: Array<{ heading: string; content: string; scriptureReferences: string[] }>;
  practicalApplication: string;
  conclusion: string;
  prayer: string;
};

export type FamilyDevotional = ContentRecord & {
  day: number;
  memoryVerse: string;
  openingPrayer: string;
  devotionalMessage: string;
  familyDiscussion: string[];
  familyActivity: string;
  lifeApplication: string;
  closingPrayer: string;
};

export type PrayerGuide = ContentRecord & {
  week: number;
  introduction: string;
  prayerPoints: Array<{ title: string; description: string; scripture: string }>;
  declarations: string[];
  thanksgiving: string;
  conclusion: string;
};

export type BibleStudy = ContentRecord & {
  week: number;
  topic: string;
  memoryVerse: string;
  background: string;
  studyOutline: Array<{ heading: string; explanation: string; scriptureReferences: string[]; questions: string[] }>;
  discussionQuestions: string[];
  lessonsLearned: string[];
  conclusion: string;
  closingPrayer: string;
};

export type CourseModule = ContentRecord & {
  moduleNumber: number;
  description: string;
  scriptureReferences: string[];
  memoryVerse: string;
  lessons: Array<{ title: string; content: string }>;
  discussionQuestions: string[];
  reviewQuestions: string[];
  conclusion: string;
};

export type ChurchForm = FormTemplate;

export type LibraryData = {
  libraryId: LibraryId;
  libraryName: string;
  totalWeeks?: number;
  totalDays?: number;
  lessons?: SundaySchoolLesson[];
  devotionals?: DailyDevotional[] | FamilyDevotional[];
  sermons?: SundaySermon[];
  prayerGuides?: PrayerGuide[];
  studies?: BibleStudy[];
  forms?: ChurchForm[];
  modules?: CourseModule[];
};

export type FormField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "tel" | "email" | "date" | "month" | "select" | "radio" | "checkbox" | "signature";
  required: boolean;
  options?: string[];
};

export type FormTemplate = {
  id: string;
  title: string;
  cadence: string;
  description: string;
  category: string;
  fields: FormField[];
};

export type BookmarkRecord = {
  id: string;
  libraryId: LibraryId;
  contentId: string;
  contentTitle: string;
  createdAt: string;
};

export type NoteRecord = {
  id: string;
  title: string;
  content: string;
  libraryId?: LibraryId;
  contentId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ReadingRecord = {
  id: string;
  libraryId: LibraryId;
  contentId: string;
  lastOpenedAt: string;
  completed: boolean;
};

export type CourseProgressRecord = {
  id: string;
  courseId: LibraryId;
  moduleId: string;
  completed: boolean;
  completedAt?: string;
};

export type FormDraft = {
  id: string;
  formId: string;
  formTitle: string;
  formData: Record<string, string | boolean>;
  createdAt: string;
  updatedAt: string;
};

export type ReportHistoryRecord = {
  id: string;
  formId: string;
  formTitle: string;
  cadence: string;
  formData: Record<string, string | boolean>;
  createdAt: string;
  updatedAt: string;
};
