// Todo valor monetário é guardado em CENTAVOS INTEIROS.
// Converta de/para texto apenas nas bordas (formulários e exibição).

/**
 * Converte texto/número em inteiro escalado (centavos = scale 2, milésimos = scale 3).
 * Aceita "1.234,56", "1234,56", "R$ 12,5", "12.5" e "1.500" (ponto de milhar).
 * Retorna null se inválido ou negativo.
 */
export function parseScaled(input, scale, { dotThousands = true } = {}) {
  const factor = 10 ** scale;
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) return null;
    return Math.round(input * factor);
  }
  if (typeof input !== 'string') return null;
  const s = input.replace(/R\$/gi, '').replace(/[\s ]/g, '');
  if (!s || !/^[\d.,]+$/.test(s)) return null;

  let intPart;
  let decPart = '';
  if (s.includes(',')) {
    const parts = s.split(',');
    if (parts.length !== 2) return null;
    intPart = parts[0].replace(/\./g, '');
    decPart = parts[1];
  } else if (s.includes('.')) {
    if (dotThousands && /^\d{1,3}(\.\d{3})+$/.test(s)) {
      intPart = s.replace(/\./g, '');
    } else {
      const parts = s.split('.');
      if (parts.length !== 2) return null;
      intPart = parts[0];
      decPart = parts[1];
    }
  } else {
    intPart = s;
  }
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(decPart)) return null;
  if (intPart === '' && decPart === '') return null;
  if (intPart.length > 12) return null;

  let value = parseInt(intPart || '0', 10) * factor;
  value += parseInt((decPart + '0'.repeat(scale)).slice(0, scale) || '0', 10);
  if (decPart.length > scale && decPart[scale] >= '5') value += 1; // arredonda meio para cima
  return Number.isSafeInteger(value) ? value : null;
}

export const parseMoneyToCents = (input) => parseScaled(input, 2);
export const parseLitersToMilli = (input) => parseScaled(input, 3, { dotThousands: false });
export const parsePriceToMilli = (input) => parseScaled(input, 3, { dotThousands: false });

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlNoCents = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatBRL(cents, { showCents = true } = {}) {
  const value = (Number.isFinite(cents) ? cents : 0) / 100;
  return (showCents ? brl : brlNoCents).format(value);
}

/** "1234,56" — para preencher campos de edição. */
export function centsToInput(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100);
  const c = String(abs % 100).padStart(2, '0');
  return `${sign}${reais},${c}`;
}

export function sumCents(list, pick = (x) => x) {
  let total = 0;
  for (const item of list) total += pick(item);
  return total;
}

/** Percentual para exibição (não usar em cálculo monetário). */
export function percentOf(part, whole) {
  if (!whole || whole <= 0) return 0;
  return (part * 100) / whole;
}

// ----- Combustível: litros em milésimos, preço/litro em milésimos de real -----

/** preço/litro (milésimos de real) = valor pago / litros */
export function priceMilliFrom(amountCents, litersMilli) {
  if (!litersMilli) return 0;
  return Math.round((amountCents * 10000) / litersMilli);
}

/** valor pago (centavos) = preço/litro × litros */
export function amountCentsFrom(priceMilli, litersMilli) {
  return Math.round((priceMilli * litersMilli) / 10000);
}

export function formatLiters(litersMilli) {
  return `${(litersMilli / 1000).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  })} L`;
}

export function formatPricePerLiter(priceMilli) {
  return `R$ ${(priceMilli / 1000).toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}/L`;
}

export function milliToInput(milli, decimals = 3) {
  return (milli / 10 ** decimals).toFixed(decimals).replace('.', ',');
}
