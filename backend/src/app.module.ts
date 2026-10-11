import { DynamicModule, Module } from '@nestjs/common';
import { Configuracao } from './configuracao/configuracao';
import { ConfiguracaoModule } from './configuracao/configuracao.module';
import { SaudeModule } from './modulos/saude/saude.module';
import { PersistenciaModule } from './persistencia/persistencia.module';

/* Monólito modular: cada módulo funcional (modulos/<nome>) tem API e aplicação próprias; o Núcleo (src/nucleo) e
   a persistência (src/persistencia) são compartilhados. Novos módulos entram aqui. */
@Module({})
export class AppModule {
  static com(configuracao: Configuracao): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfiguracaoModule.com(configuracao), PersistenciaModule, SaudeModule]
    };
  }
}
