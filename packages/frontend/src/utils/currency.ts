// ========================================================================
// Central School Currency & Localization Formatting Helper & Hook
// Provides standard currency formatting across all tables, cards, forms,
// and reports, dynamically driven by the school's configured localization settings.
// NEVER silently converts historical monetary values.
// ========================================================================

import { useAuth } from '../context/AuthContext.js';

export interface CurrencyFormatOptions {
  symbol?: string;
  position?: 'BEFORE' | 'AFTER';
  decimalPlaces?: number;
  locale?: string;
}

/**
 * Format a numeric amount using the specified currency symbol and positioning.
 */
export function formatCurrency(
  amount: number | string | undefined | null,
  symbolOrOptions: string | CurrencyFormatOptions = '₹',
  positionArg: 'BEFORE' | 'AFTER' = 'BEFORE',
  decimalPlacesArg: number = 2,
  localeArg: string = 'en-IN'
): string {
  let symbol = '₹';
  let position: 'BEFORE' | 'AFTER' = 'BEFORE';
  let decimalPlaces = 2;
  let locale = 'en-IN';

  if (typeof symbolOrOptions === 'object' && symbolOrOptions !== null) {
    symbol = symbolOrOptions.symbol ?? '₹';
    position = symbolOrOptions.position ?? 'BEFORE';
    decimalPlaces = symbolOrOptions.decimalPlaces ?? 2;
    locale = symbolOrOptions.locale ?? 'en-IN';
  } else {
    symbol = symbolOrOptions || '₹';
    position = positionArg || 'BEFORE';
    decimalPlaces = typeof decimalPlacesArg === 'number' ? decimalPlacesArg : 2;
    locale = localeArg || 'en-IN';
  }

  const num = Number(amount || 0);
  const safeNum = isNaN(num) ? 0 : num;

  let formattedNumber: string;
  try {
    formattedNumber = safeNum.toLocaleString(locale, {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    });
  } catch {
    formattedNumber = safeNum.toFixed(decimalPlaces);
  }

  return position === 'AFTER'
    ? `${formattedNumber} ${symbol}`
    : `${symbol}${formattedNumber}`;
}

/**
 * React hook to access the active school's currency symbol and formatter.
 */
export function useCurrency() {
  const { userContext } = useAuth();

  const currency = userContext?.currency || 'INR';
  const symbol = userContext?.currency_symbol || (currency === 'USD' ? '$' : '₹');
  const position = userContext?.currency_position || (currency === 'EUR' ? 'AFTER' : 'BEFORE');
  const decimalPlaces = typeof userContext?.decimal_places === 'number' ? userContext.decimal_places : 2;
  const locale = userContext?.locale || (currency === 'USD' ? 'en-US' : currency === 'EUR' ? 'de-DE' : currency === 'GBP' ? 'en-GB' : 'en-IN');

  const format = (
    amount: number | string | undefined | null,
    overrideDecimals?: number
  ): string => {
    return formatCurrency(amount, {
      symbol,
      position,
      decimalPlaces: typeof overrideDecimals === 'number' ? overrideDecimals : decimalPlaces,
      locale,
    });
  };

  const formatAmountOnly = (
    amount: number | string | undefined | null,
    overrideDecimals?: number
  ): string => {
    const num = Number(amount || 0);
    const safeNum = isNaN(num) ? 0 : num;
    const dec = typeof overrideDecimals === 'number' ? overrideDecimals : decimalPlaces;
    try {
      return safeNum.toLocaleString(locale, {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      });
    } catch {
      return safeNum.toFixed(dec);
    }
  };

  return {
    currency,
    symbol,
    position,
    decimalPlaces,
    locale,
    format,
    formatCurrency: format,
    formatAmountOnly,
  };
}
