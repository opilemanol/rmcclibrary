import { LIBRARIES } from "./library-registry";
import { validateLibraryData } from "./content-validator";
import type { LibraryData, LibraryId } from "./types";

const cache = new Map<LibraryId, LibraryData>();

export async function getLibrary(id: LibraryId): Promise<LibraryData> {
  const cached = cache.get(id);
  if (cached) return cached;

  const library = LIBRARIES.find((item) => item.id === id);
  if (!library) throw new Error(`Unknown library: ${id}`);

  const response = await fetch(`./data/${library.dataFile}`);
  if (!response.ok) {
    throw new Error(`Unable to load ${library.name}. Please reinstall or update the app.`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(`${library.name} content is invalid. Please contact the app administrator.`);
  }

  const validated = validateLibraryData(data, id, library.name, library.collection);
  cache.set(id, validated);
  return validated;
}

export function clearLibraryCache(): void {
  cache.clear();
}
