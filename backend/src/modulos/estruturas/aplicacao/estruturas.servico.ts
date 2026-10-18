import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import type { Acesso } from '../../../compartilhado/autenticacao/guarda-acesso';
import { Entidade, ErroNucleo, Estado, Evento, nucleoEstruturas as N, PosicionamentoVigente, Referencias, Registro, ResultadoOperacao, SituacaoCalculada } from '../../../nucleo/estruturas';
import { CODIGOS_FIRMES } from '../../../nucleo/posicionamento';
import { REPOSITORIO_ESTRUTURAS, RepositorioEstruturas } from '../../../persistencia/contratos/repositorio-estruturas';
import { ExecutorSql, UNIDADE_DE_TRABALHO, UnidadeDeTrabalho } from '../../../persistencia/contratos/unidade-de-trabalho';
import { FONTE_POSICIONAMENTO, FONTE_TAXONOMIA, FontePosicionamento, FonteTaxonomia, ReferenciaOficialIndisponivel } from './portas';

/* CAMADA 1 (aplicação) — casos de uso das Estruturas Organizacionais Concretas.
   Toda REGRA é do núcleo (forca-agil/estruturas-nucleo.js). Aqui só se orquestra, sempre do mesmo jeito:
     1. lê as referências oficiais (Taxonomia, códigos firmes do motor, Posicionamento vigente) — sem elas, recusa;
     2. abre UMA unidade de trabalho serializável, lê o estado, chama a operação do núcleo com o contexto do servidor
        (identificadores novos, horário e o usuário do TOKEN) e grava operação + mudanças + eventos juntos.
   Sob concorrência a transação é repetida e o núcleo revalida tudo sobre o estado novo (docs/estruturas-nucleo-
   contratos.md, "Invariantes que dependem de outros registros"). */

export class OperacaoRecusada extends Error {
  constructor(readonly erros: ErroNucleo[]) { super('OPERACAO_RECUSADA'); this.name = 'OperacaoRecusada'; }
}
export class NaoEncontrado extends Error {
  constructor(readonly entidade: Entidade, readonly id: string) { super(entidade.toUpperCase() + '_INEXISTENTE'); this.name = 'NaoEncontrado'; }
}
export class IdempotenciaConflitante extends Error {
  constructor() { super('CHAVE_DE_IDEMPOTENCIA_REUTILIZADA'); this.name = 'IdempotenciaConflitante'; }
}

type Contexto = { operacaoId: string; novoId: string; usuario: { id: string; email: string }; agora: string };
type Montar = (estado: Estado, ctx: Contexto) => ResultadoOperacao;
/* nomes das chaves da resposta, na ordem das mudanças do núcleo (ex.: substituição = ['encerrada', 'relacao']) */
type Nomes = string[];

const COLECAO: Record<Entidade, keyof Estado> = { estrutura: 'estruturas', relacao: 'relacoes', vinculo: 'vinculos' };
const INDETERMINADA = (fonte: string): SituacaoCalculada => ({ situacao: 'indeterminada', motivos: ['REFERENCIA_OFICIAL_INDISPONIVEL'], fonte });

@Injectable()
export class EstruturasServico {
  constructor(
    @Inject(UNIDADE_DE_TRABALHO) private readonly uow: UnidadeDeTrabalho,
    @Inject(REPOSITORIO_ESTRUTURAS) private readonly repo: RepositorioEstruturas,
    @Inject(FONTE_TAXONOMIA) private readonly taxonomia: FonteTaxonomia,
    @Inject(FONTE_POSICIONAMENTO) private readonly posicionamento: FontePosicionamento
  ) {}

  /* referências oficiais completas: Taxonomia (fonte oficial) + códigos firmes (motor de Posicionamento) */
  private async referencias(): Promise<Referencias> {
    return { ...(await this.taxonomia.referencias()), codigosFirmes: CODIGOS_FIRMES.slice() };
  }

  /* ---------------- execução de uma operação que grava ---------------- */
  private async executar(acesso: Acesso, operacao: string, pedido: unknown, chave: string | null, alvo: [Entidade, string] | null, nomes: Nomes, montar: Montar) {
    const usuario = { id: acesso.identidade.uid, email: acesso.identidade.email };
    const digest = chave ? createHash('sha256').update(JSON.stringify({ operacao, pedido })).digest('hex') : null;
    return this.uow.executar(async (sql) => {
      if (chave) {
        const anterior = await this.repo.operacaoPorChave(sql, usuario.id, chave);
        if (anterior) {
          if (anterior.digestPedido !== digest) throw new IdempotenciaConflitante();
          return anterior.resposta; /* repetição do mesmo pedido: a mesma resposta, nada gravado de novo */
        }
      }
      const estado = await this.repo.lerEstado(sql);
      if (alvo && !estado[COLECAO[alvo[0]]][alvo[1]]) throw new NaoEncontrado(alvo[0], alvo[1]);
      const ctx: Contexto = { operacaoId: randomUUID(), novoId: randomUUID(), usuario, agora: new Date().toISOString() };
      const r = montar(estado, ctx);
      if (!r.ok) throw new OperacaoRecusada(r.erros);
      const resposta: Record<string, unknown> = { operacaoId: ctx.operacaoId };
      r.mudancas.forEach((m, i) => { resposta[nomes[i] || 'registro' + i] = m.depois; });
      await this.repo.gravar(sql, { id: ctx.operacaoId, operacao, usuarioId: usuario.id, chaveIdempotencia: chave, digestPedido: digest, resposta, em: ctx.agora }, r.mudancas, r.eventos);
      return resposta;
    });
  }

