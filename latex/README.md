# Artigo (LaTeX)

Artigo do projeto no modelo abnTeX2 (ABNT NBR 6022:2003). Arquivo principal: `main.tex`.

## Compilar

Precisa de uma distribuição LaTeX com a classe `abntex2` (MiKTeX ou TeX Live).

```
cd latex
pdflatex main.tex
bibtex main
pdflatex main.tex
pdflatex main.tex
```

A sequência com `bibtex` é necessária para gerar as referências. Ou use o Overleaf: envie a pasta `latex/` e escolha `main.tex` como arquivo principal (ele roda o bibtex sozinho).

## Referências

`referencias.bib` tem 12 fontes (2 brasileiras: Silva e Scarpin, 2017; Bonassa e Cunha, 2011), conferidas na web (DOI, páginas das revistas ou índices) entre 29 e 30/10/2026. Coisas a conferir antes da entrega:

- `bonassa2011` está sem o intervalo de páginas (o SciELO não respondeu na conferência); complete pelo site da revista.

- Leia pelo menos o resumo de cada artigo: a seção "Fundamentação teórica" descreve cada fonte em uma ou duas frases, e vocês assumem o que está escrito.
- `parikh2009`, `ramalingam1996`, `qiu2002` e `egbelu1984` estão sem DOI, porque a busca não o retornou; confira no site do periódico e adicione o campo `url`, se quiserem.

## Estado

- Os números da Seção "Resultados preliminares" vêm de `../contexto_projeto.md` (média de 30 cenários). Reexecute a simulação antes de usá-los na versão final.
