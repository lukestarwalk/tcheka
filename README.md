# Tcheka — Análise de comprovativos

Protótipo navegável de uma plataforma angolana de apoio à análise de comprovativos bancários. Projecto académico da cadeira de Empreendedorismo e Inovação do ISPTEC.

## Executar

Requer Node.js numa versão LTS compatível (24.15+ ou 22.22.2+) e npm.

```bash
npm install
npm run dev
```

Abra o endereço indicado pelo Vite, normalmente http://localhost:5173.

```bash
npm test
npm run build
```

React + TypeScript + Vite, CSS normal e lucide-react. Sem backend ou serviços pagos.

## Fluxo actual

**Seleccionar comprovativo → Analisar comprovativo → Consultar registo**

A página inicial aceita qualquer ficheiro, independentemente da extensão, tipo, tamanho ou conteúdo, um de cada vez. Permite seleccionar, arrastar, substituir e remover o ficheiro. «Tirar foto» solicita a câmara nos navegadores que suportam captura nativa; nos restantes abre o selector de imagens.

Os quatro cartões de exemplos foram removidos. Depois de seleccionar um ficheiro, «Analisar comprovativo» avança para **Comprovativo recebido**. Esta versão não lê o conteúdo, não extrai campos, não compara referências e não consulta bancos. A transição de três segundos apresenta três etapas animadas: receber ficheiro, organizar registo e preparar resultado. O resultado confirma a recepção do ficheiro, sem afirmar a sua autenticidade.

Os detalhes de banco indicado (Banco BFA), nome, formato e tamanho ficam recolhidos até clicar em «Ver detalhes do registo». O botão permite voltar a ocultá-los; ao mudar de página, os detalhes ficam novamente recolhidos. O ficheiro não é enviado para um servidor nem guardado; apenas os metadados e a hora ficam no histórico local. A aceitação do ficheiro não confirma autenticidade nem recebimento de dinheiro.

Não são necessários conta, credenciais ou ficheiros de exemplo. Para repetir a demonstração, use «Analisar outro comprovativo» e seleccione novamente o ficheiro. Repetir o nome não gera um alerta de duplicação.

## Pacotes

A aba «Pacotes» (`#/pacotes`) apresenta as seguintes opções:

| Opção | Preço | Verificações | Modalidade |
| --- | --- | --- | --- |
| Grátis | 0 Kz | 3 por dia | Renovação à meia-noite de Angola, sem acumulação |
| Pacote avulso | 1.500 Kz | 10 pré-pagas | Compra única |
| Essencial | 2.000 Kz/mês | 30 por mês | Mensalidade |

Percurso pago: escolher opção → «Resumo da escolha» → «Confirmar escolha» → «Simulação de pagamento» → «Concluir simulação» → «Demonstração concluída. Nenhum valor foi cobrado.» O resumo identifica quantidade, valor e compra única ou mensalidade. A transferência usa banco, beneficiário, referência e IBAN fictícios; não existe integração bancária nem cobrança real. O plano Grátis é activado automaticamente na primeira visita, com 3 verificações disponíveis, sem confirmação nem pagamento. A aba Pacotes mostra «Grátis activado».

Não existem contas ou saldo de verificações no modelo anterior. O percurso acrescenta **saldo de demonstração local**, guardado na chave `tcheka-packages-v1`, separado do histórico de documentos. Cada escolha concluída tem um identificador único; o saldo é reconstruído a partir de concessões sem duplicados. A oferta grátis usa um identificador fixo e regista a data de cada consumo no fuso Africa/Luanda. São 3 usos por dia, renovados à meia-noite de Angola e sem acumulação; os usos grátis são consumidos antes dos créditos pagos. Cliques repetidos e recarregamentos no mesmo dia não repõem o saldo. Uma nova compra deliberada atribui um novo pacote. O passo de resumo, pagamento ou conclusão também é recuperado após recarregar.

A regra grátis é aplicada diariamente **por navegador**, não por identidade real: limpar os dados ou usar outro navegador reinicia a demonstração. Limpar o histórico de documentos não limpa as escolhas dos pacotes. Se o armazenamento falhar, a interface mostra um erro e não confirma activação. Cada análise concluída desconta uma verificação do saldo de demonstração. O contador aparece na página de análise e no resultado. Ao chegar a zero, o percurso abre a lista de pacotes; o resultado da última análise continua no histórico. Sem saldo, não é possível concluir outra análise. Interromper o carregamento não consome créditos; voltar a abrir um resultado ou actualizar a página também não. Limpar o histórico não repõe verificações. Os consumos têm identificadores únicos e persistem na mesma chave dos pacotes. Na migração dos dados anteriores, até 3 consumos antigos são atribuídos ao saldo grátis do dia da migração; os restantes continuam a descontar dos créditos pagos. A migração é guardada para não se repetir no dia seguinte. A interface actualiza o saldo ao regressar à janela e a cada 30 segundos, incluindo durante a mudança de dia. Não existem renovação mensal automática nem créditos de produção. Para produção, faltam autenticação, saldo no servidor e confirmação de pagamento pelo prestador.

Para ensaiar outra vez, clique «Voltar aos pacotes» na conclusão e comece uma nova escolha. Não precisa de apagar o histórico. Para ensaiar de zero, use um novo perfil de navegador ou remova apenas `tcheka-packages-v1` nas ferramentas de desenvolvimento e actualize a página.

