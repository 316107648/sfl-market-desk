# Sunflower Market Pro v26 — Login + dados por usuário

## O que muda
- Cadastro com nome, e-mail e senha.
- Login/logout com sessão persistente por 30 dias.
- Senhas armazenadas com scrypt + salt; nunca em texto puro.
- Sessão em cookie HttpOnly, SameSite=Lax e Secure em produção.
- Estado na nuvem agora é isolado por usuário + perfil/Farm ID.
- Snapshots passam a registrar também o usuário autenticado.
- Estrutura de plano `free`/`vip` já preparada.
- A Farm API Key não é salva pelo sistema de autenticação.

## Instalação
Copie sobre o projeto atual:
- app/
- components/
- lib/
- database/
- render.yaml
- README-v26.md

Esta versão não adiciona novas dependências npm além das que a v25 já usa.

## Deploy
Depois de copiar:

```bash
git add .
git commit -m "Add login and cloud accounts v26"
git push
```

O Render fará Auto-Deploy.

## Teste
1. Abra o site no Render.
2. Crie uma conta.
3. Saia e entre novamente.
4. Atualize a página: a sessão deve permanecer.
5. Abra Fazenda/Temporada e salve alguma configuração; o endpoint cloud usa a conta autenticada.

## Observações
- Dados antigos em localStorage continuam no navegador e não são apagados.
- A persistência em nuvem passa a ser protegida por login.
- Recuperação de senha e confirmação de e-mail ficam para uma próxima etapa.
