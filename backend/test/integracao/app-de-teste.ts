import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { configurarAplicacao } from '../../src/aplicacao';
import { FONTE_PERFIS } from '../../src/compartilhado/autenticacao/perfis';
import { VERIFICADOR_IDENTIDADE } from '../../src/compartilhado/autenticacao/verificador-identidade';
import { Configuracao } from '../../src/configuracao/configuracao';
import { FONTE_POSICIONAMENTO, FONTE_TAXONOMIA } from '../../src/modulos/estruturas/aplicacao/portas';
import { POOL_POSTGRES } from '../../src/persistencia/postgres/pool';
import { EMAILS, EmissorSintetico, PerfisSinteticos, PosicionamentoSintetico, TaxonomiaSintetica } from '../sinteticos';

/* A aplicação INTEIRA (mesmos módulos, guarda, filtros, casos de uso, núcleo e adaptador PostgreSQL) apontada para
   um schema próprio do PostgreSQL real. Só o que é externo é trocado, sempre por algo sintético e identificado:
   o conjunto de chaves que assina os tokens (o verificador é o da aplicação), os perfis e as fontes oficiais. */
export interface AppDeTeste {
  app: INestApplication;
  taxonomia: TaxonomiaSintetica;
  posicionamento: PosicionamentoSintetico;
  auth: Record<keyof typeof EMAILS, string>;
}

export async function montarAppDeTeste(configuracao: Configuracao, pool: Pool): Promise<AppDeTeste> {
  const taxonomia = new TaxonomiaSintetica(), posicionamento = new PosicionamentoSintetico();
  const emissor = await EmissorSintetico.criar();
  const auth = {} as Record<keyof typeof EMAILS, string>;
  for (const [k, email] of Object.entries(EMAILS)) auth[k as keyof typeof EMAILS] = 'Bearer ' + (await emissor.token(email));
  const modulo = await Test.createTestingModule({ imports: [AppModule.com(configuracao)] })
    .overrideProvider(POOL_POSTGRES).useValue(pool)
    .overrideProvider(VERIFICADOR_IDENTIDADE).useValue(emissor.verificador())
    .overrideProvider(FONTE_PERFIS).useValue(new PerfisSinteticos())
    .overrideProvider(FONTE_TAXONOMIA).useValue(taxonomia)
    .overrideProvider(FONTE_POSICIONAMENTO).useValue(posicionamento)
    .compile();
  const app = modulo.createNestApplication({ logger: false });
  configurarAplicacao(app);
  await app.init();
  return { app, taxonomia, posicionamento, auth };
}
