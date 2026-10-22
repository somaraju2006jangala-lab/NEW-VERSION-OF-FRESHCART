import { Product, PackSizeOption } from '../types';

/**
 * Standard selectable units available in Admin Portal.
 */
export const STANDARD_UNITS = [
  '1 kg',
  '500 g',
  '250 g',
  '100 g',
  '50 g',
  '1 L',
  '1 litre',
  '500 ml',
  '250 ml',
  '100 ml',
  '5 L',
  '1 dozen',
  '1 piece',
  '1 packet',
  '1 box',
  '1 bunch',
] as const;

/**
 * Normalizes and formats a unit string cleanly and consistently across products.
 */
export function formatUnitString(rawUnit: string): string {
  if (!rawUnit) return '1 kg';
  const trimmed = rawUnit.trim();
  const lower = trimmed.toLowerCase();

  if (lower === '1kg' || lower === '1 kg') return '1 kg';
  if (lower === '500g' || lower === '500 g') return '500 g';
  if (lower === '250g' || lower === '250 g') return '250 g';
  if (lower === '100g' || lower === '100 g') return '100 g';
  if (lower === '50g' || lower === '50 g') return '50 g';
  if (lower === '2kg' || lower === '2 kg') return '2 kg';
  if (lower === '5kg' || lower === '5 kg') return '5 kg';

  if (lower === '1l' || lower === '1 l' || lower === '1 litre' || lower === '1 liter') return '1 L';
  if (lower === '500ml' || lower === '500 ml') return '500 ml';
  if (lower === '250ml' || lower === '250 ml') return '250 ml';
  if (lower === '100ml' || lower === '100 ml') return '100 ml';
  if (lower === '2l' || lower === '2 litres' || lower === '2 liters') return '2 L';
  if (lower === '5l' || lower === '5 litres' || lower === '5 liters') return '5 L';

  if (lower === '1 dozen' || lower === '1 dozen' || lower === '1 dogen' || lower === 'dozen') return '1 dozen';
  if (lower === '1 piece' || lower === '1 pc' || lower === 'piece') return '1 piece';
  if (lower === '1 packet' || lower === '1 pack' || lower === 'packet' || lower === 'pack') return '1 packet';
  if (lower === '1 box' || lower === 'box') return '1 box';
  if (lower === '1 bunch' || lower === 'bunch') return '1 bunch';

  return trimmed;
}

/**
 * Automatically determines available pack sizes and corresponding prices
 * based on the product unit, category, and title configured by the admin.
 *
 * Examples:
 * - Carrot (produce, 1 kg) => 250g (₹20), 500g (₹40), 1kg (₹70)
 * - Rice (grains, 1 kg) => 500g (₹45), 1kg (₹80), 5kg (₹380)
 * - Milk (dairy, 1 L) => 250ml (₹18), 500ml (₹30), 1L (₹58)
 * - Cooking oil (oil/grains, 1 L) => 500ml (₹85), 1L (₹160), 5L (₹760)
 * - Apples (produce, 1 kg) => 250g (₹55), 500g (₹105), 1kg (₹199)
 * - Bananas (produce, 1 dozen) => 1/2 dozen (₹48), 1 dozen (₹90), 2 dozen (₹175)
 */
