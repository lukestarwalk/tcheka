import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { DEMO_EXAMPLES, RESULT_LABELS, DISCLAIMER, analyseExample, initialStore } from "./domain";
import type { Store } from "./domain";
import { STORAGE_KEY } from "./storage";
import { demoBalance, readPackages } from "./packages";

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
afterEach(() => {
  cleanup();
  localStorage.clear();
});

test("paid package shows quantity and single-purchase terms before simulated payment, and resumes after reload", async () => {
  let user = mount("/pacotes");
  assert.equal(screen.queryByText("Preços propostos para teste"), null);
  await user.click(screen.getByRole("button", { name: "Comprar pacote" }));
  assert.ok(screen.getByRole("heading", { name: "Resumo da escolha" }));
  assert.ok(screen.getByText("1.500 Kz"));
  assert.ok(screen.getByText("10 verificações pré-pagas"));
  assert.ok(screen.getByText("Compra única, sem mensalidade"));
  assert.equal(demoBalance(readPackages(localStorage)), 3);
  await user.click(screen.getByRole("button", { name: "Confirmar escolha" }));
  assert.ok(screen.getByRole("heading", { name: "Simulação de pagamento" }));
  assert.ok(screen.getByText("Banco Exemplo (fictício)"));
  cleanup();
  user = mount("/pacotes", true);
  assert.ok(screen.getByRole("heading", { name: "Simulação de pagamento" }));
  await user.dblClick(screen.getByRole("button", { name: "Concluir simulação" }));
  assert.ok(screen.getByText("Demonstração concluída. Nenhum valor foi cobrado."));
  assert.equal(demoBalance(readPackages(localStorage)), 13);
  cleanup();
  mount("/pacotes", true);
  assert.ok(screen.getByText("Demonstração concluída. Nenhum valor foi cobrado."));
  assert.equal(demoBalance(readPackages(localStorage)), 13);
});

test("the first visit activates free automatically on every entry route and survives reloads", async () => {
  for (const route of ["/analisar", "/pacotes", "/historico", "/sobre"]) {
    let user = mount(route);
    assert.equal(demoBalance(readPackages(localStorage)), 3);
    assert.equal(readPackages(localStorage).checkout, null);
    assert.equal(screen.queryByRole("heading", { name: "Simulação de pagamento" }), null);
    cleanup();
    user = mount("/pacotes", true);
    const freeButton = screen.getByRole("button", { name: "Grátis activado" }) as HTMLButtonElement;
    assert.equal(freeButton.disabled, true);
    await user.dblClick(freeButton);
    assert.equal(demoBalance(readPackages(localStorage)), 3);
    assert.equal(readPackages(localStorage).grants.length, 1);
    cleanup();
  }
});

test("monthly packages show monthly amounts and quantities before confirmation", async () => {
  const user = mount("/pacotes");
  for (const [button, amount, quantity] of [["Escolher Essencial", "2.000 Kz", "30 verificações por mês"], ["Escolher Negócio", "5.000 Kz", "80 verificações por mês"]]) {
    await user.click(screen.getByRole("button", { name: button }));
    assert.ok(screen.getByText(`Mensalidade de ${amount}`));
    assert.ok(screen.getByText(quantity));
    await user.click(screen.getByRole("button", { name: "Voltar aos pacotes" }));
  }
  assert.equal(demoBalance(readPackages(localStorage)), 3);
});

async function submitFile(user: ReturnType<typeof userEvent.setup>, file = new File(["comprovativo"], "recibo.pdf", { type: "application/pdf" })) {
  await user.upload(screen.getByLabelText("Seleccionar comprovativo"), file);
  await user.click(mainAnalyse());
  await screen.findByRole("heading", { name: RESULT_LABELS.unverified }, { timeout: 4500 });
}

