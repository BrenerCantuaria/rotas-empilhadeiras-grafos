(function () {
  const { LAYOUT, criarCatalogo, gerarTarefas, Simulador } = window.Rotas;
  const catalogo = criarCatalogo(LAYOUT);
  const $ = (id) => document.getElementById(id);

  // Vocabulário do painel: sem termos técnicos.
  const NOME_GIRO = { A: 'Alto giro', B: 'Médio giro', C: 'Baixo giro' };
  const POLITICAS = [
    { id: 'chegada', nome: 'Operação atual', cor: 'var(--neutral)' },
    { id: 'algoritmo', nome: 'Com priorização', cor: 'var(--accent)' },
  ];
  const DIAS_MEDIA = 30;
  const PASSO_GRADE = 30; // s entre pontos da curva do dia

  const estado = { modo: 'comparar', visao: 'dia' };
  let dados = null; // { chegada: agregado, algoritmo: agregado, grade, total }

  // ---------- formatação ----------
  const num = (v, d = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const min = (s) => num(s / 60, 1);
  const media = (l) => (l.length ? l.reduce((s, x) => s + x, 0) / l.length : 0);

  // ---------- cálculo ----------
  function rodarDia(politica, tarefas, nOps, params) {
    const sim = new Simulador({ layout: LAYOUT, tarefas, politica, params, nOperadores: nOps });
    sim.executar();
    const c = sim.concluidas;
    const ciclo = (t) => t.fim - t.criacao;
    const porCurva = {};
    for (const k of ['A', 'B', 'C']) porCurva[k] = media(c.filter((t) => t.material.curva === k).map(ciclo));
    const tempoTotal = c.reduce((m, t) => Math.max(m, t.fim), 0);
    const esperaSeg = sim.ops.reduce((s, o) => s + o.tempoEspera, 0);
    return {
      tempoTotal,
      cicloMedio: media(c.map(ciclo)),
      cicloA: porCurva.A,
      esperaSeg,
      bloqueios: sim.bloqueios,
      distancia: sim.ops.reduce((s, o) => s + o.distancia, 0),
      porHora: c.length / (tempoTotal / 3600),
      pctEspera: (esperaSeg / (nOps * tempoTotal)) * 100,
      porCurva,
      esperaRua: sim.esperaPorRua,
      fins: c.map((t) => t.fim),
    };
  }

  function agregar(dias, grade) {
    const ag = {};
    for (const k of ['tempoTotal', 'cicloMedio', 'cicloA', 'esperaSeg', 'bloqueios', 'distancia', 'porHora', 'pctEspera']) {
      ag[k] = media(dias.map((d) => d[k]));
    }
    ag.porCurva = {};
    for (const c of ['A', 'B', 'C']) ag.porCurva[c] = media(dias.map((d) => d.porCurva[c]).filter((v) => v > 0));
    ag.esperaRua = {};
    for (const r of LAYOUT.ruas) ag.esperaRua[r.id] = media(dias.map((d) => d.esperaRua[r.id] || 0));
    // paletes guardados até cada instante, média dos dias
    ag.curva = grade.map((t) => media(dias.map((d) => d.fins.filter((f) => f <= t).length)));
    return ag;
  }

  function calcular() {
    const nOps = +$('nOps').value;
    const nTarefas = +$('nTarefas').value;
    const w1 = +$('giro').value / 100;
    const params = { w1, w2: 1 - w1, w3: 0.5, precedencia: $('fundo').checked };
    const sementes = estado.visao === 'dia' ? [+$('dia').value] : Array.from({ length: DIAS_MEDIA }, (_, i) => i + 1);
    const cenarios = sementes.map((s) => gerarTarefas(catalogo, LAYOUT, { semente: s, quantidade: nTarefas }));
    const brutos = {};
    for (const p of POLITICAS) brutos[p.id] = cenarios.map((t) => rodarDia(p.id, t, nOps, p.id === 'algoritmo' ? params : {}));
    const tmax = Math.max(...POLITICAS.flatMap((p) => brutos[p.id].map((d) => d.tempoTotal)));
    const grade = [];
    for (let t = 0; t <= Math.ceil(tmax / PASSO_GRADE) * PASSO_GRADE; t += PASSO_GRADE) grade.push(t);
    dados = { grade, total: nTarefas, nOps };
    for (const p of POLITICAS) dados[p.id] = agregar(brutos[p.id], grade);
  }

  // ---------- indicadores ----------
  const HEROI = { k: 'tempoTotal', nome: 'Tempo para guardar todos os paletes', menorMelhor: true };
  const KPIS = [
    { k: 'cicloMedio', nome: 'Tempo médio para guardar um palete', menorMelhor: true, un: 'min', f: (v) => min(v), dica: 'Da chegada do palete até ele estar no endereço.' },
    { k: 'cicloA', nome: 'Tempo médio dos itens de alto giro', menorMelhor: true, un: 'min', f: (v) => min(v), dica: 'Materiais mais vendidos (curva A): os que mais importam ter à mão.' },
    { k: 'esperaSeg', nome: 'Tempo perdido esperando a rua liberar', menorMelhor: true, un: 'min', f: (v) => min(v), dica: 'Soma de todos os operadores.' },
    { k: 'bloqueios', nome: 'Paradas por rua ocupada', menorMelhor: true, un: 'vezes', f: (v) => num(v, 0), dica: 'Quantas vezes uma empilhadeira teve de esperar.' },
    { k: 'pctEspera', nome: 'Parte do tempo dos operadores perdida em espera', menorMelhor: true, un: '%', f: (v) => num(v, 1), dica: 'Quanto da jornada vai para esperar.' },
    { k: 'distancia', nome: 'Distância percorrida', menorMelhor: true, un: 'km', f: (v) => num(v / 1000, 2), dica: 'Soma de todas as empilhadeiras.' },
    { k: 'porHora', nome: 'Paletes guardados por hora', menorMelhor: false, un: 'por hora', f: (v) => num(v, 1), dica: 'Produtividade do conjunto de operadores.' },
  ];
  HEROI.un = 'min'; HEROI.f = (v) => min(v);

  // Variação da operação priorizada em relação à atual, com leitura de "melhor/pior".
  function variacao(ind) {
    const a = dados.chegada[ind.k];
    const b = dados.algoritmo[ind.k];
    const pct = a ? ((b - a) / a) * 100 : 0;
    if (Math.abs(pct) < 0.5) return { pct, cls: 'igual', icone: '=', rotulo: 'igual' };
    const melhor = ind.menorMelhor ? pct < 0 : pct > 0;
    return { pct, cls: melhor ? 'melhor' : 'pior', icone: pct < 0 ? '▼' : '▲', rotulo: melhor ? 'melhor' : 'pior' };
  }
  const textoVar = (v) => `<span class="selo ${v.cls}">${v.icone} ${v.pct > 0 ? '+' : ''}${num(v.pct, 0)}% (${v.rotulo})</span>`;

  const mostrar = () => POLITICAS.filter((p) => estado.modo === 'comparar' || estado.modo === p.id);
  const unico = () => (estado.modo === 'comparar' ? null : POLITICAS.find((p) => p.id === estado.modo));

  function valorECampo(ind) {
    const u = unico();
    if (u) return `${ind.f(dados[u.id][ind.k])} <small>${ind.un}</small>`;
    return `${ind.f(dados.algoritmo[ind.k])} <small>${ind.un}</small>`;
  }
  function linhaDelta(ind) {
    const u = unico();
    if (u) return `<span class="igual">${u.nome}</span>`;
    return `${textoVar(variacao(ind))} <span class="igual">contra ${ind.f(dados.chegada[ind.k])} ${ind.un} na operação atual</span>`;
  }

  function renderKpis() {
    const ph = estado.visao === 'dia' ? `Dia ${$('dia').value}` : `Média de ${DIAS_MEDIA} dias`;
    $('heroi').innerHTML =
      `<div class="rotulo">${HEROI.nome} (${ph})</div>` +
      `<div class="valor">${valorECampo(HEROI)}</div><div class="delta">${linhaDelta(HEROI)}</div>`;
    $('tiles').innerHTML = KPIS.map((ind) =>
      `<div class="card tile"><div class="rotulo">${ind.nome}</div><div class="valor">${valorECampo(ind)}</div>` +
      `<div class="delta">${linhaDelta(ind)}</div><div class="dica">${ind.dica}</div></div>`
    ).join('');
  }

  // Leitura rápida em frases simples, geradas dos próprios números (inclusive quando piora).
  function renderLeitura() {
    if (estado.modo !== 'comparar') {
      $('leitura').innerHTML = `<h2>Leitura rápida</h2><p class="nota">Escolha “Comparar as duas” para ver o que muda com a priorização.</p>`;
      return;
    }
    const itens = [
      [HEROI, 'O dia termina', 'mais cedo', 'mais tarde'],
      [KPIS[1], 'Itens de alto giro ficam guardados', 'mais rápido', 'mais devagar'],
      [KPIS[2], 'O tempo perdido esperando a rua liberar ficou', 'menor', 'maior'],
      [KPIS[0], 'O tempo médio por palete ficou', 'menor', 'maior'],
    ];
    const li = itens.map(([ind, inicio, bom, ruim]) => {
      const v = variacao(ind);
      const texto = v.cls === 'igual' ? `${inicio} no mesmo ritmo.` : `${inicio} ${num(Math.abs(v.pct), 0)}% ${v.cls === 'melhor' ? bom : ruim}.`;
      return `<li><span class="selo ${v.cls}">${v.icone} ${v.rotulo}</span><span>${texto}</span></li>`;
    }).join('');
    $('leitura').innerHTML = `<h2>Leitura rápida</h2><p class="nota">Com priorização, em comparação com a operação atual.</p><ul>${li}</ul>`;
  }

  // ---------- gráficos (SVG) ----------
  const dica = $('dica');
  function mostrarDica(html, e) {
    dica.innerHTML = html;
    dica.style.display = 'block';
    const x = Math.min(e.clientX + 14, window.innerWidth - dica.offsetWidth - 8);
    dica.style.left = Math.max(8, x) + 'px';
    dica.style.top = e.clientY + 14 + 'px';
  }
  const esconderDica = () => (dica.style.display = 'none');
  function ligarDicas(el) {
    el.addEventListener('mousemove', (e) => {
      const alvo = e.target.closest('[data-tip]');
      if (alvo) mostrarDica(alvo.getAttribute('data-tip'), e); else esconderDica();
    });
    el.addEventListener('mouseleave', esconderDica);
  }
  const legenda = (id, pols) => {
    $(id).innerHTML = pols.length > 1
      ? pols.map((p) => `<span><i style="background:${p.cor}"></i>${p.nome}</span>`).join('')
      : '';
  };

  function passoBonito(max, alvo) {
    const bruto = max / alvo;
    for (const p of [1, 2, 5, 10, 20, 50, 100]) if (p >= bruto) return p;
    return 100;
  }

  function topoArredondado(x, y, w, h, r) {
    r = Math.min(r, h, w / 2);
    return `M${x},${y + h}L${x},${y + r}Q${x},${y} ${x + r},${y}L${x + w - r},${y}Q${x + w},${y} ${x + w},${y + r}L${x + w},${y + h}Z`;
  }
  function direitaArredondada(x, y, w, h, r) {
    r = Math.min(r, w, h / 2);
    return `M${x},${y}L${x + w - r},${y}Q${x + w},${y} ${x + w},${y + r}L${x + w},${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}L${x},${y + h}Z`;
  }

  function graficoLinha() {
    const el = $('gLinha');
    const pols = mostrar();
    legenda('legLinha', pols);
    const W = Math.max(320, el.clientWidth), H = 280, m = { l: 36, r: 14, t: 12, b: 32 };
    const n = dados.grade.length, xmax = dados.grade[n - 1], ymax = dados.total;
    const x = (s) => m.l + (s / xmax) * (W - m.l - m.r);
    const y = (v) => H - m.b - (v / ymax) * (H - m.t - m.b);
    let s = '';
    const py = passoBonito(ymax, 5);
    for (let v = 0; v <= ymax; v += py) s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    const px = passoBonito(xmax / 60, 7);
    for (let t = 0; t <= xmax / 60; t += px) s += `<text x="${x(t * 60)}" y="${H - 10}" text-anchor="middle">${t} min</text>`;
    s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}" stroke="var(--axis)"/>`;
    for (const p of pols) {
      const d = dados[p.id].curva.map((v, i) => `${i ? 'L' : 'M'}${x(dados.grade[i]).toFixed(1)},${y(v).toFixed(1)}`).join('');
      s += `<path d="${d}" fill="none" stroke="${p.cor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    s += `<line id="cruz" y1="${m.t}" y2="${H - m.b}" stroke="var(--axis)" style="display:none"/>`;
    for (const p of pols) s += `<circle id="pt_${p.id}" r="4" fill="${p.cor}" stroke="var(--surface)" stroke-width="2" style="display:none"/>`;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Paletes guardados ao longo do dia">${s}<rect id="captura" x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="transparent"/></svg>`;
    const svg = el.querySelector('svg');
    const cruz = svg.querySelector('#cruz');
    svg.querySelector('#captura').addEventListener('mousemove', (e) => {
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / (W - m.l - m.r)) * (n - 1))));
      const t = dados.grade[i];
      cruz.setAttribute('x1', x(t)); cruz.setAttribute('x2', x(t)); cruz.style.display = '';
      let html = `<b>${num(t / 60, 1)} min</b>`;
      for (const p of pols) {
        const pt = svg.querySelector('#pt_' + p.id);
        pt.setAttribute('cx', x(t)); pt.setAttribute('cy', y(dados[p.id].curva[i])); pt.style.display = '';
        html += `<br>${p.nome}: ${num(dados[p.id].curva[i], 1)} paletes guardados`;
      }
      mostrarDica(html, e);
    });
    svg.addEventListener('mouseleave', () => {
      cruz.style.display = 'none';
      svg.querySelectorAll('circle').forEach((c) => (c.style.display = 'none'));
      esconderDica();
    });
    // tabela: um ponto a cada 2 minutos
    const linhas = dados.grade.filter((_, i) => i % 4 === 0);
    $('tLinha').innerHTML = `<table><tr><th>Minuto</th>${pols.map((p) => `<th>${p.nome}</th>`).join('')}</tr>` +
      linhas.map((t) => `<tr><td>${t / 60}</td>${pols.map((p) => `<td>${num(dados[p.id].curva[dados.grade.indexOf(t)], 1)}</td>`).join('')}</tr>`).join('') + '</table>';
  }

  function graficoGiro() {
    const el = $('gGiro');
    const pols = mostrar();
    legenda('legGiro', pols);
    const W = Math.max(320, el.clientWidth), H = 250, m = { l: 36, r: 8, t: 22, b: 44 };
    const cats = ['A', 'B', 'C'];
    const vmax = Math.max(...pols.flatMap((p) => cats.map((c) => dados[p.id].porCurva[c]))) / 60 || 1;
    const py = passoBonito(vmax, 4);
    const ymax = Math.ceil(vmax / py) * py;
    const y = (v) => H - m.b - (v / ymax) * (H - m.t - m.b);
    const banda = (W - m.l - m.r) / cats.length;
    const larg = Math.min(24, (banda * 0.7) / pols.length - 2);
    let s = '';
    for (let v = 0; v <= ymax; v += py) s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    cats.forEach((c, i) => {
      const grupoW = pols.length * larg + (pols.length - 1) * 2;
      const x0 = m.l + banda * i + (banda - grupoW) / 2;
      pols.forEach((p, j) => {
        const v = dados[p.id].porCurva[c] / 60;
        const bx = x0 + j * (larg + 2), by = y(v), bh = y(0) - by;
        const tip = `<b>${NOME_GIRO[c]}</b><br>${p.nome}: ${num(v, 1)} min por palete`;
        s += `<path d="${topoArredondado(bx, by, larg, bh, 4)}" fill="${p.cor}" data-tip="${tip}"/>`;
        s += `<text class="v" x="${bx + larg / 2}" y="${by - 5}" text-anchor="middle">${num(v, 1)}</text>`;
      });
      s += `<text x="${m.l + banda * i + banda / 2}" y="${H - 22}" text-anchor="middle" style="fill:var(--ink2)">${NOME_GIRO[c]}</text>`;
      s += `<text x="${m.l + banda * i + banda / 2}" y="${H - 8}" text-anchor="middle">curva ${c}</text>`;
    });
    s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}" stroke="var(--axis)"/>`;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tempo para guardar por giro do material">${s}</svg>`;
    ligarDicas(el);
    $('tGiro').innerHTML = `<table><tr><th>Giro</th>${pols.map((p) => `<th>${p.nome} (min)</th>`).join('')}</tr>` +
      cats.map((c) => `<tr><td>${NOME_GIRO[c]}</td>${pols.map((p) => `<td>${num(dados[p.id].porCurva[c] / 60, 1)}</td>`).join('')}</tr>`).join('') + '</table>';
  }

  function graficoRua() {
    const el = $('gRua');
    const pols = mostrar();
    legenda('legRua', pols);
    const ruas = LAYOUT.ruas;
    const esp = (p, r) => dados[p.id].esperaRua[r.id] / 60;
    const vmax = Math.max(...pols.flatMap((p) => ruas.map((r) => esp(p, r)))) || 1;
    const W = Math.max(320, el.clientWidth), larg = 16, grupoH = pols.length * larg + (pols.length - 1) * 2;
    const passo = grupoH + 18, m = { l: 120, r: 46, t: 6, b: 6 };
    const H = m.t + m.b + passo * ruas.length;
    const x = (v) => (v / vmax) * (W - m.l - m.r);
    let s = '';
    ruas.forEach((r, i) => {
      const y0 = m.t + i * passo + 9;
      s += `<text x="${m.l - 10}" y="${y0 + grupoH / 2 + 4}" text-anchor="end" style="fill:var(--ink2)">${r.deposito}</text>`;
      pols.forEach((p, j) => {
        const v = esp(p, r), by = y0 + j * (larg + 2), bw = Math.max(x(v), 0.5);
        const tip = `<b>${r.deposito}</b><br>${p.nome}: ${num(v, 1)} min esperando`;
        s += `<path d="${direitaArredondada(m.l, by, bw, larg, 4)}" fill="${p.cor}" data-tip="${tip}"/>`;
        s += `<text class="v" x="${m.l + bw + 6}" y="${by + larg / 2 + 4}">${num(v, 1)} min</text>`;
      });
    });
    s += `<line x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${H - m.b}" stroke="var(--axis)"/>`;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tempo de espera por rua">${s}</svg>`;
    ligarDicas(el);
    $('tRua').innerHTML = `<table><tr><th>Depósito</th>${pols.map((p) => `<th>${p.nome} (min)</th>`).join('')}</tr>` +
      ruas.map((r) => `<tr><td>${r.deposito}</td>${pols.map((p) => `<td>${num(esp(p, r), 1)}</td>`).join('')}</tr>`).join('') + '</table>';
  }

  function renderResumo() {
    const pols = mostrar();
    const todos = [HEROI, ...KPIS];
    const cmp = estado.modo === 'comparar';
    $('resumo').innerHTML = `<table><tr><th>Indicador</th>${pols.map((p) => `<th>${p.nome}</th>`).join('')}${cmp ? '<th>Variação</th>' : ''}</tr>` +
      todos.map((ind) => `<tr><td>${ind.nome}</td>${pols.map((p) => `<td>${ind.f(dados[p.id][ind.k])} ${ind.un}</td>`).join('')}${cmp ? `<td>${textoVar(variacao(ind))}</td>` : ''}</tr>`).join('') + '</table>';
  }

  function renderTudo() {
    renderKpis(); renderLeitura(); graficoLinha(); graficoGiro(); graficoRua(); renderResumo();
  }

  // ---------- controles ----------
  function marcarBotoes(id, valor) {
    $(id).querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === valor)));
  }
  $('modo').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    estado.modo = b.dataset.v; marcarBotoes('modo', estado.modo); renderTudo();
  });
  $('visao').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    estado.visao = b.dataset.v; marcarBotoes('visao', estado.visao);
    $('grpDia').style.display = estado.visao === 'dia' ? '' : 'none';
    recalcular();
  });
  let temporizador = null;
  function recalcular() {
    $('conteudo').classList.add('carregando');
    clearTimeout(temporizador);
    temporizador = setTimeout(() => { calcular(); renderTudo(); $('conteudo').classList.remove('carregando'); }, 30);
  }
  ['dia', 'nOps', 'nTarefas', 'fundo'].forEach((id) => $(id).addEventListener('change', recalcular));
  $('giro').addEventListener('input', () => { $('giroTxt').textContent = $('giro').value + '%'; });
  $('giro').addEventListener('change', recalcular);
  let redim = null;
  window.addEventListener('resize', () => { clearTimeout(redim); redim = setTimeout(() => dados && (graficoLinha(), graficoGiro(), graficoRua()), 120); });

  // ---------- tela cheia (F11) ----------
  // F11 vira o modo painel de TV: a página entra em tela cheia e mostra só os indicadores principais.
  const mqTela = window.matchMedia('(display-mode: fullscreen)');
  function atualizarTela() {
    document.body.classList.toggle('tv', !!document.fullscreenElement || mqTela.matches);
    if (dados) setTimeout(() => { graficoLinha(); graficoGiro(); graficoRua(); }, 150);
  }
  function alternarTela() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'F11') { e.preventDefault(); alternarTela(); } });
  document.addEventListener('fullscreenchange', atualizarTela);
  mqTela.addEventListener('change', atualizarTela);
  $('telaCheia').addEventListener('click', alternarTela);
  if (location.search.includes('tv')) document.body.classList.add('tv'); // para testar o modo sem entrar em tela cheia

  calcular();
  renderTudo();
})();
