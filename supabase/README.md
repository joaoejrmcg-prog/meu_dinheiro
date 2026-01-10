# Supabase Migrations

Este diretório contém as migrações do banco de dados para o projeto Manicure IA.

## Estrutura

- `config.toml`: Configuração do Supabase CLI.
- `migrations/`: Arquivos SQL de migração versionados.

## Como Usar

### Pré-requisitos
- [Supabase CLI](https://supabase.com/docs/guides/cli) instalado.

### Comandos Úteis

1.  **Iniciar Supabase Localmente (Opcional)**
    ```bash
    supabase start
    ```

2.  **Criar Nova Migração**
    ```bash
    supabase migration new nome_da_mudanca
    ```
    Isso criará um novo arquivo em `migrations/` onde você deve colocar seu SQL.

3.  **Aplicar Migrações (Local)**
    ```bash
    supabase db reset
    ```
    Isso recria o banco local com base nas migrações.

4.  **Aplicar Migrações (Produção)**
    ```bash
    supabase db push
    ```
    Isso aplica as migrações pendentes no banco de dados linkado.

## Histórico de Migrações

- **20240101000000_initial_schema.sql**: Schema inicial consolidado (Profiles, Subscriptions, Clients, Appointments, Financial, Rewards).