  private ler<T>(trabalho: (sql: ExecutorSql) => Promise<T>): Promise<T> { return this.uow.executar(trabalho); }

  /* ---------------- estruturas ---------------- */
  async criarEstrutura(acesso: Acesso, dados: Record<string, unknown>, chave: string | null) {
    const ref = await this.referencias();
    return this.executar(acesso, 'estrutura.criar', dados, chave, null, ['estrutura'], (e, ctx) => N.criarEstrutura(e, dados, ctx, ref));
  }
  async alterarEstrutura(acesso: Acesso, id: string, alteracoes: Record<string, unknown>, opcoes: { justificativa?: unknown; revisaoEsperada?: number }, chave: string | null) {
    return this.executar(acesso, 'estrutura.alterar', { id, alteracoes, opcoes }, chave, ['estrutura', id], ['estrutura'], (e, ctx) => N.alterarEstrutura(e, id, alteracoes, ctx, opcoes));
  }
  async encerrarEstrutura(acesso: Acesso, id: string, motivo: unknown, opcoes: { revisaoEsperada?: number }, chave: string | null) {
    return this.executar(acesso, 'estrutura.encerrar', { id, motivo, opcoes }, chave, ['estrutura', id], ['estrutura'], (e, ctx) => N.encerrarEstrutura(e, id, motivo, ctx, opcoes));
  }
  async listarEstruturas(filtro: { situacao: 'ativa' | 'encerrada' | 'todas'; tipo?: string }) {
    const estado = await this.ler((sql) => this.repo.lerEstado(sql));
    return Object.values(estado.estruturas)
      .filter((s) => (filtro.situacao === 'todas' || s.situacao === filtro.situacao) && (!filtro.tipo || s.tipo === filtro.tipo))
      .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  }
  async obterEstrutura(id: string) {
    const estado = await this.ler((sql) => this.repo.lerEstado(sql));
    const estrutura = estado.estruturas[id];
    if (!estrutura) throw new NaoEncontrado('estrutura', id);
    return { estrutura, relacoes: N.relacoesDaEstrutura(estado, id, { incluirEncerradas: true }), objetos: N.objetosDaEstrutura(estado, id) };
  }

  /* ---------------- relações ---------------- */
  async criarRelacao(acesso: Acesso, dados: Record<string, unknown>, chave: string | null) {
    const ref = await this.referencias();
    return this.executar(acesso, 'relacao.criar', dados, chave, null, ['relacao'], (e, ctx) => N.criarRelacao(e, dados, ctx, ref));
  }
  async substituirRelacao(acesso: Acesso, id: string, novos: Record<string, unknown>, motivo: unknown, chave: string | null) {
    const ref = await this.referencias();
    return this.executar(acesso, 'relacao.substituir', { id, novos, motivo }, chave, ['relacao', id], ['encerrada', 'relacao'], (e, ctx) => N.alterarRelacao(e, id, novos, motivo, ctx, ref));
  }
  async encerrarRelacao(acesso: Acesso, id: string, motivo: unknown, chave: string | null) {
    return this.executar(acesso, 'relacao.encerrar', { id, motivo }, chave, ['relacao', id], ['relacao'], (e, ctx) => N.encerrarRelacao(e, id, motivo, ctx));
  }
  /* cada relação com a situação CALCULADA pelo núcleo (válida / a revisar / encerrada); sem a Taxonomia, indeterminada */
  async listarRelacoes(filtro: { situacao: 'ativa' | 'encerrada' | 'todas'; aRevisar: boolean }) {
    const ref = await this.referencias().catch((e) => { if (e instanceof ReferenciaOficialIndisponivel) return null; throw e; });
    const estado = await this.ler((sql) => this.repo.lerEstado(sql));
    return Object.values(estado.relacoes)
      .filter((r) => filtro.situacao === 'todas' || r.situacao === filtro.situacao)
      .map((relacao) => ({ relacao, avaliacao: ref ? N.situacaoRelacao(estado, relacao.id, ref) : INDETERMINADA('taxonomia') }))
      .filter((x) => !filtro.aRevisar || x.avaliacao?.situacao === 'a-revisar' || x.avaliacao?.situacao === 'indeterminada');
  }
  async obterRelacao(id: string) {
    const ref = await this.referencias().catch((e) => { if (e instanceof ReferenciaOficialIndisponivel) return null; throw e; });
    const estado = await this.ler((sql) => this.repo.lerEstado(sql));
    const relacao = estado.relacoes[id];
    if (!relacao) throw new NaoEncontrado('relacao', id);
    return { relacao, avaliacao: ref ? N.situacaoRelacao(estado, id, ref) : INDETERMINADA('taxonomia') };
  }

