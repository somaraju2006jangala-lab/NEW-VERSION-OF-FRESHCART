/**
 * Formats a numeric currency amount into Indian Rupees (INR / ₹)
 * using the standard Indian locale ('en-IN') and number system.
 *
 * Examples:
 * - formatINR(99) -> "₹99"
 * - formatINR(499) -> "₹499"
 * - formatINR(1299) -> "₹1,299"
 * - formatINR(10999) -> "₹10,999"
 * - formatINR(99.5) -> "₹99.50"
 */
export const formatINR = (amount: number, forceDecimals = false): string => {
  if (isNaN(amount)) return '₹0';
  const hasDecimals = amount % 1 !== 0;

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: hasDecimals || forceDecimals ? 2 : 0,
    minimumFractionDigits: hasDecimals || forceDecimals ? 2 : 0,
  }).format(amount);
};
