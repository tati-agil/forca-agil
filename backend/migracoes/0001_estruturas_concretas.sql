-- Estruturas Organizacionais Concretas (Núcleo de Avaliação, Taxonomia e Mapa da Floresta).
-- As REGRAS de negócio são do núcleo (forca-agil/estruturas-nucleo.js); este esquema guarda o que ele produz e
-- garante, no próprio banco, a integridade que não pode depender de quem grava (docs/estruturas-nucleo-contratos.md):
--   * cada registro guarda o objeto inteiro do núcleo em "dados"; as colunas são cópias para índice e restrição, e
--     uma CHECK garante que coincidem com "dados";
--   * nada se apaga (DELETE e TRUNCATE recusados); encerrar é uma alteração;
--   * cada alteração avança a revisão em exatamente 1, só sobre registro ATIVO (encerrado é final: sem reativação);
--   * o que é imutável não muda: tipo da estrutura; origem/tipo/destino da relação; objeto, estrutura, papel e base
--     do vínculo;
--   * no máximo uma relação ATIVA por (origem, tipo, destino) e um responsável principal ATIVO por objeto;
--   * eventos de histórico só por acréscimo, sempre ligados à operação que os gerou.
-- Ciclos em "compõe" não cabem numa restrição de linha: o núcleo os valida dentro da mesma transação SERIALIZABLE
-- que grava (unidade de trabalho), o que serializa as operações concorrentes que poderiam formar um ciclo.

CREATE TABLE estruturas_operacoes (
  id               text PRIMARY KEY,
  operacao         text NOT NULL,
  usuario_id       text NOT NULL,
  chave_idempotencia text,
  digest_pedido    text,
  resposta         jsonb,
  em               timestamptz NOT NULL,
  CHECK ((chave_idempotencia IS NULL) = (digest_pedido IS NULL))
);
CREATE UNIQUE INDEX estruturas_operacoes_idempotencia ON estruturas_operacoes (usuario_id, chave_idempotencia)
  WHERE chave_idempotencia IS NOT NULL;

CREATE TABLE estruturas (
  id        text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  tipo      text NOT NULL CHECK (tipo <> ''),
  nome      text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 200),
  sigla     text CHECK (sigla IS NULL OR length(sigla) BETWEEN 1 AND 30),
  situacao  text NOT NULL CHECK (situacao IN ('ativa', 'encerrada')),
  revisao   integer NOT NULL CHECK (revisao >= 1),
  dados     jsonb NOT NULL,
  CHECK (coalesce(dados->>'id' = id AND dados->>'tipo' = tipo AND dados->>'nome' = nome
         AND (dados->>'sigla') IS NOT DISTINCT FROM sigla AND dados->>'situacao' = situacao
         AND (dados->>'revisao')::int = revisao, false)),
  CHECK (situacao = 'ativa' OR dados ? 'encerramento')
);
CREATE INDEX estruturas_tipo ON estruturas (tipo, situacao);

CREATE TABLE estruturas_relacoes (
  id        text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  origem    text NOT NULL REFERENCES estruturas (id),
  tipo      text NOT NULL CHECK (tipo IN ('compoe', 'aloca-em', 'atende', 'desenvolve-disciplina', 'pertence-a-disciplina')),
  destino   text NOT NULL REFERENCES estruturas (id),
  situacao  text NOT NULL CHECK (situacao IN ('ativa', 'encerrada')),
  revisao   integer NOT NULL CHECK (revisao >= 1),
  dados     jsonb NOT NULL,
  CHECK (origem <> destino),
  CHECK (coalesce(dados->>'id' = id AND dados->>'origem' = origem AND dados->>'tipo' = tipo AND dados->>'destino' = destino
         AND dados->>'situacao' = situacao AND (dados->>'revisao')::int = revisao, false)),
  CHECK (situacao = 'ativa' OR dados ? 'encerramento')
);
CREATE UNIQUE INDEX estruturas_relacoes_ativa_unica ON estruturas_relacoes (origem, tipo, destino) WHERE situacao = 'ativa';
CREATE INDEX estruturas_relacoes_destino ON estruturas_relacoes (destino);