Gravação de 24 segundos: 0–4 s, abrir «Pacotes» e mostrar os preços propostos; 4–8 s, descer e clicar «Comprar pacote»; 8–13 s, mostrar 1.500 Kz, 10 verificações e compra única, depois «Confirmar escolha»; 13–19 s, mostrar «Simulação de pagamento», descer aos dados fictícios e clicar «Concluir simulação»; 19–24 s, manter a mensagem final visível. O vídeo não necessita de qualquer comprovativo nem pagamento bancário.

Verificação: `node --import tsx --test src/domain.test.ts src/packages.test.ts src/App.test.tsx` cobre os percursos, persistência, idempotência, cancelamento, armazenamento bloqueado e distinção de compra única/mensalidade.

«Banco BFA» é uma indicação configurada para o percurso da demonstração, não um banco identificado por leitura do ficheiro.

## Histórico e armazenamento

O botão de lua/sol no cabeçalho alterna entre tema claro e escuro. Sem preferência guardada, segue o sistema; a escolha fica na chave `tcheka-theme` e não é removida ao limpar o histórico. Se o armazenamento estiver bloqueado, a alternância funciona durante a sessão. A impressão mantém fundo claro. O tema aplica-se antes do arranque da interface para evitar um clarão no modo escuro.

O histórico inclui os registos dos ficheiros aceites, com pesquisa pelo nome e filtro «Não analisados». As horas são apresentadas no fuso Africa/Luanda. Os antigos registos fictícios continuam legíveis por compatibilidade; os seus exemplos já não podem ser seleccionados na interface.

Os metadados são persistidos na chave `tcheka-analysis-v2` do localStorage. O conteúdo dos ficheiros não é persistido. A leitura do armazenamento reconstrói os novos registos como não analisados, descartando resultados ou dados financeiros adicionados externamente. A migração remove exclusivamente a chave incompatível anterior `tcheka-demo-v1`. A limpeza do histórico exige confirmação.

## Limite essencial

**A análise do comprovativo não confirma que o dinheiro entrou na conta do beneficiário.**

Os dados e as entidades dos exemplos são inteiramente fictícios. Não existem integrações ou parcerias bancárias. A repetição de uma referência, por si só, não classifica um documento como fraudulento. Para esclarecer a operação, obtenha o documento original e consulte o banco.

## Verificação

As notas abaixo documentam verificações de versões anteriores; o fluxo actual é o de aceitação de ficheiros descrito acima.

Tema escuro: os 11 testes React passaram (incluindo alternância, recarregamento, independência do histórico, preferência do sistema e armazenamento bloqueado), assim como `npm run build`. A revisão visual em navegador permanece limitada pelo ambiente descrito abaixo.

`npm test` verifica os exemplos e resultados determinísticos, duplicação separada, campos não identificados, validação de ficheiros, histórico, pesquisa/filtros, armazenamento e migração selectiva. Os testes React usam jsdom. `npm run build` verifica os tipos TypeScript e gera a versão estática em `dist/`.

A interface usa a direcção **Solar Glass**: amarelo solar e laranja, navegação flutuante translúcida, tipografia maior e superfícies neutras para os documentos. Inclui adaptações para telemóvel, foco visível, movimento reduzido e fallback sem desfoque. A decisão visual e as referências OpenAI, Apple e BFA estão em [DESIGN.md](DESIGN.md). A paleta é uma proposta para o Tcheka, não uma reprodução da identidade oficial destas entidades.

Verificação desta renovação: `npm run build` passou; `node --import tsx --test src/domain.test.ts src/App.test.tsx` passou para os dois ficheiros de testes. Esta chamada directa foi usada porque o launcher de `npm test` tenta criar um socket IPC bloqueado neste ambiente. O arranque do navegador instalado também foi bloqueado pelo sistema; a revisão visual real em 360, 768 e 1440 px continua pendente.

## Política editorial (10/11/2026)

Por decisão posterior de Luke, a interface não mostra a label “Ambiente de demonstração”. Os resultados continuam simulados; a impressão identifica-os como “Resultado simulado”. Não existem exportações ou partilhas de resultados implementadas. A página “Sobre” contém orientação de utilização; o enquadramento académico e técnico permanece nesta documentação.

O aviso de que uma análise não confirma o recebimento aparece uma vez junto ao resultado. A selecção de ficheiros reais cria apenas registos não analisados, conforme o fluxo actual descrito acima. Os controlos de histórico, filtros e limpeza com confirmação permanecem disponíveis.

`src/presentation.ts` adapta exclusivamente textos apresentados. Os exemplos canónicos e a validação do armazenamento mantêm-se intactos para não apagar análises previamente guardadas. O link técnico para descarregar código foi retirado da interface.

Validação editorial: 17 testes de domínio e 9 testes React passaram com `node --import tsx --test --test-isolation=none src/domain.test.ts` e o comando equivalente para `src/App.test.tsx`. Incluem as quatro situações, erros de ficheiros, filtros, confirmação de limpeza e leitura do histórico anterior sem alterações. A revisão visual real em desktop/mobile e a impressão permanecem pendentes: o navegador falhou no arranque com `setsockopt: Operation not permitted`. Os breakpoints e as regras de impressão foram revistos no código; isso não substitui a verificação visual.

## Skills de design

As cópias completas de **UI/UX Pro Max** e **Frontend Design (Anthropic)** estão em `skills/`, com licenças e proveniência. Foram consultadas nesta renovação. A instalação para descoberta automática não pôde ser concluída porque as pastas de skills do ambiente estão protegidas. Ver [skills/README.md](skills/README.md) para concluir a activação num terminal local com permissão.
