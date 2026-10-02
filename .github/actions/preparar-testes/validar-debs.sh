#!/usr/bin/env bash
# Prepara o cache de pacotes do apt ANTES do `playwright install-deps`.
#
# Pega os .deb restaurados do cache (/tmp/apt-debs) e entrega ao apt SÓ os que forem
# comprovadamente íntegros: o SHA256 do arquivo precisa constar, no índice assinado do
# espelho, para aquela mesma versão do pacote. Qualquer outra coisa — arquivo corrompido,
# truncado, vazio, de versão que o espelho não tem mais — é descartada, e o apt baixa de
# novo o que faltar. Quem escolhe a versão a instalar continua sendo o apt.
#
# Nunca falha o job: na dúvida, descarta. Cache vazio = não faz nada.
#
# Saída (stdout): uma linha "restaurados=N validos=V descartados=D validacao=Ns".
set -u
POOL=/tmp/apt-debs
ARQ=/var/cache/apt/archives
t0=$(date +%s)

# Mantém os .deb baixados depois da instalação (é o que o passo de guardar copia para o cache).
echo 'APT::Keep-Downloaded-Packages "true";' | sudo tee /etc/apt/apt.conf.d/zzz-manter-debs >/dev/null 2>&1 || true
# Começa de uma pasta de pacotes limpa, para o cache conter só o que ESTE preparo usou.
sudo rm -f "$ARQ"/*.deb 2>/dev/null || true

restaurados=$(ls "$POOL"/*.deb 2>/dev/null | wc -l)
validos=0; descartados=0
if [ "$restaurados" -gt 0 ]; then
  # O índice é necessário para conferir o hash (o install-deps repetiria este update de qualquer forma).
  sudo apt-get update -qq >/dev/null 2>&1 || echo "aviso: apt-get update falhou; a conferência usa o índice que já existe no runner"
  for f in "$POOL"/*.deb; do
    p=$(dpkg-deb -f "$f" Package 2>/dev/null); v=$(dpkg-deb -f "$f" Version 2>/dev/null)
    real=$(sha256sum "$f" 2>/dev/null | cut -d' ' -f1)
    if [ -n "$p" ] && [ -n "$v" ] && [ -n "$real" ] && apt-cache show "$p=$v" 2>/dev/null | grep -q "^SHA256: $real\$"; then
      sudo cp "$f" "$ARQ"/ && validos=$((validos + 1))
    else
      echo "descartado (não confere com o índice do espelho): $(basename "$f")"
      descartados=$((descartados + 1))
    fi
  done
fi
echo "restaurados=$restaurados validos=$validos descartados=$descartados validacao=$(( $(date +%s) - t0 ))s"
exit 0
