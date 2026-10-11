import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FiltroErros } from './compartilhado/api/filtro-erros';
import { Configuracao } from './configuracao/configuracao';

/* Monta a aplicação (usado por main.ts e pelos testes, para que os testes exercitem a MESMA configuração). */
export async function criarAplicacao(configuracao: Configuracao, logger: false | ('log' | 'warn' | 'error')[] = ['log', 'warn', 'error']): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.com(configuracao), { logger });
  configurarAplicacao(app);
  return app;
}

export function configurarAplicacao(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new FiltroErros());
  app.enableShutdownHooks();
}
