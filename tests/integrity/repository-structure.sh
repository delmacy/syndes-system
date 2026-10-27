#!/usr/bin/env bash
set -euo pipefail

required_files=(
  "AGENTS.md"
  "README.md"
  "docs/product/MVP-SCOPE.md"
  "docs/product/MODULE-ORDER.md"
  "docs/engineering/TEST-STRATEGY.md"
  "modules/platform-core/AGENTS.md"
  "modules/core-crm/AGENTS.md"
  "modules/inbox/AGENTS.md"
  "modules/whatsapp/AGENTS.md"
  "modules/scheduling/AGENTS.md"
  "modules/ai-assistant/AGENTS.md"
  "modules/documents/AGENTS.md"
  "modules/email/AGENTS.md"
  "modules/onboarding/AGENTS.md"
  "modules/billing/AGENTS.md"
  "modules/commercial-site/AGENTS.md"
  "tests/AGENTS.md"
)

for path in "${required_files[@]}"; do
  if [[ ! -s "$path" ]]; then
    echo "::error::Required non-empty file missing: $path"
    exit 1
  fi
done

for module_dir in modules/*/; do
  if [[ ! -s "${module_dir}AGENTS.md" ]]; then
    echo "::error::Module without AGENTS.md: $module_dir"
    exit 1
  fi
done

echo "Repository governance structure: PASS"
