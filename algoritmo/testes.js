// Testes do modelo. Rodar com: node algoritmo/testes.js
// No Node usa require; no navegador (testes.html) usa as globais e um assert mínimo.
const emNode = typeof require !== 'undefined';
const assert = emNode ? require('assert') : {
  ok: (c, m) => { if (!c) throw new Error(m || 'falhou'); },
  strictEqual: (a, b) => { if (a !== b) throw new Error(a + ' !== ' + b); },
  deepStrictEqual: (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(JSON.stringify(a) + ' != ' + JSON.stringify(b)); },
};
const R = emNode ? null : globalThis.Rotas;
const { LAYOUT } = R || require('../dados/layout');
const { criarCatalogo, gerarTarefas } = R || require('../dados/materiais');
const { construirGrafo, menorCaminho } = R || require('./grafo');
const { elegiveis, escolherTarefa, PARAMS_PADRAO } = R || require('./prioridade');
const { Simulador } = R || require('../simulacao/simulador');

function teste(nome, fn) {
  fn();
  console.log('ok  -', nome);
}

const catalogo = criarCatalogo(LAYOUT);
const grafo = construirGrafo(LAYOUT);

teste('endereço fixo: categoria define a rua e a curva define o nível', () => {
  for (const m of catalogo) {
    const rua = LAYOUT.ruas.find((r) => r.id === m.endereco.rua);
    assert.strictEqual(rua.deposito, m.categoria);
    assert.strictEqual(m.endereco.nivel, LAYOUT.nivelPorCurva[m.curva]);
  }
});

teste('rota: recebimento até o fundo da R1 passa pela travessa e pelas posições em ordem', () => {
  const r = menorCaminho(grafo, 'REC', 'R1_3');
  assert.deepStrictEqual(r.caminho, ['REC', 'T1_C', 'T1_R2', 'T1_R1', 'R1_1', 'R1_2', 'R1_3']);
});

teste('rota: peso dinâmico aumenta o custo de passar por um nó ocupado', () => {
  const livre = menorCaminho(grafo, 'REC', 'R1_5').tempo;
  const ocupado = menorCaminho(grafo, 'REC', 'R1_5', (no) => (no === 'R1_2' ? 30 : 0)).tempo;
  assert.ok(Math.abs(ocupado - livre - 30) < 1e-9);
});

const tarefa = (id, rua, posicao, curva) => {
  const m = { codigo: 'X', categoria: '', curva };
  return { id, criacao: 0, material: m, endereco: { rua, posicao, nivel: LAYOUT.nivelPorCurva[curva], lado: 'E' } };
};

teste('precedência: em cada rua só a tarefa mais funda está liberada', () => {
  const fila = [tarefa(1, 'R1', 1, 'A'), tarefa(2, 'R1', 6, 'C'), tarefa(3, 'R2', 2, 'B')];
  const ids = elegiveis(fila).map((t) => t.id).sort();
  assert.deepStrictEqual(ids, [2, 3]);
});

teste('algoritmo escolhe o fundo da rua mesmo com chegada posterior e giro menor', () => {
  const fila = [tarefa(1, 'R1', 1, 'A'), tarefa(2, 'R1', 6, 'C')];
  const ctx = { layout: LAYOUT, grafo, params: PARAMS_PADRAO, operadores: [] };
  assert.strictEqual(escolherTarefa('chegada', fila, ctx).id, 1);
  assert.strictEqual(escolherTarefa('algoritmo', fila, ctx).id, 2);
});

teste('cenário mínimo: frente antes do fundo bloqueia; fundo antes da frente não', () => {
  const tarefas = [tarefa(1, 'R1', 1, 'A'), tarefa(2, 'R1', 6, 'A')];
  const chegada = new Simulador({ layout: LAYOUT, tarefas, politica: 'chegada', nOperadores: 2 }).executar();
  const algoritmo = new Simulador({ layout: LAYOUT, tarefas, politica: 'algoritmo', nOperadores: 2 }).executar();
  assert.ok(chegada.bloqueios > 0, 'chegada deveria bloquear');
  assert.strictEqual(algoritmo.bloqueios, 0);
  assert.ok(algoritmo.esperaBloqueio < chegada.esperaBloqueio);
});

teste('simulação conclui todas as tarefas nas duas políticas', () => {
  const tarefas = gerarTarefas(catalogo, LAYOUT, { semente: 3 });
  for (const politica of ['chegada', 'algoritmo']) {
    const m = new Simulador({ layout: LAYOUT, tarefas, politica }).executar();
    assert.strictEqual(m.concluidas, tarefas.length);
  }
});

console.log('\nTodos os testes passaram.');
