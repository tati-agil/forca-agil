import { DynamicModule, Global, Module } from '@nestjs/common';
import { CONFIGURACAO, Configuracao } from './configuracao';

/* A configuração já validada (main.ts) é injetada como valor: nenhum módulo lê process.env por conta própria. */
@Global()
@Module({})
export class ConfiguracaoModule {
  static com(configuracao: Configuracao): DynamicModule {
    return {
      module: ConfiguracaoModule,
      providers: [{ provide: CONFIGURACAO, useValue: Object.freeze(configuracao) }],
      exports: [CONFIGURACAO]
    };
  }
}
