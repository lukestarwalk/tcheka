import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { DEMO_EXAMPLES, RESULT_LABELS, UPLOAD_NOTICE, DISCLAIMER, analyseExample, initialStore } from "./domain";
import type { Store, DemoKey } from "./domain";
import { STORAGE_KEY } from "./storage";
import { receiptPresentation } from "./presentation";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://tcheka.test/",
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement,
  Element: dom.window.Element,
  Node: dom.window.Node,
  File: dom.window.File,
  FileList: dom.window.FileList,
  Event: dom.window.Event,
  MutationObserver: dom.window.MutationObserver,
  getComputedStyle: dom.window.getComputedStyle,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
dom.window.scrollTo = () => {};
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
const { render, cleanup, screen, within, waitFor, fireEvent } =
  await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
const { default: App } = await import("./App");
const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Store;
function mount(route = "/analisar", preserveStorage = false) {
  if (!preserveStorage) localStorage.clear();
  dom.window.history.replaceState(null, "", `/#${route}`);
  render(<App />);
  return userEvent.setup({ document: dom.window.document });
}
const mainAnalyse = () =>
  screen.getByRole("button", { name: /^Analisar comprovativo$/ });
async function analyseDemo(
  user: ReturnType<typeof userEvent.setup>,
  key: DemoKey,
) {
  const example = DEMO_EXAMPLES.find((item) => item.key === key)!;
  await user.click(
    screen.getByRole("button", { name: new RegExp(example.title) }),
  );
  await user.click(mainAnalyse());
  await screen.findByRole(
    "heading",
    { name: RESULT_LABELS[example.result] },
    { timeout: 2500 },
  );
}
afterEach(() => {
  cleanup();
  localStorage.clear();
});

test("home provides direct analysis, only the requested navigation, and isolated legacy cleanup", async () => {
  localStorage.setItem(
    "tcheka-demo-v1",
    JSON.stringify({ orders: [{ client: "Dados antigos" }] }),
  );
  localStorage.setItem("unrelated-app-preference", "keep-me");
  const user = mount("/analisar", true);
  assert.equal(localStorage.getItem("tcheka-demo-v1"), null);
  assert.equal(localStorage.getItem("unrelated-app-preference"), "keep-me");
  assert.deepEqual(
    within(screen.getByRole("navigation", { name: "Navegação principal" }))
      .getAllByRole("link")
      .map((link) => link.textContent),
    ["Analisar comprovativo", "Histórico", "Sobre o Tcheka"],
  );
  assert.ok(
    screen.getByRole("heading", { name: "Analisar comprovativo", level: 1 }),
  );
  assert.equal((mainAnalyse() as HTMLButtonElement).disabled, true);
  assert.doesNotMatch(
    document.body.textContent!,
    /encomenda|cobrança|pagamentos parciais|saldo|recebimento confirmado|cadastro de clientes/i,
  );
  await user.click(screen.getByRole("link", { name: "Sobre o Tcheka" }));
  await screen.findByRole("heading", { name: "Sobre o Tcheka", level: 1 });
  assert.ok(
    screen.getByRole("heading", { name: "Como interpretar o resultado" }),
  );
  assert.doesNotMatch(
    document.body.textContent!,
    /encomenda|cobrança|pagamentos parciais|saldo|recebimento confirmado/i,
  );
});

test("coherent example processes directly, exposes details and keeps the same outcome when repeated", async () => {
  const user = mount();
  await user.click(
    screen.getByRole("button", {
      name: /Documento sem inconsistências detectadas/,
    }),
  );
  assert.equal((mainAnalyse() as HTMLButtonElement).disabled, false);
  await user.click(mainAnalyse());
  assert.ok(
    screen.getByRole("status").textContent!.includes("A analisar comprovativo"),
  );
  assert.equal((mainAnalyse() as HTMLButtonElement).disabled, true);
  assert.equal(
    saved().analyses.length,
    0,
    "processing has not yet created a completed analysis",
  );
  await screen.findByRole(
    "heading",
    { name: "Sem divergências detectadas" },
    { timeout: 2500 },
  );
  assert.equal(saved().analyses.length, 1);
  assert.equal(saved().analyses[0].result, "clear");
  assert.match(document.body.textContent!, /Banco Exemplo/);
  assert.match(document.body.textContent!, /20[.\s]000 Kz/);
  assert.match(
    document.body.textContent!,
    /A análise do comprovativo não confirma que o dinheiro entrou na conta do beneficiário/,
  );
  await user.click(
    screen.getByRole("button", { name: "Ver detalhes da análise" }),
  );
  assert.equal(document.activeElement?.textContent, "Detalhes da análise");
  await user.click(
    screen.getByRole("button", { name: "Analisar outro comprovativo" }),
  );
  await screen.findByRole("heading", {
    name: "Analisar comprovativo",
    level: 1,
  });
  assert.equal((mainAnalyse() as HTMLButtonElement).disabled, true);
  await analyseDemo(user, "consistent");
  assert.deepEqual(
    saved().analyses.map((record) => record.result),
    ["clear", "clear"],
  );
  assert.ok(screen.getByRole("heading", { name: "Possível duplicação" }));
  assert.ok(
    screen.getByRole("heading", { name: "Sem divergências detectadas" }),
  );
});

