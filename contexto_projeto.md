# Rota Operacional de Empilhador com base em grafos

Projeto de extensão. Este arquivo guarda o contexto da conversa que originou o projeto, para que qualquer sessão iniciada nesta pasta saiba onde paramos.

## Autor

Márcio Brener Cantuária Santos (Marcio). Engenheiro Mecânico com experiência em indústria e melhoria contínua. Nível de inglês básico: comentários e explicações em português.

## Preferência de trabalho

Quando a orientação envolver abrir abas, telas ou ferramentas diferentes, passar **uma etapa de cada vez** e esperar a confirmação do Marcio antes da próxima. Sem sequências longas de passos.

## Problema

Em um centro logístico, depois que o palete é montado, o operador de empilhadeira o busca e o armazena na posição do estoque. Não existe priorização das tarefas de armazenagem. Ao armazenar, a empilhadeira precisa se posicionar, elevar o palete, guardar e liberar a rua, e durante esse tempo a rua fica **bloqueada** para os demais. Isso ocorre muitas vezes ao dia. Com vários operadores (por exemplo, 5) a mesma situação gera esperas e **congestionamento** na mesma rua, mesmo para materiais de baixo giro.

## Solução proposta

Um algoritmo baseado em **grafos dinâmicos** que, quando mais de um operador recebe tarefas de armazenagem na mesma rua, devolve:

1. A **ordem de prioridade** das tarefas (qual material é armazenado primeiro).
2. A **rota** de cada operador, com pesos que mudam conforme a ocupação da rua.
3. Opcionalmente, uma **alternativa** para quem não tem prioridade (esperar ou usar outra rua/posição equivalente).

O grafo é recalculado a cada evento (empilhadeira entra ou sai da rua, nova tarefa criada).

## Decisões já tomadas

- **O núcleo do projeto é o algoritmo.** O site 3D é apenas a vitrine para mostrar o algoritmo rodando.
- **Grafo dinâmico**, não estático.
- **Foco principal: rota e ordem de prioridade**, não a escolha de endereço. A classificação por giro entra como entrada do modelo.
- **Layout genérico** de docas, pátio, ruas e posições de depósito, tanto no algoritmo quanto no site 3D.
- **Site 3D** que executa o algoritmo de forma dinâmica e mostra visualmente a ordem de armazenagem sugerida.
- **Validação por simulação** no site: rodar o mesmo cenário com ordem de chegada e com o algoritmo proposto, comparando tempo de espera, distância percorrida e número de bloqueios.
- **Limitação a declarar no projeto:** o layout genérico prova que o método é coerente, mas não mede ganho real de um centro logístico específico. A aplicação com dados reais fica como trabalho futuro.

## Modelo do grafo

- **Nós:** cruzamentos, posições de armazenagem, docas.
- **Arestas:** trechos de corredor/rua.
- **Pesos:** distância e tempo, e depois a ocupação da rua (rua ocupada = custo alto ou aresta temporariamente indisponível).

## Critério de prioridade

Definido pelo Marcio: **giro do material + posição do material no depósito**.

Índice proposto, para cada tarefa *i* que disputa a mesma rua:

```
P(i) = w1 * G(i) + w2 * Pos(i)
```

- `G(i)`: giro normalizado do material (0 a 1), por exemplo a partir da curva ABC.
- `Pos(i)`: valor derivado da posição de destino (proximidade da saída ou tempo de ocupação da rua, conforme a interpretação adotada).
- `w1` e `w2`: pesos parametrizáveis. No site 3D, mudar os pesos deve alterar a ordem sugerida em tempo real.

Tensão a deixar explícita: priorizar só o alto giro pode atrasar tarefas rápidas; priorizar só tarefas curtas pode deixar o alto giro esperando. Os pesos controlam esse equilíbrio e a simulação mostra o efeito de cada escolha.

Duas interpretações de "posição":

1. **Profundidade/distância na rua:** quanto mais fundo o endereço, mais tempo a rua fica ocupada. Vira peso da aresta.
2. **Ordem de acesso:** em estruturas onde um palete tapa outro (drive-in, blocado), a posição de fundo deve ser armazenada antes da da frente. Vira restrição de precedência.

## Modelo de dados (decidido)

- Todo material pertence a uma **categoria** e tem uma **curva** (ABC) que alimenta o `G(i)`.
- Todo material tem **endereço fixo** no depósito. O algoritmo não escolhe endereço: o destino de cada tarefa já vem definido pelo material.
- Todo endereço é composto por **depósito** e **nível**. O nível entra no tempo de ocupação da rua (nível mais alto = elevação maior = rua bloqueada por mais tempo), então alimenta o `Pos(i)`.

