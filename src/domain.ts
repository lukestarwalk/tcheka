/** Analysis-only demonstration model. Monetary values use integer cêntimos. */
export type ResultState = "clear" | "irregular" | "inconclusive";
export type DemoKey = "consistent" | "altered" | "illegible" | "repeated";
export interface DemoExample {
  key: DemoKey;
  title: string;
  description: string;
  fileName: string;
  format: "PDF" | "JPG" | "PNG";
  size: number;
  issuer: string | null;
  amount: number | null;
  date: string | null;
  beneficiary: string | null;
  reference: string | null;
  result: ResultState;
  reasons: string[];
}
export interface AnalysisRecord extends DemoExample {
  id: string;
  analysedAt: string;
  duplicateOf?: string;
  isReferenceBaseline?: boolean;
}
export interface Store {
  version: 2;
  analyses: AnalysisRecord[];
}
export interface SelectedFileMetadata {
  name: string;
  size: number;
  type: string;
}
export const DISCLAIMER =
  "A análise do comprovativo não confirma que o dinheiro entrou na conta do beneficiário.";
export const UPLOAD_NOTICE =
  "Não é possível analisar este ficheiro. Escolha um dos exemplos abaixo. O ficheiro não foi enviado nem guardado.";
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const RESULT_LABELS: Record<ResultState, string> = {
  clear: "Sem divergências detectadas",
  irregular: "Indícios de irregularidade",
  inconclusive: "Análise inconclusiva",
};
export const RESULT_MESSAGES: Record<ResultState, string> = {
  clear:
    "Os campos verificados não apresentam inconsistências.",
  irregular: "Foram identificados elementos que exigem verificação adicional.",
  inconclusive:
    "Não existem elementos suficientes para concluir a análise. Obtenha o documento original ou confirme a operação junto do banco.",
};
export const DEMO_EXAMPLES: DemoExample[] = [
  {
    key: "consistent",
    title: "Documento sem inconsistências detectadas",
    description:
      "Dados legíveis e coerentes neste documento inteiramente fictício.",
    fileName: "demonstracao-documento-coerente.pdf",
    format: "PDF",
    size: 84520,
    issuer: "Banco Exemplo — fictício",
    amount: 2000000,
    date: "2026-11-08",
    beneficiary: "Beneficiário de demonstração",
    reference: "DEMO-REF-2026-001",
    result: "clear",
    reasons: [],
  },
  {
    key: "altered",
    title: "Documento com indícios de alteração",
    description:
      "Um exemplo de diferenças visuais que exigem verificação adicional.",
    fileName: "demonstracao-indicios-alteracao.pdf",
    format: "PDF",
    size: 92640,
    issuer: "Serviço Exemplo — fictício",
    amount: 3500000,
    date: "2026-11-08",
    beneficiary: "Beneficiário de demonstração",
    reference: "DEMO-REF-2026-002",
    result: "irregular",
    reasons: [
      "A zona do montante apresenta um tipo de letra e um alinhamento diferentes do restante texto neste exemplo simulado.",
      "O fundo junto à referência apresenta uma descontinuidade visual simulada. Obtenha o documento original para esclarecer estes elementos.",
    ],
  },
  {
    key: "illegible",
    title: "Imagem ilegível",
    description:
      "A imagem fictícia não tem legibilidade suficiente para identificar os dados.",
    fileName: "demonstracao-imagem-ilegivel.jpg",
    format: "JPG",
    size: 186420,
    issuer: null,
    amount: null,
    date: null,
    beneficiary: null,
    reference: null,
    result: "inconclusive",
    reasons: [
      "A resolução e o desfoque simulados impedem a leitura dos campos do documento.",
    ],
  },
  {
    key: "repeated",
    title: "Referência anteriormente analisada",
    description:
      "Dados coerentes, com um alerta separado de possível duplicação.",
    fileName: "demonstracao-referencia-repetida.pdf",
    format: "PDF",
    size: 84520,
    issuer: "Banco Exemplo — fictício",
    amount: 2000000,
    date: "2026-11-08",
    beneficiary: "Beneficiário de demonstração",
    reference: "DEMO-REF-2026-001",
    result: "clear",
    reasons: [],
  },
];
export function initialStore(): Store {
  return { version: 2, analyses: [] };
}
function copyExample(example: DemoExample): DemoExample {
  return { ...example, reasons: [...example.reasons] };
}
function nextId(records: AnalysisRecord[]): string {
  const last = records.reduce(
    (highest, record) =>
      Math.max(highest, Number(/^analysis-(\d+)$/.exec(record.id)?.[1] ?? 0)),
    0,
  );
  return `analysis-${String(last + 1).padStart(3, "0")}`;
}
function validTimestamp(at: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(at))
    return false;
  const date = new Date(at);
  return (
    Number.isFinite(date.valueOf()) &&
    date.toISOString() === (at.includes(".") ? at : at.replace("Z", ".000Z"))
  );
}
export function analyseExample(
  store: Store,
  key: DemoKey,
  at = new Date().toISOString(),
): { store: Store; record: AnalysisRecord } {
  const example = DEMO_EXAMPLES.find((item) => item.key === key);
  if (!example) throw new Error("Escolha um exemplo de demonstração válido.");
  if (!validTimestamp(at))
    throw new Error("A data e hora da análise são inválidas.");
  const analyses = [...store.analyses];
  if (
    key === "repeated" &&
    !analyses.some((item) => item.reference === example.reference)
  ) {
    // A labelled fictional baseline makes this scenario usable directly from an empty history.
    const previous: AnalysisRecord = {
      ...copyExample(DEMO_EXAMPLES[0]),
      id: nextId(analyses),
      analysedAt: new Date(new Date(at).valueOf() - 60000).toISOString(),
      isReferenceBaseline: true,
    };
    analyses.push(previous);
  }
  const prior = example.reference
    ? analyses
        .filter((item) => item.reference === example.reference)
        .sort((a, b) => a.analysedAt.localeCompare(b.analysedAt))[0]
    : undefined;
  const record: AnalysisRecord = {
    ...copyExample(example),
    id: nextId(analyses),
    analysedAt: at,
    ...(prior ? { duplicateOf: prior.id } : {}),
  };
  analyses.push(record);
  return { store: { version: 2, analyses }, record };
}
export function validateFile(file: SelectedFileMetadata): string | null {
  const extension = file.name.trim().split(".").pop()?.toLowerCase();
  const mime = file.type.trim().toLowerCase();
  const compatible: Record<string, string[]> = {
    pdf: ["application/pdf"],
    jpg: ["image/jpeg", "image/jpg"],
    jpeg: ["image/jpeg", "image/jpg"],
    png: ["image/png"],
  };
  if (
    !extension ||
    !compatible[extension] ||
    !compatible[extension].includes(mime)
  ) {
    return "Seleccione um ficheiro PDF, JPG ou PNG. A extensão e o tipo do ficheiro devem ser compatíveis.";
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0)
    return "O ficheiro está vazio ou tem um tamanho inválido. Seleccione outro ficheiro.";
  if (file.size > MAX_FILE_SIZE)
    return "O ficheiro não pode exceder 10 MB. Seleccione um ficheiro mais pequeno.";
  return null;
}
export function formatMoney(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isSafeInteger(amount))
    return "Não identificado";
  return `${new Intl.NumberFormat("pt-AO", { minimumFractionDigits: amount % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(amount / 100).replace(/\s/g, ".")} Kz`;
}
function dateParts(date: Date, includeTime = false): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat("pt-AO", {
      timeZone: "Africa/Luanda",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      ...(includeTime
        ? ({ hour: "2-digit", minute: "2-digit", hour12: false } as const)
        : {}),
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
}
export function formatDate(value: string | null | undefined): string {
  if (!value) return "Não identificado";
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value,
  );
  if (!Number.isFinite(date.valueOf())) return "Não identificado";
  const parts = dateParts(date);
  return `${parts.day}/${parts.month}/${parts.year}`;
}
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Não identificado";
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) return "Não identificado";
  const parts = dateParts(date, true);
  return `${parts.day}/${parts.month}/${parts.year} às ${parts.hour}:${parts.minute}`;
}