for (const key of ["altered", "illegible"] as const) {
  const example = DEMO_EXAMPLES.find((item) => item.key === key)!;
  test(`${example.title} has its predefined result and does not invent missing fields`, async () => {
    const user = mount();
    await analyseDemo(user, key);
    assert.equal(saved().analyses[0].result, example.result);
    for (const reason of receiptPresentation(example).reasons) assert.ok(screen.getByText(reason));
    if (key === "illegible") {
      assert.equal(
        document.querySelectorAll(".document-data .data-value").length,
        5,
      );
      for (const value of document.querySelectorAll(
        ".document-data .data-value",
      ))
        assert.equal(value.textContent, "Não identificado");
    } else {
      assert.match(document.body.textContent!, /exigem verificação adicional/);
      assert.doesNotMatch(
        document.body.textContent!,
        /fraude comprovada|100% seguro/i,
      );
    }
  });
}

test("previously analysed reference displays a separate duplication warning and working previous-record link", async () => {
  const user = mount();
  await analyseDemo(user, "repeated");
  assert.equal(
    saved().analyses.length,
    2,
    "this scenario includes an explicitly fictional previous reference record",
  );
  assert.equal(saved().analyses.at(-1)!.result, "clear");
  assert.ok(
    screen.getByRole("heading", { name: "Sem divergências detectadas" }),
  );
  assert.ok(screen.getByRole("heading", { name: "Possível duplicação" }));
  const link = screen.getByRole("link", { name: "Consultar registo anterior" });
  assert.equal(
    link.getAttribute("href"),
    `#/resultado/${saved().analyses[0].id}`,
  );
  await user.click(link);
  await waitFor(() =>
    assert.equal(window.location.hash, `#/resultado/${saved().analyses[0].id}`),
  );
  await waitFor(() =>
    assert.equal(
      screen.queryByRole("heading", { name: "Possível duplicação" }),
      null,
    ),
  );
  assert.ok(
    screen.getByRole("heading", { name: "Sem divergências detectadas" }),
  );
});

test("real files can be selected, replaced, removed and dropped without a result or completed history", async () => {
  const user = mount();
  const file = new dom.window.File(["PRIVATE_FILE_CONTENT"], "cliente.pdf", {
    type: "application/pdf",
  });
  const input = screen.getByLabelText("Seleccionar comprovativo");
  await user.upload(input, file);
  assert.ok(screen.getByText("cliente.pdf"));
  assert.ok(screen.getByText(UPLOAD_NOTICE));
  assert.equal((mainAnalyse() as HTMLButtonElement).disabled, true);
  let pickerRequested = false;
  input.addEventListener("click", () => {
    pickerRequested = true;
  });
  await user.click(screen.getByRole("button", { name: "Substituir ficheiro" }));
  assert.equal(pickerRequested, true);
  await user.upload(
    input,
    new dom.window.File(["IMAGE_CONTENT"], "captura.png", {
      type: "image/png",
    }),
  );
  assert.ok(screen.getByText("captura.png"));
  assert.equal(screen.queryByText("cliente.pdf"), null);
  await user.click(screen.getByRole("button", { name: "Remover selecção" }));
  assert.equal(screen.queryByText(UPLOAD_NOTICE), null);
  const dropZone = document.querySelector(".upload-zone")!;
  fireEvent.dragOver(dropZone, { dataTransfer: { files: [file] } });
  assert.equal(dropZone.classList.contains("drag-active"), true);
  fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });
  assert.ok(screen.getByText("cliente.pdf"));
  assert.equal((mainAnalyse() as HTMLButtonElement).disabled, true);
  assert.equal(saved().analyses.length, 0);
  assert.doesNotMatch(
    localStorage.getItem(STORAGE_KEY)!,
    /PRIVATE_FILE_CONTENT|cliente.pdf|IMAGE_CONTENT|captura.png/,
  );
  await user.click(screen.getByRole("link", { name: "Histórico" }));
  await screen.findByRole("heading", { name: "O seu histórico começa aqui" });
  assert.equal(screen.queryByText("cliente.pdf"), null);
});

