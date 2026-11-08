import type { LibraryData, LibraryId } from "./types";

export function validateLibraryData(
  value: unknown,
  expectedId: LibraryId,
  expectedName: string,
  collectionName: string,
): LibraryData {
  if (!value || typeof value !== "object") {
    throw new Error(`${expectedName} content is invalid. Please contact the app administrator.`);
  }

  const candidate = value as Partial<LibraryData>;
  const collection = candidate[collectionName as keyof LibraryData];
  if (
    candidate.libraryId !== expectedId ||
    candidate.libraryName !== expectedName ||
    !Array.isArray(collection)
  ) {
    throw new Error(`${expectedName} content is incomplete. Please contact the app administrator.`);
  }

  const validRecords = collection.every((record) =>
    Boolean(record && typeof record === "object" &&
      typeof (record as { id?: unknown }).id === "string" &&
      typeof (record as { title?: unknown }).title === "string"),
  );
  if (!validRecords) {
    throw new Error(`${expectedName} contains an invalid entry. Please contact the app administrator.`);
  }

  const capacity = expectedId.includes("devotionals") ? 365
    : ["sunday-school", "sunday-sermons", "prayer-guides", "bible-study"].includes(expectedId) ? 52
      : expectedId === "reports-forms" ? 17
        : undefined;
  const declaredCapacity = expectedId.includes("devotionals") ? candidate.totalDays
    : capacity === 52 ? candidate.totalWeeks
      : undefined;
  const capacityDeclared = capacity === 52 || expectedId.includes("devotionals");
  if (capacityDeclared && declaredCapacity !== capacity) {
    throw new Error(`${expectedName} has inconsistent calendar capacity metadata. Please contact the app administrator.`);
  }
  if (expectedId === "reports-forms" && collection.length !== capacity) {
    throw new Error(`${expectedName} does not contain all required form templates. Please contact the app administrator.`);
  }

  const requiredKeys: Partial<Record<LibraryId, string[]>> = {
    "sunday-school": ["week", "scripture", "memoryVerse", "lessonContent", "discussionQuestions"],
    "daily-devotionals": ["day", "scripture", "keyVerse", "reflection", "prayer"],
    "sunday-sermons": ["week", "scripture", "keyVerse", "mainPoints", "practicalApplication"],
    "family-devotionals": ["day", "scripture", "memoryVerse", "devotionalMessage", "familyActivity"],
    "prayer-guides": ["week", "scripture", "prayerPoints", "declarations"],
    "bible-study": ["week", "scripture", "studyOutline", "discussionQuestions"],
    "baptismal-course": ["moduleNumber", "scriptureReferences", "lessons", "reviewQuestions"],
    "discipleship-course": ["moduleNumber", "scriptureReferences", "lessons", "reviewQuestions", "assignments"],
  };
  const records = collection as Array<Record<string, unknown>>;
  if (records.some((record) => (requiredKeys[expectedId] ?? []).some((key) => record[key] === undefined || record[key] === null))) {
    throw new Error(`${expectedName} is missing required fields. Please contact the app administrator.`);
  }
  if (expectedId === "reports-forms") {
    const validForms = records.every((form) => {
      if (typeof form.cadence !== "string" || !Array.isArray(form.fields) || form.fields.length === 0) return false;
      return form.fields.every((field) => Boolean(
        field && typeof field === "object" &&
        typeof (field as { id?: unknown }).id === "string" &&
        typeof (field as { label?: unknown }).label === "string" &&
        typeof (field as { type?: unknown }).type === "string",
      ));
    });
    if (!validForms) {
      throw new Error(`${expectedName} contains an invalid form. Please contact the app administrator.`);
    }
  }

  return candidate as LibraryData;
}
