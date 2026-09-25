# Sunflower Market Pro v30

Atualização focada nos animais e na leitura real da Community Farm API.

## Mudanças
- Melhor identificação de nível mesmo quando o campo vem aninhado na API.
- Produção reconhece Egg, Feather, Milk, Leather e Wool.
- Separação mais rígida entre comida favorita e buff temporário.
- Tentativa de leitura de XP restante para o próximo nível, buff restante e próximo pedido.
- O painel de mimo usa o valor de XP restante da API quando ele estiver disponível; caso contrário, permite informar manualmente.
- Novo alerta `Vale alimentar?` em cada animal.
- O alerta soma o valor de mercado da produção detectada, desconta a taxa de venda e compara com o custo da alimentação.
- Se a API fornecer quantidade da comida e houver preço para a comida favorita, o custo pode ser estimado automaticamente. Caso contrário, o usuário informa apenas o custo daquela alimentação.
- O painel mostra lucro/prejuízo em FLOWER e o custo máximo da alimentação para empatar.
- Configurações do alerta são sincronizadas na nuvem por Farm ID.

## Observação
A Community Farm API pode mudar os nomes/caminhos dos campos. Os dados técnicos continuam disponíveis no diagnóstico para ajustar os mapeamentos quando necessário.
