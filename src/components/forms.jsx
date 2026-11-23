import { useState } from 'react';
import { EXPENSE_TYPES, STATUS, STATUS_LABEL } from '../constants.js';
import { newId, useApp } from '../state/AppContext.jsx';
import { monthEnd, monthStart } from '../utils/dates.js';
import {
  amountCentsFrom,
  centsToInput,
  milliToInput,
  parseLitersToMilli,
  parseMoneyToCents,
  parsePriceToMilli,
  priceMilliFrom,
} from '../utils/money.js';
import { validateEarning, validateExpense, validateFuel } from '../utils/validation.js';
import { Field, Modal } from './ui.jsx';

function useForm(initial) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((er) => (er[key] ? { ...er, [key]: undefined } : er));
  };
  return { form, setForm, errors, setErrors, set };
}

function FormFooter({ onClose, formId, label }) {
  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      <button type="submit" form={formId} className="btn btn-primary">{label}</button>
    </>
  );
}

// ---------------------------------------------------------------- Ganho
export function EarningModal({ initial, defaultDate, onClose }) {
  const { state, dispatch, toast, today } = useApp();
  const editing = Boolean(initial);
  const { form, errors, setErrors, set } = useForm({
    description: initial?.description ?? '',
    amount: initial ? centsToInput(initial.amountCents) : '',
    date: initial?.date ?? defaultDate ?? today,
    category: initial?.category ?? '',
  });

  const submit = (e) => {
    e.preventDefault();
    const r = validateEarning(form);
    if (!r.ok) return setErrors(r.errors);
    if (editing) dispatch('UPDATE_EARNING', { id: initial.id, changes: r.value });
    else dispatch('ADD_EARNING', { earning: { id: newId('e'), ...r.value } });
    toast('success', editing ? 'Ganho atualizado.' : 'Ganho registrado.');
    onClose();
  };

  return (
    <Modal title={editing ? 'Editar ganho' : 'Novo ganho'} onClose={onClose} footer={<FormFooter onClose={onClose} formId="earning-form" label={editing ? 'Salvar' : 'Adicionar'} />}>
      <form id="earning-form" className="form" onSubmit={submit} noValidate>
        <Field label="Descrição" htmlFor="e-desc" error={errors.description}>
          <input id="e-desc" value={form.description} onChange={set('description')} maxLength={120} placeholder="Ex.: Serviço, venda, corrida..." />
        </Field>
        <div className="form-row">
          <Field label="Valor (R$)" htmlFor="e-amount" error={errors.amount}>
            <input id="e-amount" inputMode="decimal" value={form.amount} onChange={set('amount')} placeholder="0,00" />
          </Field>
          <Field label="Data" htmlFor="e-date" error={errors.date}>
            <input id="e-date" type="date" value={form.date} onChange={set('date')} />
          </Field>
        </div>
        <Field label="Categoria (opcional)" htmlFor="e-cat">
          <select id="e-cat" value={form.category} onChange={set('category')}>
            <option value="">Sem categoria</option>
            {state.settings.earningCategories.map((c) => <option key={c}>{c}</option>)}
            {form.category && !state.settings.earningCategories.includes(form.category) && <option>{form.category}</option>}
          </select>
        </Field>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- Despesa
export function ExpenseModal({ initial, defaultMonth, onClose }) {
  const { state, dispatch, toast, today, currentMonth } = useApp();
  const editing = Boolean(initial);
  const isRecurringInstance = Boolean(initial?.recurringId);
  const defaultDue = defaultMonth && defaultMonth !== currentMonth ? monthStart(defaultMonth) : today;
  const { form, errors, setErrors, set, setForm } = useForm({
    name: initial?.name ?? '',
    amount: initial ? centsToInput(initial.amountCents) : '',
    category: initial?.category ?? state.settings.expenseCategories[0],
    type: initial?.type ?? 'Variável',
    dueDate: initial?.dueDate ?? defaultDue,
    status: initial?.status ?? STATUS.PENDING,
    recurrence: initial?.recurrence ?? 'none',
    description: initial?.description ?? '',
    applyToFuture: false,
  });

  const submit = (e) => {
    e.preventDefault();
    const r = validateExpense(form);
    if (!r.ok) return setErrors(r.errors);
    const uptoMonth = currentMonth;
    if (editing) {
      const { recurrence, ...changes } = r.value;
      dispatch('UPDATE_EXPENSE', {
        id: initial.id,
        changes: isRecurringInstance ? changes : { ...changes, recurrence },
        applyToFuture: isRecurringInstance && form.applyToFuture,
        uptoMonth,
      });
    } else {
      dispatch('ADD_EXPENSE', { expense: { id: newId('x'), ...r.value }, uptoMonth });
    }
    toast('success', editing ? 'Despesa atualizada.' : 'Despesa registrada.');
    onClose();
  };

  const categories = state.settings.expenseCategories;
  const recurringMonth = initial?.monthKey;

  return (
    <Modal title={editing ? 'Editar despesa' : 'Nova despesa'} onClose={onClose} footer={<FormFooter onClose={onClose} formId="expense-form" label={editing ? 'Salvar' : 'Adicionar'} />}>
      <form id="expense-form" className="form" onSubmit={submit} noValidate>
        <Field label="Nome" htmlFor="x-name" error={errors.name}>
          <input id="x-name" value={form.name} onChange={set('name')} maxLength={80} placeholder="Ex.: Aluguel, internet, mercado..." />
        </Field>
        <div className="form-row">
          <Field label="Valor (R$)" htmlFor="x-amount" error={errors.amount}>
            <input id="x-amount" inputMode="decimal" value={form.amount} onChange={set('amount')} placeholder="0,00" />
          </Field>
          <Field label="Vencimento" htmlFor="x-due" error={errors.dueDate}>
            <input
              id="x-due"
              type="date"
              value={form.dueDate}
              onChange={set('dueDate')}
              min={recurringMonth ? monthStart(recurringMonth) : undefined}
              max={recurringMonth ? monthEnd(recurringMonth) : undefined}
            />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Categoria" htmlFor="x-cat" error={errors.category}>
            <select id="x-cat" value={form.category} onChange={set('category')}>
              {categories.map((c) => <option key={c}>{c}</option>)}
              {!categories.includes(form.category) && <option>{form.category}</option>}
            </select>
          </Field>
          <Field label="Tipo" htmlFor="x-type" error={errors.type}>
            <select id="x-type" value={form.type} onChange={set('type')}>
              {EXPENSE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <div className="form-row">
          <Field label="Status" htmlFor="x-status">
            <select id="x-status" value={form.status} onChange={set('status')}>
              {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field
            label="Recorrência"
            htmlFor="x-rec"
            hint={isRecurringInstance ? 'Para encerrar, exclua esta e as próximas.' : form.recurrence === 'monthly' ? 'Será criada uma despesa por mês, sem duplicar.' : undefined}
          >
            <select id="x-rec" value={form.recurrence} onChange={set('recurrence')} disabled={isRecurringInstance}>
              <option value="none">Não recorrente</option>
              <option value="monthly">Mensal</option>
            </select>
          </Field>
        </div>
        <Field label="Descrição (opcional)" htmlFor="x-desc">
          <input id="x-desc" value={form.description} onChange={set('description')} maxLength={200} />
        </Field>
        {isRecurringInstance && (
          <label className="check">
            <input type="checkbox" checked={form.applyToFuture} onChange={set('applyToFuture')} />
            Aplicar nome, valor, categoria e tipo às próximas despesas pendentes desta recorrência
          </label>
        )}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- Combustível
export function FuelModal({ initial, onClose }) {
  const { dispatch, toast, today } = useApp();
  const editing = Boolean(initial);
  const { form, setForm, errors, setErrors, set } = useForm({
    date: initial?.date ?? today,
    amount: initial ? centsToInput(initial.amountCents) : '',
    liters: initial ? milliToInput(initial.litersMilli) : '',
    price: initial ? milliToInput(initial.priceMilli) : '',
    note: initial?.note ?? '',
  });

  // Valor, litros e preço/litro se relacionam: ao editar dois deles o terceiro é calculado.
  const onAmount = (e) => {
    const amount = e.target.value;
    setForm((f) => {
      const c = parseMoneyToCents(amount);
      const l = parseLitersToMilli(f.liters);
      return { ...f, amount, price: c && l ? milliToInput(priceMilliFrom(c, l)) : f.price };
    });
    setErrors((er) => ({ ...er, amount: undefined }));
  };
  const onLiters = (e) => {
    const liters = e.target.value;
    setForm((f) => {
      const l = parseLitersToMilli(liters);
      const p = parsePriceToMilli(f.price);
      const c = parseMoneyToCents(f.amount);
      if (l && p && !c) return { ...f, liters, amount: centsToInput(amountCentsFrom(p, l)) };
      if (l && c) return { ...f, liters, price: milliToInput(priceMilliFrom(c, l)) };
      return { ...f, liters };
    });
    setErrors((er) => ({ ...er, liters: undefined }));
  };
  const onPrice = (e) => {
    const price = e.target.value;
    setForm((f) => {
      const p = parsePriceToMilli(price);
      const l = parseLitersToMilli(f.liters);
      return { ...f, price, amount: p && l ? centsToInput(amountCentsFrom(p, l)) : f.amount };
    });
  };

  const submit = (e) => {
    e.preventDefault();
    const r = validateFuel(form);
    if (!r.ok) return setErrors(r.errors);
    if (editing) dispatch('UPDATE_FUEL', { id: initial.id, changes: r.value });
    else dispatch('ADD_FUEL', { fuel: { id: newId('f'), ...r.value } });
    toast('success', editing ? 'Abastecimento atualizado.' : 'Abastecimento registrado e lançado nas despesas.');
    onClose();
  };

  return (
    <Modal title={editing ? 'Editar abastecimento' : 'Novo abastecimento'} onClose={onClose} footer={<FormFooter onClose={onClose} formId="fuel-form" label={editing ? 'Salvar' : 'Adicionar'} />}>
      <form id="fuel-form" className="form" onSubmit={submit} noValidate>
        <Field label="Data" htmlFor="f-date" error={errors.date}>
          <input id="f-date" type="date" value={form.date} onChange={set('date')} />
        </Field>
        <div className="form-row">
          <Field label="Valor pago (R$)" htmlFor="f-amount" error={errors.amount}>
            <input id="f-amount" inputMode="decimal" value={form.amount} onChange={onAmount} placeholder="0,00" />
          </Field>
          <Field label="Litros" htmlFor="f-liters" error={errors.liters}>
            <input id="f-liters" inputMode="decimal" value={form.liters} onChange={onLiters} placeholder="0,00" />
          </Field>
        </div>
        <Field label="Preço por litro (R$)" htmlFor="f-price" hint="Calculado automaticamente; você também pode digitar o preço e os litros.">
          <input id="f-price" inputMode="decimal" value={form.price} onChange={onPrice} placeholder="0,000" />
        </Field>
        <Field label="Observação (opcional)" htmlFor="f-note">
          <input id="f-note" value={form.note} onChange={set('note')} maxLength={200} />
        </Field>
        <p className="field-hint">O abastecimento é lançado automaticamente nas despesas (categoria Transporte, paga), uma única vez.</p>
      </form>
    </Modal>
  );
}