CREATE TABLE estruturas_vinculos (
  id            text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  objeto_id     text NOT NULL CHECK (objeto_id <> ''),
  estrutura_id  text NOT NULL REFERENCES estruturas (id),
  papel         text NOT NULL CHECK (papel IN ('responsavel-principal')),
  situacao      text NOT NULL CHECK (situacao IN ('ativa', 'encerrada')),
  revisao       integer NOT NULL CHECK (revisao >= 1),
  dados         jsonb NOT NULL,
  CHECK (coalesce(dados->>'id' = id AND dados->>'objetoId' = objeto_id AND dados->>'estruturaId' = estrutura_id
         AND dados->>'papel' = papel AND dados->>'situacao' = situacao AND (dados->>'revisao')::int = revisao, false)),
  -- V4: a base do vínculo (avaliação, código e origem) é registrada na criação
  CHECK (coalesce(dados->'base'->>'avaliacaoId' <> '' AND dados->'base'->>'codigo' <> ''
         AND dados->'base'->>'origem' IN ('decisao', 'recomendacao'), false)),
  CHECK (situacao = 'ativa' OR dados ? 'encerramento')
);
CREATE UNIQUE INDEX estruturas_vinculos_responsavel_unico ON estruturas_vinculos (objeto_id)
  WHERE situacao = 'ativa' AND papel = 'responsavel-principal';
CREATE INDEX estruturas_vinculos_estrutura ON estruturas_vinculos (estrutura_id);

CREATE TABLE estruturas_eventos (
  seq           bigserial PRIMARY KEY,
  id            text NOT NULL UNIQUE,
  operacao_id   text NOT NULL REFERENCES estruturas_operacoes (id),
  tipo          text NOT NULL CHECK (tipo IN ('estrutura.criada', 'estrutura.alterada', 'estrutura.encerrada',
                                              'relacao.criada', 'relacao.encerrada', 'vinculo.criado', 'vinculo.encerrado')),
  entidade      text NOT NULL CHECK (entidade IN ('estrutura', 'relacao', 'vinculo')),
  entidade_id   text NOT NULL,
  usuario_id    text NOT NULL,
  em            timestamptz NOT NULL,
  dados         jsonb NOT NULL,
  CHECK (coalesce(dados->>'id' = id AND dados->>'operacaoId' = operacao_id AND dados->>'tipo' = tipo
         AND dados->>'entidade' = entidade AND dados->>'entidadeId' = entidade_id
         AND dados->'usuario'->>'id' = usuario_id, false))
);
CREATE INDEX estruturas_eventos_entidade ON estruturas_eventos (entidade, entidade_id, seq);

-- Nada se apaga: registros, eventos e operações.
CREATE FUNCTION estruturas_recusar_exclusao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Exclusão não permitida em %: encerre em vez de apagar', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END $$;

-- Eventos e operações: só acréscimo.
CREATE FUNCTION estruturas_recusar_alteracao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Registro somente de acréscimo: % não pode ser alterado', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END $$;

