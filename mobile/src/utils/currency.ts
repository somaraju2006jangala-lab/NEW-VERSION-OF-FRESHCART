/**
 * Currency utility for Indian Rupees (₹ / INR) formatting in FreshCart Mobile.
 * Uses Intl.NumberFormat with 'en-IN' locale.
 * Formats integers without unnecessary trailing decimals (e.g. ₹99, ₹499, ₹1,299)
 * and formats fractional values with 2 decimals (e.g. ₹49.50).
 */
export const formatINR = (amount: number | string | null | undefined, forceDecimals = false): string => {
  const num = typeof amount === 'number' ? amount : Number(amount);
  if (isNaN(num) || num === null || num === undefined) {
    return '₹0';
  }

  const hasDecimals = num % 1 !== 0;

  try {
    const formatted = new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: hasDecimals || forceDecimals ? 2 : 0,
      minimumFractionDigits: hasDecimals || forceDecimals ? 2 : 0,
    }).format(num);
    return `₹${formatted}`;
  } catch {
    return `₹${hasDecimals || forceDecimals ? num.toFixed(2) : Math.round(num)}`;
  }
};