test("camera capture replaces a demo, preserves selection on cancellation and allows retaking a photo", async () => {
  const user = mount();
  const camera = screen.getByLabelText("Fotografar comprovativo") as HTMLInputElement;
  assert.equal(camera.getAttribute("capture"), "environment");
  assert.equal(screen.getByLabelText("Seleccionar comprovativo").hasAttribute("capture"), false);
  let captureRequested = false;
  camera.addEventListener("click", () => { captureRequested = true; });
  await user.click(screen.getByRole("button", { name: "Tirar foto" }));
  assert.equal(captureRequested, true);

  await user.click(screen.getByRole("button", { name: new RegExp(DEMO_EXAMPLES[0].title) }));
  assert.equal((mainAnalyse() as HTMLButtonElement).disabled, false);
  const photo = new File(["PRIVATE_PHOTO"], "comprovativo.jpg", { type: "image/jpeg" });
  await user.upload(camera, photo);
  assert.ok(screen.getByText(photo.name));
  assert.ok(screen.getByText(UPLOAD_NOTICE));
  assert.equal((mainAnalyse() as HTMLButtonElement).disabled, true);
  fireEvent.change(camera, { target: { files: [] } });
  assert.ok(screen.getByText(photo.name));

  await user.click(screen.getByRole("button", { name: "Remover selecção" }));
  assert.equal(screen.queryByText(photo.name), null);
  await user.upload(camera, photo);
  assert.ok(screen.getByText(photo.name));
  assert.equal(saved().analyses.length, 0);
  assert.doesNotMatch(localStorage.getItem(STORAGE_KEY)!, /PRIVATE_PHOTO|comprovativo.jpg/);

  fireEvent.change(camera, {
    target: { files: [new File([new Uint8Array(10 * 1024 * 1024 + 1)], "grande.jpg", { type: "image/jpeg" })] },
  });
  assert.match(screen.getByRole("alert").textContent!, /10 MB/);
  assert.equal(screen.queryByText(photo.name), null);
});

test("invalid file formats, empty files, oversized files and multi-file drops show actionable errors", async () => {
  mount();
  const input = screen.getByLabelText("Seleccionar comprovativo");
  fireEvent.change(input, {
    target: {
      files: [
        new dom.window.File(["x"], "ficheiro.exe", {
          type: "application/octet-stream",
        }),
      ],
    },
  });
  assert.match(screen.getByRole("alert").textContent!, /PDF, JPG ou PNG/);
  fireEvent.change(input, {
    target: {
      files: [
        new dom.window.File([], "vazio.pdf", { type: "application/pdf" }),
      ],
    },
  });
  assert.match(screen.getByRole("alert").textContent!, /vazio/);
  fireEvent.change(input, {
    target: {
      files: [
        new dom.window.File(
          [new Uint8Array(10 * 1024 * 1024 + 1)],
          "grande.pdf",
          { type: "application/pdf" },
        ),
      ],
    },
  });
  assert.match(screen.getByRole("alert").textContent!, /10 MB/);
  const first = new dom.window.File(["a"], "a.pdf", {
    type: "application/pdf",
  });
  const second = new dom.window.File(["b"], "b.pdf", {
    type: "application/pdf",
  });
  fireEvent.drop(document.querySelector(".upload-zone")!, {
    dataTransfer: { files: [first, second] },
  });
  assert.match(screen.getByRole("alert").textContent!, /apenas um ficheiro/);
  assert.equal((mainAnalyse() as HTMLButtonElement).disabled, true);
  assert.equal(saved().analyses.length, 0);
});

test("history searches and filters fictional analyses, survives reload and resets only after confirmation", async () => {
  let user = mount();
  for (const key of ["consistent", "altered", "illegible"] as const) {
    await analyseDemo(user, key);
    await user.click(
      screen.getByRole("button", { name: "Analisar outro comprovativo" }),
    );
    await screen.findByRole("heading", {
      name: "Analisar comprovativo",
      level: 1,
    });
  }
  await user.click(screen.getByRole("link", { name: /^Histórico/ }));
  await screen.findByRole("heading", { name: "Histórico", level: 1 });
  assert.equal(document.querySelectorAll(".analysis-row").length, 3);
  const search = screen.getByRole("textbox", { name: "Pesquisar análises" });
  await user.type(search, "DEMO-REF-2026-002");
  assert.equal(document.querySelectorAll(".analysis-row").length, 1);
  assert.match(
    document.querySelector(".analysis-row")!.textContent!,
    /indicios-alteracao.pdf/,
  );
  await user.clear(search);
  await user.click(screen.getByRole("button", { name: "Inconclusivos" }));
  assert.equal(document.querySelectorAll(".analysis-row").length, 1);
  assert.match(
    document.querySelector(".analysis-row")!.textContent!,
    /imagem-ilegivel.jpg/,
  );
  cleanup();
  user = mount("/historico", true);
  assert.equal(document.querySelectorAll(".analysis-row").length, 3);
  assert.equal(saved().analyses.length, 3);
  await user.click(screen.getByRole("button", { name: "Limpar histórico" }));
  assert.equal(saved().analyses.length, 3);
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Cancelar",
    }),
  );
  assert.equal(saved().analyses.length, 3);
  await user.click(screen.getByRole("button", { name: "Limpar histórico" }));
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Limpar histórico",
    }),
  );
  await waitFor(() => assert.equal(saved().analyses.length, 0));
  await screen.findByRole("heading", {
    name: "Analisar comprovativo",
    level: 1,
  });
});


