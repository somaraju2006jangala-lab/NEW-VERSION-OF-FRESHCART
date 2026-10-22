import { Product, PackSizeOption } from '../types';

/**
 * Standard default pack size options for common grocery units.
 * Ensures that if a product does not yet have custom admin-configured pack sizes,
 * realistic and proportional pack sizes are generated from its actual unit and price.
 */
export function getDefaultPackSizes(product: {
  id?: string;
  title?: string;
  unit: string;
  price: number;
  packSizes?: PackSizeOption[];
}): PackSizeOption[] {
  // If actual configured pack sizes already exist, use them directly
  if (Array.isArray(product.packSizes) && product.packSizes.length > 0) {
    return product.packSizes;
  }

  const baseUnit = (product.unit || '1 kg').trim();
  const basePrice = Math.max(1, Number(product.price) || 0);
  const lowerUnit = baseUnit.toLowerCase();

  // 1. Kilogram based (e.g., '1 kg', '2 kg')
  if (lowerUnit === '1 kg' || lowerUnit === '1kg') {
    return [
      { size: '250 g', price: Math.max(1, Math.round(basePrice * 0.29)) },
      { size: '500 g', price: Math.max(1, Math.round(basePrice * 0.55)) },
      { size: '1 kg', price: basePrice },
      { size: '2 kg', price: Math.max(1, Math.round(basePrice * 1.88)) },
    ];
  }

  // 2. 500 grams based (e.g., '500 g')
  if (lowerUnit === '500 g' || lowerUnit === '500g') {
    return [
      { size: '250 g', price: Math.max(1, Math.round(basePrice * 0.55)) },
      { size: '500 g', price: basePrice },
      { size: '1 kg', price: Math.max(1, Math.round(basePrice * 1.88)) },
    ];
  }

  // 3. 250 grams based
  if (lowerUnit === '250 g' || lowerUnit === '250g') {
    return [
      { size: '100 g', price: Math.max(1, Math.round(basePrice * 0.45)) },
      { size: '250 g', price: basePrice },
      { size: '500 g', price: Math.max(1, Math.round(basePrice * 1.88)) },
    ];
  }

  // 4. 100 grams based (e.g., Turmeric, Spices)
  if (lowerUnit === '100 g' || lowerUnit === '100g') {
    return [
      { size: '50 g', price: Math.max(1, Math.round(basePrice * 0.6)) },
      { size: '100 g', price: basePrice },
      { size: '250 g', price: Math.max(1, Math.round(basePrice * 2.33)) },
    ];
  }

  // 5. 500 ml based (e.g., Milk, Yogurt)
  if (lowerUnit === '500 ml' || lowerUnit === '500ml') {
    return [
      { size: '250 ml', price: Math.max(1, Math.round(basePrice * 0.6)) },
      { size: '500 ml', price: basePrice },
      { size: '1 litre', price: Math.max(1, Math.round(basePrice * 1.93)) },
    ];
  }

  // 6. 1 litre based (e.g., Juice, Oils)
  if (lowerUnit === '1 litre' || lowerUnit === '1l' || lowerUnit === '1 liter') {
    return [
      { size: '250 ml', price: Math.max(1, Math.round(basePrice * 0.32)) },
      { size: '500 ml', price: Math.max(1, Math.round(basePrice * 0.56)) },
      { size: '1 litre', price: basePrice },
      { size: '2 litres', price: Math.max(1, Math.round(basePrice * 1.9)) },
    ];
  }

  // 7. Piece based (e.g., Sourdough, Bread)
  if (lowerUnit.includes('piece') || lowerUnit.includes('pc')) {
    return [
      { size: '1 piece', price: basePrice },
      { size: '2 pieces', price: Math.max(1, Math.round(basePrice * 1.88)) },
      { size: '4 pieces', price: Math.max(1, Math.round(basePrice * 3.6)) },
    ];
  }

  // 8. Packet based (e.g., Avocados 4-pack)
  if (lowerUnit.includes('packet') || lowerUnit.includes('pack')) {
    return [
      { size: '1 packet', price: basePrice },
      { size: '2 packets', price: Math.max(1, Math.round(basePrice * 1.89)) },
    ];
  }

  // 9. Dozen based (e.g., Eggs)
  if (lowerUnit.includes('dozen')) {
    return [
      { size: '6 pieces', price: Math.max(1, Math.round(basePrice * 0.54)) },
      { size: '1 dozen', price: basePrice },
      { size: '2 dozen', price: Math.max(1, Math.round(basePrice * 1.92)) },
    ];
  }

  // 10. Bunch based (e.g., Coriander, Herbs)
  if (lowerUnit.includes('bunch')) {
    return [
      { size: '1 bunch', price: basePrice },
      { size: '2 bunches', price: Math.max(1, Math.round(basePrice * 1.8)) },
      { size: '3 bunches', price: Math.max(1, Math.round(basePrice * 2.5)) },
    ];
  }

  // Fallback default: base unit and double pack
  return [
    { size: baseUnit, price: basePrice },
    { size: `2 × ${baseUnit}`, price: Math.max(1, Math.round(basePrice * 1.9)) },
  ];
}

/**
 * Returns the effective pack sizes for a product, ensuring the list is never empty
 * and contains valid prices.
 */
export function getProductPackSizes(product: Product): PackSizeOption[] {
  if (product.packSizes && product.packSizes.length > 0) {
    return product.packSizes;
  }
  return getDefaultPackSizes(product);
}
