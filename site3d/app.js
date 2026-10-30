(function () {
  const { LAYOUT, criarCatalogo, gerarTarefas, Simulador, ordemSugerida, noDestino } = window.Rotas;
  const catalogo = criarCatalogo(LAYOUT);
  const PASSO = 0.25; // s de simulação por passo
  const COR_CURVA = { A: 0x4cd08a, B: 0xf0b429, C: 0xff7b72 };
  const $ = (id) => document.getElementById(id);

  // ---------- cena ----------
  const cena = new THREE.Scene();
  cena.background = new THREE.Color(0x1b1f27);
  // Grupo espelhado em x: com a câmera olhando de frente, R1 fica à esquerda e R4 à direita.
  const mundo = new THREE.Group();
  mundo.scale.x = -1;
  cena.add(mundo);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  $('cena').appendChild(renderer.domElement);
  cena.add(new THREE.AmbientLight(0xffffff, 0.7));
  const sol = new THREE.DirectionalLight(0xffffff, 0.6);
  sol.position.set(20, 40, 10);
  cena.add(sol);

  // Câmera orbital simples (sem biblioteca extra): arrastar gira, roda aproxima.
  const alvo = new THREE.Vector3(-22, 0, 20);
  const orb = { theta: 0.0, phi: 0.95, raio: 58 };
  function posicionarCamera() {
    camera.position.set(
      alvo.x + orb.raio * Math.sin(orb.phi) * Math.sin(orb.theta),
      alvo.y + orb.raio * Math.cos(orb.phi),
      alvo.z - orb.raio * Math.sin(orb.phi) * Math.cos(orb.theta)
    );
    camera.lookAt(alvo);
  }
  let arrastando = false, ultimoX = 0, ultimoY = 0;
  renderer.domElement.addEventListener('mousedown', (e) => { arrastando = true; ultimoX = e.clientX; ultimoY = e.clientY; });
  window.addEventListener('mouseup', () => (arrastando = false));
  window.addEventListener('mousemove', (e) => {
    if (!arrastando) return;
    orb.theta -= (e.clientX - ultimoX) * 0.006;
    orb.phi = Math.min(1.5, Math.max(0.2, orb.phi - (e.clientY - ultimoY) * 0.006));
    ultimoX = e.clientX; ultimoY = e.clientY;
    posicionarCamera();
  });
  renderer.domElement.addEventListener('wheel', (e) => {
    orb.raio = Math.min(120, Math.max(15, orb.raio + e.deltaY * 0.05));
    posicionarCamera();
    e.preventDefault();
  }, { passive: false });
  function redimensionar() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', redimensionar);

  const cacheRotulos = {};
  function rotulo(texto, escala = 3, cor = '#ffffff') {
    const chave = texto + cor;
    if (!cacheRotulos[chave]) {
      const c = document.createElement('canvas');
      c.width = 340; c.height = 96;
      const g = c.getContext('2d');
      g.fillStyle = 'rgba(0,0,0,.55)';
      g.fillRect(0, 0, 340, 96);
      g.fillStyle = cor; g.font = 'bold 36px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(texto, 170, 50);
      cacheRotulos[chave] = new THREE.CanvasTexture(c);
    }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cacheRotulos[chave], depthTest: false }));
    s.scale.set(escala, escala * 0.28, 1);
    return s;
  }

  const caixa = (l, a, p, cor, opacidade = 1) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(l, a, p),
      new THREE.MeshLambertMaterial({ color: cor, transparent: opacidade < 1, opacity: opacidade })
    );
    return m;
  };

  // ---------- layout estático ----------
  (function construirLayout() {
    const piso = caixa(52, 0.2, 52, 0x262c38);
    piso.position.set(22, -0.1, 24);
    mundo.add(piso);

    const rec = caixa(16, 0.1, 7, 0x3a4a66);
    rec.position.set(LAYOUT.recebimento.x, 0.05, LAYOUT.recebimento.z + 1);
    mundo.add(rec);
    const lr = rotulo('RECEBIMENTO', 7);
    lr.position.set(LAYOUT.recebimento.x, 3, LAYOUT.recebimento.z + 4);
    mundo.add(lr);
    [-6, 0, 6].forEach((dx, i) => {
      const doca = caixa(3.5, 2.5, 1, 0x56627a);
      doca.position.set(LAYOUT.recebimento.x + dx, 1.25, -3);
      mundo.add(doca);
      const l = rotulo('D' + (i + 1), 2);
      l.position.set(LAYOUT.recebimento.x + dx, 3.6, -3);
      mundo.add(l);
    });

    const t1 = caixa(30, 0.1, 3, 0x30384a);
    t1.position.set(22, 0.05, LAYOUT.travessaZ);
    mundo.add(t1);
    const lt = rotulo('T1', 2);
    lt.position.set(3, 1.5, LAYOUT.travessaZ);
    mundo.add(lt);

    const fundoZ = LAYOUT.ruaInicioZ + (LAYOUT.posicoesPorRua - 1) * LAYOUT.passoPosicao;
    for (const rua of LAYOUT.ruas) {
      const corredor = caixa(2.6, 0.1, fundoZ - LAYOUT.ruaInicioZ + 4, 0x30384a);
      corredor.position.set(rua.x, 0.05, (LAYOUT.ruaInicioZ - 1.5 + fundoZ + 1.5) / 2);
      mundo.add(corredor);
      const l = rotulo(rua.id + ' ' + rua.deposito, 7.5);
      l.position.set(rua.x, 3.2, LAYOUT.ruaInicioZ - 2.5);
      mundo.add(l);
      // racks dos dois lados, um bloco por nível (altura cresce com o nível)
      for (const lado of [-1, 1]) {
        for (let p = 1; p <= LAYOUT.posicoesPorRua; p++) {
          for (let n = 1; n <= 3; n++) {
            const rack = caixa(2, 1.15, LAYOUT.passoPosicao - 0.3, 0x44506a, 0.35);
            rack.position.set(rua.x + lado * 2.4, (n - 1) * 1.3 + 0.7, LAYOUT.ruaInicioZ + (p - 1) * LAYOUT.passoPosicao);
            mundo.add(rack);
          }
        }
      }
    }
  })();

  // ---------- estado da simulação ----------
  let sim = null;
  let pausado = false;
  let acumulado = 0;
  const grupoGuardados = new THREE.Group();
  const grupoFila = new THREE.Group();
  mundo.add(grupoGuardados, grupoFila);
  let viewOps = [];
  let guardadasMostradas = 0;
  let assinaturaFila = '';

  const posEndereco = (e) => {
    const rua = LAYOUT.ruas.find((r) => r.id === e.rua);
    return {
      x: rua.x + (e.lado === 'E' ? -1 : 1) * 2.4,
      y: (e.nivel - 1) * 1.3 + 0.7,
      z: LAYOUT.ruaInicioZ + (e.posicao - 1) * LAYOUT.passoPosicao,
    };
  };

  function params() {
    return { w1: +$('w1').value, w2: +$('w2').value, w3: +$('w3').value };
  }

  function cenarioAtual() {
    return gerarTarefas(catalogo, LAYOUT, { semente: +$('semente').value, quantidade: +$('nTarefas').value });
  }

  function novaSimulacao() {
    sim = new Simulador({
      layout: LAYOUT, tarefas: cenarioAtual(), politica: $('politica').value, params: params(), nOperadores: +$('nOps').value,
    });
    acumulado = 0;
    guardadasMostradas = 0;
    assinaturaFila = '';
    grupoGuardados.clear();
    grupoFila.clear();
    viewOps.forEach((v) => mundo.remove(v.grupo));
    viewOps = sim.ops.map((op) => {
      const grupo = new THREE.Group();
      const corpo = caixa(1.6, 1, 2.2, 0x3b82f6);
      corpo.position.y = 0.6;
      const mastro = caixa(1.2, 2.2, 0.2, 0x222222);
      mastro.position.set(0, 1.1, 1.2);
      const carga = caixa(1.2, 0.8, 1.2, 0xffffff);
      carga.position.set(0, 0.6, 1.9);
      const l = rotulo(String(op.id + 1), 2.4);
      l.position.y = 3;
      grupo.add(corpo, mastro, carga, l);
      mundo.add(grupo);
      return { grupo, corpo, carga };
    });
  }

  function atualizarCena() {
    sim.ops.forEach((op, i) => {
      const v = viewOps[i];
      v.grupo.position.set(op.x + (op.estado === 'ocioso' || op.estado === 'pegando' ? (i - sim.ops.length / 2) * 1.5 : 0), 0, op.z);
      // orientação: de frente para o próximo nó (ou para o fundo da rua quando parado)
      const prox = op.caminho[op.i + 1] && sim.grafo.nos[op.caminho[op.i + 1]];
      if (prox) {
        const a = sim.grafo.nos[op.caminho[op.i]];
        v.grupo.rotation.y = Math.atan2(prox.x - a.x, prox.z - a.z);
      }
      const levando = op.estado === 'pegando' || op.estado === 'indo' || op.estado === 'operando';
      v.carga.visible = levando;
      if (levando) v.carga.material.color.setHex(COR_CURVA[op.tarefa.material.curva]);
      const cor = op.esperando ? 0xe5484d : op.estado === 'operando' ? 0xf08c00 : 0x3b82f6;
      v.corpo.material.color.setHex(cor);
    });

    // palete guardado fica no endereço
    while (guardadasMostradas < sim.concluidas.length) {
      const t = sim.concluidas[guardadasMostradas++];
      const p = posEndereco(t.endereco);
      const m = caixa(1.8, 1, 2.4, COR_CURVA[t.material.curva]);
      m.position.set(p.x, p.y, p.z);
      grupoGuardados.add(m);
    }
  }

  // Fila: destinos das tarefas esperando, numerados na ordem sugerida pela política atual.
  function atualizarFila() {
    sim.politica = $('politica').value;
    Object.assign(sim.params, params());
    const ordem = ordemSugerida(sim.politica, sim.fila, sim.contexto());
    const assinatura = sim.politica + ordem.map((t) => t.id).join(',');
    if (assinatura === assinaturaFila) return;
    assinaturaFila = assinatura;

    grupoFila.clear();
    ordem.forEach((t, k) => {
      const p = posEndereco(t.endereco);
      const fantasma = caixa(1.9, 1.05, 2.5, COR_CURVA[t.material.curva], 0.45);
      fantasma.position.set(p.x, p.y, p.z);
      const num = rotulo(String(k + 1), 2.2);
      num.position.set(p.x, p.y + 1.4, p.z);
      grupoFila.add(fantasma, num);
    });

    $('filaLista').innerHTML = ordem.length
      ? ordem.map((t, k) =>
          `<div class="item"><b>${k + 1}.</b><span class="tag ${t.material.curva}">${t.material.curva}</span>` +
          `${t.material.codigo}<span class="peq">${t.endereco.rua} pos ${t.endereco.posicao} nív ${t.endereco.nivel}</span></div>`
        ).join('')
      : 'sem tarefas na fila';
  }

  function atualizarPainel() {
    ['w1', 'w2', 'w3'].forEach((k) => ($(k + 'v').textContent = (+$(k).value).toFixed(2)));
    const m = sim.metricas();
    const esperando = sim.ops.filter((o) => o.esperando).length;
    $('vivo').innerHTML =
      `Tempo: ${sim.t.toFixed(0)} s &nbsp; Concluídas: ${m.concluidas}/${sim.totalTarefas}<br>` +
      `Esperando rua agora: ${esperando} &nbsp; Bloqueios: ${m.bloqueios}<br>` +
      `Espera total: ${m.esperaBloqueio} s &nbsp; Distância: ${m.distancia} m` +
      (sim.terminou() ? '<br><b>Fim da simulação</b>' : '');
  }

  // Roda o mesmo cenário nas duas políticas, sem animação, e compara.
  function compararPoliticas() {
    const tarefas = cenarioAtual();
    const roda = (politica) =>
      new Simulador({ layout: LAYOUT, tarefas, politica, params: params(), nOperadores: +$('nOps').value }).executar();
    const a = roda('chegada');
    const b = roda('algoritmo');
    const linhas = [
      ['Espera por bloqueio (s)', 'esperaBloqueio'],
      ['Bloqueios (nº)', 'bloqueios'],
      ['Distância (m)', 'distancia'],
      ['Tempo total (s)', 'tempoTotal'],
      ['Ciclo médio (s)', 'cicloMedio'],
      ['Ciclo médio curva A (s)', 'cicloMedioCurvaA'],
    ];
    $('resultado').innerHTML =
      '<hr><h3>Comparação (mesmo cenário)</h3><table><tr><th></th><th>Chegada</th><th>Algoritmo</th><th>Var.</th></tr>' +
      linhas.map(([nome, k]) => {
        const var_ = a[k] ? ((b[k] - a[k]) / a[k]) * 100 : 0;
        const cls = var_ < 0 ? 'bom' : var_ > 0 ? 'ruim' : '';
        return `<tr><td>${nome}</td><td>${a[k]}</td><td>${b[k]}</td><td class="${cls}">${var_.toFixed(0)}%</td></tr>`;
      }).join('') + '</table><p class="peq">Variação negativa = o algoritmo melhorou.</p>';
  }

  // ---------- eventos ----------
  $('reiniciar').onclick = novaSimulacao;
  $('pausar').onclick = () => { pausado = !pausado; $('pausar').textContent = pausado ? 'Continuar' : 'Pausar'; };
  $('comparar').onclick = compararPoliticas;
  ['politica', 'w1', 'w2', 'w3'].forEach((id) => $(id).addEventListener('input', () => { assinaturaFila = ''; }));
  ['nOps', 'nTarefas', 'semente'].forEach((id) => $(id).addEventListener('change', novaSimulacao));

  redimensionar();
  posicionarCamera();
  novaSimulacao();

  let ultimo = performance.now();
  let contador = 0;
  function animar(agora) {
    requestAnimationFrame(animar);
    const dtReal = Math.min((agora - ultimo) / 1000, 0.1);
    ultimo = agora;
    if (!pausado) {
      acumulado += dtReal * +$('velocidade').value;
      while (acumulado >= PASSO) { sim.step(PASSO); acumulado -= PASSO; }
    }
    atualizarCena();
    atualizarFila();
    if (contador++ % 6 === 0) atualizarPainel();
    renderer.render(cena, camera);
  }
  requestAnimationFrame(animar);
})();
