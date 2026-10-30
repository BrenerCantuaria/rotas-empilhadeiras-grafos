# CLAUDE.md

Projeto de extensão: **rota operacional e ordem de prioridade de empilhadeiras com base em grafos dinâmicos**. Autor: Márcio Brener Cantuária Santos (Marcio), engenheiro mecânico, inglês básico: **comentários, explicações e respostas em português**. Ao guiar o Marcio por várias telas/ferramentas, passe **uma etapa por vez** e espere a confirmação.

O contexto completo (problema, decisões, suposições, resultados, próximos passos) está em [contexto_projeto.md](contexto_projeto.md). Leia-o antes de mudar o algoritmo; este arquivo só resume a estrutura do código.

## Ideia central

- **O núcleo é o algoritmo**; o site 3D e o dashboard são vitrines.
- Tarefa de armazenagem = palete que sai do recebimento (`REC`) para o **endereço fixo** do material. O algoritmo não escolhe endereço, só a **ordem** e a **rota**.
- Cada rua é um **beco sem saída** (acesso só pela frente) e pertence a uma categoria/depósito. Curva ABC define o nível (A=1, B=2, C=3); nível maior = elevação maior = rua bloqueada por mais tempo.
- Só a empilhadeira **parada operando** bloqueia um nó; quem está em movimento passa.
- Prioridade: `P(i) = w1*G(i) + w2*Pos(i) - w3*penalidade_de_espera`, mais a regra de **precedência por profundidade** (em cada rua só a tarefa mais funda está elegível; desligável com `params.precedencia = false`).
- Duas políticas comparadas: `'chegada'` (FIFO, linha de base) e `'algoritmo'`.

## Estrutura

Sem build, sem dependências, JavaScript puro. Todos os módulos são IIFEs "universais": exportam via `module.exports` no Node ou em `globalThis.Rotas` no navegador. **Mantenha esse padrão** em arquivos novos.

- `dados/layout.js`: `LAYOUT`, todos os parâmetros físicos (velocidade 2 m/s, tempos, ruas R1–R4, posições por rua, `nivelPorCurva`). Mudar aqui muda grafo, simulação e 3D.
- `dados/materiais.js`: `criarAleatorio(semente)` (PRNG com semente), `criarCatalogo` (6 materiais por rua, endereço fixo), `gerarTarefas` (cenário reprodutível; `pesosRua` concentra tarefas em poucas ruas).
- `algoritmo/grafo.js`: `construirGrafo(layout)` (nós `REC`, `T1_*`, `R#_p`) e `menorCaminho` (Dijkstra com `custoNo` = peso dinâmico de ocupação). A travessa de fundo T2 **não** está no grafo.
- `algoritmo/prioridade.js`: `PARAMS_PADRAO`, `pontuar`, `elegiveis`, `escolherTarefa`, `ordemSugerida`, `esperaPrevista`, tempos de operação.
- `simulacao/simulador.js`: classe `Simulador({layout, tarefas, politica, params, nOperadores})` por passos de tempo; `executar()` devolve `metricas()` (tempoTotal, esperaBloqueio, distancia, bloqueios, cicloMedio, cicloMedioCurvaA, concluidas). Copia as tarefas, então o mesmo cenário roda nas duas políticas.
- `site3d/` (`index.html` + `app.js`): cena Three.js r128 via CDN, sliders de w1/w2/w3, ordem sugerida numerada, botão "Comparar políticas".
- `dashboard/` (`index.html` + `dashboard.js`): painel para o coordenador de operações, **linguagem sem termos técnicos**; compara operação atual × com priorização, um dia × média de 30 dias; frases de "Leitura rápida" geradas dos números (inclusive quando piora).
- `algoritmo/testes.js` / `testes.html`: 7 testes (rota, endereço fixo, precedência, cenário mínimo) com `assert` no Node e shim no navegador.

## Comandos

Node não está instalado direto; use Docker (imagem `node`):

```
docker run --rm -v "C:\Users\Brene\Documents\rotas_empilhadeiras_grafos:/app:ro" -w /app node:latest node algoritmo/testes.js
```

Também dá para abrir `algoritmo/testes.html`, `site3d/index.html` ou `dashboard/index.html` direto no navegador (via `file://`, por isso os scripts são clássicos, não ES modules). O 3D precisa de internet para o CDN do Three.js.

## Cuidados

- Ordem dos `<script>` nos HTMLs importa: layout → materiais → grafo → prioridade → simulador → app.
- Mantenha o determinismo: use sempre `criarAleatorio` com semente, nunca `Math.random`, nas simulações.
- Suposições ainda a confirmar com o Marcio estão em contexto_projeto.md ("Suposições adotadas"); não as trate como definitivas.
- Resultado atual: a precedência "fundo primeiro" sozinha **não** reduz a espera (a empilhadeira do fundo fica presa na saída); o ganho vem do giro. Próximo passo planejado: prever conflito de **saída** no algoritmo. Reporte resultados da simulação com honestidade, mesmo quando o algoritmo piora.
- Não há git neste diretório.