  /* ---------------- responsável principal ---------------- */
  async vincularResponsavel(acesso: Acesso, objetoId: string, dados: Record<string, unknown>, chave: string | null) {
    const ref = await this.referencias();
    const p = await this.posicionamento.vigenteDoObjeto(objetoId);
    const d = { ...dados, objetoId };
    return this.executar(acesso, 'vinculo.criar', d, chave, null, ['vinculo'], (e, ctx) => N.vincularResponsavel(e, d, p, ctx, ref));
  }
  /* E3: estrutura colaboradora (mesmo registro de vínculo, papel 'colaboradora'); as regras são do núcleo */
  async vincularColaboradora(acesso: Acesso, objetoId: string, dados: Record<string, unknown>, chave: string | null) {
    const ref = await this.referencias();
    const p = await this.posicionamento.vigenteDoObjeto(objetoId);
    const d = { ...dados, objetoId };
    return this.executar(acesso, 'vinculo.colaboradora', d, chave, null, ['vinculo'], (e, ctx) => N.vincularColaboradora(e, d, p, ctx, ref));
  }
  async substituirResponsavel(acesso: Acesso, vinculoId: string, dados: Record<string, unknown>, motivo: unknown, chave: string | null) {
    const ref = await this.referencias();
    /* o objeto de um vínculo é imutável: dá para saber de quem é o Posicionamento antes da transação */
    const atual = (await this.ler((sql) => this.repo.lerEstado(sql))).vinculos[vinculoId];
    if (!atual) throw new NaoEncontrado('vinculo', vinculoId);
    const p = await this.posicionamento.vigenteDoObjeto(String(atual.objetoId));
    return this.executar(acesso, 'vinculo.substituir', { vinculoId, dados, motivo }, chave, ['vinculo', vinculoId], ['encerrado', 'vinculo'],
      (e, ctx) => N.substituirResponsavel(e, vinculoId, dados, motivo, p, ctx, ref));
  }
  async encerrarVinculo(acesso: Acesso, id: string, motivo: unknown, chave: string | null) {
    return this.executar(acesso, 'vinculo.encerrar', { id, motivo }, chave, ['vinculo', id], ['vinculo'], (e, ctx) => N.encerrarVinculo(e, id, motivo, ctx));
  }
  /* situação CALCULADA (válido / ausente / precisa de revisão / não aplicável); nada é gravado nem corrigido sozinho */
  async responsavelDoObjeto(objetoId: string) {
    let ref: Referencias | null = null, p: PosicionamentoVigente | null = null, indisponivel: string | null = null;
    try { ref = await this.referencias(); p = await this.posicionamento.vigenteDoObjeto(objetoId); }
    catch (e) { if (!(e instanceof ReferenciaOficialIndisponivel)) throw e; indisponivel = e.fonte; }
    const estado = await this.ler((sql) => this.repo.lerEstado(sql));
    if (indisponivel || !ref) return { objetoId, vinculo: N.responsavelAtivo(estado, objetoId), ...INDETERMINADA(indisponivel || 'taxonomia') };
    return { objetoId, ...N.situacaoResponsavel(estado, objetoId, p, ref), colaboradoras: N.situacaoColaboradoras(estado, objetoId, p, ref) };
  }
  async obterVinculo(id: string) {
    const vinculo = (await this.ler((sql) => this.repo.lerEstado(sql))).vinculos[id];
    if (!vinculo) throw new NaoEncontrado('vinculo', id);
    return { vinculo };
  }

  /* ---------------- histórico (eventos só de acréscimo, ordenados pelo núcleo) ---------------- */
  async historico(entidade: Entidade, id: string): Promise<{ eventos: Evento[] }> {
    return this.ler(async (sql) => {
      const estado = await this.repo.lerEstado(sql);
      if (!(estado[COLECAO[entidade]] as Record<string, Registro>)[id]) throw new NaoEncontrado(entidade, id);
      return { eventos: N.historico(await this.repo.eventosDe(sql, entidade, id), entidade, id) };
    });
  }
}
