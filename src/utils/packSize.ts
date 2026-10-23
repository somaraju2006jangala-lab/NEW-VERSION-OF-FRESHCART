import { Product, PackSizeOption } from '../types';

/**
 * Standard unit options grouped by category.
 */
export const UNIT_TYPES = {
  WEIGHT: ['100 g', '250 g', '500 g', '1 kg', '2 kg', '5 kg'],
  VOLUME: ['100 ml', '250 ml', '500 ml', '1 litre', '2 litres', '5 litres'],
  PIECES: ['1 piece', '2 pieces', '4 pieces', '1 packet', '1 box', '1 bunch'],
  DOZEN: ['1/2 dozen', '1 dozen', '2 dozen'],
} as const;

/**
 * Standard selectable units available in Admin Portal.
 */
export const STANDARD_UNITS = [
  '100 g',
  '250 g',
  '500 g',
  '1 kg',
  '2 kg',
  '5 kg',
  '100 ml',
  '250 ml',
  '500 ml',
  '1 litre',
  '1 L',
  '2 litres',
  '5 litres',
  '1 piece',
  '2 pieces',
  '4 pieces',
  '1/2 dozen',
  '1 dozen',
  '2 dozen',
  '1 packet',
  '1 box',
  '1 bunch',
] as const;

/**
 * Standard selectable units in the Admin Portal unit dropdown.
 */
export const SELECTABLE_STANDARD_UNITS = [
  '100 g',
  '250 g',
  '500 g',
  '1 kg',
  '2 kg',
  '5 kg',
  '100 ml',
  '250 ml',
  '500 ml',
  '1 litre',
  '2 litres',
  '5 litres',
  '1 piece',
  '2 pieces',
  '4 pieces',
  '1 packet',
  '1 box',
  '1 bunch',
  '1/2 dozen',
  '1 dozen',
  '2 dozen',
] as const;

/**
 * Normalizes and formats a unit string cleanly and consistently across products.
 */
export function formatUnitString(rawUnit: string): string {
  if (!rawUnit) return '1 kg';
  const trimmed = rawUnit.trim();
  const lower = trimmed.toLowerCase();

  if (lower === '100g' || lower === '100 g') return '100 g';
  if (lower === '250g' || lower === '250 g') return '250 g';
  if (lower === '500g' || lower === '500 g') return '500 g';
  if (lower === '1kg' || lower === '1 kg') return '1 kg';
  if (lower === '2kg' || lower === '2 kg') return '2 kg';
  if (lower === '5kg' || lower === '5 kg') return '5 kg';

  if (lower === '100ml' || lower === '100 ml') return '100 ml';
  if (lower === '250ml' || lower === '250 ml') return '250 ml';
  if (lower === '500ml' || lower === '500 ml') return '500 ml';
  if (lower === '1l' || lower === '1 l' || lower === '1 litre' || lower === '1 liter') return '1 litre';
  if (lower === '2l' || lower === '2 litres' || lower === '2 liters') return '2 litres';
  if (lower === '5l' || lower === '5 litres' || lower === '5 liters') return '5 litres';

  if (lower === '1/2 dozen' || lower === '½ dozen' || lower === '0.5 dozen' || lower === 'half dozen') return '1/2 dozen';
  if (lower === '1 dozen' || lower === 'dozen' || lower === '1 dogen') return '1 dozen';
  if (lower === '2 dozen' || lower === '2 dogen') return '2 dozen';

  if (lower === '1 piece' || lower === '1 pc' || lower === 'piece') return '1 piece';
  if (lower === '2 pieces' || lower === '2 pcs') return '2 pieces';
  if (lower === '4 pieces' || lower === '4 pcs') return '4 pieces';
  if (lower === '1 packet' || lower === '1 pack' || lower === 'packet' || lower === 'pack') return '1 packet';
  if (lower === '1 box' || lower === 'box') return '1 box';
  if (lower === '1 bunch' || lower === 'bunch') return '1 bunch';

  return trimmed;
}

export interface ParsedUnitQuantity {
  amount: number;
  unitType: 'weight' | 'volume' | 'dozen' | 'count' | 'custom';
  baseUnits: number; // weight in grams, volume in ml, dozen/count in pieces
}

/**
 * Parses a unit string into its numeric value, unit type, and base equivalent.
 */
