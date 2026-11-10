import { DEMO_EXAMPLES, initialStore } from "./domain";
import type { AnalysisRecord, DemoExample, Store } from "./domain";

export const STORAGE_KEY = "tcheka-analysis-v2";
const LEGACY_STORAGE_KEY = "tcheka-demo-v1";
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function sameExample(
  value: Record<string, unknown>,
  example: DemoExample,
): boolean {
  return Object.keys(example).every((key) =>
    key === "reasons"
      ? Array.isArray(value.reasons) &&
        value.reasons.length === example.reasons.length &&
        value.reasons.every(
          (reason, index) => reason === example.reasons[index],
        )
      : value[key] === example[key as keyof DemoExample],
  );
}
/** Rebuild only known fictional examples. Unknown records and all extra properties are discarded. */
export function sanitizeStore(value: unknown): Store {
  if (!object(value) || value.version !== 2 || !Array.isArray(value.analyses))
    return initialStore();
  const analyses: AnalysisRecord[] = [];
  for (const candidate of value.analyses) {
    if (!object(candidate)) continue;
    const example = DEMO_EXAMPLES.find((item) => item.key === candidate.key);
    if (!example || !sameExample(candidate, example)) continue;
    if (
      typeof candidate.id !== "string" ||
      !/^analysis-\d{3,}$/.test(candidate.id) ||
      analyses.some((record) => record.id === candidate.id)
    )
      continue;
    if (
      typeof candidate.analysedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(
        candidate.analysedAt,
      ) ||
      !Number.isFinite(new Date(candidate.analysedAt).valueOf())
    )
      continue;
    const parsedDate = new Date(candidate.analysedAt);
    if (
      parsedDate.toISOString() !==
      (candidate.analysedAt.includes(".")
        ? candidate.analysedAt
        : candidate.analysedAt.replace("Z", ".000Z"))
    )
      continue;
    const prior = example.reference
      ? analyses
          .filter((record) => record.reference === example.reference)
          .sort((a, b) => a.analysedAt.localeCompare(b.analysedAt))[0]
      : undefined;
    analyses.push({
      ...example,
      reasons: [...example.reasons],
      id: candidate.id,
      analysedAt: candidate.analysedAt,
      ...(prior ? { duplicateOf: prior.id } : {}),
      ...(candidate.isReferenceBaseline === true && example.key === "consistent"
        ? { isReferenceBaseline: true }
        : {}),
    });
  }
  return { version: 2, analyses };
}
export function loadStore(storage: StorageLike): Store {
  // Remove this application's incompatible previous model; leave all unrelated keys intact.
  try {
    storage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* unavailable storage does not block the demonstration */
  }
  try {
    const saved = storage.getItem(STORAGE_KEY);
    return saved ? sanitizeStore(JSON.parse(saved)) : initialStore();
  } catch {
    return initialStore();
  }
}
export function persistStore(storage: StorageLike, store: Store): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(sanitizeStore(store)));
    return true;
  } catch {
    return false;
  }
}
