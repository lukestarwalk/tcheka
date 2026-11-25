export type PackageId = "free" | "single" | "essential" | "business";
export const PACKAGES = [
  { id: "free", name: "Grátis", amount: 0, credits: 3, period: "", billing: "Gratuito", allowance: "3 verificações por dia", terms: "Renovam à meia-noite de Angola. Não acumulam.", button: "Experimentar grátis" },
  { id: "single", name: "Pacote avulso", amount: 150000, credits: 10, period: "por pacote", billing: "Compra única", allowance: "10 verificações pré-pagas", terms: "Compra única, sem mensalidade.", button: "Comprar pacote" },
  { id: "essential", name: "Essencial", amount: 200000, credits: 30, period: "por mês", billing: "Mensalidade", allowance: "30 verificações por mês", terms: "Pagamento mensal.", button: "Escolher Essencial" },
  { id: "business", name: "Negócio", amount: 500000, credits: 80, period: "por mês", billing: "Mensalidade", allowance: "80 verificações por mês", terms: "Pagamento mensal.", button: "Escolher Negócio" },
] as const;
export const PACKAGE_STORAGE_KEY = "tcheka-packages-v1";
export type PackageStep = "review" | "payment" | "done";
export interface Grant { id: string; packageId: PackageId }
export interface PackageState {
  version: 1;
  grants: Grant[];
  used: string[];
  freeUsage: { id: string; day: string }[];
  checkout: (Grant & { step: PackageStep }) | null;
}
export const emptyPackages = (): PackageState => ({ version: 1, grants: [], used: [], freeUsage: [], checkout: null });
export const getPackage = (id: PackageId) => PACKAGES.find((plan) => plan.id === id)!;
export const freeActivated = (state: PackageState) => state.grants.some((grant) => grant.packageId === "free");
const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Luanda", year: "numeric", month: "2-digit", day: "2-digit" });
export const dayInLuanda = (now = new Date()) => dayFormat.format(now);
const paidCredits = (state: PackageState) => state.grants.reduce((total, grant) => total + (grant.packageId === "free" ? 0 : getPackage(grant.packageId).credits), 0);
export const freeBalance = (state: PackageState, now = new Date()) => freeActivated(state)
  ? Math.max(0, 3 - state.freeUsage.filter((usage) => usage.day === dayInLuanda(now)).length) : 0;
export const demoBalance = (state: PackageState, now = new Date()) => paidCredits(state) - (state.used.length - state.freeUsage.length) + freeBalance(state, now);
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function validGrant(value: unknown): value is Grant {
  return isObject(value) && PACKAGES.some((plan) => plan.id === value.packageId) &&
    typeof value.id === "string" && (value.packageId === "free" ? value.id === "free-trial" : /^checkout-[a-z0-9-]+$/.test(value.id));
}

/** Persist choices, not money. Reconstruct the balance from unique completed choices. */
export function sanitizePackages(value: unknown, now = new Date()): PackageState {
  const state = emptyPackages();
  if (!isObject(value) || value.version !== 1 || !Array.isArray(value.grants)) return state;
  for (const grant of value.grants) {
    if (validGrant(grant) && !state.grants.some((item) => item.id === grant.id)) {
      state.grants.push({ id: grant.id, packageId: grant.packageId });
    }
  }
  if (Array.isArray(value.used)) {
    state.used = [...new Set(value.used.filter((id): id is string => typeof id === "string" && /^usage-[a-z0-9-]+$/.test(id)))];
  }
  if (freeActivated(state)) {
    if (!Array.isArray(value.freeUsage)) {
      // Preserve the old allowance's consumption on the migration day.
      state.freeUsage = state.used.slice(0, 3).map((id) => ({ id, day: dayInLuanda(now) }));
    } else {
      for (const usage of value.freeUsage) {
        if (isObject(usage) && typeof usage.id === "string" && state.used.includes(usage.id) &&
          typeof usage.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(usage.day) &&
          !state.freeUsage.some((item) => item.id === usage.id) &&
          state.freeUsage.filter((item) => item.day === usage.day).length < 3) {
          state.freeUsage.push({ id: usage.id, day: usage.day });
        }
      }
    }
  }
  let remainingPaid = paidCredits(state);
  state.used = state.used.filter((id) => state.freeUsage.some((usage) => usage.id === id) || remainingPaid-- > 0);
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

export function updatePackages(state: PackageState, action: PackageAction, now = new Date()): PackageState {
  const checkout = state.checkout;
  if (action.type === "consume") {
    if (state.used.includes(action.id)) return state;
    if (demoBalance(state, now) <= 0) throw new NoCreditsError();
    const next = { ...state, used: [...state.used, action.id],
      freeUsage: freeBalance(state, now) > 0 ? [...state.freeUsage, { id: action.id, day: dayInLuanda(now) }] : state.freeUsage };
    return demoBalance(next, now) === 0 ? { ...next, checkout: null } : next;
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

export function readPackages(storage: Pick<Storage, "getItem">, now = new Date()): PackageState {
  const saved = storage.getItem(PACKAGE_STORAGE_KEY);
  if (!saved) return emptyPackages();
  try { return sanitizePackages(JSON.parse(saved), now); } catch { return emptyPackages(); }
}

/** Grant the first-visit allowance once, without opening or replacing a checkout. */
export function initializePackages(storage: Pick<Storage, "getItem" | "setItem">, now = new Date()): PackageState {
  const state = readPackages(storage, now);
  const next: PackageState = freeActivated(state) ? state : {
    ...state,
    grants: [...state.grants, { id: "free-trial", packageId: "free" }],
  };
  const serialized = JSON.stringify(next);
  if (storage.getItem(PACKAGE_STORAGE_KEY) !== serialized) storage.setItem(PACKAGE_STORAGE_KEY, serialized);
  return next;
}

/** Read the latest state and persist before reporting success. Storage failures are surfaced to the UI. */
export function savePackageAction(storage: Pick<Storage, "getItem" | "setItem">, action: PackageAction, now = new Date()): PackageState {
  const next = updatePackages(readPackages(storage, now), action, now);
  storage.setItem(PACKAGE_STORAGE_KEY, JSON.stringify(next));
  return next;
}
