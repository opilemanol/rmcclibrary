import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const expected = new Map([
  ["sunday-school.json", "lessons"],
  ["daily-devotionals.json", "devotionals"],
  ["sunday-sermons.json", "sermons"],
  ["family-devotionals.json", "devotionals"],
  ["prayer-guides.json", "prayerGuides"],
  ["bible-study.json", "studies"],
  ["reports-forms.json", "forms"],
  ["baptismal-course.json", "modules"],
  ["discipleship-course.json", "modules"],
]);

test("all nine bundled libraries have unique, nonempty records", async () => {
  for (const [fileName, collectionName] of expected) {
    const text = await readFile(new URL(`../public/data/${fileName}`, import.meta.url), "utf8");
    const library = JSON.parse(text);
    const items = library[collectionName];
    assert.ok(Array.isArray(items), `${fileName} must contain ${collectionName}`);
    assert.ok(items.length > 0, `${fileName} must contain available records`);
    assert.equal(new Set(items.map((item) => item.id)).size, items.length, `${fileName} IDs must be unique`);
    assert.ok(items.every((item) => typeof item.title === "string" && item.title.length > 0));
  }
});

test("bundled libraries contain no sample or placeholder records", async () => {
  for (const [fileName, collectionName] of expected) {
    const library = JSON.parse(await readFile(new URL(`../public/data/${fileName}`, import.meta.url), "utf8"));
    const entries = library[collectionName];
    assert.ok(entries.every((item) => !["sample", "placeholder"].includes(item.contentStatus)), `${fileName} must exclude sample and placeholder entries`);
  }
});

test("each date-based library includes the November 8, 2026 lesson or devotional", async () => {
  const dated = [
    ["sunday-school.json", "lessons", "week", 45],
    ["daily-devotionals.json", "devotionals", "day", 312],
    ["sunday-sermons.json", "sermons", "week", 45],
    ["family-devotionals.json", "devotionals", "day", 312],
    ["prayer-guides.json", "prayerGuides", "week", 45],
    ["bible-study.json", "studies", "week", 45],
  ];
  for (const [fileName, collectionName, period, value] of dated) {
    const library = JSON.parse(await readFile(new URL(`../public/data/${fileName}`, import.meta.url), "utf8"));
    assert.ok(library[collectionName].some((item) => item[period] === value), `${fileName} must include period ${value}`);
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
