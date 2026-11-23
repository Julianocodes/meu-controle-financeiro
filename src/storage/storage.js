import { APP_ID, SCHEMA_VERSION, STORAGE_PREFIX } from '../constants.js';
import { sanitizeState } from './schema.js';

// Uma chave do LocalStorage por área de dados:
//   mcf:v1:earnings | expenses | recurring | fuel | goals | settings | history
export const SLICES = ['earnings', 'expenses', 'recurring', 'fuel', 'goals', 'settings', 'history'];

function getStore(store) {
  if (store) return store;
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // acesso bloqueado (modo privado, políticas do navegador)
  }
}

/** Lê tudo do LocalStorage. Nunca lança: devolve `issues` para o app avisar o usuário. */
export function loadAll(store) {
  const s = getStore(store);
  const issues = [];
  const raw = {};
  if (!s) {
    issues.push('O armazenamento do navegador não está disponível. Os dados não serão salvos.');
    return { ...sanitizeState({}), issues, storageAvailable: false };
  }
  for (const slice of SLICES) {
    let text = null;
    try {
      text = s.getItem(STORAGE_PREFIX + slice);
    } catch {
      issues.push(`Não foi possível ler "${slice}" do armazenamento.`);
      continue;
    }
    if (text === null) continue;
    try {
      raw[slice] = JSON.parse(text);
    } catch {
      issues.push(`Os dados de "${slice}" estavam corrompidos e foram ignorados (cópia guardada).`);
      try {
        s.setItem(`${STORAGE_PREFIX}corrupt:${slice}:${Date.now()}`, text);
      } catch {
        /* sem espaço: segue sem a cópia */
      }
    }
  }
  const { state, discarded } = sanitizeState(raw);
  if (discarded > 0) issues.push(`${discarded} registro(s) inválido(s) foram descartados.`);
  return { state, discarded, issues, storageAvailable: true };
}

/** Salva uma área. Retorna { ok, error }. */
export function saveSlice(slice, value, store) {
  const s = getStore(store);
  if (!s) return { ok: false, error: 'Armazenamento indisponível.' };
  try {
    s.setItem(STORAGE_PREFIX + slice, JSON.stringify(value));
    return { ok: true };
  } catch (err) {
    const full = err && (err.name === 'QuotaExceededError' || err.code === 22);
    return {
      ok: false,
      error: full ? 'Armazenamento cheio. Exporte um backup e libere espaço.' : 'Falha ao salvar os dados.',
    };
  }
}

export function clearAll(store) {
  const s = getStore(store);
  if (!s) return;
  for (const slice of SLICES) {
    try {
      s.removeItem(STORAGE_PREFIX + slice);
    } catch {
      /* ignora */
    }
  }
}

// ----- Backup JSON -----

export function buildBackup(state, now = new Date()) {
  const { earnings, expenses, recurring, fuel, goals, settings, history } = state;
  return {
    app: APP_ID,
    version: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    // despesas de combustível são derivadas dos abastecimentos: não vão duplicadas no backup
    data: { earnings, expenses: expenses.filter((e) => !e.fuelId), recurring, fuel, goals, settings, history },
  };
}

export function parseBackup(text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'O arquivo não é um JSON válido.' };
  }
  if (!json || typeof json !== 'object' || json.app !== APP_ID || typeof json.data !== 'object' || !json.data) {
    return { ok: false, error: 'Este arquivo não parece ser um backup do Meu Controle Financeiro.' };
  }
  if (typeof json.version !== 'number' || json.version > SCHEMA_VERSION) {
    return { ok: false, error: 'Versão de backup não suportada por esta versão do app.' };
  }
  const { state, discarded } = sanitizeState(json.data);
  return { ok: true, state, discarded };
}