export function parseUnitQuantity(unitStr: string): ParsedUnitQuantity | null {
  if (!unitStr) return null;
  const raw = unitStr.trim().toLowerCase();

  // 1. Dozen
  if (raw.includes('dozen') || raw.includes('dogen') || raw.includes('½')) {
    if (raw.includes('1/2') || raw.includes('½') || raw.includes('0.5') || raw.includes('half')) {
      return { amount: 0.5, unitType: 'dozen', baseUnits: 6 };
    }
    const match = raw.match(/^([\d.]+)/);
    const amount = match ? parseFloat(match[1]) : 1;
    return { amount, unitType: 'dozen', baseUnits: amount * 12 };
  }

  // 2. Volume (ml, litre, liter, L)
  if (raw.includes('ml') || raw.includes('milli')) {
    const match = raw.match(/^([\d.]+)/);
    const amount = match ? parseFloat(match[1]) : 100;
    return { amount, unitType: 'volume', baseUnits: amount };
  }
  if (raw.includes('l') || raw.includes('litre') || raw.includes('liter')) {
    const match = raw.match(/^([\d.]+)/);
    const amount = match ? parseFloat(match[1]) : 1;
    return { amount, unitType: 'volume', baseUnits: amount * 1000 };
  }

  // 3. Weight (g, gm, gram, kg, kilo)
  if (raw.includes('kg') || raw.includes('kilo')) {
    const match = raw.match(/^([\d.]+)/);
    const amount = match ? parseFloat(match[1]) : 1;
    return { amount, unitType: 'weight', baseUnits: amount * 1000 };
  }
  if (raw.includes('g') || raw.includes('gram') || raw.includes('gm')) {
    const match = raw.match(/^([\d.]+)/);
    const amount = match ? parseFloat(match[1]) : 100;
    return { amount, unitType: 'weight', baseUnits: amount };
  }

  // 4. Pieces / Packets / Boxes
  if (raw.includes('piece') || raw.includes('pc') || raw.includes('pack') || raw.includes('box') || raw.includes('bunch')) {
    const match = raw.match(/^([\d.]+)/);
    const amount = match ? parseFloat(match[1]) : 1;
    return { amount, unitType: 'count', baseUnits: amount };
  }

  // 5. Custom
  const customMatch = raw.match(/^([\d.]+)/);
  const amount = customMatch ? parseFloat(customMatch[1]) : 1;
  return { amount, unitType: 'custom', baseUnits: amount };
}

/**
 * Calculates accurate conversion factor between pack size and product base unit.
 * E.g., 500 g from 1 kg = 0.5.
 * Returns null if units belong to different incompatible categories (e.g., grams vs litres).
 */
export function getPackSizeConversionFactor(packSize: string, baseUnit: string): number | null {
  if (!packSize || !baseUnit) return 1.0;
  const pNorm = formatUnitString(packSize).toLowerCase();
  const bNorm = formatUnitString(baseUnit).toLowerCase();

  if (pNorm === bNorm) return 1.0;

  const parsedPack = parseUnitQuantity(pNorm);
  const parsedBase = parseUnitQuantity(bNorm);

  if (!parsedPack || !parsedBase) return null;

  // Never mix weight with volume or pieces
  if (parsedPack.unitType !== parsedBase.unitType) {
    return null;
  }

  if (parsedBase.baseUnits <= 0) return 1.0;
  return parsedPack.baseUnits / parsedBase.baseUnits;
}

/**
 * Computes available stock for a specific pack size.
 * Uses pack-size-specific stock if explicitly configured by the admin;
 * otherwise calculates available packs from base inventory conversion.
 */
export function getPackStock(
  packSize: string | PackSizeOption,
  product: { stock: number; unit: string; packSizes?: PackSizeOption[] }
): number {
  const psObj: PackSizeOption =
    typeof packSize === 'string'
      ? product.packSizes?.find((p) => p.size.toLowerCase() === packSize.toLowerCase()) || {
          size: packSize,
          price: 0,
        }
      : packSize;

  if (psObj.isAvailable === false || (psObj as any).available === false) {
    return 0;
  }
  if (product.stock <= 0) {
    return 0;
  }
  if (psObj.stock !== undefined && psObj.stock !== null && !isNaN(psObj.stock)) {
    return Math.max(0, Number(psObj.stock));
  }

  const factor = getPackSizeConversionFactor(psObj.size, product.unit);
  if (factor && factor > 0) {
    return Math.max(0, Math.floor(product.stock / factor));
  }

  return Math.max(0, product.stock);
}

/**
 * Determines whether a pack size is currently available to customers.
 * Pack size must be enabled by admin and have stock > 0.
 */
export function isPackSizeAvailable(
  packSize: PackSizeOption,
  product: { stock: number; unit: string }
): boolean {
  const isEnabled = packSize.isAvailable !== false && (packSize as any).available !== false;
  if (!isEnabled) return false;
  return getPackStock(packSize, product) > 0;
}

/**
 * Returns configured pack sizes for a product (used in Admin Portal).
 * If no pack sizes are configured, returns a single default option matching product's unit.
 * NEVER automatically invents pack sizes that the admin hasn't configured.
 */
