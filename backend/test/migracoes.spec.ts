import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { listarMigracoes } from '../src/persistencia/postgres/migracoes';

describe('migrações versionadas (arquivos)', () => {
  it('ordena por versão e calcula o checksum', () => {
    const dir = mkdtempSync(join(tmpdir(), 'migr-'));
    writeFileSync(join(dir, '0002_segunda.sql'), 'SELECT 2;');
    writeFileSync(join(dir, '0001_primeira.sql'), 'SELECT 1;');
    writeFileSync(join(dir, 'LEIAME.md'), 'ignorado');
    const m = listarMigracoes(dir);
    expect(m.map((x) => x.nome)).toEqual(['0001_primeira.sql', '0002_segunda.sql']);
    expect(m[0].checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('recusa nome fora do padrão NNNN_descricao.sql', () => {
    const dir = mkdtempSync(join(tmpdir(), 'migr-'));
    writeFileSync(join(dir, 'criar-tabela.sql'), 'SELECT 1;');
    expect(() => listarMigracoes(dir)).toThrow(/Nome de migração inválido/);
  });

  it('a pasta do projeto tem só a migração das Estruturas Concretas (nada de Avaliações, Taxonomia ou Mapa)', () => {
    expect(listarMigracoes(join(__dirname, '..', 'migracoes')).map((m) => m.nome)).toEqual(['0001_estruturas_concretas.sql', '0002_alocacao_divergente_colaboradoras.sql']);
  });
});