Regras de endereçamento (exemplo dado pelo Marcio):

- **Depósito = área por categoria de material.** Cada rua pertence a um depósito. Ex.: rua 1 = medicamentos, rua 2 = HPC, rua 3 = grandes volumes, etc.
- **Nível = curva.** Nível 1 só recebe curva A, nível 2 curva B, e assim por diante.
- Consequência: categoria define depósito e rua; curva define nível. O endereço sai das duas informações do material.
- Consequência para o critério: curva e nível são correlacionados. Curva A fica no nível mais baixo (elevação curta, rua liberada rápido) e curva C fica no alto (elevação longa, rua bloqueada por mais tempo). Então `G(i)` e `Pos(i)` não são independentes, e a simulação precisa mostrar o efeito dos pesos `w1` e `w2` com essa correlação.
- Congestionamento ocorre entre operadores com tarefas da **mesma categoria** (mesma rua).

Acesso às ruas (decidido): **apenas por um lado**. Cada rua é um beco sem saída.

- No grafo, a rua é um ramo que sai de um único cruzamento de entrada e termina na última posição.
- **Duas ou mais operações podem estar na mesma rua ao mesmo tempo**, desde que quem está parado armazenando não bloqueie os que ainda precisam passar. A rua não é de uso exclusivo.
- **Regra de precedência pela profundidade:** o material cujo destino fica no **fundo** da rua entra primeiro. Assim, quem armazena mais perto da entrada depois não atrapalha quem já está no fundo, e os demais também conseguem entrar.
- **Onde ocorre o bloqueio:** a empilhadeira parada (posicionando, elevando, guardando) ocupa o trecho onde está. Quem precisa passar por esse trecho, para entrar ou para sair, espera. Quem está parado perto da entrada bloqueia todos que estão atrás ou que ainda vão entrar mais fundo. Quem está no fundo só bloqueia quem vai ao mesmo trecho.
- Ordem ruim (frente antes do fundo): o da frente fica parado e trava o acesso ao fundo. Ordem boa (fundo antes da frente): os dois ficam na rua ao mesmo tempo, sem espera.
- No grafo dinâmico: o trecho (aresta) onde há empilhadeira parada fica indisponível durante o tempo da operação (posicionar + elevar conforme o nível + guardar). O recálculo a cada evento reordena as tarefas.
- Isso cria uma **restrição de precedência por profundidade** dentro de cada rua, e o `P(i)` (giro + posição) atua como desempate e para ordenar entre ruas. A profundidade passa a ser regra, não só peso.

Estrutura sugerida (a confirmar com o Marcio):

```
Material: codigo, descricao, categoria, curva (A/B/C), endereco
Endereco: deposito, rua, posicao, nivel
Tarefa:   material, doca_origem, hora_criacao  (destino = endereco do material)
```

## Esboço de layout (Marcio)

```
PÁTIO / ENTRADA DE CAMINHÕES
   [D1]  [D2]  [D3]
 ┌──────┴─────┴─────┴───────────────────────────┐
 │  ÁREA DE RECEBIMENTO                         │
 │  (conferência/pulmão)                        │
 ├───────────────────────────────────────────────┤
 │  Travessa frontal (T1)  ←────────────────→    │
 ├───────────────────────────────────────────────┤
 │ ║ R1 ║   ║ R2 ║   ║ R3 ║   ║ R4 ║             │
 │ ║    ║   ║    ║   ║    ║   ║    ║  racks nos │
 │ ║    ║   ║    ║   ║    ║   ║    ║  dois lados│
 │ ║    ║   ║    ║   ║    ║   ║    ║  de cada   │
 ├───────────────────────────────────────────────┤
 │  Travessa de fundo (T2)  ←───────────────→    │
 └───────────────────────────────────────────────┘
```

Leitura para o grafo:
- Docas de recebimento D1 a D3 alimentam a armazenagem. A área de expedição e as docas E1 e E2 foram **removidas** do layout: o foco do projeto é só armazenagem.
- Origem das tarefas: área de recebimento (pulmão). Ela liga na travessa frontal T1.
- T1 distribui para as ruas R1 a R4. Cada rua tem racks nos dois lados (endereços dos dois lados da rua).
- Pendente: a travessa de fundo T2 aparece no desenho e pode dar acesso pelo fundo, o que contradiz "acesso por um lado" (ver conversa).

## Pergunta em aberto

