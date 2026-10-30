(function (root) {
  // Nós: recebimento, cruzamentos da travessa frontal e posições dentro de cada rua.
  // Arestas: trechos de corredor, com distância (m) e tempo (s).
  function construirGrafo(layout) {
    const nos = {};
    const addNo = (id, x, z, tipo, rua = null, posicao = 0) => {
      nos[id] = { id, x, z, tipo, rua, posicao, vizinhos: [] };
    };
    const ligar = (a, b) => {
      const dist = Math.hypot(nos[a].x - nos[b].x, nos[a].z - nos[b].z);
      const tempo = dist / layout.velocidade;
      nos[a].vizinhos.push({ para: b, dist, tempo });
      nos[b].vizinhos.push({ para: a, dist, tempo });
    };

    addNo('REC', layout.recebimento.x, layout.recebimento.z, 'recebimento');
    addNo('T1_C', layout.recebimento.x, layout.travessaZ, 'cruzamento');
    ligar('REC', 'T1_C');

    // Cruzamentos da travessa frontal: um em frente a cada rua, em fila ordenada por x.
    const cruzamentos = [{ id: 'T1_C', x: layout.recebimento.x }];
    for (const rua of layout.ruas) {
      addNo('T1_' + rua.id, rua.x, layout.travessaZ, 'cruzamento');
      cruzamentos.push({ id: 'T1_' + rua.id, x: rua.x });
    }
    cruzamentos.sort((a, b) => a.x - b.x);
    for (let i = 0; i < cruzamentos.length - 1; i++) ligar(cruzamentos[i].id, cruzamentos[i + 1].id);

    // Cada rua é um beco sem saída: entra por T1 e vai até a posição mais funda.
    for (const rua of layout.ruas) {
      for (let p = 1; p <= layout.posicoesPorRua; p++) {
        addNo(`${rua.id}_${p}`, rua.x, layout.ruaInicioZ + (p - 1) * layout.passoPosicao, 'posicao', rua.id, p);
      }
      ligar('T1_' + rua.id, `${rua.id}_1`);
      for (let p = 1; p < layout.posicoesPorRua; p++) ligar(`${rua.id}_${p}`, `${rua.id}_${p + 1}`);
    }
    return { nos, layout };
  }

  // Dijkstra. custoNo(id) soma segundos ao entrar em um nó: é por aqui que a
  // ocupação da rua (peso dinâmico) entra no cálculo da rota.
  function menorCaminho(grafo, origem, destino, custoNo = () => 0) {
    const dist = {};
    const ant = {};
    const aberto = new Set(Object.keys(grafo.nos));
    for (const id of aberto) dist[id] = Infinity;
    dist[origem] = 0;
    while (aberto.size) {
      let u = null;
      for (const id of aberto) if (u === null || dist[id] < dist[u]) u = id;
      if (dist[u] === Infinity || u === destino) break;
      aberto.delete(u);
      for (const v of grafo.nos[u].vizinhos) {
        const c = dist[u] + v.tempo + custoNo(v.para);
        if (c < dist[v.para]) {
          dist[v.para] = c;
          ant[v.para] = u;
        }
      }
    }
    if (dist[destino] === Infinity) return null;
    const caminho = [destino];
    while (caminho[0] !== origem) caminho.unshift(ant[caminho[0]]);
    let distancia = 0;
    for (let i = 0; i < caminho.length - 1; i++) {
      distancia += grafo.nos[caminho[i]].vizinhos.find((v) => v.para === caminho[i + 1]).dist;
    }
    return { caminho, tempo: dist[destino], distancia };
  }

  const api = { construirGrafo, menorCaminho };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Rotas = Object.assign(root.Rotas || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
