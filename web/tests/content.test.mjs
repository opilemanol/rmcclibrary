import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const expected = new Map([
  ["sunday-school.json", ["lessons", 52]],
  ["daily-devotionals.json", ["devotionals", 365]],
  ["sunday-sermons.json", ["sermons", 52]],
  ["family-devotionals.json", ["devotionals", 365]],
  ["prayer-guides.json", ["prayerGuides", 52]],
  ["bible-study.json", ["studies", 52]],
  ["reports-forms.json", ["forms", 17]],
  ["baptismal-course.json", ["modules", 4]],
  ["discipleship-course.json", ["modules", 6]],
]);

test("all nine bundled libraries have their required records and unique IDs", async () => {
  for (const [fileName, [collectionName, count]] of expected) {
    const text = await readFile(new URL(`../public/data/${fileName}`, import.meta.url), "utf8");
    const library = JSON.parse(text);
    const items = library[collectionName];
    assert.ok(Array.isArray(items), `${fileName} must contain ${collectionName}`);
    assert.equal(items.length, count, `${fileName} must contain ${count} records`);
    assert.equal(new Set(items.map((item) => item.id)).size, count, `${fileName} IDs must be unique`);
    assert.ok(items.every((item) => typeof item.title === "string" && item.title.length > 0));
  }
});

test("each teaching library has a clearly marked original sample and placeholder entries", async () => {
  for (const [fileName, [collectionName]] of expected) {
    if (fileName === "reports-forms.json") continue;
    const library = JSON.parse(await readFile(new URL(`../public/data/${fileName}`, import.meta.url), "utf8"));
    const entries = library[collectionName];
    assert.ok(entries.some((item) => item.contentStatus === "sample"), `${fileName} must have sample entries`);
    assert.ok(entries.some((item) => item.contentStatus === "placeholder"), `${fileName} must retain placeholder entries`);
  }
});

test("form templates cover weekly, monthly and as-needed church workflows", async () => {
  const library = JSON.parse(await readFile(new URL("../public/data/reports-forms.json", import.meta.url), "utf8"));
  assert.equal(library.forms.length, 17);
  assert.deepEqual(new Set(library.forms.map((form) => form.cadence)), new Set(["Weekly", "Monthly", "As needed", "Event-based"]));
  assert.ok(library.forms.every((form) =>
    Array.isArray(form.fields) &&
    form.fields.length > 0 &&
    form.fields.every((field) => typeof field.id === "string" && typeof field.label === "string" && typeof field.type === "string"),
  ));
  assert.ok(library.forms.some((form) => /attendance/i.test(form.title)));
  assert.ok(library.forms.some((form) => /finance/i.test(form.title)));
  assert.ok(library.forms.some((form) => /event/i.test(form.title)));
});