No layout genérico, os paletes ficam em **porta-paletes seletivo** (cada posição acessível de forma independente) ou em **estrutura profunda/blocada** (uma posição pode tapar outra)? A precedência por profundidade já vale por causa da rua sem saída (ver "Acesso às ruas"), independentemente do tipo de estrutura. A existência de níveis sugere porta-paletes seletivo, mas isso ainda não foi confirmado. A resposta decide se a posição entra só como peso ou também como regra de precedência.

## Objetivos

**Objetivo geral:** Desenvolver e demonstrar um algoritmo baseado em grafos dinâmicos que defina a ordem de prioridade e a rota das tarefas de armazenagem de empilhadeiras, considerando o giro dos materiais e a posição de destino, para reduzir esperas e bloqueios de corredor em um centro logístico.

**Objetivos específicos:**

- Modelar um layout genérico de centro logístico (docas, pátio, ruas e posições) como um grafo com pesos dinâmicos.
- Definir um índice de prioridade das tarefas combinando o giro do material e a posição de destino no depósito.
- Implementar o algoritmo de priorização e roteirização para múltiplos operadores concorrendo pela mesma rua.
- Desenvolver uma visualização 3D que execute o algoritmo dinamicamente e mostre a ordem de armazenagem sugerida.
- Comparar, por simulação, o cenário sem priorização (ordem de chegada) com o cenário com o algoritmo, quanto a tempo de espera, distância percorrida e número de bloqueios.

## Estado atual

- Objetivos e critério de prioridade definidos.
- Stack: JavaScript puro (algoritmo e simulação) + Three.js (site 3D, via CDN, sem build). Node não está instalado direto na máquina, mas há Docker com a imagem `node`. Testes pelo Docker: `docker run --rm -v "<pasta do projeto>:/app:ro" -w /app node:latest node algoritmo/testes.js`. Também rodam no navegador (`algoritmo/testes.html`).
- Primeira versão (MVP) construída:
  - `dados/layout.js` (parâmetros do layout), `dados/materiais.js` (catálogo com endereço fixo e gerador de tarefas com semente).
  - `algoritmo/grafo.js` (grafo + Dijkstra com peso dinâmico), `algoritmo/prioridade.js` (P(i), precedência por profundidade, escolha da tarefa).
  - `simulacao/simulador.js` (simulação por passos de tempo, duas políticas: chegada e algoritmo).
  - `site3d/index.html` (abrir no navegador): cena 3D, pesos w1/w2/w3 ao vivo, ordem sugerida numerada, botão "Comparar políticas".
  - 7 testes passando (rota, endereço fixo, precedência, cenário mínimo).
  - `dashboard/index.html`: painel administrativo para o coordenador de operações, em linguagem sem termos técnicos. Botões "Operação atual / Com priorização / Comparar as duas" e "Um dia / Média de 30 dias". Mostra tempo total, tempo médio por palete, itens de alto giro, tempo perdido esperando a rua, paradas, % do tempo em espera, distância e paletes por hora, mais 3 gráficos e uma tabela-resumo. Frases de "Leitura rápida" geradas dos números (inclusive quando o resultado piora). Controles: operadores, paletes no dia, peso do giro, "guardar primeiro o fundo da rua".
- Suposições adotadas na primeira versão (confirmar com o Marcio):
  1. Ruas sem saída pelo fundo: a travessa T2 não está no grafo.
  2. Os dois lados da rua contam como o mesmo trecho para bloqueio.
  3. Só a empilhadeira **parada operando** bloqueia o trecho. Quem está em movimento passa.
  4. Um palete por viagem; operador volta ao recebimento depois de guardar.
  5. Tempos: 2 m/s, operação 10 s + 12 s por nível, pegar palete 5 s (todos parametrizáveis). A rua 4 se chama "Alimentos" como nome provisório.
- Primeiro resultado (média de 30 cenários, 5 operadores, 24 tarefas, concentradas na R1):
  - Algoritmo padrão (w1=w2=w3=0,5, com precedência): espera por bloqueio **maior** (399 s contra 318 s na ordem de chegada). Curva A melhora muito (ciclo médio 157 s contra 193 s) e o ciclo médio geral fica igual.
  - Sem a regra de precedência, só pelo giro: curva A ciclo 98 s, ciclo geral 185 s (melhor), espera 324 s (igual à chegada), mas o tempo total sobe (446 s contra 430 s).
  - Leitura: a regra "fundo primeiro" sozinha não reduz espera, porque a empilhadeira do fundo fica presa na saída quando a da frente ainda está operando. O ganho atual vem do giro (prioriza curva A).
- Próximo passo sugerido: fazer o algoritmo prever o conflito de **saída** (a tarefa da frente só começa se terminar antes de a do fundo sair) e então reavaliar a precedência.
- Depois: estrutura do projeto de extensão (texto) e refinamento do site.