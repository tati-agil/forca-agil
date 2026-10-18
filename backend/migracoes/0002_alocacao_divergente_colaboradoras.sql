-- E2 e E3 da alocação (especificação "E1–E3 da Alocação", aprovada em 18/10/2026).
--   * E2: o vínculo do responsável principal pode ir para uma estrutura de tipo diferente do posicionamento efetivo,
--     só com "divergencia" (motivo da lista fechada + justificativa; autoridade e referência opcionais). Quem decide
--     isso é o núcleo (forca-agil/estruturas-nucleo.js); aqui o banco garante a forma e a imutabilidade.
--   * E3: estruturas colaboradoras são o MESMO registro de vínculo com papel 'colaboradora': sempre com justificativa,
--     nunca com divergência, no máximo uma ativa por (objeto, estrutura). Exigir o principal ativo e uma estrutura
--     diferente da dele é regra do núcleo, revalidada dentro da transação serializável.

ALTER TABLE estruturas_vinculos DROP CONSTRAINT estruturas_vinculos_papel_check;
ALTER TABLE estruturas_vinculos ADD CONSTRAINT estruturas_vinculos_papel_check
  CHECK (papel IN ('responsavel-principal', 'colaboradora'));

-- divergência: só no responsável principal, com motivo da lista e justificativa
ALTER TABLE estruturas_vinculos ADD CONSTRAINT estruturas_vinculos_divergencia_check
  CHECK (NOT dados ? 'divergencia' OR (papel = 'responsavel-principal'
    AND dados->'divergencia'->>'motivo' IN ('pessoas', 'escala', 'custo', 'afinidade', 'prioridade', 'viabilidade', 'outro')
    AND coalesce(btrim(dados->'divergencia'->>'justificativa'), '') <> ''));

-- colaboradora: a participação é sempre explicada
ALTER TABLE estruturas_vinculos ADD CONSTRAINT estruturas_vinculos_colaboradora_check
  CHECK (papel <> 'colaboradora' OR coalesce(btrim(dados->>'justificativa'), '') <> '');

CREATE UNIQUE INDEX estruturas_vinculos_colaboradora_unica ON estruturas_vinculos (objeto_id, estrutura_id)
  WHERE situacao = 'ativa' AND papel = 'colaboradora';

-- a divergência registrada também é imutável (encerrar não reescreve a decisão organizacional)
CREATE OR REPLACE FUNCTION estruturas_conferir_alteracao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id <> OLD.id THEN RAISE EXCEPTION 'Identificador imutável' USING ERRCODE = 'restrict_violation'; END IF;
  IF OLD.situacao <> 'ativa' THEN RAISE EXCEPTION 'Registro encerrado não pode ser alterado nem reativado' USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.revisao <> OLD.revisao + 1 THEN RAISE EXCEPTION 'A revisão deve avançar exatamente 1' USING ERRCODE = 'restrict_violation'; END IF;
  IF TG_TABLE_NAME = 'estruturas' THEN
    IF NEW.tipo <> OLD.tipo THEN RAISE EXCEPTION 'O tipo da estrutura é imutável' USING ERRCODE = 'restrict_violation'; END IF;
  ELSIF TG_TABLE_NAME = 'estruturas_relacoes' THEN
    IF (NEW.origem, NEW.tipo, NEW.destino) IS DISTINCT FROM (OLD.origem, OLD.tipo, OLD.destino) THEN
      RAISE EXCEPTION 'Origem, tipo e destino da relação são imutáveis (alterar = encerrar e criar outra)' USING ERRCODE = 'restrict_violation';
    END IF;
  ELSIF TG_TABLE_NAME = 'estruturas_vinculos' THEN
    IF (NEW.objeto_id, NEW.estrutura_id, NEW.papel) IS DISTINCT FROM (OLD.objeto_id, OLD.estrutura_id, OLD.papel)
        OR NEW.dados->'base' IS DISTINCT FROM OLD.dados->'base'
        OR NEW.dados->'divergencia' IS DISTINCT FROM OLD.dados->'divergencia' THEN
      RAISE EXCEPTION 'Objeto, estrutura, papel, base e divergência do vínculo são imutáveis (substituir = encerrar e criar outro)' USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
