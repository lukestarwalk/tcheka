import { test } from "node:test";
import assert from "node:assert/strict";
import { PACKAGE_STORAGE_KEY, NoCreditsError, demoBalance, emptyPackages, readPackages, sanitizePackages, savePackageAction, updatePackages } from "./packages";

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

test("a paid choice grants credits once, only after the payment step, across reloads and repeated clicks", () => {
  const storage = memoryStorage();
  savePackageAction(storage, { type: "select", packageId: "single", id: "checkout-first" });
  assert.equal(readPackages(storage).checkout?.step, "review");
  assert.equal(demoBalance(savePackageAction(storage, { type: "confirm" })), 0);
  savePackageAction(storage, { type: "payment" });
  assert.equal(readPackages(storage).checkout?.step, "payment");
  assert.equal(demoBalance(savePackageAction(storage, { type: "confirm" })), 10);
  assert.equal(demoBalance(savePackageAction(storage, { type: "confirm" })), 10);
  assert.equal(readPackages(storage).checkout?.step, "done");
  savePackageAction(storage, { type: "list" });
  const replay = savePackageAction(storage, { type: "select", packageId: "single", id: "checkout-first" });
  assert.equal(demoBalance(replay), 10);
  assert.equal(replay.checkout?.step, "done");
  savePackageAction(storage, { type: "select", packageId: "single", id: "checkout-second" });
  savePackageAction(storage, { type: "payment" });
  assert.equal(demoBalance(savePackageAction(storage, { type: "confirm" })), 20, "an explicitly new choice can grant a new package");
});

test("free activation skips payment and is unique even after another package or a reload", () => {
  const storage = memoryStorage();
  const first = savePackageAction(storage, { type: "select", packageId: "free", id: "ignored" });
  assert.equal(first.checkout?.step, "done");
  assert.equal(demoBalance(first), 3);
  assert.equal(demoBalance(savePackageAction(storage, { type: "select", packageId: "free", id: "another-id" })), 3);
  savePackageAction(storage, { type: "select", packageId: "essential", id: "checkout-monthly" });
  savePackageAction(storage, { type: "payment" });
  savePackageAction(storage, { type: "confirm" });
  assert.equal(demoBalance(savePackageAction(storage, { type: "select", packageId: "free", id: "replay" })), 33);
});

test("cancelling and editing a choice never grants credits", () => {
  const storage = memoryStorage();
  savePackageAction(storage, { type: "select", packageId: "business", id: "checkout-cancel" });
  savePackageAction(storage, { type: "payment" });
  assert.equal(savePackageAction(storage, { type: "review" }).checkout?.step, "review");
  savePackageAction(storage, { type: "list" });
  assert.equal(demoBalance(savePackageAction(storage, { type: "confirm" })), 0);
  assert.equal(readPackages(storage).checkout, null);
});

test("stored amounts cannot inflate the balance and duplicate grants collapse", () => {
  const grant = { id: "checkout-known", packageId: "single", credits: 99999 };
  const state = sanitizePackages({ version: 1, balance: 99999, grants: [grant, grant, { id: "free-trial", packageId: "free" }, { id: "free-trial", packageId: "free" }, { id: "checkout-unknown", packageId: "fake" }], checkout: { ...grant, step: "payment" } });
  assert.equal(demoBalance(state), 13);
  assert.equal(state.checkout?.step, "done");
  assert.equal(state.grants.length, 2);
  assert.deepEqual(sanitizePackages({ version: 1, grants: [], checkout: { id: "checkout-fake", packageId: "single", step: "done" } }), emptyPackages());
});

test("storage failure does not record a successful activation", () => {
  const storage = memoryStorage();
  const failing = { ...storage, setItem: () => { throw new Error("Blocked"); } };
  assert.throws(() => savePackageAction(failing, { type: "select", packageId: "free", id: "ignored" }), /Blocked/);
  assert.equal(storage.getItem(PACKAGE_STORAGE_KEY), null);
  assert.equal(demoBalance(readPackages(storage)), 0);
  assert.equal(updatePackages(emptyPackages(), { type: "confirm" }).checkout, null);
});

test("three free analyses consume 3 → 2 → 1 → 0 without allowing duplicate charges or a fourth analysis", () => {
  const storage = memoryStorage();
  savePackageAction(storage, { type: "select", packageId: "free", id: "ignored" });
  for (let n = 1; n <= 3; n++) {
    savePackageAction(storage, { type: "consume", id: `usage-${n}` });
    assert.equal(demoBalance(readPackages(storage)), 3 - n);
    assert.equal(demoBalance(savePackageAction(storage, { type: "consume", id: `usage-${n}` })), 3 - n);
  }
  assert.equal(readPackages(storage).checkout, null, "exhaustion opens the package list, not the previous activation receipt");
  assert.throws(() => savePackageAction(storage, { type: "consume", id: "usage-fourth" }), NoCreditsError);
  assert.equal(demoBalance(savePackageAction(storage, { type: "select", packageId: "free", id: "retry" })), 0, "reselecting free cannot refill the quota");
  savePackageAction(storage, { type: "select", packageId: "single", id: "checkout-refill" });
  savePackageAction(storage, { type: "payment" });
  assert.equal(demoBalance(savePackageAction(storage, { type: "confirm" })), 10);
  assert.equal(demoBalance(savePackageAction(storage, { type: "consume", id: "usage-after-refill" })), 9);
});

test("old saved choices keep their credits and stored usages cannot duplicate deductions", () => {
  const state = { version: 1, grants: [{ id: "free-trial", packageId: "free" }], checkout: null };
  assert.equal(demoBalance(sanitizePackages(state)), 3);
  assert.equal(demoBalance(sanitizePackages({ ...state, used: ["usage-one", "usage-one", "invalid"] })), 2);
  assert.equal(demoBalance(sanitizePackages({ ...state, used: ["usage-1", "usage-2", "usage-3", "usage-4"] })), 0);
});
