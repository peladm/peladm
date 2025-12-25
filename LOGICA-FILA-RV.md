# 📋 LÓGICA DA REPRESENTAÇÃO VISUAL (RV) DA FILA

## 🎯 Como Funciona

A página da fila **se adapta automaticamente** às regras definidas em `regras.jogadores_por_time`.

### 📊 Exemplo com 18 jogadores sorteados:

#### ⚙️ Times de 5x5 (jogadores_por_time = 5)
```
┌─────────────────────────────────────┐
│ TIME 1 (jogando)                    │
│  1. Lucho Acosta                    │
│  2. Nonato                           │
│  3. Washington                       │
│  4. Romario                          │
│  5. Martineli                        │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ TIME 2 (jogando)                    │
│  6. Dario Conca                     │
│  7. Carnobis                         │
│  8. Felipe Melo                      │
│  9. Ronaldinho                       │
│ 10. Thiago Neves                     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ PRÓXIMO TIME (fila de espera)       │
│ 11. Thiago Neves                    │
│ 12. Carlos Alberto                   │
│ 13. Fred                             │
│ 14. PH Ganso                         │
│ 15. Dodô                             │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ SEGUNDO TIME (fila de espera)       │
│ 16. Thiago Silva                    │
│ 17. Serna                            │
│ 18. Deco                             │
│ -- Aguardando jogador...            │
│ -- Aguardando jogador...            │
└─────────────────────────────────────┘

TOTAL: 18 jogadores
```

#### ⚙️ Times de 4x4 (jogadores_por_time = 4)
```
┌─────────────────────────────────────┐
│ TIME 1 (jogando)     - 4 jogadores  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ TIME 2 (jogando)     - 4 jogadores  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ PRÓXIMO TIME         - 4 jogadores  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ SEGUNDO TIME         - 4 jogadores  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ TERCEIRO TIME        - 2 jogadores  │
│ -- Aguardando jogador...            │
│ -- Aguardando jogador...            │
└─────────────────────────────────────┘

TOTAL: 18 jogadores (distribuídos em blocos de 4)
```

#### ⚙️ Times de 7x7 (jogadores_por_time = 7)
```
┌─────────────────────────────────────┐
│ TIME 1 (jogando)     - 7 jogadores  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ TIME 2 (jogando)     - 7 jogadores  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ PRÓXIMO TIME         - 4 jogadores  │
│ -- Aguardando jogador...            │
│ -- Aguardando jogador...            │
│ -- Aguardando jogador...            │
└─────────────────────────────────────┘

TOTAL: 18 jogadores (7+7+4)
```

## 💻 Código Adaptável

```typescript
// Carrega regras do banco
const regras = { jogadores_por_time: 5 } // ou 4, 6, 7...

// Divide automaticamente
const time1 = todosJogadoresNaFila.slice(0, regras.jogadores_por_time)
const time2 = todosJogadoresNaFila.slice(regras.jogadores_por_time, regras.jogadores_por_time * 2)
const filaDeEspera = todosJogadoresNaFila.slice(regras.jogadores_por_time * 2)
```

## 🔒 Bloqueio de Alteração de Regras

**Status**: NÃO implementado ainda (planejado para futuro)

**Comportamento atual**:
- ✅ Usuário define regras na página `/regras`
- ✅ Faz o sorteio com essas regras
- ✅ Fila é criada seguindo as regras
- ⚠️ Se alterar regras depois, a fila NÃO é recriada (mantém a estrutura original)
- ⚠️ Mas a RV se adapta à nova regra (pode ficar inconsistente)

**Solução futura**: 
- Bloquear acesso à página `/regras` quando há sessão ativa
- Ou alertar que mudança de regras requer novo sorteio

## 🎯 Resumo

A RV está **100% adaptável** e funciona para qualquer configuração de `jogadores_por_time` entre 3 e 11 jogadores por time.

✅ **Funcionando corretamente agora!**
