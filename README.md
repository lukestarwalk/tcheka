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

## Fluxo

**Carregar comprovativo → Analisar → Consultar resultado**

A página inicial permite seleccionar ou arrastar um PDF, JPG ou PNG até 10 MB. Mostra nome, formato e tamanho; permite substituir ou remover a selecção. O formato, a compatibilidade entre extensão e tipo e o tamanho são validados.

Esta versão não analisa automaticamente ficheiros reais. A selecção de um ficheiro apresenta o aviso de indisponibilidade, sem extrair dados, atribuir resultado ou criar uma análise no histórico. O conteúdo não é lido, enviado nem guardado.

Para experimentar o fluxo, escolha um dos quatro exemplos fictícios e prima «Analisar comprovativo»:

1. Documento sem inconsistências detectadas: dados legíveis e coerentes, resultado sem divergências.
2. Documento com indícios de alteração: diferenças de tipografia, alinhamento e fundo previamente definidas.
3. Imagem ilegível: análise inconclusiva e campos «Não identificado».
4. Referência anteriormente analisada: resultado documental separado do alerta de possível duplicação, com acesso ao registo anterior. Se o histórico estiver vazio, o cenário inclui um registo de referência explicitamente fictício.

O processamento e os resultados são simulados e determinísticos. Não são executados OCR, verificação criptográfica ou consulta bancária.

## Histórico e armazenamento

O histórico contém apenas resultados dos exemplos, com ficheiro, data e hora da análise, banco/serviço fictício, valor e resultado documental. Permite pesquisa, filtro por resultado e consulta dos detalhes. As horas são apresentadas no fuso Africa/Luanda.

Apenas resultados fictícios conhecidos são persistidos na chave `tcheka-analysis-v2` do localStorage. A migração remove exclusivamente a chave incompatível anterior `tcheka-demo-v1`; outras chaves do navegador são preservadas. A reposição da demonstração exige confirmação e limpa o histórico.

## Limite essencial

**A análise do comprovativo não confirma que o dinheiro entrou na conta do beneficiário.**

Os dados e as entidades dos exemplos são inteiramente fictícios. Não existem integrações ou parcerias bancárias. A repetição de uma referência, por si só, não classifica um documento como fraudulento. Para esclarecer a operação, obtenha o documento original e consulte o banco.

## Verificação

`npm test` verifica os exemplos e resultados determinísticos, duplicação separada, campos não identificados, validação de ficheiros, histórico, pesquisa/filtros, armazenamento e migração selectiva. Os testes React usam jsdom. `npm run build` verifica os tipos TypeScript e gera a versão estática em `dist/`.

A interface usa a direcção **Solar Glass**: amarelo solar e laranja, navegação flutuante translúcida, tipografia maior e superfícies neutras para os documentos. Inclui adaptações para telemóvel, foco visível, movimento reduzido e fallback sem desfoque. A decisão visual e as referências OpenAI, Apple e BFA estão em [DESIGN.md](DESIGN.md). A paleta é uma proposta para o Tcheka, não uma reprodução da identidade oficial destas entidades.

Verificação desta renovação: `npm run build` passou; `node --import tsx --test src/domain.test.ts src/App.test.tsx` passou para os dois ficheiros de testes. Esta chamada directa foi usada porque o launcher de `npm test` tenta criar um socket IPC bloqueado neste ambiente. O arranque do navegador instalado também foi bloqueado pelo sistema; a revisão visual real em 360, 768 e 1440 px continua pendente.

## Política editorial (10/11/2026)

Por decisão posterior de Luke, a interface não mostra a label “Ambiente de demonstração”. Os resultados continuam simulados; a impressão identifica-os como “Resultado simulado”. Não existem exportações ou partilhas de resultados implementadas. A página “Sobre” contém orientação de utilização; o enquadramento académico e técnico permanece nesta documentação.

O aviso de que uma análise não confirma o recebimento aparece uma vez junto ao resultado. A selecção de ficheiros reais continua sem produzir análises, com a restrição apresentada no local. Os controlos de histórico, filtros, exemplos e limpeza com confirmação mantêm o comportamento anterior.

`src/presentation.ts` adapta exclusivamente textos apresentados. Os exemplos canónicos e a validação do armazenamento mantêm-se intactos para não apagar análises previamente guardadas. O link técnico para descarregar código foi retirado da interface.

Validação editorial: 17 testes de domínio e 9 testes React passaram com `node --import tsx --test --test-isolation=none src/domain.test.ts` e o comando equivalente para `src/App.test.tsx`. Incluem as quatro situações, erros de ficheiros, filtros, confirmação de limpeza e leitura do histórico anterior sem alterações. A revisão visual real em desktop/mobile e a impressão permanecem pendentes: o navegador falhou no arranque com `setsockopt: Operation not permitted`. Os breakpoints e as regras de impressão foram revistos no código; isso não substitui a verificação visual.

## Skills de design

As cópias completas de **UI/UX Pro Max** e **Frontend Design (Anthropic)** estão em `skills/`, com licenças e proveniência. Foram consultadas nesta renovação. A instalação para descoberta automática não pôde ser concluída porque as pastas de skills do ambiente estão protegidas. Ver [skills/README.md](skills/README.md) para concluir a activação num terminal local com permissão.
