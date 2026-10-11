import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';

/* As três camadas convivem no mesmo projeto, mas as dependências só vão num sentido:
     API e aplicação (modulos/*)  →  contratos (portas e persistencia/contratos)  ←  adaptadores (persistencia/postgres)
     Núcleo (src/nucleo)  →  nada de infraestrutura */
const SRC = join(__dirname, '..', 'src');

function arquivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? arquivos(join(dir, d.name)) : d.name.endsWith('.ts') ? [join(dir, d.name)] : []));
}
function importsDe(arquivo: string): string[] {
  return [...readFileSync(arquivo, 'utf8').matchAll(/from\s+'([^']+)'|require\('([^']+)'\)/g)].map((m) => m[1] || m[2]);
}
const rel = (f: string) => relative(SRC, f).replace(/\\/g, '/');

describe('arquitetura em camadas', () => {
  const todos = arquivos(SRC);

  it('o Núcleo não importa NestJS, banco nem Firebase', () => {
    todos.filter((f) => rel(f).startsWith('nucleo/')).forEach((f) => {
      importsDe(f).forEach((i) => expect([f, i]).not.toEqual([f, expect.stringMatching(/^@nestjs|^pg$|firebase|persistencia|modulos/)]));
    });
  });

  it('API e aplicação não importam o adaptador PostgreSQL nem o driver', () => {
    todos.filter((f) => /^modulos\/[^/]+\/(api|aplicacao)\//.test(rel(f))).forEach((f) => {
      importsDe(f).forEach((i) => expect([f, i]).not.toEqual([f, expect.stringMatching(/persistencia\/postgres|^pg$/)]));
    });
  });

  it('os contratos de persistência não dependem de banco nem de NestJS', () => {
    todos.filter((f) => rel(f).startsWith('persistencia/contratos/')).forEach((f) => {
      importsDe(f).forEach((i) => expect([f, i]).not.toEqual([f, expect.stringMatching(/^pg$|^@nestjs|postgres/)]));
    });
  });

  it('só a camada de persistência usa o driver do PostgreSQL', () => {
    const usam = todos.filter((f) => importsDe(f).includes('pg')).map(rel);
    expect(usam.every((f) => f.startsWith('persistencia/postgres/') || f === 'persistencia/persistencia.module.ts')).toBe(true);
  });

  it('o backend só VALIDA o ID token do Firebase: sem SDK do Firebase e sem acesso ao banco do site', () => {
    todos.forEach((f) => expect([rel(f), /firebase-admin|firebase\/|from 'firebase'|firebaseio\.com|firebasedatabase\.app/.test(readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''))]).toEqual([rel(f), false]));
  });

  it('o núcleo e as fontes oficiais não dependem do adaptador PostgreSQL; casos de uso só conhecem portas', () => {
    todos.filter((f) => /^modulos\/estruturas\//.test(rel(f))).forEach((f) => {
      importsDe(f).forEach((i) => expect([f, i]).not.toEqual([f, expect.stringMatching(/persistencia\/postgres|^pg$|^jose$/)]));
    });
  });
});
