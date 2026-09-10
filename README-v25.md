# Sunflower Market Pro v25 — Render + Cloud Data Vault

## O que muda
- O site continua funcionando localmente sem banco.
- Se `DATABASE_URL` estiver configurada, dados importantes passam a ser sincronizados com PostgreSQL.
- Cada leitura real da Farm API gera um snapshot histórico em `farm_snapshots`.
- Planner de temporada e configurações de animais sincronizam com `app_state`.
- A Farm API Key NÃO é salva no banco.

## Dependência nova
No projeto completo, execute uma vez:

```bash
npm install pg
npm install -D @types/pg
```

Depois faça commit do `package.json` e `package-lock.json` atualizados.

## Render
1. Suba o projeto completo no GitHub.
2. No Render, use `New > Blueprint` e selecione o repositório. O `render.yaml` cria o Web Service e o PostgreSQL.
3. Faça o deploy.
4. Abra `/api/cloud/health`. O esperado é `{ "ok": true, "database": "connected" }`.

## Segurança / fase atual
Esta v25 é a primeira camada de persistência. Os dados são separados por Farm ID, mas ainda NÃO há autenticação multiusuário. Antes de abrir o site publicamente para várias pessoas, adicionar login/autorização e vincular cada Farm ID a um usuário.
