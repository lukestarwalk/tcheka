import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent, ReactNode, RefObject } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  FileCheck2,
  FileSearch,
  FileText,
  History,
  Info,
  LoaderCircle,
  Moon,
  RotateCcw,
  Search,
  Sun,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { Modal } from "./components";
import { receiptPresentation } from "./presentation";
import { useTheme } from "./theme";
import {
  DEMO_EXAMPLES,
  DISCLAIMER,
  RESULT_LABELS,
  RESULT_MESSAGES,
  UPLOAD_NOTICE,
  analyseExample,
  formatDate,
  formatDateTime,
  formatMoney,
  initialStore,
  validateFile,
} from "./domain";
import type { AnalysisRecord, DemoKey, ResultState, Store } from "./domain";
import { loadStore, persistStore } from "./storage";

const resultLink = (id: string) => `/resultado/${encodeURIComponent(id)}`;
const routeTo = (path: string) => {
  window.location.hash = path;
};
const validRoute = (hash: string) =>
  /^\/(analisar|historico|sobre|resultado\/[\w-]+)$/.test(hash)
    ? hash
    : "/analisar";
const fileSize = (size: number) =>
  size < 1024
    ? `${size} B`
    : size < 1024 * 1024
      ? `${Math.round(size / 1024)} KB`
      : `${(size / 1024 / 1024).toLocaleString("pt-AO", { maximumFractionDigits: 1 })} MB`;
function startStore(): Store {
  try {
    return loadStore(localStorage);
  } catch {
    return initialStore();
  }
}
function ResultBadge({ result }: { result: ResultState }) {
  return (
    <span className={`result-badge badge-${result}`}>
      {result === "clear" ? (
        <CheckCircle2 size={13} />
      ) : result === "irregular" ? (
        <TriangleAlert size={13} />
      ) : (
        <CircleDashed size={13} />
      )}{" "}
      {RESULT_LABELS[result]}
    </span>
  );
}
function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <FileSearch size={31} />
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
function DataItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="data-item">
      <dt>{label}</dt>
      <dd className="data-value">{children || "Não identificado"}</dd>
    </div>
  );
}