export function getProductPackSizes(product: Product): PackSizeOption[] {
  if (Array.isArray(product.packSizes) && product.packSizes.length > 0) {
    return product.packSizes.map((ps) => ({
      ...ps,
      isAvailable: ps.isAvailable !== false && (ps as any).available !== false,
      price: Math.max(1, Number(ps.price) || product.price || 1),
    }));
  }
  return [
    {
      size: formatUnitString(product.unit || '1 unit'),
      price: Math.max(1, Number(product.price) || 1),
      isAvailable: true,
      stock: product.stock,
    },
  ];
}

/**
 * Returns ONLY configured, enabled, and in-stock pack sizes (used in Customer Portal).
 * Disabled or zero-stock pack sizes are completely hidden.
 */
export function getAvailablePackSizes(product: Product): PackSizeOption[] {
  if (product.stock <= 0) {
    return [];
  }

  if (Array.isArray(product.packSizes) && product.packSizes.length > 0) {
    return product.packSizes
      .filter((ps) => isPackSizeAvailable(ps, product))
      .map((ps) => ({
        ...ps,
        isAvailable: true,
        price: Math.max(1, Number(ps.price) || product.price || 1),
      }));
  }

  // Single unit product fallback if enabled and in stock
  return [
    {
      size: formatUnitString(product.unit || '1 unit'),
      price: Math.max(1, Number(product.price) || 1),
      isAvailable: true,
      stock: product.stock,
    },
  ];
}

/**
 * Suggests standard pack size presets for a given unit type.
 * Intended ONLY for the Admin Portal when creating a new product or choosing presets.
 * The admin can freely edit, add, remove, and price each option independently.
 */
export function getSuggestedPackSizesForUnit(params: {
  unit: string;
  price: number;
  category?: string;
  title?: string;
}): PackSizeOption[] {
  const baseUnit = formatUnitString(params.unit || '1 kg');
  const basePrice = Math.max(1, Math.round(Number(params.price) || 99));
  const parsed = parseUnitQuantity(baseUnit);

  if (!parsed) {
    return [
      { size: baseUnit, price: basePrice, isAvailable: true },
      { size: `2 × ${baseUnit}`, price: Math.round(basePrice * 1.9), isAvailable: true },
    ];
  }

  if (parsed.unitType === 'volume') {
    // Volume: 100 ml, 250 ml, 500 ml, 1 litre, 5 litres
    return [
      { size: '100 ml', price: Math.max(1, Math.round(basePrice * 0.15)), isAvailable: true },
      { size: '250 ml', price: Math.max(1, Math.round(basePrice * 0.3)), isAvailable: true },
      { size: '500 ml', price: Math.max(1, Math.round(basePrice * 0.55)), isAvailable: true },
      { size: '1 litre', price: basePrice, isAvailable: true },
      { size: '5 litres', price: Math.max(1, Math.round(basePrice * 4.6)), isAvailable: true },
    ];
  }

  if (parsed.unitType === 'dozen') {
    // Dozen: 1/2 dozen, 1 dozen, 2 dozen
    return [
      { size: '1/2 dozen', price: Math.max(1, Math.round(basePrice * 0.55)), isAvailable: true },
      { size: '1 dozen', price: basePrice, isAvailable: true },
      { size: '2 dozen', price: Math.max(1, Math.round(basePrice * 1.9)), isAvailable: true },
    ];
  }

  if (parsed.unitType === 'weight') {
    // Weight: 100 g, 250 g, 500 g, 1 kg, 5 kg
    return [
      { size: '100 g', price: Math.max(1, Math.round(basePrice * 0.15)), isAvailable: true },
      { size: '250 g', price: Math.max(1, Math.round(basePrice * 0.3)), isAvailable: true },
      { size: '500 g', price: Math.max(1, Math.round(basePrice * 0.55)), isAvailable: true },
      { size: '1 kg', price: basePrice, isAvailable: true },
      { size: '5 kg', price: Math.max(1, Math.round(basePrice * 4.6)), isAvailable: true },
    ];
  }

  if (parsed.unitType === 'count') {
    // Pieces: 1 piece, 2 pieces, 4 pieces
    return [
      { size: '1 piece', price: basePrice, isAvailable: true },
      { size: '2 pieces', price: Math.max(1, Math.round(basePrice * 1.9)), isAvailable: true },
      { size: '4 pieces', price: Math.max(1, Math.round(basePrice * 3.6)), isAvailable: true },
    ];
  }

  return [
    { size: baseUnit, price: basePrice, isAvailable: true },
    { size: `2 × ${baseUnit}`, price: Math.round(basePrice * 1.9), isAvailable: true },
  ];
}

/**
 * Backward compatibility alias for determinePackSizesForUnit.
 */
