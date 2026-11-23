export const APP_ID = 'meu-controle-financeiro';
export const SCHEMA_VERSION = 1;
export const STORAGE_PREFIX = 'mcf:v1:';

export const EXPENSE_CATEGORIES = [
  'Moradia',
  'Contas domésticas',
  'Transporte',
  'Educação',
  'Alimentação',
  'Saúde',
  'Lazer',
  'Outros',
];

export const EARNING_CATEGORIES = ['Serviços', 'Vendas', 'Aplicativos', 'Outros'];

export const EXPENSE_TYPES = ['Fixa', 'Variável'];

export const STATUS = { PENDING: 'pending', PAID: 'paid' };
export const STATUS_LABEL = { pending: 'Pendente', paid: 'Paga' };

export const FUEL_CATEGORY = 'Transporte';

export const DEFAULT_GOALS = {
  dailyGoalCents: 10000, // R$ 100,00
  monthlyGoalCents: 200000, // R$ 2.000,00
  accumulateDeficit: false,
  accumulateSince: null,
};

export const DEFAULT_SETTINGS = {
  workDays: [1, 2, 3, 4, 5], // segunda a sexta
  earningCategories: EARNING_CATEGORIES,
  expenseCategories: EXPENSE_CATEGORIES,
  display: { hideValues: false, showCents: true },
};

export const HISTORY_LIMIT = 200;
