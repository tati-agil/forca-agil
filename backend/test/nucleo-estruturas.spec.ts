import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { CAMINHO_NUCLEO_ESTRUTURAS, nucleoEstruturas } from '../src/nucleo/estruturas';

/* O backend usa o núcleo de Estruturas Concretas do site SEM reescrita nem cópia: a mesma fonte, o mesmo
   comportamento. Dados sintéticos (nenhuma estrutura real). */
const RAIZ = resolve(__dirname, '..', '..');

describe('reaproveitamento do núcleo de Estruturas Concretas', () => {
  it('carrega exatamente o arquivo do site (fonte única)', () => {
    expect(CAMINHO_NUCLEO_ESTRUTURAS).toBe(join(RAIZ, 'forca-agil', 'estruturas-nucleo.js'));
    expect(nucleoEstruturas).toBe(require(join(RAIZ, 'forca-agil', 'estruturas-nucleo.js')));
  });

  it('nenhuma cópia do núcleo dentro de backend/', () => {
    const achados: string[] = [];
    const varrer = (dir: string) => readdirSync(dir, { withFileTypes: true }).forEach((d) => {
      if (['node_modules', 'dist'].includes(d.name)) return;
      const p = join(dir, d.name);
      if (d.isDirectory()) varrer(p);
      else if (/\.(js|ts)$/.test(d.name) && /function criarEstrutura\s*\(|function vincularResponsavel\s*\(/.test(readFileSync(p, 'utf8'))) achados.push(p);
    });
    varrer(join(RAIZ, 'backend'));
    expect(achados).toEqual([]);
  });

  it('executa uma operação do núcleo com os mesmos resultados do site', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nucleo: any = nucleoEstruturas;
    const ref = {
      conceitos: { NEGOCIOS: { ativo: true } }, relacoesConceituais: [], ligacoes: { NEGOCIOS: 'NEGOCIOS' },
      codigosFirmes: ['NEGOCIOS'], conceitosTrabalho: []
    };
    const ctx = { operacaoId: 'op-sintetica', novoId: 'est-sintetica', usuario: { id: 'u-sintetico' }, agora: '2026-10-11T12:00:00.000Z' };
    const r = nucleo.criarEstrutura({}, { tipo: 'NEGOCIOS', nome: 'Estrutura Sintética' }, ctx, ref);
    expect(r.ok).toBe(true);
    expect(r.mudancas?.[0]).toMatchObject({ entidade: 'estrutura', id: 'est-sintetica', antes: null, revisaoAnterior: null });
    const aplicado = nucleo.aplicar({}, r.mudancas);
    expect(aplicado.ok).toBe(true);
    const v = nucleo.vincularResponsavel(aplicado.estado, { objetoId: 'obj-sintetico', estruturaId: 'est-sintetica' },
      { avaliacaoId: 'aval-sintetica', recomendacao: { codigoResultado: 'NEGOCIOS' } }, { ...ctx, operacaoId: 'op2', novoId: 'v1' }, ref);
    expect(v.ok).toBe(true);
    const s = nucleo.situacaoResponsavel(nucleo.aplicar(aplicado.estado, v.mudancas).estado, 'obj-sintetico',
      { avaliacaoId: 'aval-sintetica', recomendacao: { codigoResultado: 'NEGOCIOS' } }, ref);
    expect(s.situacao).toBe('valido');
  });

  it('o arquivo do núcleo continua puro (sem Firebase, NestJS ou banco)', () => {
    const fonte = readFileSync(CAMINHO_NUCLEO_ESTRUTURAS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(fonte).not.toMatch(/firebase|@nestjs|require\(|from 'pg'/);
    expect(existsSync(CAMINHO_NUCLEO_ESTRUTURAS)).toBe(true);
  });
});
