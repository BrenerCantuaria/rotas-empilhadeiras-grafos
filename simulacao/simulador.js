(function (root) {
  const R = typeof require !== 'undefined' ? null : root.Rotas;
  const { construirGrafo, menorCaminho } = R || require('../algoritmo/grafo');
  const { PARAMS_PADRAO, noDestino, tempoOperacao, escolherTarefa } = R || require('../algoritmo/prioridade');

  // Simulação por passos de tempo. Regra de bloqueio (suposição declarada no contexto):
  // só a empilhadeira PARADA operando (posicionando, elevando, guardando) bloqueia o trecho.
  // Quem está em movimento passa. Quem precisa entrar num nó ocupado espera.
  class Simulador {
    constructor({ layout, tarefas, politica = 'algoritmo', params = {}, nOperadores = 5 }) {
      this.layout = layout;
      this.grafo = construirGrafo(layout);
      this.politica = politica;
      this.params = { ...PARAMS_PADRAO, ...params };
      this.t = 0;
      this.futuras = tarefas.map((x) => ({ ...x })); // cópia: o mesmo cenário roda em várias políticas
      this.totalTarefas = tarefas.length;
      this.esperaPorRua = {}; // segundos de espera acumulados por rua (para o painel)
      this.fila = []; // tarefas já criadas e ainda sem operador, em ordem de chegada
      this.concluidas = [];
      this.bloqueios = 0;
      this.ops = [];
      for (let i = 0; i < nOperadores; i++) {
        this.ops.push({
          id: i, estado: 'ocioso', caminho: ['REC'], i: 0, prog: 0, tarefa: null, restante: 0,
          esperando: false, tempoEspera: 0, distancia: 0,
          x: this.grafo.nos.REC.x, z: this.grafo.nos.REC.z,
        });
      }
    }

    contexto() {
      return { layout: this.layout, grafo: this.grafo, params: this.params, operadores: this.ops };
    }

    // Nó ocupado por empilhadeira parada operando (exceto a própria).
    bloqueado(no, op) {
      return this.ops.some((o) => o !== op && o.estado === 'operando' && noDestino(o.tarefa) === no);
    }

    // Peso dinâmico: custo extra de entrar num nó = tempo restante de quem está operando nele.
    custoOcupacao(no, op) {
      let c = 0;
      for (const o of this.ops) {
        if (o !== op && o.estado === 'operando' && noDestino(o.tarefa) === no) c += Math.max(0, o.restante);
      }
      return c;
    }

    step(dt) {
      while (this.futuras.length && this.futuras[0].criacao <= this.t) this.fila.push(this.futuras.shift());
      this.despachar();
      for (const op of this.ops) this.atualizar(op, dt);
      this.t += dt;
    }

    despachar() {
      for (const op of this.ops) {
        if (op.estado !== 'ocioso' || this.fila.length === 0) continue;
        const tarefa = escolherTarefa(this.politica, this.fila, this.contexto());
        this.fila.splice(this.fila.indexOf(tarefa), 1);
        tarefa.inicio = this.t;
        op.tarefa = tarefa;
        op.estado = 'pegando';
        op.restante = this.layout.tempoPegar;
      }
    }

    atualizar(op, dt) {
      if (op.estado === 'pegando') {
        op.restante -= dt;
        if (op.restante <= 0) {
          const rota = menorCaminho(this.grafo, 'REC', noDestino(op.tarefa), (no) => this.custoOcupacao(no, op));
          op.caminho = rota.caminho;
          op.i = 0;
          op.prog = 0;
          op.estado = 'indo';
        }
      } else if (op.estado === 'operando') {
        op.restante -= dt;
        if (op.restante <= 0) {
          op.tarefa.fim = this.t;
          this.concluidas.push(op.tarefa);
          op.tarefa.guardada = true;
          op.caminho = op.caminho.slice().reverse();
          op.i = 0;
          op.prog = 0;
          op.estado = 'voltando';
          op.carga = op.tarefa;
          op.tarefa = null;
        }
      } else if (op.estado === 'indo' || op.estado === 'voltando') {
        this.mover(op, dt);
      }
      this.posicionar(op);
    }

    mover(op, dt) {
      const atual = this.grafo.nos[op.caminho[op.i]];
      const prox = op.caminho[op.i + 1];
      const aresta = atual.vizinhos.find((v) => v.para === prox);
      const passo = dt / aresta.tempo;
      // Espera se o próximo nó está ocupado e a empilhadeira ainda não entrou, ou está terminando de entrar.
      if (this.bloqueado(prox, op) && (op.prog === 0 || op.prog + passo >= 1)) {
        if (!op.esperando) {
          op.esperando = true;
          this.bloqueios++;
        }
        op.tempoEspera += dt;
        const rua = (op.tarefa || op.carga).endereco.rua;
        this.esperaPorRua[rua] = (this.esperaPorRua[rua] || 0) + dt;
        return;
      }
      op.esperando = false;
      const andou = Math.min(passo, 1 - op.prog);
      op.distancia += aresta.dist * andou;
      op.prog += andou;
      if (op.prog >= 1) {
        op.prog = 0;
        op.i++;
        if (op.i === op.caminho.length - 1) this.chegou(op);
      }
    }

    chegou(op) {
      if (op.estado === 'indo') {
        op.estado = 'operando';
        op.restante = tempoOperacao(this.layout, op.tarefa);
      } else {
        op.estado = 'ocioso';
        op.carga = null;
        op.caminho = ['REC'];
        op.i = 0;
      }
    }

    posicionar(op) {
      const a = this.grafo.nos[op.caminho[op.i]];
      const b = this.grafo.nos[op.caminho[op.i + 1]];
      op.x = b ? a.x + (b.x - a.x) * op.prog : a.x;
      op.z = b ? a.z + (b.z - a.z) * op.prog : a.z;
    }

    terminou() {
      return this.futuras.length === 0 && this.fila.length === 0 && this.ops.every((o) => o.estado === 'ocioso');
    }

    executar(passo = 0.5, limite = 20000) {
      while (!this.terminou() && this.t < limite) this.step(passo);
      return this.metricas();
    }

    metricas() {
      const c = this.concluidas;
      const media = (lista) => (lista.length ? lista.reduce((s, x) => s + x, 0) / lista.length : 0);
      const ciclo = (t) => t.fim - t.criacao;
      return {
        tempoTotal: Math.round(c.reduce((m, t) => Math.max(m, t.fim), 0)),
        esperaBloqueio: Math.round(this.ops.reduce((s, o) => s + o.tempoEspera, 0)),
        distancia: Math.round(this.ops.reduce((s, o) => s + o.distancia, 0)),
        bloqueios: this.bloqueios,
        cicloMedio: Math.round(media(c.map(ciclo))),
        cicloMedioCurvaA: Math.round(media(c.filter((t) => t.material.curva === 'A').map(ciclo))),
        concluidas: c.length,
      };
    }
  }

  const api = { Simulador };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Rotas = Object.assign(root.Rotas || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
