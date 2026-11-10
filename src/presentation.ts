import type { DemoExample } from "./domain";

// Editorial aliases only. Keep canonical examples unchanged: storage validates
// their exact contents, including legacy copy, before accepting saved records.
const labels: Record<string, string> = {
  "Dados legíveis e coerentes neste documento inteiramente fictício.": "Dados legíveis e coerentes.",
  "Um exemplo de diferenças visuais que exigem verificação adicional.": "Diferenças visuais que precisam de revisão.",
  "A imagem fictícia não tem legibilidade suficiente para identificar os dados.": "Imagem sem nitidez suficiente para ler os dados.",
  "Dados coerentes, com um alerta separado de possível duplicação.": "Referência já presente no histórico.",
  "Banco Exemplo — fictício": "Banco Exemplo",
  "Serviço Exemplo — fictício": "Serviço Exemplo",
  "Beneficiário de demonstração": "Beneficiário Exemplo",
  "A zona do montante apresenta um tipo de letra e um alinhamento diferentes do restante texto neste exemplo simulado.": "O tipo de letra e o alinhamento do valor diferem do restante texto.",
  "O fundo junto à referência apresenta uma descontinuidade visual simulada. Obtenha o documento original para esclarecer estes elementos.": "O fundo junto à referência apresenta uma descontinuidade. Peça o documento original para esclarecer.",
  "A resolução e o desfoque simulados impedem a leitura dos campos do documento.": "A baixa resolução e o desfoque impedem a leitura dos campos.",
};

export function receiptPresentation<T extends DemoExample>(record: T): T {
  return {
    ...record,
    fileName: record.fileName.replace(/^demonstracao-/, ""),
    description: labels[record.description] ?? record.description,
    issuer: record.issuer ? labels[record.issuer] ?? record.issuer : null,
    beneficiary: record.beneficiary ? labels[record.beneficiary] ?? record.beneficiary : null,
    reasons: record.reasons.map((reason) => labels[reason] ?? reason),
  };
}
