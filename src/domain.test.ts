import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialStore,
  analyseExample,
  DEMO_EXAMPLES,
  RESULT_LABELS,
  RESULT_MESSAGES,
  DISCLAIMER,
  UPLOAD_NOTICE,
  MAX_FILE_SIZE,
  validateFile,
  formatMoney,
  formatDate,
  formatDateTime,
} from "./domain";
import type { DemoKey, Store } from "./domain";
import { STORAGE_KEY, loadStore, persistStore, sanitizeStore } from "./storage";
import type { StorageLike } from "./storage";

const AT = "2026-11-08T10:30:00.000Z";
class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

test("the initial model contains only an empty analysis history", () => {
  assert.deepEqual(initialStore(), { version: 2, analyses: [] });
  assert.equal(DEMO_EXAMPLES.length, 4);
  assert.deepEqual(Object.keys(initialStore()).sort(), ["analyses", "version"]);
});

test("all four examples have deterministic data and results without any commercial prerequisite", () => {
  for (const example of DEMO_EXAMPLES) {
    const first = analyseExample(initialStore(), example.key, AT);
    const second = analyseExample(initialStore(), example.key, AT);
    assert.deepEqual(first, second);
    assert.equal(first.record.result, example.result);
    assert.equal(first.record.fileName, example.fileName);
    assert.equal(first.record.amount, example.amount);
  }
  const normal = analyseExample(initialStore(), "consistent", AT);
  assert.equal(normal.record.result, "clear");
  assert.equal(normal.store.analyses.length, 1);
  assert.equal(normal.record.duplicateOf, undefined);
  assert.deepEqual(
    initialStore().analyses,
    [],
    "analysis never mutates its input",
  );
});

test("simulated visual alteration shows concrete reasons and never a fraud status", () => {
  const { record } = analyseExample(initialStore(), "altered", AT);
  assert.equal(record.result, "irregular");
  assert.ok(record.reasons.length >= 2);
  assert.match(record.reasons[0], /tipo de letra.*alinhamento/);
  assert.match(record.reasons[1], /referência/);
  assert.deepEqual(Object.keys(RESULT_LABELS).sort(), [
    "clear",
    "inconclusive",
    "irregular",
  ]);
});

test("the illegible example leaves every unidentified field null", () => {
  const { record } = analyseExample(initialStore(), "illegible", AT);
  assert.equal(record.result, "inconclusive");
  for (const field of [
    "issuer",
    "amount",
    "date",
    "beneficiary",
    "reference",
  ] as const)
    assert.equal(record[field], null);
  assert.equal(formatMoney(record.amount), "Não identificado");
  assert.equal(formatDate(record.date), "Não identificado");
});

test("reference duplication is a separate linked flag and does not change the clear result", () => {
  const first = analyseExample(initialStore(), "consistent", AT);
  const next = analyseExample(
    first.store,
    "repeated",
    "2026-11-08T10:31:00.000Z",
  );
  assert.equal(next.record.result, "clear");
  assert.equal(next.record.duplicateOf, first.record.id);
  assert.equal(next.record.reference, first.record.reference);
  assert.deepEqual(next.record.reasons, []);
  assert.equal(first.store.analyses.length, 1);
  assert.equal(next.store.analyses.length, 2);
  const again = analyseExample(
    next.store,
    "repeated",
    "2026-11-08T10:32:00.000Z",
  );
  assert.equal(again.record.duplicateOf, first.record.id);
  assert.equal(again.record.result, "clear");
});

test("the repeated example works from an empty history using an explicitly fictional baseline", () => {
  const { record, store } = analyseExample(initialStore(), "repeated", AT);
  assert.equal(store.analyses.length, 2);
  const baseline = store.analyses[0];
  assert.equal(baseline.isReferenceBaseline, true);
  assert.equal(baseline.key, "consistent");
  assert.equal(baseline.analysedAt, "2026-11-08T10:29:00.000Z");
  assert.equal(record.duplicateOf, baseline.id);
  assert.equal(record.result, "clear");
});

test("reanalysis preserves the example outcome and does not mutate shared example data", () => {
  let store = initialStore();
  for (const key of ["consistent", "altered", "illegible"] as DemoKey[]) {
    const first = analyseExample(store, key, AT);
    const second = analyseExample(first.store, key, AT);
    assert.equal(second.record.result, first.record.result);
    assert.deepEqual(second.record.reasons, first.record.reasons);
    assert.notEqual(second.record.id, first.record.id);
    store = second.store;
  }
  const example = analyseExample(initialStore(), "altered", AT);
  example.record.reasons.push("test mutation");
  assert.equal(
    DEMO_EXAMPLES.find((item) => item.key === "altered")!.reasons.includes(
      "test mutation",
    ),
    false,
  );
});

test("file validation accepts only compatible supported extensions and MIME types", () => {
  for (const [name, type] of [
    ["a.pdf", "application/pdf"],
    ["a.JPG", "image/jpeg"],
    ["a.jpeg", "image/jpeg"],
    ["a.png", "image/png"],
  ]) {
    assert.equal(validateFile({ name, type, size: 1024 }), null);
  }
  for (const [name, type] of [
    ["a.exe", "application/pdf"],
    ["a.pdf", "image/png"],
    ["a.png", "application/pdf"],
    ["a.jpg", ""],
    ["a.pdf.exe", "application/pdf"],
  ]) {
    assert.match(validateFile({ name, type, size: 1024 })!, /extensão.*tipo/);
  }
});