test("free quota decreases on completion, survives reload and redirects after the third result without losing it", async () => {
  let user = mount("/analisar");
  assert.ok(screen.getByText("Plano Grátis · 3 por dia"));
  assert.ok(screen.getByText("3 verificações restantes"));
  for (let n = 1; n <= 2; n++) {
    await submitFile(user);
    assert.ok(screen.getByText(n === 1 ? "2 verificações restantes" : "1 verificação restante"));
    await user.click(screen.getByRole("button", { name: "Analisar outro comprovativo" }));
    await screen.findByRole("heading", { name: "Analisar comprovativo", level: 1 });
  }
  cleanup();
  user = mount("/analisar", true);
  assert.ok(screen.getByText("1 verificação restante"));
  await user.upload(screen.getByLabelText("Seleccionar comprovativo"), new File(["terceiro"], "terceiro.pdf"));
  await user.dblClick(mainAnalyse());
  await screen.findByRole("heading", { name: "Pacotes", level: 1 }, { timeout: 4500 });
  assert.ok(screen.getByText("As suas 3 verificações grátis de hoje terminaram."));
  assert.equal(demoBalance(readPackages(localStorage)), 0);
  assert.equal(saved().analyses.length, 3);
  assert.equal(saved().analyses[2].fileName, "terceiro.pdf");
  cleanup();
  user = mount("/pacotes", true);
  assert.equal(demoBalance(readPackages(localStorage)), 0);
  assert.equal((screen.getByRole("button", { name: "Grátis activado" }) as HTMLButtonElement).disabled, true);
  await user.click(screen.getByRole("link", { name: "Analisar comprovativo" }));
  await screen.findByRole("heading", { name: "Analisar comprovativo", level: 1 });
  await user.upload(screen.getByLabelText("Seleccionar comprovativo"), new File(["quarto"], "quarto.pdf"));
  await user.click(mainAnalyse());
  await screen.findByRole("heading", { name: "Pacotes", level: 1 });
  assert.equal(saved().analyses.length, 3);
  assert.equal(demoBalance(readPackages(localStorage)), 0);
});

test("home removes all four examples and accepts an unrestricted file without claiming analysis", async () => {
  const user = mount();
  for (const example of DEMO_EXAMPLES) assert.equal(screen.queryByRole("button", { name: new RegExp(example.title) }), null);
  assert.equal(screen.queryByText("Escolher um exemplo"), null);
  assert.equal(screen.getByLabelText("Seleccionar comprovativo").getAttribute("accept"), null);
  assert.equal((mainAnalyse() as HTMLButtonElement).disabled, true);
  const file = new File(["dados"], "demonstracao-recibo.xyz", { type: "application/octet-stream" });
  await submitFile(user, file);
  assert.ok(screen.getAllByText(file.name).length > 0, "retain exact real filename");
  assert.equal(screen.queryByRole("heading", { name: "Sem divergências detectadas" }), null);
  assert.equal(screen.queryByText("Os campos apresentados estão legíveis."), null);
  assert.equal(screen.queryByRole("heading", { name: "Dados do comprovativo" }), null);
  assert.equal(screen.getAllByText(DISCLAIMER).length, 1);
  assert.equal(saved().analyses[0].result, "unverified");
  assert.equal(saved().analyses[0].amount, null);
  assert.equal(screen.queryByRole("heading", { name: "Detalhes do registo" }), null);
  assert.equal(screen.getByRole("button", { name: "Ver detalhes do registo" }).getAttribute("aria-expanded"), "false");
  assert.doesNotMatch(document.body.textContent!, /resultado simulado|Este resultado é apresentado|Não realizada|autêntico/);
  await user.click(screen.getByRole("button", { name: "Ver detalhes do registo" }));
  assert.equal(document.activeElement?.textContent, "Detalhes do registo");
  assert.equal(screen.getByRole("button", { name: "Ocultar detalhes do registo" }).getAttribute("aria-expanded"), "true");
  await user.click(screen.getByRole("button", { name: "Ocultar detalhes do registo" }));
  assert.equal(screen.queryByRole("heading", { name: "Detalhes do registo" }), null);
  await user.click(screen.getByRole("button", { name: "Ver detalhes do registo" }));
  await user.click(screen.getByRole("link", { name: "Histórico" }));
  await screen.findByRole("heading", { name: "Histórico", level: 1 });
  await user.click(screen.getByRole("link", { name: new RegExp(`Ver análise de ${file.name}`) }));
  await screen.findByRole("heading", { name: RESULT_LABELS.unverified });
  assert.equal(screen.queryByRole("heading", { name: "Detalhes do registo" }), null);
});