test("editorial cleanup omits the environment label and preserves result limits and stored records", () => {
  let store = initialStore();
  for (const example of DEMO_EXAMPLES) {
    store = analyseExample(store, example.key, "2026-11-10T12:00:00Z").store;
  }
  const original = JSON.stringify(store);
  const routes = ["/analisar", "/historico", "/sobre", "/resultado/missing",
    ...store.analyses.map((record) => `/resultado/${record.id}`)];
  for (const route of routes) {
    localStorage.setItem(STORAGE_KEY, original);
    mount(route, true);
    assert.equal(screen.queryByText("Ambiente de demonstração"), null);
    assert.doesNotMatch(document.body.textContent!, /protótipo|projecto académico|ISPTEC|OCR|criptográfic|simulad|fictíci|pipeline|fixture|MVP|incremento/i);
    assert.equal(document.querySelector('a[download]'), null);
    assert.equal(document.querySelectorAll(".demo-chip").length, 0);
    assert.equal(localStorage.getItem(STORAGE_KEY), original, "editorial aliases must not rewrite or discard saved analyses");
    if (store.analyses.some((record) => route === `/resultado/${record.id}`)) {
      assert.equal(screen.getAllByText(DISCLAIMER).length, 1);
      assert.ok(document.querySelector(".result-main")!.contains(screen.getByText(DISCLAIMER)));
    }
    cleanup();
  }
});

test("theme switches accessibly, survives reload and remains independent of history reset", async () => {
  let user = mount();
  const before = localStorage.getItem(STORAGE_KEY);
  await user.click(screen.getByRole("button", { name: "Activar tema escuro" }));
  assert.equal(document.documentElement.dataset.theme, "dark");
  assert.equal(localStorage.getItem("tcheka-theme"), "dark");
  assert.equal(localStorage.getItem(STORAGE_KEY), before);
  cleanup();
  user = mount("/historico", true);
  assert.equal(document.documentElement.dataset.theme, "dark");
  await user.click(screen.getByRole("button", { name: "Limpar histórico" }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Limpar histórico" }));
  assert.equal(localStorage.getItem("tcheka-theme"), "dark");
  await user.click(screen.getByRole("button", { name: "Activar tema claro" }));
  assert.equal(document.documentElement.dataset.theme, "light");
  assert.equal(localStorage.getItem("tcheka-theme"), "light");
});

test("theme follows system until explicitly chosen and still switches when storage is blocked", async () => {
  const originalMatchMedia = window.matchMedia;
  let systemDark = true;
  const changes = new Set<() => void>();
  window.matchMedia = (() => ({
    get matches() { return systemDark; },
    addEventListener: (_event: string, listener: () => void) => changes.add(listener),
    removeEventListener: (_event: string, listener: () => void) => changes.delete(listener),
  })) as unknown as typeof window.matchMedia;
  const { act } = await import("@testing-library/react");
  const originalSet = dom.window.Storage.prototype.setItem;
  try {
    const user = mount();
    assert.equal(document.documentElement.dataset.theme, "dark");
    act(() => { systemDark = false; changes.forEach((callback) => callback()); });
    assert.equal(document.documentElement.dataset.theme, "light");
    dom.window.Storage.prototype.setItem = () => { throw new Error("Storage blocked"); };
    await user.click(screen.getByRole("button", { name: "Activar tema escuro" }));
    assert.equal(document.documentElement.dataset.theme, "dark");
    act(() => changes.forEach((callback) => callback()));
    assert.equal(document.documentElement.dataset.theme, "dark", "manual choice overrides system");
  } finally {
    cleanup();
    window.matchMedia = originalMatchMedia;
    dom.window.Storage.prototype.setItem = originalSet;
  }
});
