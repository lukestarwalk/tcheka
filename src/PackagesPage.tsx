import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, CreditCard, Info, Landmark, Package } from "lucide-react";
import { formatMoney } from "./domain";
import { PACKAGES, PACKAGE_STORAGE_KEY, demoBalance, emptyPackages, freeActivated, getPackage, readPackages, savePackageAction } from "./packages";
import type { PackageAction, PackageId } from "./packages";

export default function PackagesPage() {
  const [state, setState] = useState(() => {
    try { return readPackages(localStorage); } catch { return emptyPackages(); }
  });
  const [error, setError] = useState("");
  const [completionReady, setCompletionReady] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const checkout = state.checkout;
  const plan = checkout ? getPackage(checkout.packageId) : null;
  const step = checkout?.step ?? "list";
  const balance = demoBalance(state);
  const isFree = plan?.id === "free";
  const title = step === "list" ? "Pacotes" : step === "review" ? "Resumo da escolha" : step === "payment" ? "Simulação de pagamento" : isFree ? "Teste grátis activado" : "Escolha concluída";

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [step, checkout?.id]);
  useEffect(() => {
    setCompletionReady(false);
    if (step !== "done") return;
    // Let the completion layout settle before accepting another tap in the same place.
    const timer = setTimeout(() => setCompletionReady(true), 450);
    return () => clearTimeout(timer);
  }, [step, checkout?.id]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === PACKAGE_STORAGE_KEY || event.key === null) {
        try { setState(readPackages(localStorage)); } catch { /* Keep the current view. */ }
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function act(action: PackageAction) {
    try {
      const next = savePackageAction(localStorage, action);
      setState(next);
      setError("");
    } catch {
      setError("Não foi possível guardar a escolha. Permita o armazenamento neste navegador e tente novamente. Não foram activados créditos.");
    }
  }
  function select(packageId: PackageId) {
    const id = `checkout-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    act({ type: "select", packageId, id });
  }

  return (
    <div className="packages-page">
      {step !== "list" && step !== "done" && <button className="back-link" onClick={() => act({ type: step === "payment" ? "review" : "list" })}><ArrowLeft size={16} />{step === "payment" ? "Voltar ao resumo" : "Voltar aos pacotes"}</button>}
      <div className="page-heading">
        <div>
          <h1 ref={heading} tabIndex={-1}>{title}</h1>
          {step === "list" && <p className="muted">Compare o preço e as verificações incluídas em cada opção.</p>}
          {step === "review" && <p className="muted">Confira a opção e a modalidade de cobrança antes de continuar.</p>}
          {step === "payment" && <p className="muted">Transferência bancária simulada · dados fictícios</p>}
        </div>
      </div>
      {error && <div className="form-error" role="alert"><Info size={18} />{error}</div>}

      {step === "list" ? (
        <>
          <div className="packages-context"><span className="package-billing"><Info size={16} />Preços propostos para teste</span><span className="demo-balance">Saldo de demonstração: <strong>{balance} verificações restantes</strong></span></div>
          {balance === 0 && state.grants.length > 0 && (
            <div className="notice notice-warm credits-exhausted" role="status"><Info size={20} /><div><strong>{state.grants.every((grant) => grant.packageId === "free") ? "As suas 3 verificações grátis terminaram." : "As suas verificações terminaram."}</strong><p>Escolha um pacote para continuar. Os resultados anteriores estão disponíveis no histórico.</p><a className="inline-link" href="#/historico">Consultar histórico</a></div></div>
          )}
          <div className="packages-grid">
            {PACKAGES.map((item) => (
              <article className="panel package-card" key={item.id}>
                <span className="package-billing"><Package size={16} aria-hidden="true" />{item.billing}</span>
                <h2>{item.name}</h2>
                <div className="package-price"><strong>{formatMoney(item.amount)}</strong><span>{item.period}</span></div>
                <p className="package-allowance">{item.allowance}</p>
                <p className="package-terms">{item.terms}</p>
                <button className={item.id === "single" ? "primary" : "secondary"} onClick={() => select(item.id)} disabled={item.id === "free" && freeActivated(state)}>{item.id === "free" && freeActivated(state) ? "Grátis activado" : item.button}<ArrowRight size={16} /></button>
                {item.id === "free" && freeActivated(state) && <small className="package-used">Activado automaticamente na primeira visita.</small>}
              </article>
            ))}
          </div>
          <p className="packages-note">O comerciante paga pela utilização do Tcheka. Estes preços e quantidades são hipóteses a testar com comerciantes.</p>
          <p className="packages-local">Nesta demonstração, os créditos e a activação grátis ficam guardados apenas neste navegador. Ainda não existem contas de utilizador.</p>
        </>
      ) : plan && (
        <div className="checkout-content">
          {step === "done" ? (
            <section className="panel checkout-success" aria-labelledby="completion-message">
              <span className="checkout-success-icon"><CheckCircle2 size={34} /></span>
              <h2 id="completion-message">{isFree ? "As 3 verificações de teste foram activadas." : "Demonstração concluída. Nenhum valor foi cobrado."}</h2>
              <p>{plan.name} · {plan.allowance}</p>
              <p>{isFree ? "Sem pagamento. A oferta grátis só é atribuída uma vez neste navegador." : `${plan.credits} verificações atribuídas ao saldo de demonstração. Não foi criada uma compra ou subscrição real.`}</p>
              <div className="checkout-balance">Saldo de demonstração<strong>{balance} verificações</strong></div>
              <div className="checkout-actions"><button className="primary" disabled={!completionReady} onClick={() => { window.location.hash = "/analisar"; }}>Analisar comprovativo<ArrowRight size={17} /></button><button className="secondary" disabled={!completionReady} onClick={() => act({ type: "list" })}>Voltar aos pacotes</button></div>
            </section>
          ) : (
            <>
              <section className="panel checkout-summary" aria-label="Resumo do pacote">
                <div className="checkout-plan"><span className="package-billing">{plan.billing}</span><h2>{plan.name}</h2></div>
                <dl className="checkout-facts">
                  <div><dt>Valor</dt><dd>{formatMoney(plan.amount)} <span>{plan.period}</span></dd></div>
                  <div><dt>Verificações incluídas</dt><dd>{plan.allowance}</dd></div>
                  <div><dt>Modalidade de cobrança</dt><dd>{plan.id === "single" ? "Compra única, sem mensalidade" : `Mensalidade de ${formatMoney(plan.amount)}`}</dd></div>
                </dl>
                <p className="checkout-price-note">Preços propostos para teste</p>
              </section>
              {step === "review" ? (
                <>
                  <div className="checkout-method"><Landmark size={22} /><div><strong>Transferência bancária simulada</strong><p>O próximo passo mostra como pagaria pelo serviço. Não será efectuado qualquer débito.</p></div></div>
                  <button className="primary checkout-confirm" onClick={() => act({ type: "payment" })}>Confirmar escolha<ArrowRight size={17} /></button>
                </>
              ) : (
                <>
                  <section className="panel checkout-bank" aria-labelledby="transfer-title">
                    <h2 id="transfer-title"><Landmark size={20} />Dados fictícios da transferência</h2>
                    <dl className="checkout-facts">
                      <div><dt>Banco</dt><dd>Banco Exemplo (fictício)</dd></div>
                      <div><dt>Beneficiário</dt><dd>Tcheka Demonstração</dd></div>
                      <div><dt>IBAN fictício</dt><dd className="demo-iban">AO00 0000 0000 0000 0000 0000 0</dd></div>
                      <div><dt>Referência</dt><dd>DEMO-TCHEKA-001</dd></div>
                    </dl>
                    <p>Num pagamento real, abriria a aplicação do banco, escolheria transferência e indicaria o beneficiário, o IBAN e o valor do resumo.</p>
                    <p className="checkout-price-note">Estes dados não servem para efectuar uma transferência. Para a prova, conclua apenas a simulação abaixo.</p>
                  </section>
                  <button className="primary checkout-confirm" onClick={() => act({ type: "confirm" })}><CreditCard size={17} />Concluir simulação</button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