test("file validation enforces nonempty files and the 10 MiB limit without producing a result", () => {
  const file = {
    name: "ficheiro-real.pdf",
    type: "application/pdf",
    size: MAX_FILE_SIZE,
  };
  assert.equal(validateFile(file), null);
  assert.match(validateFile({ ...file, size: MAX_FILE_SIZE + 1 })!, /10 MB/);
  assert.match(validateFile({ ...file, size: 0 })!, /vazio/);
  assert.match(validateFile({ ...file, size: Infinity })!, /inválido/);
  assert.deepEqual(initialStore(), { version: 2, analyses: [] });
  assert.match(
    UPLOAD_NOTICE,
    /Não é possível analisar este ficheiro/,
  );
  assert.throws(
    () => analyseExample(initialStore(), "upload" as DemoKey, AT),
    /exemplo de demonstração válido/,
  );
});

test("storage removes only the exact incompatible Tcheka key and preserves unrelated data", () => {
  const storage = new MemoryStorage();
  storage.setItem("tcheka-demo-v1", JSON.stringify({ orders: ["legacy"] }));
  storage.setItem("tcheka-other-app", "keep this");
  storage.setItem("theme", "dark");
  assert.deepEqual(loadStore(storage), initialStore());
  assert.equal(storage.getItem("tcheka-demo-v1"), null);
  assert.equal(storage.getItem("tcheka-other-app"), "keep this");
  assert.equal(storage.getItem("theme"), "dark");
});

test("fictional analysis records and linked duplication round-trip safely", () => {
  const storage = new MemoryStorage();
  const { store } = analyseExample(initialStore(), "repeated", AT);
  assert.equal(persistStore(storage, store), true);
  assert.deepEqual(loadStore(storage), store);
  assert.equal(loadStore(storage).analyses[1].result, "clear");
  assert.equal(
    loadStore(storage).analyses[1].duplicateOf,
    store.analyses[0].id,
  );
});

test("storage strictly whitelists fictional records and strips real-file metadata and content", () => {
  const storage = new MemoryStorage();
  const { store } = analyseExample(initialStore(), "consistent", AT);
  const untrusted = {
    ...store,
    selectedFile: {
      name: "real-bank-document.pdf",
      size: 7001,
      type: "application/pdf",
      content: "sensitive file bytes",
    },
    analyses: [
      {
        ...store.analyses[0],
        file: "private bytes",
        realName: "real-bank-document.pdf",
        credentials: "secret",
      },
      {
        ...store.analyses[0],
        id: "analysis-002",
        fileName: "real-bank-document.pdf",
        size: 7001,
        format: "PNG",
      },
      { ...store.analyses[0], id: "analysis-003", issuer: "A real user bank" },
      { ...store.analyses[0], id: "analysis-004", result: "fraud" },
    ],
  };
  assert.equal(persistStore(storage, untrusted as Store), true);
  const raw = storage.getItem(STORAGE_KEY)!;
  for (const privateValue of [
    "real-bank-document",
    "7001",
    "sensitive",
    "private bytes",
    "secret",
    "A real user bank",
    "credentials",
    "selectedFile",
  ])
    assert.equal(raw.includes(privateValue), false);
  assert.deepEqual(loadStore(storage), store);
});

test("untrusted duplicate links are reconstructed against actual previous fictional records", () => {
  const { store } = analyseExample(initialStore(), "repeated", AT);
  const unsafe = {
    ...store,
    analyses: store.analyses.map((record) => ({
      ...record,
      duplicateOf: "https://external.invalid",
    })),
  };
  const safe = sanitizeStore(unsafe);
  assert.equal(safe.analyses[0].duplicateOf, undefined);
  assert.equal(safe.analyses[1].duplicateOf, safe.analyses[0].id);
});

test("invalid storage and unavailable persistence do not block the demonstration", () => {
  const storage = new MemoryStorage();
  for (const value of [
    "{broken json",
    '{"version":1,"analyses":[]}',
    '{"version":2,"analyses":"wrong"}',
  ]) {
    storage.setItem(STORAGE_KEY, value);
    assert.deepEqual(loadStore(storage), initialStore());
  }
  const unavailable: StorageLike = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  assert.deepEqual(loadStore(unavailable), initialStore());
  assert.equal(persistStore(unavailable, initialStore()), false);
});

test("result notices match the requested limits without implying a financial confirmation", () => {
  assert.equal(
    RESULT_MESSAGES.clear,
    "Os campos verificados não apresentam inconsistências.",
  );
  assert.equal(
    RESULT_MESSAGES.irregular,
    "Foram identificados elementos que exigem verificação adicional.",
  );
  assert.equal(
    RESULT_MESSAGES.inconclusive,
    "Não existem elementos suficientes para concluir a análise. Obtenha o documento original ou confirme a operação junto do banco.",
  );
  assert.equal(
    DISCLAIMER,
    "A análise do comprovativo não confirma que o dinheiro entrou na conta do beneficiário.",
  );
});

test("display helpers use kwanzas, dd/mm/aaaa and Angola date/time", () => {
  assert.match(formatMoney(2000000), /20.*000 Kz/);
  assert.match(formatMoney(2000050), /20.*000,50 Kz/);
  assert.equal(formatDate("2026-11-08"), "08/11/2026");
  assert.equal(
    formatDateTime("2026-11-08T23:30:00.000Z"),
    "09/11/2026 às 00:30",
  );
  assert.equal(formatDate(null), "Não identificado");
  assert.equal(formatDateTime("invalid"), "Não identificado");
});

test("invalid calendar timestamps cannot create or restore completed analysis records", () => {
  assert.throws(
    () =>
      analyseExample(initialStore(), "consistent", "2026-02-31T10:30:00.000Z"),
    /data e hora/,
  );
  const { store } = analyseExample(initialStore(), "consistent", AT);
  assert.deepEqual(
    sanitizeStore({
      ...store,
      analyses: [
        { ...store.analyses[0], analysedAt: "2026-02-31T10:30:00.000Z" },
      ],
    }),
    initialStore(),
  );
});
