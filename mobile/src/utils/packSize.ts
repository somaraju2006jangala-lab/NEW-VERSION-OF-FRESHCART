import { Product, PackSizeOption } from '../types';

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

export const SELECTABLE_STANDARD_UNITS = STANDARD_UNITS;

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
  if (lower === '1 dozen' || lower === 'dozen') return '1 dozen';
  if (lower === '2 dozen') return '2 dozen';

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
 * Calculates conversion factor between pack size and product base unit.
 */
export function getPackSizeConversionFactor(packSize: string, baseUnit: string): number | null {
  if (!packSize || !baseUnit) return 1.0;
  const pNorm = formatUnitString(packSize).toLowerCase();
  const bNorm = formatUnitString(baseUnit).toLowerCase();

  if (pNorm === bNorm) return 1.0;

  const parsedPack = parseUnitQuantity(pNorm);
  const parsedBase = parseUnitQuantity(bNorm);

  if (!parsedPack || !parsedBase) return null;

  if (parsedPack.unitType !== parsedBase.unitType) {
    return null;
  }

  if (parsedBase.baseUnits <= 0) return 1.0;
  return parsedPack.baseUnits / parsedBase.baseUnits;
}

export type UnitCategory = 'weight' | 'volume' | 'pieces' | 'dozen' | 'custom';

export function getUnitCategory(rawUnit: string): UnitCategory {
  if (!rawUnit) return 'custom';
  const u = rawUnit.trim().toLowerCase();

  if (u.includes('dozen') || u.includes('½')) return 'dozen';
  if (u.includes('ml') || u.includes('litre') || u.includes('liter') || /\b\d*\.?\d*\s*l\b/i.test(u)) {
    return 'volume';
  }
  if (u.includes('kg') || u.includes('kilo') || u.includes('gram') || u.includes('gm') || /\b\d*\.?\d*\s*g\b/i.test(u)) {
    return 'weight';
  }
  if (u.includes('piece') || u.includes('pc')) return 'pieces';
  return 'custom';
}

/**
 * Returns unit-dependent Quick Add preset strings for pack sizes.
 */
export function getQuickAddPresetsForUnit(unitStr: string): string[] {
  if (!unitStr || !unitStr.trim()) {
    return ['100 g', '250 g', '500 g', '1 kg', '5 kg'];
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
    return ['1/2 dozen', '1 dozen', '2 dozen'];
  }

  const lower = raw.toLowerCase();
  if (lower.includes('packet') || lower.includes('pack')) {
    return ['1 packet', '2 packets', '4 packets'];
  }
  if (lower.includes('box')) {
    return ['1 box', '2 boxes', '4 boxes'];
  }
  if (lower.includes('bunch')) {
    return ['1 bunch', '2 bunches'];
  }

  return ['100 g', '250 g', '500 g', '1 kg', '5 kg'];
}

/**
 * Checks whether two pack size labels refer to the same size.
 */
export function isSamePackSize(sizeA: string, sizeB: string): boolean {
  if (!sizeA || !sizeB) return false;
  return sizeA.trim().toLowerCase() === sizeB.trim().toLowerCase();
}

/**
 * Computes available stock for a specific pack size.
 */
export function getPackStock(
  packSize: string | PackSizeOption,
  product: { stock: number; unit: string; packSizes?: PackSizeOption[] }
): number {
  const psObj: PackSizeOption =
    typeof packSize === 'string'
      ? product.packSizes?.find((p) => isSamePackSize(p.size, packSize)) || {
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
 * Determines whether a pack size is available (enabled and in stock).
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
 * Returns available pack sizes for customers.
 */
export function getAvailablePackSizes(product: Product): PackSizeOption[] {
  if (Array.isArray(product.packSizes) && product.packSizes.length > 0) {
    return product.packSizes.filter((ps) => ps.isAvailable !== false && (ps as any).available !== false);
  }
  return [
    {
      size: formatUnitString(product.unit || '1 unit'),
      price: product.price,
      isAvailable: product.stock > 0,
      stock: product.stock,
    },
  ];
}

/**
 * Returns configured pack sizes for a product (used in Admin Portal).
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

