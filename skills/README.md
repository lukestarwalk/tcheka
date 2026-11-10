# Skills de design

Cópias locais completas, obtidas das fontes originais pelo conector GitHub em 9/11/2026, após o instalador normal falhar por DNS indisponível no terminal:

- [Frontend Design — Anthropic](https://github.com/anthropics/skills/tree/main/skills/frontend-design)
- [UI/UX Pro Max — NextLevelBuilder](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/main/.claude/skills/ui-ux-pro-max)

Os caminhos, URLs e hashes Git de origem estão em `sources.json`. As licenças acompanham cada skill. Nenhum pacote npm externo foi executado para obter estas skills.

As skills foram lidas e aplicadas nesta tarefa. Esta pasta não é um local de descoberta automática do Codex. As pastas `.agents`, `.codex` e a instalação global não permitem escrita nesta sessão; por isso a activação automática não foi concluída.

Num terminal local com permissão de escrita, a instalação para o projecto pode ser concluída com:

```bash
mkdir -p .agents/skills
cp -R -n skills/frontend-design skills/ui-ux-pro-max .agents/skills/
```

Após instalação num caminho reconhecido, as skills ficam disponíveis no próximo turno. A pesquisa local já funciona sem dependências adicionais:

```bash
python3 skills/ui-ux-pro-max/scripts/search.py 'glassmorphism' --domain style
```
