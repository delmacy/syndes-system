#!/usr/bin/env bash
# Verifica que todo módulo possui um contrato de agente (AGENTS.md) não vazio.
#
# Fonte única desta regra: tanto o workflow de integridade quanto o gate de
# auditoria de CI chamam este script. Não replique esta lógica em YAML.
set -euo pipefail

minimum="${MODULE_CONTRACTS_MINIMUM:-11}"

count=0
for file in modules/*/AGENTS.md; do
  if [[ ! -s "$file" ]]; then
    echo "::error::Module AGENTS.md missing or empty: $file"
    exit 1
  fi
  count=$((count + 1))
done

if [[ "$count" -lt "$minimum" ]]; then
  echo "::error::Expected at least $minimum module AGENTS.md files; found $count"
  exit 1
fi

echo "Module AGENTS.md contracts: PASS ($count contracts, minimum $minimum)"
