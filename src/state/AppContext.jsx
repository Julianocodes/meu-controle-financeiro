import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { addMonths, monthKeyOf, todayISO } from '../utils/dates.js';
import { formatBRL } from '../utils/money.js';
import { loadAll, saveSlice, SLICES } from '../storage/storage.js';
import { reducer } from './reducer.js';
import { earningsByDay } from '../logic/goals.js';

const AppContext = createContext(null);

let seq = 0;
export const newId = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Data de hoje que se atualiza sozinha na virada do dia (e do mês). */
function useToday() {
  const [today, setToday] = useState(() => todayISO());
  useEffect(() => {
    const t = setInterval(() => setToday((prev) => {
      const now = todayISO();
      return now === prev ? prev : now;
    }), 30000);
    return () => clearInterval(t);
  }, []);
  return today;
}

export function AppProvider({ children }) {
  const [boot] = useState(() => loadAll());
  const [state, rawDispatch] = useReducer(reducer, boot.state);
  const [toasts, setToasts] = useState([]);
  const today = useToday();
  const saveErrorShown = useRef(false);

  const toast = useCallback((type, message) => {
    const id = newId('t');
    setToasts((list) => [...list, { id, type, message }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), type === 'error' ? 6000 : 3200);
  }, []);
  const dismissToast = useCallback((id) => setToasts((l) => l.filter((t) => t.id !== id)), []);

  const dispatch = useCallback(
    (type, payload) =>
      rawDispatch({ type, payload, meta: { hid: newId('h'), at: new Date().toISOString() } }),
    [],
  );

  // avisos de carga (dados corrompidos / armazenamento indisponível)
  useEffect(() => {
    boot.issues.forEach((m) => toast('error', m));
  }, [boot, toast]);

  // persistência: cada área em sua chave, só quando muda
  const lastSaved = useRef({});
  useEffect(() => {
    for (const slice of SLICES) {
      if (lastSaved.current[slice] === state[slice]) continue;
      lastSaved.current[slice] = state[slice];
      const res = saveSlice(slice, state[slice]);
      if (!res.ok && !saveErrorShown.current) {
        saveErrorShown.current = true;
        toast('error', res.error);
      }
    }
  }, [state, toast]);

  // recorrentes: gera os meses que faltam até o mês atual (inicial e na virada do mês)
  const currentMonth = monthKeyOf(today);
  useEffect(() => {
    dispatch('ENSURE_RECURRING', { uptoMonth: currentMonth });
  }, [currentMonth, dispatch]);

  const byDay = useMemo(() => earningsByDay(state.earnings), [state.earnings]);

  const fmt = useMemo(() => {
    const { hideValues, showCents } = state.settings.display;
    return {
      money: (cents) => (hideValues ? 'R$ •••••' : formatBRL(cents, { showCents })),
      hidden: hideValues,
    };
  }, [state.settings.display]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      today,
      currentMonth,
      byDay,
      fmt,
      toast,
      toasts,
      dismissToast,
      storageIssues: boot.issues,
      /** limite para gerar recorrentes ao navegar: até 12 meses à frente */
      ensureMonth: (month) => dispatch('ENSURE_RECURRING', { uptoMonth: month > addMonths(currentMonth, 12) ? addMonths(currentMonth, 12) : month }),
    }),
    [state, dispatch, today, currentMonth, byDay, fmt, toast, toasts, dismissToast, boot],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp deve ser usado dentro de <AppProvider>');
  return ctx;
}