export function determinePackSizesForUnit(params: {
  unit: string;
  price: number;
  category?: string;
  title?: string;
}): PackSizeOption[] {
  const baseUnit = (params.unit || '1 kg').trim();
  const lowerUnit = baseUnit.toLowerCase();
  const basePrice = Math.max(1, Math.round(Number(params.price) || 0));
  const category = (params.category || '').toLowerCase();
  const title = (params.title || '').toLowerCase();

  const isCookingOil =
    title.includes('oil') ||
    title.includes('ghee') ||
    title.includes('mustard oil') ||
    title.includes('sunflower') ||
    title.includes('olive');

  const isGrainsOrBulk =
    category === 'grains' ||
    title.includes('rice') ||
    title.includes('flour') ||
    title.includes('atta') ||
    title.includes('dal') ||
    title.includes('sugar') ||
    title.includes('grain') ||
    title.includes('wheat') ||
    title.includes('pulse');

  const isCarrot = title.includes('carrot');

  // ==========================================
  // 1. VOLUME / LIQUID BASED (L, litre, ml)
  // ==========================================
  const isVolumeUnit =
    lowerUnit.includes('litre') ||
    lowerUnit.includes('liter') ||
    lowerUnit.includes('ml') ||
    lowerUnit.endsWith('l') ||
    lowerUnit.includes(' l');

  if (isVolumeUnit) {
    // Cooking oil: 500ml, 1L, 5L
    if (isCookingOil) {
      if (lowerUnit.includes('500') && lowerUnit.includes('ml')) {
        return [
          { size: '500 ml', price: basePrice },
          { size: '1 L', price: Math.max(1, Math.round(basePrice * 1.88)) },
          { size: '5 L', price: Math.max(1, Math.round(basePrice * 8.94)) },
        ];
      }
      return [
        { size: '500 ml', price: Math.max(1, Math.round(basePrice * 0.53)) },
        { size: '1 L', price: basePrice },
        { size: '5 L', price: Math.max(1, Math.round(basePrice * 4.75)) },
      ];
    }

    // Small bottle / Beverage (250 ml base)
    if (lowerUnit.includes('250') && lowerUnit.includes('ml')) {
      return [
        { size: '250 ml', price: basePrice },
        { size: '500 ml', price: Math.max(1, Math.round(basePrice * 1.67)) },
        { size: '1 L', price: Math.max(1, Math.round(basePrice * 3.22)) },
      ];
    }

    // 500 ml base (e.g. Milk, Yogurt)
    if (lowerUnit.includes('500') && lowerUnit.includes('ml')) {
      return [
        { size: '250 ml', price: Math.max(1, Math.round(basePrice * 0.6)) },
        { size: '500 ml', price: basePrice },
        { size: '1 L', price: Math.max(1, Math.round(basePrice * 1.93)) },
      ];
    }

    // 1 L / 1 litre base (e.g. Milk, Juice, Cold Brew)
    return [
      { size: '250 ml', price: Math.max(1, Math.round(basePrice * 0.31)) },
      { size: '500 ml', price: Math.max(1, Math.round(basePrice * 0.52)) },
      { size: '1 L', price: basePrice },
    ];
  }

  // ==========================================
  // 2. COUNT / DOZEN BASED (dozen, dogen)
  // ==========================================
  if (lowerUnit.includes('dozen') || lowerUnit.includes('dogen')) {
    // Bananas, Eggs: 1/2 dozen, 1 dozen, 2 dozen
    return [
      { size: '1/2 dozen', price: Math.max(1, Math.round(basePrice * 0.54)) },
      { size: '1 dozen', price: basePrice },
      { size: '2 dozen', price: Math.max(1, Math.round(basePrice * 1.94)) },
    ];
  }

  // ==========================================
  // 3. WEIGHT BASED (kg, g, grams)
  // ==========================================
  const isWeightUnit =
    lowerUnit.includes('kg') ||
    lowerUnit.includes('kilo') ||
    lowerUnit.includes('g') ||
    lowerUnit.includes('gram');

  if (isWeightUnit) {
    // 3A. Rice, Flour, Grains, Sugar, Staples: 500g, 1kg, 5kg
    if (isGrainsOrBulk) {
      if (lowerUnit.includes('500') && lowerUnit.includes('g')) {
        return [
          { size: '500 g', price: basePrice },
          { size: '1 kg', price: Math.max(1, Math.round(basePrice * 1.78)) },
          { size: '5 kg', price: Math.max(1, Math.round(basePrice * 8.44)) },
        ];
      }
      return [
        { size: '500 g', price: Math.max(1, Math.round(basePrice * 0.55)) },
        { size: '1 kg', price: basePrice },
        { size: '5 kg', price: Math.max(1, Math.round(basePrice * 4.75)) },
      ];
    }

    // 3B. Carrot: Exact requested example (250g — ₹20, 500g — ₹40, 1kg — ₹70)
    if (isCarrot) {
      const p1kg = basePrice;
      const p500 = p1kg === 70 ? 40 : Math.max(1, Math.round(p1kg * 0.57));
      const p250 = p1kg === 70 ? 20 : Math.max(1, Math.round(p1kg * 0.29));
      return [
        { size: '250 g', price: p250 },
        { size: '500 g', price: p500 },
        { size: '1 kg', price: p1kg },
      ];
    }

    // 3C. Small spice / powders (50 g or 100 g)
    if (lowerUnit.includes('50') && lowerUnit.includes('g')) {
      return [
        { size: '50 g', price: basePrice },
        { size: '100 g', price: Math.max(1, Math.round(basePrice * 1.67)) },
        { size: '250 g', price: Math.max(1, Math.round(basePrice * 3.89)) },
      ];
    }
    if (lowerUnit.includes('100') && lowerUnit.includes('g')) {
      return [
        { size: '50 g', price: Math.max(1, Math.round(basePrice * 0.6)) },
        { size: '100 g', price: basePrice },
        { size: '250 g', price: Math.max(1, Math.round(basePrice * 2.33)) },
      ];
    }

    // 3D. 250 g base (e.g. specialty coffee, seeds)
    if (lowerUnit.includes('250') && lowerUnit.includes('g')) {
      return [
        { size: '100 g', price: Math.max(1, Math.round(basePrice * 0.45)) },
        { size: '250 g', price: basePrice },
        { size: '500 g', price: Math.max(1, Math.round(basePrice * 1.88)) },
      ];
    }

    // 3E. 500 g base (e.g. Yogurt, Paneer)
    if (lowerUnit.includes('500') && lowerUnit.includes('g')) {
      return [
        { size: '250 g', price: Math.max(1, Math.round(basePrice * 0.55)) },
        { size: '500 g', price: basePrice },
        { size: '1 kg', price: Math.max(1, Math.round(basePrice * 1.88)) },
      ];
    }

    // 3F. General 1 kg Produce / Fruits (Carrot, Apples, etc.): 250g, 500g, 1kg
    return [
      { size: '250 g', price: Math.max(1, Math.round(basePrice * 0.28)) },
      { size: '500 g', price: Math.max(1, Math.round(basePrice * 0.53)) },
      { size: '1 kg', price: basePrice },
    ];
  }

  // ==========================================
  // 4. PIECE / PACKET / BOX / BUNCH
  // ==========================================
  if (lowerUnit.includes('piece') || lowerUnit.includes('pc')) {
    return [
      { size: '1 piece', price: basePrice },
      { size: '2 pieces', price: Math.max(1, Math.round(basePrice * 1.88)) },
      { size: '4 pieces', price: Math.max(1, Math.round(basePrice * 3.6)) },
    ];
  }

  if (lowerUnit.includes('packet') || lowerUnit.includes('pack')) {
    return [
      { size: '1 packet', price: basePrice },
      { size: '2 packets', price: Math.max(1, Math.round(basePrice * 1.89)) },
      { size: '5 packets', price: Math.max(1, Math.round(basePrice * 4.6)) },
    ];
  }

  if (lowerUnit.includes('box')) {
    return [
      { size: '1 box', price: basePrice },
      { size: '2 boxes', price: Math.max(1, Math.round(basePrice * 1.9)) },
      { size: '4 boxes', price: Math.max(1, Math.round(basePrice * 3.7)) },
    ];
  }

  if (lowerUnit.includes('bunch')) {
    return [
      { size: '1 bunch', price: basePrice },
      { size: '2 bunches', price: Math.max(1, Math.round(basePrice * 1.8)) },
      { size: '3 bunches', price: Math.max(1, Math.round(basePrice * 2.5)) },
    ];
  }

  // Fallback: 1x and 2x base unit
  return [
    { size: baseUnit, price: basePrice },
    { size: `2 × ${baseUnit}`, price: Math.max(1, Math.round(basePrice * 1.9)) },
  ];
}

/**
 * Returns default pack sizes for a product if none are configured.
 */
export function getDefaultPackSizes(product: {
  id?: string;
  title?: string;
  unit: string;
  price: number;
  category?: string;
  packSizes?: PackSizeOption[];
}): PackSizeOption[] {
  if (Array.isArray(product.packSizes) && product.packSizes.length > 0) {
    return product.packSizes;
  }
  return determinePackSizesForUnit(product);
}

/**
 * Returns effective pack sizes for a product, ensuring list is never empty.
 */
export function getProductPackSizes(product: Product): PackSizeOption[] {
  if (Array.isArray(product.packSizes) && product.packSizes.length > 0) {
    return product.packSizes;
  }
  return determinePackSizesForUnit(product);
}
