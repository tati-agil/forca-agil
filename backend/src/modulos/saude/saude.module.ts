import { Module } from '@nestjs/common';
import { SaudeController } from './api/saude.controller';
import { VerificarSaude } from './aplicacao/verificar-saude';

/* O VERIFICADOR_BANCO vem do PersistenciaModule (global): este módulo só conhece a porta. */
@Module({
  controllers: [SaudeController],
  providers: [VerificarSaude]
})
export class SaudeModule {}
