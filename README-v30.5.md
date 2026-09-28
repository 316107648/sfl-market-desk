# Sunflower Market Pro v30.5

Correção da progressão de nível das vacas para refletir os limites atuais do jogo.

## O que mudou

- Removida a tabela incorreta usada nas versões v30.3/v30.4.
- O nível da vaca continua sendo calculado pelo `experience` do próprio animal.
- A tabela agora usa XP cumulativo observado na progressão atual do jogo:
  - Lv 0: 0
  - Lv 1: 180
  - Lv 2: 360
  - Lv 3: 720
  - Lv 4: 1080
  - Lv 5: 1440
  - Lv 6: 1980
  - Lv 7: 2520
  - Lv 8: 3060
  - Lv 9: 3600
  - Lv 10: 4320
  - Lv 11: 5040
  - Lv 12: 5760
  - Lv 13: 6480
  - Lv 14: 7200
  - Lv 15: 8160

## Casos de validação

- 5225 XP => nível 11; faltam 535 XP para o nível 12.
- 5915 XP => nível 12; faltam 565 XP para o nível 13.
- 5087,5 XP => nível 11; faltam 672,5 XP para o nível 12.

Observação: se a API fornecer um valor de `experience` atrasado em relação ao jogo, o nível será calculado corretamente para esse XP recebido, mas o número exato de XP restante também refletirá o valor recebido pela API.
