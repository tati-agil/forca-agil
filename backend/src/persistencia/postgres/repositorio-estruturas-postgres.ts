import { Injectable } from '@nestjs/common';
import type { Entidade, Estado, Evento, Mudanca, Registro } from '../../nucleo/estruturas';
import { ConflitoDeRevisao, OperacaoRegistrada, RepositorioEstruturas, ViolacaoDeIntegridade } from '../contratos/repositorio-estruturas';
import type { ExecutorSql } from '../contratos/unidade-de-trabalho';

/* Adaptador PostgreSQL das Estruturas Concretas (migracoes/0001_estruturas_concretas.sql). Grava exatamente o que o
   núcleo produziu: cada registro guarda o objeto inteiro em "dados" e as colunas são cópias para índice e restrição.
   Não decide regra de negócio; só traduz recusas do banco (revisão, duplicidade) para os erros do contrato. */

type Coluna = (r: Registro) => unknown;
const TABELAS: Record<Entidade, { tabela: string; colunas: Record<string, Coluna> }> = {
  estrutura: { tabela: 'estruturas', colunas: { tipo: (r) => r.tipo, nome: (r) => r.nome, sigla: (r) => r.sigla ?? null } },
  relacao: { tabela: 'estruturas_relacoes', colunas: { origem: (r) => r.origem, tipo: (r) => r.tipo, destino: (r) => r.destino } },
  vinculo: { tabela: 'estruturas_vinculos', colunas: { objeto_id: (r) => r.objetoId, estrutura_id: (r) => r.estruturaId, papel: (r) => r.papel } }
};

/* restrições do banco que correspondem a regras do núcleo */
const RESTRICAO_PARA_CODIGO: Record<string, string> = {
  estruturas_vinculos_responsavel_unico: 'RESPONSAVEL_PRINCIPAL_JA_EXISTE',
  estruturas_vinculos_colaboradora_unica: 'COLABORADORA_JA_EXISTE',
  estruturas_relacoes_ativa_unica: 'RELACAO_DUPLICADA'
};

function traduzir(e: unknown, entidade: string, id: string): never {
  const erro = e as { code?: string; constraint?: string };
  if (erro.code === '23505') {
    if (erro.constraint && RESTRICAO_PARA_CODIGO[erro.constraint]) throw new ViolacaoDeIntegridade(RESTRICAO_PARA_CODIGO[erro.constraint]);
    throw new ConflitoDeRevisao(entidade, id); /* identificador já existente */
  }
  throw e; /* 40001/40P01 seguem para a unidade de trabalho repetir; o resto é erro de verdade */
}

@Injectable()
export class RepositorioEstruturasPostgres implements RepositorioEstruturas {
  async lerEstado(sql: ExecutorSql): Promise<Estado> {
    const ler = async (tabela: string) => {
      const linhas = await sql.consultar<{ dados: Registro }>(`SELECT dados FROM ${tabela}`);
      return Object.fromEntries(linhas.map((l) => [l.dados.id, l.dados]));
    };
    return { estruturas: await ler('estruturas'), relacoes: await ler('estruturas_relacoes'), vinculos: await ler('estruturas_vinculos') };
  }

  async eventosDe(sql: ExecutorSql, entidade: Entidade, id: string): Promise<Evento[]> {
    const linhas = await sql.consultar<{ dados: Evento }>('SELECT dados FROM estruturas_eventos WHERE entidade = $1 AND entidade_id = $2 ORDER BY seq', [entidade, id]);
    return linhas.map((l) => l.dados);
  }

  async operacaoPorChave(sql: ExecutorSql, usuarioId: string, chave: string): Promise<OperacaoRegistrada | null> {
    const linhas = await sql.consultar<{ id: string; operacao: string; usuario_id: string; chave_idempotencia: string; digest_pedido: string; resposta: unknown; em: Date }>(
      'SELECT id, operacao, usuario_id, chave_idempotencia, digest_pedido, resposta, em FROM estruturas_operacoes WHERE usuario_id = $1 AND chave_idempotencia = $2', [usuarioId, chave]);
    const l = linhas[0];
    return l ? { id: l.id, operacao: l.operacao, usuarioId: l.usuario_id, chaveIdempotencia: l.chave_idempotencia, digestPedido: l.digest_pedido, resposta: l.resposta, em: l.em.toISOString() } : null;
  }

  async gravar(sql: ExecutorSql, op: OperacaoRegistrada, mudancas: Mudanca[], eventos: Evento[]): Promise<void> {
    await sql.consultar('INSERT INTO estruturas_operacoes (id, operacao, usuario_id, chave_idempotencia, digest_pedido, resposta, em) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [op.id, op.operacao, op.usuarioId, op.chaveIdempotencia, op.digestPedido, JSON.stringify(op.resposta ?? null), op.em]).catch((e) => traduzir(e, 'operacao', op.id));
    /* na ordem do núcleo: numa substituição, o encerramento vem antes da criação (o índice único vê um só ativo) */
    for (const m of mudancas) {
      const { tabela, colunas } = TABELAS[m.entidade];
      const nomes = Object.keys(colunas);
      const valores = [m.depois.id, ...nomes.map((n) => colunas[n](m.depois)), m.depois.situacao, m.depois.revisao, JSON.stringify(m.depois)];
      if (m.antes === null) {
        const lista = ['id', ...nomes, 'situacao', 'revisao', 'dados'];
        await sql.consultar(`INSERT INTO ${tabela} (${lista.join(', ')}) VALUES (${lista.map((_, i) => '$' + (i + 1)).join(', ')})`, valores)
          .catch((e) => traduzir(e, m.entidade, m.id));
      } else {
        const sets = [...nomes, 'situacao', 'revisao', 'dados'].map((n, i) => `${n} = $${i + 2}`).join(', ');
        const linhas = await sql.consultar(`UPDATE ${tabela} SET ${sets} WHERE id = $1 AND revisao = $${valores.length + 1} RETURNING id`, [...valores, m.revisaoAnterior])
          .catch((e) => traduzir(e, m.entidade, m.id));
        if (!linhas.length) throw new ConflitoDeRevisao(m.entidade, m.id);
      }
    }
    for (const ev of eventos) {
      await sql.consultar('INSERT INTO estruturas_eventos (id, operacao_id, tipo, entidade, entidade_id, usuario_id, em, dados) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [ev.id, ev.operacaoId, ev.tipo, ev.entidade, ev.entidadeId, ev.usuario.id, ev.em, JSON.stringify(ev)]).catch((e) => traduzir(e, 'evento', ev.id));
    }
  }
}