-- Estruturas, relações e vínculos: revisão +1, só sobre registro ativo, e campos imutáveis preservados.
CREATE FUNCTION estruturas_conferir_alteracao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id <> OLD.id THEN RAISE EXCEPTION 'Identificador imutável' USING ERRCODE = 'restrict_violation'; END IF;
  IF OLD.situacao <> 'ativa' THEN RAISE EXCEPTION 'Registro encerrado não pode ser alterado nem reativado' USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.revisao <> OLD.revisao + 1 THEN RAISE EXCEPTION 'A revisão deve avançar exatamente 1' USING ERRCODE = 'restrict_violation'; END IF;
  -- um IF por tabela: cada registro só tem as próprias colunas
  IF TG_TABLE_NAME = 'estruturas' THEN
    IF NEW.tipo <> OLD.tipo THEN RAISE EXCEPTION 'O tipo da estrutura é imutável' USING ERRCODE = 'restrict_violation'; END IF;
  ELSIF TG_TABLE_NAME = 'estruturas_relacoes' THEN
    IF (NEW.origem, NEW.tipo, NEW.destino) IS DISTINCT FROM (OLD.origem, OLD.tipo, OLD.destino) THEN
      RAISE EXCEPTION 'Origem, tipo e destino da relação são imutáveis (alterar = encerrar e criar outra)' USING ERRCODE = 'restrict_violation';
    END IF;
  ELSIF TG_TABLE_NAME = 'estruturas_vinculos' THEN
    IF (NEW.objeto_id, NEW.estrutura_id, NEW.papel) IS DISTINCT FROM (OLD.objeto_id, OLD.estrutura_id, OLD.papel)
        OR NEW.dados->'base' IS DISTINCT FROM OLD.dados->'base' THEN
      RAISE EXCEPTION 'Objeto, estrutura, papel e base do vínculo são imutáveis (substituir = encerrar e criar outro)' USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER estruturas_sem_exclusao BEFORE DELETE ON estruturas FOR EACH ROW EXECUTE FUNCTION estruturas_recusar_exclusao();
CREATE TRIGGER estruturas_relacoes_sem_exclusao BEFORE DELETE ON estruturas_relacoes FOR EACH ROW EXECUTE FUNCTION estruturas_recusar_exclusao();
CREATE TRIGGER estruturas_vinculos_sem_exclusao BEFORE DELETE ON estruturas_vinculos FOR EACH ROW EXECUTE FUNCTION estruturas_recusar_exclusao();
CREATE TRIGGER estruturas_eventos_sem_exclusao BEFORE DELETE ON estruturas_eventos FOR EACH ROW EXECUTE FUNCTION estruturas_recusar_exclusao();
CREATE TRIGGER estruturas_operacoes_sem_exclusao BEFORE DELETE ON estruturas_operacoes FOR EACH ROW EXECUTE FUNCTION estruturas_recusar_exclusao();
CREATE TRIGGER estruturas_sem_truncate BEFORE TRUNCATE ON estruturas FOR EACH STATEMENT EXECUTE FUNCTION estruturas_recusar_exclusao();
CREATE TRIGGER estruturas_relacoes_sem_truncate BEFORE TRUNCATE ON estruturas_relacoes FOR EACH STATEMENT EXECUTE FUNCTION estruturas_recusar_exclusao();
CREATE TRIGGER estruturas_vinculos_sem_truncate BEFORE TRUNCATE ON estruturas_vinculos FOR EACH STATEMENT EXECUTE FUNCTION estruturas_recusar_exclusao();
CREATE TRIGGER estruturas_eventos_sem_truncate BEFORE TRUNCATE ON estruturas_eventos FOR EACH STATEMENT EXECUTE FUNCTION estruturas_recusar_exclusao();
CREATE TRIGGER estruturas_operacoes_sem_truncate BEFORE TRUNCATE ON estruturas_operacoes FOR EACH STATEMENT EXECUTE FUNCTION estruturas_recusar_exclusao();

CREATE TRIGGER estruturas_eventos_so_acrescimo BEFORE UPDATE ON estruturas_eventos FOR EACH ROW EXECUTE FUNCTION estruturas_recusar_alteracao();
CREATE TRIGGER estruturas_operacoes_so_acrescimo BEFORE UPDATE ON estruturas_operacoes FOR EACH ROW EXECUTE FUNCTION estruturas_recusar_alteracao();

CREATE TRIGGER estruturas_alteracao BEFORE UPDATE ON estruturas FOR EACH ROW EXECUTE FUNCTION estruturas_conferir_alteracao();
CREATE TRIGGER estruturas_relacoes_alteracao BEFORE UPDATE ON estruturas_relacoes FOR EACH ROW EXECUTE FUNCTION estruturas_conferir_alteracao();
CREATE TRIGGER estruturas_vinculos_alteracao BEFORE UPDATE ON estruturas_vinculos FOR EACH ROW EXECUTE FUNCTION estruturas_conferir_alteracao();
