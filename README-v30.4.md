# Sunflower Market Pro v30.4

Correção definitiva da prioridade do progresso das vacas.

- Para vacas, `experience` do próprio animal passa a ser a fonte principal para calcular nível e XP restante.
- Um `level` antigo/incorreto enviado pela API não sobrescreve mais o cálculo por XP.
- O XP também é lido diretamente de `rawData.experience`/`rawData.xp` como primeira opção.
- Animais vindos como `kind: Barn` são tratados como vacas para o cálculo de progresso.
- Para outros animais, o comportamento anterior é preservado.
- Mantém a tabela v30.3: Cow Lv14 inicia em 4800 XP e Lv15 em 5400 XP.

Caso de validação:
- 5087,5 XP => nível 14; 312,5 XP restantes para o nível 15.
