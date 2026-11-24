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
  Package,
  RotateCcw,
  Search,
  ShieldCheck,
  Sun,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { Modal } from "./components";
import PackagesPage from "./PackagesPage";
import { receiptPresentation } from "./presentation";
import { useTheme } from "./theme";
import {
  DISCLAIMER,
  RESULT_LABELS,
  RESULT_MESSAGES,
  acceptFile,
  fileFormat,
  formatDate,
  formatDateTime,
  formatMoney,
  initialStore,
} from "./domain";
import type { AnalysisRecord, ResultState, Store } from "./domain";
import { loadStore, persistStore } from "./storage";
import { PACKAGE_STORAGE_KEY, NoCreditsError, demoBalance, emptyPackages, readPackages, savePackageAction } from "./packages";

const resultLink = (id: string) => `/resultado/${encodeURIComponent(id)}`;
const PROCESSING_STEPS = ["Receber ficheiro", "Organizar registo", "Preparar resultado"];
const PROCESSING_TITLES = ["A receber o comprovativo…", "A organizar o registo…", "A preparar o resultado…"];
const routeTo = (path: string) => {
  window.location.hash = path;
};
const validRoute = (hash: string) =>
  /^\/(analisar|historico|pacotes|sobre|resultado\/[\w-]+)$/.test(hash)
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
    <span className={`result-badge badge-${result === "unverified" ? "inconclusive" : result}`}>
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
  const [wallet, setWallet] = useState(() => {
    try { return readPackages(localStorage); } catch { return emptyPackages(); }
  });
  const [route, setRoute] = useState(() =>
    validRoute(window.location.hash.slice(1)),
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [detailsRoute, setDetailsRoute] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ResultState | "all">("all");
  const [showReset, setShowReset] = useState(false);
  const [toast, setToast] = useState("");
  const [storageWarning, setStorageWarning] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const loadingPanel = useRef<HTMLDivElement>(null);
  const processingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const closeReset = useCallback(() => setShowReset(false), []);
  useEffect(() => {
    const refresh = () => {
      try { setWallet(readPackages(localStorage)); } catch { /* Show the last known balance. */ }
    };
    refresh();
    const sync = (event: StorageEvent) => {
      if (event.key === PACKAGE_STORAGE_KEY || event.key === null) refresh();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [route]);
  useEffect(() => {
    if (!processing) return;
    loadingPanel.current?.focus({ preventScroll: true });
    loadingPanel.current?.scrollIntoView({ block: "start", behavior: "instant" });
    const timer = setInterval(() => setProcessingStep((step) => Math.min(step + 1, 2)), 1000);
    return () => clearInterval(timer);
  }, [processing]);
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
    setDetailsRoute(null);
  }, [route]);
  useEffect(() => {
    if (detailsRoute !== route) return;
    const details = document.getElementById("analysis-details");
    details?.scrollIntoView({ behavior: "smooth", block: "start" });
    const title = details?.querySelector("h2");
    title?.setAttribute("tabindex", "-1");
    title?.focus({ preventScroll: true });
  }, [detailsRoute, route]);
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
  const selection = selectedFile
    ? {
        name: selectedFile.name,
        format: fileFormat(selectedFile.name),
        size: selectedFile.size,
      }
    : null;
  const isHistory = route === "/historico";
  const isAbout = route === "/sobre";
  const isPackages = route === "/pacotes";
  const selectedRecord = route.startsWith("/resultado/")
    ? store.analyses.find((r) => r.id === route.split("/")[2])
    : undefined;
  const title = isPackages
    ? "Pacotes"
    : isAbout
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
    setSelectedFile(null);
    setFileError("");
    if (fileInput.current) fileInput.current.value = "";
  }
  function chooseFile(file: File | undefined) {
    if (!file) return;
    setSelectedFile(file);
    setFileError("");
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
    if (processing || processingTimer.current || !selectedFile) return;
    try {
      const current = readPackages(localStorage);
      setWallet(current);
      if (demoBalance(current) <= 0) {
        savePackageAction(localStorage, { type: "list" });
        routeTo("/pacotes");
        return;
      }
    } catch {
      setFileError("Não foi possível consultar o saldo. Permita o armazenamento neste navegador e tente novamente.");
      return;
    }
    const usageId = `usage-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    setProcessingStep(0);
    setProcessing(true);
    setFileError("");
    processingTimer.current = setTimeout(() => {
      processingTimer.current = null;
      try {
        // Check again at completion: another tab may have spent the last credit.
        if (demoBalance(readPackages(localStorage)) <= 0) throw new NoCreditsError();
        const previous = loadStore(localStorage);
        const next = acceptFile(previous, selectedFile);
        if (!persistStore(localStorage, next.store)) throw new Error("Não foi possível guardar a análise.");
        let updated;
        try {
          updated = savePackageAction(localStorage, { type: "consume", id: usageId });
        } catch (error) {
          persistStore(localStorage, previous);
          throw error;
        }
        setStore(next.store);
        setWallet(updated);
        if (demoBalance(updated) === 0) {
          setToast("Análise concluída. As suas verificações terminaram. Consulte o resultado no histórico.");
          routeTo("/pacotes");
        } else {
          routeTo(resultLink(next.record.id));
        }
      } catch (error) {
        if (error instanceof NoCreditsError) {
          try { setWallet(savePackageAction(localStorage, { type: "list" })); } catch { /* No credit was consumed. */ }
          routeTo("/pacotes");
        } else {
          setFileError("Não foi possível concluir a análise. Não foi descontada nenhuma verificação. Tente novamente.");
        }
      } finally {
        setProcessing(false);
      }
    }, 3000);
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
          <a className={`nav-item ${!isHistory && !isAbout && !isPackages ? "active" : ""}`} href="#/analisar" aria-current={!isHistory && !isAbout && !isPackages ? "page" : undefined}>
            <FileSearch aria-hidden="true" size={19} />Analisar comprovativo
          </a>
          <a className={`nav-item ${isHistory ? "active" : ""}`} href="#/historico" aria-current={isHistory ? "page" : undefined}>
            <History aria-hidden="true" size={19} />Histórico
          </a>
          <a className={`nav-item ${isPackages ? "active" : ""}`} href="#/pacotes" aria-current={isPackages ? "page" : undefined}>
            <Package aria-hidden="true" size={19} />Pacotes
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
          {!isPackages && !isHistory && !isAbout && (
            <div className="analysis-balance" role="status">
              <div><strong>{demoBalance(wallet)} {demoBalance(wallet) === 1 ? "verificação restante" : "verificações restantes"}</strong><span>Saldo de demonstração</span></div>
              <a className="inline-link" href="#/pacotes">Ver pacotes <ArrowRight size={15} /></a>
            </div>
          )}
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
          ) : isPackages ? (
            <PackagesPage />
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
          subtitle="Seleccione o comprovativo no seu dispositivo."
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
                  <p className="muted small">Qualquer formato · um ficheiro de cada vez</p>
                </div>
                <span className="subtle-icon">
                  <Upload size={21} />
                </span>
              </div>
              {processing ? (
                <div
                  className="processing-panel verification-loading"
                  ref={loadingPanel}
                  tabIndex={-1}
                  role="status"
                  aria-live="polite"
                >
                  <span className="verification-label"><FileText size={16} />A registar comprovativo</span>
                  <div className="verification-art" aria-hidden="true">
                    <div className="verification-orbit" />
                    <div className="verification-document">
                      <FileText size={44} strokeWidth={1.4} />
                      <span className="verification-scan" />
                    </div>
                    <span className="verification-seal"><ShieldCheck size={24} /></span>
                  </div>
                  <h3>{PROCESSING_TITLES[processingStep]}</h3>
                  <p className="verification-filename">{selectedFile?.name}</p>
                  <div className="verification-progress" role="progressbar" aria-label="Progresso do registo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={[18, 56, 90][processingStep]}>
                    <span style={{ width: `${[18, 56, 90][processingStep]}%` }} />
                  </div>
                  <ol className="verification-stages">
                    {PROCESSING_STEPS.map((label, index) => (
                      <li key={label} className={index < processingStep ? "complete" : index === processingStep ? "current" : ""} aria-current={index === processingStep ? "step" : undefined}>
                        {index < processingStep ? <CheckCircle2 size={18} /> : index === processingStep ? <LoaderCircle size={18} className="spinner" /> : <CircleDashed size={18} />}
                        <span>{label}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
                <>
                  <input
                    ref={cameraInput}
                    type="file"
                    hidden
                    aria-label="Fotografar comprovativo"
                    accept="image/*"
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
                        <small>Seleccione um ficheiro ou tire uma foto.</small>
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
                </>
              )}
              <div className="upload-footer">
                <button
                  className="primary"
                  disabled={!selectedFile || processing}
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
        <div className={`result-layout${record.key === "uploaded" ? " received-file" : ""}`}>
          <div className="result-main">
            <section
              className={`result-banner result-${record.result === "unverified" ? "clear" : record.result}`}
              aria-labelledby="result-title"
            >
              <span className="result-icon">
                {record.result === "unverified" ? (
                  <CheckCircle2 size={28} />
                ) : record.result === "clear" ? (
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
            {record.key === "uploaded" ? detailsRoute === route && (
              <section className="panel details-panel" id="analysis-details">
                <div className="panel-header"><h2>Detalhes do registo</h2></div>
                <dl className="document-data">
                  <DataItem label="Banco indicado">Banco BFA</DataItem>
                  <DataItem label="Ficheiro">{record.fileName}</DataItem>
                  <DataItem label="Formato">{record.format}</DataItem>
                  <DataItem label="Tamanho">{fileSize(record.size)}</DataItem>
                </dl>
              </section>
            ) : (<>
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
            </>)}
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
                  <dt>{record.key === "uploaded" ? "Data e hora do registo" : "Data e hora da análise"}</dt>
                  <dd>{formatDateTime(record.analysedAt)}</dd>
                </div>
              </dl>
              <button
                className="secondary"
                aria-expanded={record.key === "uploaded" ? detailsRoute === route : undefined}
                aria-controls="analysis-details"
                onClick={() => {
                  if (record.key === "uploaded") {
                    setDetailsRoute(detailsRoute === route ? null : route);
                    return;
                  }
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
                {record.key === "uploaded" ? detailsRoute === route ? "Ocultar detalhes do registo" : "Ver detalhes do registo" : "Ver detalhes da análise"} <ArrowRight size={15} />
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
              {(["all", "unverified", "clear", "irregular", "inconclusive"] as const).map(
                (value) => (
                  <button
                    key={value}
                    className={`filter-tab ${filter === value ? "active" : ""}`}
                    onClick={() => setFilter(value)}
                    aria-pressed={filter === value}
                  >
                    {value === "all"
                      ? "Todos"
                      : value === "unverified"
                        ? "Não analisados"
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
                  : "Seleccione um comprovativo para começar."
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
              <p>Seleccione um ficheiro ou tire uma foto e seleccione «Analisar comprovativo». No resultado, seleccione «Ver detalhes do registo» para consultar a informação do ficheiro.</p>
              <p>Use o histórico para encontrar o registo pelo nome do ficheiro. Apenas o nome, formato, tamanho e momento do registo ficam guardados neste navegador.</p>
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
