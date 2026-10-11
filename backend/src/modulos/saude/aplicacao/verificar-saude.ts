import { Inject, Injectable } from '@nestjs/common';
import { VERIFICADOR_BANCO, VerificacaoBanco, VerificadorBanco } from './portas';

/* Caso de uso (CAMADA 1 — aplicação): a saúde da API e, separadamente, a disponibilidade do banco.
   A API responde mesmo com o banco fora do ar; a verificação do banco diz que ele está indisponível. */
@Injectable()
export class VerificarSaude {
  constructor(@Inject(VERIFICADOR_BANCO) private readonly verificadorBanco: VerificadorBanco) {}

  api(): { status: 'ok'; servico: string } {
    return { status: 'ok', servico: 'forca-agil-backend' };
  }

  banco(): Promise<VerificacaoBanco> {
    return this.verificadorBanco.verificar();
  }
}
