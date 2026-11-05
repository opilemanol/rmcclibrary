import { getCollection } from "./content-service";
import { LIBRARIES } from "./library-registry";
import type { ContentRecord, LibraryData, LibraryId } from "./types";

export type SearchResult = {
  library: (typeof LIBRARIES)[number];
  item: ContentRecord;
  excerpt: string;
};

function searchableText(item: ContentRecord): string {
  const collect = (value: unknown): string => {
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.map(collect).join(" ");
    if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).map(collect).join(" ");
    return "";
  };
  return collect(item);
}

export function searchLibrary(data: LibraryData | undefined, libraryId: LibraryId, query: string): ContentRecord[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  return getCollection(data, libraryId).filter((item) => searchableText(item).toLocaleLowerCase().includes(normalized));
}

export function searchAllLibraries(
  libraries: Partial<Record<LibraryId, LibraryData>>,
  query: string,
): SearchResult[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  return LIBRARIES.flatMap((library) => getCollection(libraries[library.id], library.id)
    .map((item) => ({ library, item, text: searchableText(item) }))
    .filter(({ text }) => text.toLocaleLowerCase().includes(normalized))
    .slice(0, 60)
    .map(({ library, item, text }) => {
      const position = text.toLocaleLowerCase().indexOf(normalized);
      return { library, item, excerpt: text.slice(Math.max(0, position - 30), position + normalized.length + 100) };
    }));
}
