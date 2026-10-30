(function (root) {
  const { menorCaminho } = typeof require !== 'undefined' ? require('./grafo') : root.Rotas;

  // w1: giro | w2: posição (tarefa que ocupa menos a rua) | w3: penalidade por rua ocupada agora
  const PARAMS_PADRAO = {
    w1: 0.5,
    w2: 0.5,
    w3: 0.5,
    giroPorCurva: { A: 1, B: 0.5, C: 0.1 }, // G(i) normalizado de 0 a 1
    esperaRef: 40, // s de espera prevista que zera a pontuação de uma tarefa
  };

  const noDestino = (t) => `${t.endereco.rua}_${t.endereco.posicao}`;

  // Tempo que a empilhadeira fica parada ocupando o trecho (posicionar + elevar + guardar).
  const tempoOperacao = (layout, t) => layout.tempoOperacaoBase + layout.tempoPorNivel * t.endereco.nivel;

  // Tempo de presença dentro da rua: entra até a posição, opera e sai.
  const tempoNaRua = (layout, t) =>
    (2 * t.endereco.posicao * layout.passoPosicao) / layout.velocidade + tempoOperacao(layout, t);

  function tempoNaRuaMax(layout) {
    const nivelMax = Math.max(...Object.values(layout.nivelPorCurva));
    return (
      (2 * layout.posicoesPorRua * layout.passoPosicao) / layout.velocidade +
      layout.tempoOperacaoBase +
      layout.tempoPorNivel * nivelMax
    );
  }

  // Espera prevista agora: soma o tempo restante das empilhadeiras paradas no caminho da tarefa.
  function esperaPrevista(grafo, tarefa, operadores) {
    const rota = menorCaminho(grafo, 'REC', noDestino(tarefa));
    let espera = 0;
    for (const op of operadores) {
      if (op.estado === 'operando' && rota.caminho.includes(noDestino(op.tarefa))) {
        espera += Math.max(0, op.restante);
      }
    }
    return espera;
  }

  // P(i) = w1*G(i) + w2*Pos(i), menos a penalidade dinâmica por rua ocupada.
  function pontuar(t, ctx) {
    const { layout, grafo, params, operadores } = ctx;
    const G = params.giroPorCurva[t.material.curva];
    const Pos = 1 - tempoNaRua(layout, t) / tempoNaRuaMax(layout);
    const P = params.w1 * G + params.w2 * Pos;
    const espera = esperaPrevista(grafo, t, operadores);
    const final = P - params.w3 * Math.min(1, espera / params.esperaRef);
    return { G, Pos, P, espera, final };
  }

  // Regra de precedência por profundidade: em cada rua, só a tarefa mais funda está liberada.
  // Assim quem armazena perto da entrada depois não bloqueia quem ainda vai ao fundo.
  function elegiveis(fila) {
    const maxPorRua = {};
    for (const t of fila) {
      maxPorRua[t.endereco.rua] = Math.max(maxPorRua[t.endereco.rua] || 0, t.endereco.posicao);
    }
    return fila.filter((t) => t.endereco.posicao === maxPorRua[t.endereco.rua]);
  }

  // politica 'chegada': primeira que chegou. politica 'algoritmo': precedência + pontuação.
  function escolherTarefa(politica, fila, ctx) {
    if (fila.length === 0) return null;
    if (politica === 'chegada') return fila[0]; // a fila já está em ordem de chegada
    let melhor = null;
    let melhorPont = -Infinity;
    const candidatas = ctx.params.precedencia === false ? fila : elegiveis(fila);
    for (const t of candidatas) {
      const pont = pontuar(t, ctx).final;
      if (pont > melhorPont + 1e-9) {
        melhor = t;
        melhorPont = pont;
      }
    }
    return melhor;
  }

  // Ordem completa sugerida para a fila atual (usada pelo site para mostrar a sequência).
  function ordemSugerida(politica, fila, ctx) {
    const resto = fila.slice();
    const ordem = [];
    while (resto.length) {
      const t = escolherTarefa(politica, resto, ctx);
      ordem.push(t);
      resto.splice(resto.indexOf(t), 1);
    }
    return ordem;
  }

  const api = {
    PARAMS_PADRAO,
    noDestino,
    tempoOperacao,
    tempoNaRua,
    esperaPrevista,
    pontuar,
    elegiveis,
    escolherTarefa,
    ordemSugerida,
  };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Rotas = Object.assign(root.Rotas || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
