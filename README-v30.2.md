# Sunflower Market Pro v30.2

Correção do progresso individual dos animais.

- Cada vaca agora calcula nível e XP restante usando o `experience` do próprio animal.
- Corrige o caso em que a primeira vaca aparecia certa e as seguintes reutilizavam/interpretavam progresso incorretamente.
- Mantém `Honey Treat` como buff (`feedBuff`) e `Brush` como item/request, sem misturar com alimentação.
- A fronteira Cow Lv12 -> Lv13 em 6480 XP foi calibrada com um caso confirmado no jogo (5915 XP, faltando 565).
- O diagnóstico bruto continua disponível para refinarmos as demais faixas caso o jogo use limites diferentes.
