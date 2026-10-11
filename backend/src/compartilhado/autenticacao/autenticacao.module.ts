import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CONFIGURACAO, Configuracao } from '../../configuracao/configuracao';
import { GuardaAcesso } from './guarda-acesso';
import { FONTE_PERFIS, FontePerfisIndisponivel } from './perfis';
import { VERIFICADOR_IDENTIDADE, VerificadorIdentidadeNaoConfigurado } from './verificador-identidade';
import { VerificadorIdentidadeFirebase } from './verificador-identidade-firebase';

/* Identidade (Firebase Authentication) e perfis oficiais para TODAS as rotas, pela guarda global. */
@Global()
@Module({
  providers: [
    {
      provide: VERIFICADOR_IDENTIDADE,
      useFactory: (c: Configuracao) => (c.firebase.projetoId ? VerificadorIdentidadeFirebase.comChavesDoGoogle(c.firebase.projetoId) : new VerificadorIdentidadeNaoConfigurado()),
      inject: [CONFIGURACAO]
    },
    { provide: FONTE_PERFIS, useClass: FontePerfisIndisponivel },
    { provide: APP_GUARD, useClass: GuardaAcesso }
  ],
  exports: [VERIFICADOR_IDENTIDADE, FONTE_PERFIS]
})
export class AutenticacaoModule {}
