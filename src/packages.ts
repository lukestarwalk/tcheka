export type PackageId = "free" | "single" | "essential" | "business";
export const PACKAGES = [
  { id: "free", name: "Grátis", amount: 0, credits: 3, period: "", billing: "Gratuito", allowance: "3 verificações de teste", terms: "Uma única vez por conta.", button: "Experimentar grátis" },
  { id: "single", name: "Pacote avulso", amount: 100000, credits: 10, period: "por pacote", billing: "Compra única", allowance: "10 verificações pré-pagas", terms: "Compra única, sem mensalidade.", button: "Comprar pacote" },
  { id: "essential", name: "Essencial", amount: 200000, credits: 30, period: "por mês", billing: "Mensalidade", allowance: "30 verificações por mês", terms: "Pagamento mensal.", button: "Escolher Essencial" },
  { id: "business", name: "Negócio", amount: 400000, credits: 80, period: "por mês", billing: "Mensalidade", allowance: "80 verificações por mês", terms: "Pagamento mensal.", button: "Escolher Negócio" },
] as const;
export const PACKAGE_STORAGE_KEY = "tcheka-packages-v1";
export type PackageStep = "review" | "payment" | "done";
export interface Grant { id: string; packageId: PackageId }
export interface PackageState {
  version: 1;
  grants: Grant[];
  used: string[];
  checkout: (Grant & { step: PackageStep }) | null;
}
export const emptyPackages = (): PackageState => ({ version: 1, grants: [], used: [], checkout: null });
export const getPackage = (id: PackageId) => PACKAGES.find((plan) => plan.id === id)!;
export const demoBalance = (state: PackageState) => state.grants.reduce((total, grant) => total + getPackage(grant.packageId).credits, 0) - state.used.length;
export const freeActivated = (state: PackageState) => state.grants.some((grant) => grant.packageId === "free");
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function validGrant(value: unknown): value is Grant {
  return isObject(value) && PACKAGES.some((plan) => plan.id === value.packageId) &&
    typeof value.id === "string" && (value.packageId === "free" ? value.id === "free-trial" : /^checkout-[a-z0-9-]+$/.test(value.id));
}

/** Persist choices, not money. Reconstruct the balance from unique completed choices. */
export function sanitizePackages(value: unknown): PackageState {
  const state = emptyPackages();
  if (!isObject(value) || value.version !== 1 || !Array.isArray(value.grants)) return state;
  for (const grant of value.grants) {
    if (validGrant(grant) && !state.grants.some((item) => item.id === grant.id)) {
      state.grants.push({ id: grant.id, packageId: grant.packageId });
    }
  }
  if (Array.isArray(value.used)) {
    const limit = demoBalance(state);
    state.used = [...new Set(value.used.filter((id): id is string => typeof id === "string" && /^usage-[a-z0-9-]+$/.test(id)))].slice(0, limit);
  }
  const checkout = value.checkout;
  if (validGrant(checkout) && isObject(checkout)) {
    const completed = state.grants.find((grant) => grant.id === checkout.id);
    if (completed) state.checkout = { ...completed, step: "done" };
    else if (checkout.packageId !== "free" && (checkout.step === "review" || checkout.step === "payment")) {
      state.checkout = { id: checkout.id, packageId: checkout.packageId, step: checkout.step };
    }
  }
  return state;
}

export type PackageAction =
  | { type: "select"; packageId: PackageId; id: string }
  | { type: "payment" }
  | { type: "confirm" }
  | { type: "review" }
  | { type: "consume"; id: string }
  | { type: "list" };

export class NoCreditsError extends Error {
  constructor() { super("Não tem verificações disponíveis. Escolha um pacote para continuar."); }
}

export function updatePackages(state: PackageState, action: PackageAction): PackageState {
  const checkout = state.checkout;
  if (action.type === "consume") {
    if (state.used.includes(action.id)) return state;
    if (demoBalance(state) <= 0) throw new NoCreditsError();
    const next = { ...state, used: [...state.used, action.id] };
    return demoBalance(next) === 0 ? { ...next, checkout: null } : next;
  }
  if (action.type === "list") return { ...state, checkout: null };
  if (action.type === "select") {
    if (action.packageId === "free") {
      const grant: Grant = { id: "free-trial", packageId: "free" };
      return { ...state, grants: freeActivated(state) ? state.grants : [...state.grants, grant], checkout: { ...grant, step: "done" } };
    }
    // Reusing a completed checkout identifier can only reopen its receipt.
    const previous = state.grants.find((grant) => grant.id === action.id);
    return { ...state, checkout: previous ? { ...previous, step: "done" } : { id: action.id, packageId: action.packageId, step: "review" } };
  }
  if (!checkout) return state;
  if (action.type === "payment" && checkout.step === "review") return { ...state, checkout: { ...checkout, step: "payment" } };
  if (action.type === "review" && checkout.step === "payment") return { ...state, checkout: { ...checkout, step: "review" } };
  if (action.type === "confirm" && checkout.step === "payment") {
    const grant = { id: checkout.id, packageId: checkout.packageId };
    return { ...state, grants: state.grants.some((item) => item.id === grant.id) ? state.grants : [...state.grants, grant], checkout: { ...checkout, step: "done" } };
  }
  return state;
}

export function readPackages(storage: Pick<Storage, "getItem">): PackageState {
  const saved = storage.getItem(PACKAGE_STORAGE_KEY);
  if (!saved) return emptyPackages();
  try { return sanitizePackages(JSON.parse(saved)); } catch { return emptyPackages(); }
}

/** Read the latest state and persist before reporting success. Storage failures are surfaced to the UI. */
export function savePackageAction(storage: Pick<Storage, "getItem" | "setItem">, action: PackageAction): PackageState {
  const next = updatePackages(readPackages(storage), action);
  storage.setItem(PACKAGE_STORAGE_KEY, JSON.stringify(next));
  return next;
}
