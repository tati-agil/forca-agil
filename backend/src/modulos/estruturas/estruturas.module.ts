import { Module } from '@nestjs/common';
import { EstruturasController, RelacoesController, ResponsaveisController } from './api/estruturas.controller';
import { EstruturasServico } from './aplicacao/estruturas.servico';
import { FontePosicionamentoIndisponivel, FonteTaxonomiaIndisponivel } from './aplicacao/fontes-indisponiveis';
import { FONTE_POSICIONAMENTO, FONTE_TAXONOMIA } from './aplicacao/portas';

/* Estruturas Organizacionais Concretas: estruturas, relações e responsável principal de objetos avaliados.
   UNIDADE_DE_TRABALHO e REPOSITORIO_ESTRUTURAS vêm do PersistenciaModule (global); as fontes oficiais, das portas
   (hoje indisponíveis: as operações que dependem delas são recusadas). */
@Module({
  controllers: [EstruturasController, RelacoesController, ResponsaveisController],
  providers: [
    EstruturasServico,
    { provide: FONTE_TAXONOMIA, useClass: FonteTaxonomiaIndisponivel },
    { provide: FONTE_POSICIONAMENTO, useClass: FontePosicionamentoIndisponivel }
  ]
})
export class EstruturasModule {}
