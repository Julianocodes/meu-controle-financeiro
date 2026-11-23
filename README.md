# Meu Controle Financeiro

Controle de ganhos, despesas, combustível e metas para quem tem renda variável.
React + Vite + JavaScript, LocalStorage, Recharts e Lucide. Sem backend.

## Como rodar

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # produção (pasta dist)
npm test         # testes da lógica financeira (Node, sem dependências)
```

## Estrutura

```
src/
  utils/      money.js (centavos), dates.js (datas ISO), validation.js, demo.js
  logic/      goals.js (metas e déficit), finance.js (totais/séries), recurrence.js, fuel.js
  storage/    schema.js (validação), storage.js (LocalStorage, backup JSON)
  state/      reducer.js (todas as regras de alteração), AppContext.jsx
  components/ ui.jsx, forms.jsx, charts.jsx, PeriodFilter.jsx
  pages/      Dashboard, Earnings, Expenses, Fuel, Reports, Settings
```

## Regras financeiras

- Todo valor é guardado em **centavos inteiros** (sem erro de ponto flutuante).
- Faturamento bruto = soma dos ganhos.
- Despesas do período = despesas com **vencimento** no período (pagas + pendentes).
- Resultado líquido = faturamento bruto − despesas do período.
- Saldo de caixa = faturamento bruto − despesas **pagas** do período.
- Meta restante nunca fica negativa; o excedente é mostrado à parte.
- Combustível: cada abastecimento gera uma despesa vinculada (Transporte, paga). A lista de
  abastecimentos é a fonte da verdade e as despesas vinculadas são reconstruídas a cada mudança,
  então não há contagem dupla. Elas só são editadas/excluídas pelo módulo Combustível.
- Meta acumulativa: o déficit de um dia de trabalho (meta do dia − ganho) soma na meta do próximo
  dia de trabalho. Só dias de trabalho contam, o acúmulo reinicia a cada mês e começa na data em que
  a opção foi ativada. Sobra não vira crédito.
- Projeção do mês = ganho atual + média por dia de trabalho transcorrido × dias de trabalho restantes.
- Média diária necessária = restante ÷ dias de trabalho que ainda faltam (incluindo hoje), arredondada para cima.
- Recorrentes: um modelo por recorrência e uma despesa por mês com id determinístico, gerada até o
  mês atual (e até o mês navegado, no máximo 12 meses à frente). Excluir "só este mês" não recria.

## Dados

LocalStorage, uma chave por área: `mcf:v1:earnings | expenses | recurring | fuel | goals | settings | history`.
Dados corrompidos são ignorados (com cópia guardada) e registros inválidos são descartados com aviso.
Backup: Configurações → Exportar/Importar (JSON validado antes de substituir os dados).