export const determinePackSizesForUnit = getSuggestedPackSizesForUnit;
export const getDefaultPackSizes = getProductPackSizes;

export type UnitCategory = 'weight' | 'volume' | 'pieces' | 'dozen' | 'custom';

/**
 * Determines the unit category for any given unit string.
 */
export function getUnitCategory(rawUnit: string): UnitCategory {
  if (!rawUnit) return 'custom';
  const u = rawUnit.trim().toLowerCase();

  // 1. Dozen
  if (u.includes('dozen') || u.includes('dogen') || u.includes('½')) {
    return 'dozen';
  }

  // 2. Volume (ml, litre, liter, l)
  if (
    u.includes('ml') ||
    u.includes('milli') ||
    u.includes('litre') ||
    u.includes('liter') ||
    /\b\d*\.?\d*\s*l\b/i.test(u)
  ) {
    return 'volume';
  }

  // 3. Weight (g, kg, gram, grams, gm, gms, kilo, kilogram, kilograms)
  if (
    u.includes('kg') ||
    u.includes('kilo') ||
    u.includes('gram') ||
    u.includes('gm') ||
    /\b\d*\.?\d*\s*g\b/i.test(u)
  ) {
    return 'weight';
  }

  // 4. Pieces
  if (u.includes('piece') || u.includes('pc')) {
    return 'pieces';
  }

  // 5. Custom
  return 'custom';
}

/**
 * Returns unit-dependent Quick Add preset strings for pack sizes based on the selected unit.
 *
 * - Weight (grams / kilograms): +100 g, +250 g, +500 g, +1 kg, +5 kg
 * - Volume (millilitres / litres): +100 ml, +250 ml, +500 ml, +1 litre, +5 litres
 * - Pieces: +1 piece, +2 pieces, +4 pieces
 * - Dozen: +½ dozen, +1 dozen, +2 dozen
 * - Custom: options relevant to that unit without showing unrelated options
 */
export function getQuickAddPresetsForUnit(unitStr: string): string[] {
  if (!unitStr || !unitStr.trim()) {
    return [];
  }

  const raw = unitStr.trim();
  const category = getUnitCategory(raw);

  if (category === 'weight') {
    return ['100 g', '250 g', '500 g', '1 kg', '5 kg'];
  }

  if (category === 'volume') {
    return ['100 ml', '250 ml', '500 ml', '1 litre', '5 litres'];
  }

  if (category === 'pieces') {
    return ['1 piece', '2 pieces', '4 pieces'];
  }

  if (category === 'dozen') {
    return ['½ dozen', '1 dozen', '2 dozen'];
  }

  // Container units configured in admin dropdown
  const lower = raw.toLowerCase();
  if (lower.includes('packet') || lower.includes('pack')) {
    return ['1 packet', '2 packets', '4 packets'];
  }
  if (lower.includes('box')) {
    return ['1 box', '2 boxes', '4 boxes'];
  }
  if (lower.includes('bunch')) {
    return ['1 bunch', '2 bunches', '4 bunches'];
  }

  // Generic custom units (e.g. tin, bottle, can, tray, jar, sachet)
  const cleanedUnit = raw.replace(/^[\d.]+\s*(x|×)?\s*/i, '').trim();
  if (!cleanedUnit) {
    return [raw];
  }

  const plural = cleanedUnit.endsWith('s')
    ? cleanedUnit
    : cleanedUnit.endsWith('ch') || cleanedUnit.endsWith('sh') || cleanedUnit.endsWith('x')
    ? `${cleanedUnit}es`
    : `${cleanedUnit}s`;

  return [`1 ${cleanedUnit}`, `2 ${plural}`, `4 ${plural}`];
}

/**
 * Checks whether two pack size labels refer to the same size,
 * handling case sensitivity, extra whitespace, '1/2 dozen' vs '½ dozen', '100g' vs '100 g', and '1 L' vs '1 litre'.
 */
export function isSamePackSize(sizeA: string, sizeB: string): boolean {
  if (!sizeA || !sizeB) return false;
  const a = sizeA.trim().toLowerCase();
  const b = sizeB.trim().toLowerCase();
  if (a === b) return true;

  // Normalize fractions (½ vs 1/2)
  const normA = a.replace(/½/g, '1/2').replace(/\s+/g, ' ');
  const normB = b.replace(/½/g, '1/2').replace(/\s+/g, ' ');
  if (normA === normB) return true;

  // Normalized unit string comparison
  const fmtA = formatUnitString(normA).toLowerCase();
  const fmtB = formatUnitString(normB).toLowerCase();
  if (fmtA === fmtB) return true;

  // Space-collapsed comparison
  if (normA.replace(/\s+/g, '') === normB.replace(/\s+/g, '')) return true;

  return false;
}
