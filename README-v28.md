# Sunflower Market Pro v28

## Mudanças
- Galinheiro redesenhado com visual próprio inspirado em um painel de galinheiro, sem copiar assets do jogo.
- Galinhas aparecem em uma grade compacta; clicar abre um painel lateral com estado, nível, timer, produção/XP/feed/buff quando esses campos existirem na API, e diagnóstico bruto.
- O último snapshot completo da Fazenda agora é salvo como estado atual na nuvem por usuário + Farm ID.
- O perfil da Fazenda (Farm ID e parâmetros) agora é salvo na conta na nuvem.
- Ao entrar em outro dispositivo, o site tenta restaurar automaticamente o perfil e o último snapshot da Fazenda.
- A Farm API Key continua sem ser armazenada.

## Importante
Dados antigos consultados antes desta versão podem não existir no banco, porque as versões anteriores não restauravam o snapshot completo. Depois de atualizar para a v28, faça uma consulta da Farm API uma vez; a partir daí o último estado passa a ficar disponível na nuvem para o próximo login/dispositivo.
