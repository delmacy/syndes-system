# AGENTS.md — Documents

## Missão

Anexar e recuperar documentos com segurança dentro do contexto dos registros do tenant.

## Escopo

- upload;
- download;
- metadata;
- relationship to entities;
- tenant storage;
- authorization;
- archive.

## Não fazer

- Google Drive clone;
- editor colaborativo;
- versionamento complexo;
- compartilhamento público avançado.

## Segurança

- validar tipo/tamanho/nome;
- storage isolado por tenant;
- URLs temporárias/autorizadas quando aplicável;
- nunca confiar em path fornecido pelo cliente;
- audit para operações críticas;
- nenhum secret em metadata.

## Testes

- upload/download;
- permissions;
- cross-tenant storage denial;
- malformed files/metadata;
- archive;
- missing object;
- limits.