function PageHeading({
  children,
  eyebrow,
  subtitle,
  headingRef,
}: {
  children: ReactNode;
  eyebrow?: string;
  subtitle: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 tabIndex={-1} ref={headingRef}>
          {children}
        </h1>
        <p className="muted">{subtitle}</p>
      </div>
    </div>
  );
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [store, setStore] = useState<Store>(startStore);
  const [route, setRoute] = useState(() =>
    validRoute(window.location.hash.slice(1)),
  );
  const [selectedDemo, setSelectedDemo] = useState<DemoKey | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ResultState | "all">("all");
  const [showReset, setShowReset] = useState(false);
  const [toast, setToast] = useState("");
  const [storageWarning, setStorageWarning] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const processingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const closeReset = useCallback(() => setShowReset(false), []);
  useEffect(() => {
    const navigate = () => {
      if (processingTimer.current) {
        clearTimeout(processingTimer.current);
        processingTimer.current = null;
        setProcessing(false);
      }
      const next = validRoute(window.location.hash.slice(1));
      if (next !== window.location.hash.slice(1))
        window.history.replaceState(null, "", `#${next}`);
      setRoute(next);
      window.scrollTo(0, 0);
    };
    if (
      !window.location.hash ||
      validRoute(window.location.hash.slice(1)) !==
        window.location.hash.slice(1)
    )
      window.history.replaceState(null, "", "#/analisar");
    window.addEventListener("hashchange", navigate);
    return () => {
      window.removeEventListener("hashchange", navigate);
      if (processingTimer.current) clearTimeout(processingTimer.current);
    };
  }, []);
  useEffect(() => {
    heading.current?.focus();
  }, [route]);
  useEffect(() => {
    try {
      if (!persistStore(localStorage, store)) setStorageWarning(true);
    } catch {
      setStorageWarning(true);
    }
  }, [store]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const demo = DEMO_EXAMPLES.find((d) => d.key === selectedDemo);
  const selection = selectedFile
    ? {
        name: selectedFile.name,
        format: selectedFile.name.split(".").pop()?.toUpperCase() || "",
        size: selectedFile.size,
      }
    : demo
      ? { name: receiptPresentation(demo).fileName, format: demo.format, size: demo.size }
      : null;
  const isHistory = route === "/historico";
  const isAbout = route === "/sobre";
  const selectedRecord = route.startsWith("/resultado/")
    ? store.analyses.find((r) => r.id === route.split("/")[2])
    : undefined;
  const title = isAbout
    ? "Sobre o Tcheka"
    : isHistory
      ? "Histórico"
      : selectedRecord
        ? "Resultado da análise"
        : "Analisar comprovativo";
  const visible = store.analyses.filter(
    (r) =>
      (filter === "all" || r.result === filter) &&
      `${r.fileName} ${r.issuer ?? ""} ${r.reference ?? ""} ${r.title}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  function removeSelection() {
    setSelectedDemo(null);
    setSelectedFile(null);
    setFileError("");
    if (fileInput.current) fileInput.current.value = "";
  }
  function chooseFile(file: File | undefined) {
    if (!file) return;
    const error = validateFile(file);
    setSelectedDemo(null);
    setSelectedFile(error ? null : file);
    setFileError(error ?? "");
    if (error && fileInput.current) fileInput.current.value = "";
  }
  function chooseDemo(key: DemoKey) {
    setSelectedDemo(key);
    setSelectedFile(null);
    setFileError("");
    if (fileInput.current) fileInput.current.value = "";
  }
  function drop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragActive(false);
    if (processing) return;
    if (e.dataTransfer.files.length !== 1) {
      removeSelection();
      setFileError("Seleccione apenas um ficheiro de cada vez.");
      return;
    }
    chooseFile(e.dataTransfer.files[0]);
  }
  function analyse() {
    if (processing || !selectedDemo || selectedFile) return;
    setProcessing(true);
    setFileError("");
    processingTimer.current = setTimeout(() => {
      processingTimer.current = null;
      const next = analyseExample(store, selectedDemo);
      setStore(next.store);
      setProcessing(false);
      routeTo(resultLink(next.record.id));
    }, 700);
  }
  function analyseAnother() {
    removeSelection();
    routeTo("/analisar");
  }
  function reset() {
    if (processingTimer.current) {
      clearTimeout(processingTimer.current);
      processingTimer.current = null;
    }
    setProcessing(false);
    setStore(initialStore());
    removeSelection();
    setQuery("");
    setFilter("all");
    closeReset();
    routeTo("/analisar");
    setToast("Histórico limpo.");
  }

  return (
    <div className="shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Saltar para o conteúdo
      </a>
      <header className="site-nav">
        <a className="brand" href="#/analisar" aria-label="Tcheka, analisar comprovativo">
          <span className="brand-mark"><CheckCheck aria-hidden="true" size={25} /></span>
          <span>tcheka<span className="brand-period">.</span></span>
        </a>
        <nav aria-label="Navegação principal">
          <a className={`nav-item ${!isHistory && !isAbout ? "active" : ""}`} href="#/analisar" aria-current={!isHistory && !isAbout ? "page" : undefined}>
            <FileSearch aria-hidden="true" size={19} />Analisar comprovativo
          </a>
          <a className={`nav-item ${isHistory ? "active" : ""}`} href="#/historico" aria-current={isHistory ? "page" : undefined}>
            <History aria-hidden="true" size={19} />Histórico
          </a>
          <a className={`nav-item ${isAbout ? "active" : ""}`} href="#/sobre" aria-current={isAbout ? "page" : undefined}>
            <Info aria-hidden="true" size={19} />Sobre o Tcheka
          </a>
        </nav>
        <div className="nav-tools">
          <button
            className="nav-reset theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Activar tema claro" : "Activar tema escuro"}
            title={theme === "dark" ? "Activar tema claro" : "Activar tema escuro"}
          >
            {theme === "dark" ? <Sun aria-hidden="true" size={19} /> : <Moon aria-hidden="true" size={19} />}
          </button>
          <button className="nav-reset" onClick={() => setShowReset(true)} aria-label="Limpar histórico" title="Limpar histórico">
            <RotateCcw aria-hidden="true" size={17} />
          </button>
        </div>
      </header>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Tcheka <ChevronRight size={13} />
            <span>{title}</span>
          </div>
        </header>
        <main id="main-content" className="page" tabIndex={-1}>
          {storageWarning && (
            <div className="notice notice-warm" role="status">
              <Info size={19} />
              <p>
                Não foi possível guardar o histórico. Ao fechar a página, perderá as análises desta sessão.
              </p>
            </div>
          )}
          {route.startsWith("/resultado/") ? (
            selectedRecord ? (
              renderResult(selectedRecord)
            ) : (
              <>
                <PageHeading
                  headingRef={heading}
                  eyebrow="ANÁLISE DOCUMENTAL"
                  subtitle="O registo pode ter sido removido ao limpar o histórico."
                >
                  Análise não encontrada
                </PageHeading>
                <Empty
                  title="Este registo já não está disponível"
                  text="Inicie uma análise ou consulte o histórico."
                >
                  <button className="primary" onClick={analyseAnother}>
                    Analisar comprovativo
                  </button>
                  <a className="secondary" href="#/historico">
                    Ver histórico
                  </a>
                </Empty>
              </>
            )
          ) : isHistory ? (
            renderHistory()
          ) : isAbout ? (
            renderAbout()
          ) : (
            renderHome()
          )}
          <footer className="page-footer">
            <span>Análise documental, com contexto.</span>
            <span>Tcheka</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
          <button onClick={() => setToast("")} aria-label="Fechar confirmação">
            <X size={16} />
          </button>
        </div>
      )}
      {showReset && (
        <Modal
          title="Limpar histórico?"
          subtitle="Todas as análises serão removidas deste navegador."
          onClose={closeReset}
        >
          <div className="modal-body">
            <p>
              Esta acção não pode ser desfeita.
            </p>
          </div>
          <div className="modal-footer">
            <button className="secondary" onClick={closeReset}>
              Cancelar
            </button>
            <button className="primary" onClick={reset}>
              <RotateCcw size={17} />
              Limpar histórico
            </button>
          </div>
        </Modal>
      )}
    </div>
  );

  function renderHome() {
    return (
      <>
        <PageHeading
          headingRef={heading}
          subtitle="Escolha um exemplo para analisar os dados do comprovativo."
        >
          Analisar comprovativo
        </PageHeading>
        <ol className="workflow-steps" aria-label="Etapas da análise">
          <li className="workflow-step current">
            <span>1</span>Escolher comprovativo
          </li>
          <li className={`workflow-step ${processing ? "current" : ""}`}>
            <span>2</span>Analisar
          </li>
          <li className="workflow-step">
            <span>3</span>Consultar resultado
          </li>
        </ol>
        <div className="analysis-layout">
          <div className="analysis-main">
            <section
              className="panel upload-panel"
              aria-labelledby="upload-title"
            >
              <div className="panel-header">
                <div>
                  <h2 id="upload-title">Adicionar comprovativo</h2>
                  <p className="muted small">PDF, JPG ou PNG · até 10 MB</p>
                </div>
                <span className="subtle-icon">
                  <Upload size={21} />
                </span>
              </div>
              {processing ? (
                <div
                  className="processing-panel"
                  role="status"
                  aria-live="polite"
                >
                  <span className="processing-symbol">
                    <LoaderCircle className="spinner" size={34} />
                  </span>
                  <h3>A analisar comprovativo…</h3>
                  <div className="processing-steps">
                    <span className="processing-item">
                      <CheckCircle2 size={15} />
                      Comprovativo seleccionado
                    </span>
                    <span className="processing-item">
                      <CircleDashed size={15} />A preparar o resultado
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <input
                    ref={cameraInput}
                    type="file"
                    hidden
                    aria-label="Fotografar comprovativo"
                    accept="image/jpeg,image/png"
                    capture="environment"
                    onChange={(e) => {
                      const photo = e.target.files?.[0];
                      e.target.value = "";
                      chooseFile(photo);
                    }}
                  />
                  <input
                    ref={fileInput}
                    id="receipt-file"
                    className="upload-input sr-only"
                    type="file"
                    aria-label="Seleccionar comprovativo"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    onChange={(e) => chooseFile(e.target.files?.[0])}
                  />
                  <label
                    htmlFor="receipt-file"
                    className={`upload-zone ${dragActive ? "drag-active" : ""} ${selection ? "has-file" : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={(e) => {
                      if (
                        !e.currentTarget.contains(
                          e.relatedTarget as Node | null,
                        )
                      )
                        setDragActive(false);
                    }}
                    onDrop={drop}
                  >
                    {selection ? (
                      <>
                        <span className="file-icon">
                          <FileText size={29} />
                        </span>
                        <strong>{selection.name}</strong>
                        <span className="upload-meta">
                          {selection.format} <span>·</span>{" "}
                          {fileSize(selection.size)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="document-scene" aria-hidden="true">
                          <span className="solar-orb" />
                          <span className="glass-document">
                            <FileText size={29} />
                            <span className="document-line" /><span className="document-line short" />
                            <span className="document-rule" />
                          </span>
                          <span className="upload-float"><Upload size={22} /></span>
                        </span>
                        <strong>Arraste o comprovativo para aqui</strong>
                        <span>
                          ou{" "}
                          <span className="inline-link">
                            seleccione um ficheiro
                          </span>{" "}
                          no seu dispositivo
                        </span>
                        <small>A análise está disponível apenas para os exemplos abaixo.</small>
                      </>
                    )}
                  </label>
                  <div className="file-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => cameraInput.current?.click()}
                    >
                      <Camera size={17} aria-hidden="true" />
                      Tirar foto
                    </button>
                    {selection && (
                      <>
                        <button
                          className="ghost"
                          onClick={() => fileInput.current?.click()}
                        >
                          <Upload size={15} />
                          Substituir ficheiro
                        </button>
                        <button className="ghost" onClick={removeSelection}>
                          <X size={15} />
                          Remover selecção
                        </button>
                      </>
                    )}
                  </div>
                  {fileError && (
                    <div className="form-error" role="alert">
                      <TriangleAlert size={17} />
                      {fileError}
                    </div>
                  )}
                  {selectedFile && (
                    <div className="notice notice-warm upload-notice">
                      <Info size={20} />
                      <p>{UPLOAD_NOTICE}</p>
                    </div>
                  )}
                </>
              )}
              <div className="upload-footer">
                <button
                  className="primary"
                  disabled={!selectedDemo || !!selectedFile || processing}
                  onClick={analyse}
                >
                  {processing ? (
                    <LoaderCircle size={17} className="spinner" />
                  ) : (
                    <FileSearch size={17} />
                  )}
                  Analisar comprovativo <ArrowRight size={15} />
                </button>
              </div>
            </section>
            <section className="demo-section" aria-labelledby="demo-title">
              <div className="demo-section-heading">
                <div>
                  <h2 id="demo-title">Escolher um exemplo</h2>

                </div>
              </div>
              <div className="demo-grid">
                {DEMO_EXAMPLES.map(receiptPresentation).map((example, index) => (
                  <button
                    key={example.key}
                    className={`demo-example ${selectedDemo === example.key ? "selected" : ""}`}
                    aria-pressed={selectedDemo === example.key}
                    disabled={processing}
                    onClick={() => chooseDemo(example.key)}
                  >
                    <span
                      className={`demo-example-icon example-${example.key}`}
                    >
                      {index === 0 ? (
                        <FileCheck2 size={22} />
                      ) : index === 1 ? (
                        <TriangleAlert size={22} />
                      ) : index === 2 ? (
                        <FileSearch size={22} />
                      ) : (
                        <History size={22} />
                      )}
                    </span>
                    <span className="demo-example-text">
                      <strong>{example.title}</strong>
                      <small>{example.description}</small>
                      <span>
                        {example.format} · {fileSize(example.size)}
                      </span>
                    </span>
                    <span className="demo-radio">
                      {selectedDemo === example.key && <Check size={12} />}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>
          <aside className="analysis-guide">
            <div className="panel">
              <div className="panel-header">
                <span className="guide-icon">
                  <FileCheck2 size={25} />
                </span>
              </div>
              <div className="guide-copy">
                <h2>O que verificar</h2>
                <p>
                  Consulte os dados e esclareça qualquer diferença antes de tomar uma decisão.
                </p>
                <ul className="guide-checks">
                  <li>
                    <Check size={15} />
                    Dados disponíveis no documento
                  </li>
                  <li>
                    <Check size={15} />
                    Diferenças no documento
                  </li>
                  <li>
                    <Check size={15} />
                    Possível duplicação de referência
                  </li>
                </ul>
              </div>
            </div>
            <p className="file-original-note">
              <FileText size={17} />
              Prefira o documento original. Fotografias e capturas de ecrã podem
              perder informação relevante.
            </p>
          </aside>
        </div>
      </>
    );
  }

  function renderResult(savedRecord: AnalysisRecord) {
    const record = receiptPresentation(savedRecord);
    const previous = store.analyses.find((r) => r.id === record.duplicateOf);
    return (
      <>
        <button className="back-link" onClick={() => routeTo("/historico")}>
          <ArrowLeft size={16} />
          Histórico de análises
        </button>
        <PageHeading
          headingRef={heading}
          subtitle="Consulte os dados e os pontos que precisam de atenção."
        >
          Resultado da análise
        </PageHeading>
        <div className="result-layout">
          <div className="result-main">
            <section
              className={`result-banner result-${record.result}`}
              aria-labelledby="result-title"
            >
              <span className="result-icon">
                {record.result === "clear" ? (
                  <CheckCircle2 size={28} />
                ) : record.result === "irregular" ? (
                  <TriangleAlert size={28} />
                ) : (
                  <CircleDashed size={28} />
                )}
              </span>
              <div>
                <h2 id="result-title">{RESULT_LABELS[record.result]}</h2>
                <p>{RESULT_MESSAGES[record.result]}</p>
                {record.reasons.length > 0 && (
                  <ul className="result-reasons">
                    {record.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
            <div className="notice notice-green receipt-limit">
              <Info size={20} />
              <p>{DISCLAIMER}</p>
            </div>
            {previous && (
              <section
                className="duplicate-alert"
                aria-labelledby="duplicate-title"
              >
                <History size={23} />
                <div>
                  <h3 id="duplicate-title">Possível duplicação</h3>
                  <p>
                    Esta referência já aparece no histórico. Reveja o registo anterior; a repetição não comprova fraude.
                  </p>
                  <a
                    className="inline-link"
                    href={`#${resultLink(previous.id)}`}
                  >
                    Consultar registo anterior <ArrowRight size={15} />
                  </a>
                </div>
              </section>
            )}
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>Dados do comprovativo</h2>

                </div>
              </div>
              <dl className="document-data">
                <DataItem label="Banco ou serviço emissor">
                  {record.issuer ?? "Não identificado"}
                </DataItem>
                <DataItem label="Valor apresentado">
                  {record.amount === null
                    ? "Não identificado"
                    : formatMoney(record.amount)}
                </DataItem>
                <DataItem label="Data do documento">
                  {record.date ? formatDate(record.date) : "Não identificado"}
                </DataItem>
                <DataItem label="Beneficiário">
                  {record.beneficiary ?? "Não identificado"}
                </DataItem>
                <DataItem label="Referência da operação">
                  {record.reference ?? "Não identificado"}
                </DataItem>
              </dl>
            </section>
            <section className="panel details-panel" id="analysis-details">
              <div className="panel-header">
                <div>
                  <h2>Detalhes da análise</h2>

                </div>
                <FileSearch size={20} />
              </div>
              <ul className="check-list">
                <li className="check-item">
                  <span
                    className={`check-icon ${record.result === "inconclusive" ? "check-neutral" : ""}`}
                  >
                    {record.result === "inconclusive" ? (
                      <CircleDashed size={18} />
                    ) : (
                      <Check size={18} />
                    )}
                  </span>
                  <div>
                    <strong>Legibilidade dos dados</strong>
                    <p>
                      {record.result === "inconclusive"
                        ? "A imagem não permite identificar os campos com confiança."
                        : "Os campos apresentados estão legíveis."}
                    </p>
                  </div>
                </li>
                <li className="check-item">
                  <span
                    className={`check-icon ${record.result === "irregular" ? "check-warm" : ""}`}
                  >
                    {record.result === "irregular" ? (
                      <TriangleAlert size={18} />
                    ) : (
                      <Info size={18} />
                    )}
                  </span>
                  <div>
                    <strong>Coerência do documento</strong>
                    <p>
                      {record.result === "irregular"
                        ? "Há diferenças visuais que precisam de revisão. Consulte os motivos acima."
                        : record.result === "inconclusive"
                          ? "Sem elementos suficientes para avaliar a coerência."
                          : "Sem inconsistências detectadas. Isto não autentica o documento."}
                    </p>
                  </div>
                </li>
                <li className="check-item">
                  <span className="check-icon">
                    <History size={18} />
                  </span>
                  <div>
                    <strong>Referências no histórico</strong>
                    <p>
                      {previous
                        ? "Encontrada uma referência igual num registo anterior."
                        : "Nenhuma referência igual encontrada neste histórico."}
                    </p>
                  </div>
                </li>
              </ul>
            </section>
            <div className="result-actions">
              <button className="primary" onClick={analyseAnother}>
                <Upload size={17} />
                Analisar outro comprovativo
              </button>
              <a className="secondary" href="#/historico">
                <History size={17} />
                Ver histórico
              </a>
            </div>
          </div>
          <aside className="result-aside">
            <section className="panel document-summary">
              <div className="panel-header">
                <h2>Sobre este registo</h2>
                <FileText size={20} />
              </div>
              <div className="summary-file">
                <span className="file-icon">
                  <FileText size={24} />
                </span>
                <div>
                  <strong>{record.fileName}</strong>
                  <small>
                    {record.format} · {fileSize(record.size)}
                  </small>
                </div>
              </div>
              <dl>
                <div className="summary-line">
                  <dt>Data e hora da análise</dt>
                  <dd>{formatDateTime(record.analysedAt)}</dd>
                </div>
              </dl>
              <button
                className="secondary"
                onClick={() => {
                  document
                    .getElementById("analysis-details")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  document
                    .getElementById("analysis-details")
                    ?.querySelector("h2")
                    ?.setAttribute("tabindex", "-1");
                  (
                    document
                      .getElementById("analysis-details")
                      ?.querySelector("h2") as HTMLElement
                  )?.focus({ preventScroll: true });
                }}
              >
                Ver detalhes da análise <ArrowRight size={15} />
              </button>
            </section>
          </aside>
        </div>
      </>
    );
  }

  function renderHistory() {
    return (
      <>
        <div className="history-heading">
          <PageHeading
            headingRef={heading}
            subtitle="Pesquise e consulte as suas análises."
          >
            Histórico
          </PageHeading>
          <button className="primary" onClick={analyseAnother}>
            <Upload size={17} />
            Analisar comprovativo
          </button>
        </div>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>
                Análises anteriores{" "}
                <span className="count-badge">{store.analyses.length}</span>
              </h2>

            </div>

          </div>
          <div className="history-toolbar">
            <label className="search-box">
              <Search size={18} />
              <input
                aria-label="Pesquisar análises"
                placeholder="Pesquisar ficheiro, banco ou referência…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Limpar pesquisa"
                >
                  <X size={15} />
                </button>
              )}
            </label>
            <div className="filter-tabs" aria-label="Filtrar por resultado">
              {(["all", "clear", "irregular", "inconclusive"] as const).map(
                (value) => (
                  <button
                    key={value}
                    className={`filter-tab ${filter === value ? "active" : ""}`}
                    onClick={() => setFilter(value)}
                    aria-pressed={filter === value}
                  >
                    {value === "all"
                      ? "Todos"
                      : value === "clear"
                        ? "Sem divergências"
                        : value === "irregular"
                          ? "Indícios de irregularidade"
                          : "Inconclusivos"}
                  </button>
                ),
              )}
            </div>
          </div>
          {visible.length ? (
            <>
              <div className="analysis-list">
                {[...visible].reverse().map(receiptPresentation).map((record) => (
                  <a
                    className="analysis-row"
                    href={`#${resultLink(record.id)}`}
                    key={record.id}
                    aria-label={`Ver análise de ${record.fileName}, ${formatDateTime(record.analysedAt)}`}
                  >
                    <span className="file-icon">
                      <FileText size={22} />
                    </span>
                    <div className="analysis-row-main">
                      <strong>{record.fileName}</strong>
                      <small>{record.issuer ?? "Não identificado"}</small>
                    </div>
                    <div className="analysis-row-meta">
                      <strong>
                        {record.amount === null
                          ? "Não identificado"
                          : formatMoney(record.amount)}
                      </strong>
                      <small>{formatDateTime(record.analysedAt)}</small>
                    </div>
                    <div className="analysis-row-result">
                      <ResultBadge result={record.result} />
                      {record.duplicateOf && (
                        <span className="duplicate-label">
                          <History size={12} />
                          Possível duplicação
                        </span>
                      )}
                    </div>
                    <ChevronRight size={18} />
                  </a>
                ))}
              </div>
              <div className="list-footer">
                A mostrar {visible.length} de {store.analyses.length} análises
              </div>
            </>
          ) : (
            <Empty
              title={
                store.analyses.length
                  ? "Nenhuma análise encontrada"
                  : "O seu histórico começa aqui"
              }
              text={
                store.analyses.length
                  ? "Experimente outra pesquisa ou outro resultado."
                  : "Escolha um exemplo para fazer a primeira análise."
              }
            >
              {store.analyses.length ? (
                <button
                  className="secondary"
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                  }}
                >
                  Limpar filtros
                </button>
              ) : (
                <button className="primary" onClick={analyseAnother}>
                  Escolher comprovativo <ArrowRight size={17} />
                </button>
              )}
            </Empty>
          )}
        </section>
        <p className="history-local-note">
          <Info size={15} />
          O histórico fica guardado apenas neste navegador.
        </p>
      </>
    );
  }

  function renderAbout() {
    return (
      <>
        <PageHeading headingRef={heading} subtitle="Informação para interpretar os seus comprovativos.">
          Sobre o Tcheka
        </PageHeading>
        <section className="panel about-intro">
          <span className="about-brand"><CheckCheck size={32} /></span>
          <h2>Mais clareza sobre cada comprovativo.</h2>
          <p>Consulte valores, beneficiários e referências. Identifique os pontos que precisam de atenção e mantenha as análises organizadas.</p>
        </section>
        <div className="about-grid">
          <section className="panel">
            <div className="panel-header"><h2>Como analisar</h2></div>
            <div className="about-copy">
              <p>Escolha um exemplo e seleccione «Analisar comprovativo». Consulte o resultado e os dados apresentados.</p>
              <p>Use o histórico para encontrar uma análise por ficheiro, banco ou referência.</p>
            </div>
          </section>
          <section className="panel">
            <div className="panel-header"><h2>Como interpretar o resultado</h2></div>
            <div className="about-copy">
              <p>Se houver diferenças ou campos ilegíveis, peça o documento original para esclarecer.</p>
              <p>Uma referência repetida exige revisão; por si só, não comprova uma irregularidade.</p>
              <p>{DISCLAIMER} Consulte o recebimento na sua conta.</p>
            </div>
          </section>
        </div>
        <div className="about-actions">
          <button className="primary" onClick={analyseAnother}>
            Analisar comprovativo <ArrowRight size={17} />
          </button>
          <a className="secondary" href="#/historico"><History size={17} />Ver histórico</a>
        </div>
      </>
    );
  }
}
