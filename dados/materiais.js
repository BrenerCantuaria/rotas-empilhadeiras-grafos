(function (root) {
  // Gerador pseudoaleatório com semente: o mesmo cenário se repete igual nas duas políticas.
  function criarAleatorio(semente) {
    let a = semente >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Catálogo de materiais. Cada material tem categoria, curva e ENDEREÇO FIXO.
  // Categoria define o depósito (rua); curva define o nível; a posição (profundidade) é fixa por material.
  function criarCatalogo(layout) {
    const rnd = criarAleatorio(7); // semente fixa: o endereço de um material nunca muda
    const curvas = ['A', 'A', 'B', 'B', 'C', 'C'];
    const catalogo = [];
    for (const rua of layout.ruas) {
      curvas.forEach((curva, k) => {
        catalogo.push({
          codigo: `${rua.prefixo}-${String(k + 1).padStart(2, '0')}`,
          categoria: rua.deposito,
          curva,
          endereco: {
            deposito: rua.deposito,
            rua: rua.id,
            posicao: 1 + Math.floor(rnd() * layout.posicoesPorRua),
            lado: rnd() < 0.5 ? 'E' : 'D',
            nivel: layout.nivelPorCurva[curva],
          },
        });
      });
    }
    return catalogo;
  }

  // Tarefas de armazenagem: o destino de cada uma é o endereço fixo do material.
  // pesosRua concentra as tarefas em poucas ruas, que é onde o congestionamento aparece.
  function gerarTarefas(catalogo, layout, opcoes = {}) {
    const { semente = 1, quantidade = 24, janela = 60, pesosRua = [0.5, 0.2, 0.2, 0.1] } = opcoes;
    const rnd = criarAleatorio(semente);
    const tarefas = [];
    for (let i = 0; i < quantidade; i++) {
      let sorteio = rnd();
      let idx = 0;
      for (; idx < pesosRua.length - 1; idx++) {
        if (sorteio < pesosRua[idx]) break;
        sorteio -= pesosRua[idx];
      }
      const ruaId = layout.ruas[idx].id;
      const doRua = catalogo.filter((m) => m.endereco.rua === ruaId);
      const material = doRua[Math.floor(rnd() * doRua.length)];
      tarefas.push({ criacao: Math.round(rnd() * janela), material, endereco: material.endereco });
    }
    tarefas.sort((a, b) => a.criacao - b.criacao);
    tarefas.forEach((t, i) => (t.id = i + 1));
    return tarefas;
  }

  const api = { criarAleatorio, criarCatalogo, gerarTarefas };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Rotas = Object.assign(root.Rotas || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
