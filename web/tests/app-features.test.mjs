import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);

async function loadTypeScriptModule(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("exports", "require", "module", compiled)(loaded.exports, require, loaded);
  return loaded.exports;
}

test("daily calendar preserves 365 entries in leap years", async () => {
  const { dayOfYear, devotionalDay } = await loadTypeScriptModule("../src/lib/date-manager.ts");
  assert.equal(devotionalDay(new Date(2026, 0, 1)), 1);
  assert.equal(devotionalDay(new Date(2026, 11, 31)), 365);
  assert.equal(devotionalDay(new Date(2024, 1, 28)), 59);
  assert.equal(devotionalDay(new Date(2024, 1, 29)), 59);
  assert.equal(devotionalDay(new Date(2024, 2, 1)), 60);
  assert.equal(dayOfYear(new Date(2024, 11, 31)), 366);
});

test("programme weeks follow the configured start date and week boundary", async () => {
  const { programmeWeek } = await loadTypeScriptModule("../src/lib/date-manager.ts");
  assert.equal(programmeWeek(new Date(2026, 0, 4), "2026-01-04", 0), 1);
  assert.equal(programmeWeek(new Date(2026, 0, 10), "2026-01-04", 0), 1);
  assert.equal(programmeWeek(new Date(2026, 0, 11), "2026-01-04", 0), 2);
  assert.equal(programmeWeek(new Date(2026, 0, 3), "2026-01-04", 0), 1);
  assert.equal(programmeWeek(new Date(2026, 11, 31), "2026-01-04", 0), 52);
});

test("library validator rejects mismatched or malformed records", async () => {
  const { validateLibraryData } = await loadTypeScriptModule("../src/lib/content-validator.ts");
  const lesson = {
    id: "ss-001", week: 1, title: "Lesson", scripture: "John 3:16", memoryVerse: "John 3:16",
    lessonContent: "Placeholder", discussionQuestions: [],
  };
  const valid = { libraryId: "sunday-school", libraryName: "Sunday School", totalWeeks: 52, lessons: Array.from({ length: 52 }, (_, index) => ({ ...lesson, id: `ss-${index + 1}` })) };
  assert.equal(validateLibraryData(valid, "sunday-school", "Sunday School", "lessons"), valid);
  assert.throws(() => validateLibraryData(valid, "bible-study", "Bible Study", "studies"));
  assert.throws(() => validateLibraryData({ ...valid, lessons: [{ id: "ss-001", title: "Only a title" }] }, "sunday-school", "Sunday School", "lessons"));
  assert.throws(() => validateLibraryData({ ...valid, lessons: valid.lessons.slice(0, 1) }, "sunday-school", "Sunday School", "lessons"));
});

test("reports library validates all 17 complete form templates", async () => {
  const { validateLibraryData } = await loadTypeScriptModule("../src/lib/content-validator.ts");
  const library = JSON.parse(await readFile(new URL("../public/data/reports-forms.json", import.meta.url), "utf8"));
  assert.equal(validateLibraryData(library, "reports-forms", "Reports & Forms", "forms"), library);
  assert.throws(() => validateLibraryData({ ...library, forms: library.forms.slice(0, 16) }, "reports-forms", "Reports & Forms", "forms"));
  const invalidForms = [...library.forms];
  invalidForms[0] = { ...invalidForms[0], fields: [] };
  assert.throws(() => validateLibraryData({ ...library, forms: invalidForms }, "reports-forms", "Reports & Forms", "forms"));
});

test("PDF output contains searchable text and paginates long content", async () => {
  const { createDocumentPdf } = await loadTypeScriptModule("../src/lib/pdf-generator.ts");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path) => {
    const font = String(path).endsWith("DejaVuSans-Bold.ttf") ? "DejaVuSans-Bold.ttf" : "DejaVuSans.ttf";
    const bytes = await readFile(new URL(`../public/fonts/${font}`, import.meta.url));
    return new Response(bytes);
  };
  const paragraph = "A searchable church library document with readable text. ";
  try {
    const blob = await createDocumentPdf("Sample Lesson", "Sunday School", {
      scripture: "John 3:16",
      lessonContent: paragraph.repeat(1000),
    });
    assert.ok(blob.size > 10000);
    const document = await blob.text();
    assert.ok(document.includes("/ToUnicode"));
    assert.ok(document.includes("/FontFile2"));
    assert.ok((document.match(/\/Type \/Page\b/g) ?? []).length > 1);
    assert.ok(document.includes("DejaVuSans"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