test("selection accepts empty, extensionless and large files; replacement, removal and camera cancellation work", async () => {
  const user = mount();
  const input = screen.getByLabelText("Seleccionar comprovativo");
  const empty = new File([], "sem-extensao", { type: "" });
  await user.upload(input, empty);
  assert.equal((mainAnalyse() as HTMLButtonElement).disabled, false);
  assert.ok(screen.getByText("sem-extensao"));
  const large = new File(["x"], "grande.bin", { type: "application/octet-stream" });
  Object.defineProperty(large, "size", { value: 20 * 1024 * 1024 });
  await user.upload(input, large);
  assert.ok(screen.getByText("grande.bin"));
  assert.equal(screen.queryByRole("alert"), null);
  const camera = screen.getByLabelText("Fotografar comprovativo");
  fireEvent.change(camera, { target: { files: [] } });
  assert.ok(screen.getByText("grande.bin"));
  const photo = new File(["image"], "foto.heic", { type: "image/heic" });
  fireEvent.change(camera, { target: { files: [photo] } });
  assert.ok(screen.getByText("foto.heic"));
  await user.click(screen.getByRole("button", { name: "Remover selecção" }));
  assert.equal((mainAnalyse() as HTMLButtonElement).disabled, true);
  assert.equal(saved().analyses.length, 0);
});

test("drop accepts arbitrary files but requires one at a time", () => {
  mount();
  const file = new File([], "comprovativo");
  const zone = document.querySelector(".upload-zone")!;
  fireEvent.drop(zone, { dataTransfer: { files: [file] } });
  assert.equal((mainAnalyse() as HTMLButtonElement).disabled, false);
  fireEvent.drop(zone, { dataTransfer: { files: [file, file] } });
  assert.match(screen.getByRole("alert").textContent!, /apenas um ficheiro/);
  assert.equal((mainAnalyse() as HTMLButtonElement).disabled, true);
});

test("accepted files persist, can be searched and filtered, and reset requires confirmation", async () => {
  let user = mount();
  await submitFile(user);
  await user.click(screen.getByRole("button", { name: "Analisar outro comprovativo" }));
  await screen.findByRole("heading", { name: "Analisar comprovativo", level: 1 });
  await submitFile(user);
  assert.equal(saved().analyses.length, 2);
  assert.ok(saved().analyses.every(record => record.result === "unverified" && !record.duplicateOf));
  cleanup();
  user = mount("/historico", true);
  assert.equal(document.querySelectorAll(".analysis-row").length, 2);
  await user.click(screen.getByRole("button", { name: "Não analisados" }));
  assert.equal(document.querySelectorAll(".analysis-row").length, 2);
  await user.type(screen.getByRole("textbox", { name: "Pesquisar análises" }), "ausente");
  assert.equal(document.querySelectorAll(".analysis-row").length, 0);
  await user.click(screen.getByRole("button", { name: "Limpar histórico" }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
  assert.equal(saved().analyses.length, 2);
  await user.click(screen.getByRole("button", { name: "Limpar histórico" }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Limpar histórico" }));
  await waitFor(() => assert.equal(saved().analyses.length, 0));
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
    assert.doesNotMatch(document.body.textContent!, /protótipo|projecto académico|ISPTEC|OCR|criptográfic|fictíci|pipeline|fixture|MVP|incremento/i);
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
