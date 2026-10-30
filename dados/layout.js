(function (root) {
  // Layout genérico do centro logístico. Unidades: metros e segundos.
  // Tudo aqui é parâmetro: mudar um valor muda o grafo, a simulação e o site 3D.
  const LAYOUT = {
    velocidade: 2,          // m/s da empilhadeira
    tempoPegar: 5,          // s para pegar o palete na área de recebimento
    tempoOperacaoBase: 10,  // s para posicionar e guardar o palete
    tempoPorNivel: 12,      // s de elevação por nível (nível mais alto = rua ocupada por mais tempo)
    posicoesPorRua: 8,      // profundidade da rua (posição 1 = perto da entrada)
    passoPosicao: 3,        // m entre posições na rua
    recebimento: { x: 22, z: 0 },
    travessaZ: 10,          // posição da travessa frontal (T1)
    ruaInicioZ: 14,         // onde começa a posição 1 de cada rua
    // Cada rua é um depósito (categoria de material). Acesso só pela frente (beco sem saída).
    ruas: [
      { id: 'R1', deposito: 'Medicamentos', prefixo: 'MED', x: 10 },
      { id: 'R2', deposito: 'HPC', prefixo: 'HPC', x: 18 },
      { id: 'R3', deposito: 'Grandes volumes', prefixo: 'GV', x: 26 },
      { id: 'R4', deposito: 'Alimentos', prefixo: 'ALI', x: 34 }, // nome provisório
    ],
    nivelPorCurva: { A: 1, B: 2, C: 3 }, // curva define o nível do endereço
  };

  const api = { LAYOUT };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Rotas = Object.assign(root.Rotas || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
