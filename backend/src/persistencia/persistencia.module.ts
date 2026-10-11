import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import type { Pool } from 'pg';
import { CONFIGURACAO, Configuracao } from '../configuracao/configuracao';
import { VERIFICADOR_BANCO } from '../modulos/saude/aplicacao/portas';
import { UNIDADE_DE_TRABALHO } from './contratos/unidade-de-trabalho';
import { POOL_POSTGRES, criarPool } from './postgres/pool';
import { UnidadeDeTrabalhoPostgres } from './postgres/unidade-de-trabalho-postgres';
import { VerificadorBancoPostgres } from './postgres/verificador-banco-postgres';

/* CAMADA 3 — ligação dos contratos aos adaptadores PostgreSQL. Trocar de banco = trocar só este módulo. */
@Global()
@Module({
  providers: [
    { provide: POOL_POSTGRES, useFactory: (c: Configuracao) => criarPool(c.banco), inject: [CONFIGURACAO] },
    { provide: VERIFICADOR_BANCO, useClass: VerificadorBancoPostgres },
    { provide: UNIDADE_DE_TRABALHO, useClass: UnidadeDeTrabalhoPostgres }
  ],
  exports: [VERIFICADOR_BANCO, UNIDADE_DE_TRABALHO]
})
export class PersistenciaModule implements OnApplicationShutdown {
  constructor(@Inject(POOL_POSTGRES) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end().catch(() => undefined);
  }
}
