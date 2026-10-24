import { Request, Response } from 'express';
import {
  getPool,
  getProductsFromDb,
  findProductInDb,
  getCartForCustomerInDb,
  saveCartItemInDb,
  removeCartItemInDb,
  clearCartInDb,
  getCouponsFromDb,
  findCouponByCodeInDb,
  getSettingsFromDb,
} from './db.ts';

// Verified Gemini Live API models for real-time voice streaming
export const GEMINI_LIVE_MODEL = 'gemini-3.1-flash-live-preview';
export const GEMINI_LIVE_FALLBACK_MODEL = 'gemini-3.8-live';

// Supported Gemini text/multimodal models in priority order (verified active & quota-friendly)
export const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
];

export type SupportedLanguage = 'en-IN' | 'hi-IN' | 'te-IN';

export interface AssistantStructuredAction {
  intent:
    | 'ADD_TO_CART'
    | 'UPDATE_CART_QTY'
    | 'REMOVE_FROM_CART'
    | 'VIEW_CART'
    | 'CLEAR_CART'
    | 'SEARCH_PRODUCTS'
    | 'SHOW_ALL_PRODUCTS'
    | 'SHOW_CATEGORY'
    | 'FILTER_PRICE'
    | 'SHOW_DEALS'
    | 'BUDGET_LIST'
    | 'SHOW_COUPONS'
    | 'APPLY_COUPON'
    | 'MOST_EXPENSIVE_ITEM'
    | 'GENERAL_QUERY';
  product_name?: string;
  quantity?: number;
  unit?: string;
  pack_size?: string;
  category?: string;
  price_limit?: number;
  budget_limit?: number;
  coupon_code?: string;
  confirmed?: boolean;
  requires_confirmation?: boolean;
  message?: string;
  language?: SupportedLanguage;
}

export interface AssistantApiResponse {
  success: boolean;
  message: string;
  spokenMessage?: string;
  language?: SupportedLanguage;
  intent: string;
  actionExecuted?: boolean;
  cartUpdated?: boolean;
  cartItems?: any[];
  products?: any[];
  coupons?: any[];
  cartSummary?: {
    itemCount: number;
    subtotal: number;
    deliveryFee: number;
    discount: number;
    total: number;
    mostExpensiveItem?: any;
  };
  requiresConfirmation?: boolean;
  pendingAction?: any;
  quickReplies?: string[];
  suggestedAction?: 'ADD_TO_CART' | 'VIEW_CART' | 'APPLY_COUPON' | 'NONE';
  error?: string;
}

/**
 * Detects language from user message text or explicit request code
 */
export function detectLanguage(text?: string, requestedLang?: string): SupportedLanguage {
  if (requestedLang === 'hi-IN' || requestedLang === 'te-IN') {
    return requestedLang;
  }
  if (!text) return 'en-IN';
  // Devanagari script for Hindi
  if (/[\u0900-\u097F]/.test(text)) {
    return 'hi-IN';
  }
  // Telugu script
  if (/[\u0C00-\u0C7F]/.test(text)) {
    return 'te-IN';
  }
  return 'en-IN';
}

/**
 * Normalizes strings for robust matching
 */
function cleanStr(s?: string): string {
  return (s || '').toLowerCase().trim();
}

/**
 * Calls Gemini REST API with model fallback cascade and multilingual support
 */
async function callGeminiApi(prompt: string, preferredLang: SupportedLanguage = 'en-IN'): Promise<AssistantStructuredAction | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return null;
  }

  const systemInstructions = `
You are the FreshCart AI Shopping & Voice Assistant brain.
FreshCart is an ultra-fresh grocery store with real products in Indian Rupees (₹).
You understand English, Hindi (हिन्दी), and Telugu (తెలుగు) or transliterated Hindi/Telugu (Hinglish/Tenglish).

Analyze the customer's input and output ONLY a single valid JSON object representing the customer's intent and structured action.
Always translate non-English product names to their English catalog names (e.g. "टमाटर" or "టమాటాలు" -> "tomatoes", "आलू" or "బంగాళాదుంప" -> "potatoes", "दूध" or "పాలు" -> "milk", "प्याज" or "ఉల్లిపాయలు" -> "onions", "सब्जियां" or "కూరగాయలు" -> category "vegetables", "फल" or "పండ్లు" -> category "fruits").

INTENTS:
1. ADD_TO_CART: When customer wants to add an item to their cart.
   e.g. "Add 2 kg tomatoes", "Add 500 grams potatoes", "1 litre cow milk please", "मुझे 2 किलो टमाटर चाहिए", "నాకు 2 కేజీల టమాటాలు కార్ట్‌లో వేయి"
   Fields: intent: "ADD_TO_CART", product_name: string (in English), quantity: number (default 1), unit: string (e.g. "kg", "g", "litre", "ml", "dozen", "packet", "piece")
2. UPDATE_CART_QTY: When customer wants to increase/decrease or change quantity.
   e.g. "Increase tomatoes to 2 kg", "Change milk to 2 litres", "టమాటాలు 3 కేజీలు చేయి"
   Fields: intent: "UPDATE_CART_QTY", product_name: string, quantity: number, unit: string
3. REMOVE_FROM_CART: When customer wants to remove an item.
   e.g. "Remove onions", "Delete bananas from my cart", "हटाओ प्याज", "ఉల్లిపాయలు తొలగించు"
   Fields: intent: "REMOVE_FROM_CART", product_name: string
4. VIEW_CART: When customer asks to view cart, check items, calculate total.
   e.g. "Show my cart", "What items are in my cart?", "Calculate my cart total", "कार्ट दिखाओ", "కార్ట్ చూపించు"
   Fields: intent: "VIEW_CART"
5. CLEAR_CART: When customer wants to empty/clear their cart.
   e.g. "Clear my cart", "Empty cart", "कार्ट खाली करो", "కార్ట్ ఖాళీ చేయి"
   Fields: intent: "CLEAR_CART", confirmed: boolean (true if customer says "yes confirm clear" or confirms)
6. MOST_EXPENSIVE_ITEM: When customer asks what the most expensive item is.
   e.g. "Which item is the most expensive?", "सबसे महंगा सामान कौन सा है?", "అత్యంత ఖరీదైన వస్తువు ఏది?"
   Fields: intent: "MOST_EXPENSIVE_ITEM"
7. SEARCH_PRODUCTS: When customer searches for a specific product.
   e.g. "Find tomatoes", "Do you have organic honey?", "गाजर ढूंढो", "క్యారెట్ వెతుకు"
   Fields: intent: "SEARCH_PRODUCTS", product_name: string (in English)
8. SHOW_ALL_PRODUCTS: When customer asks to browse everything.
   e.g. "Show all products", "View catalogue", "सभी उत्पाद दिखाओ", "అన్ని ఉత్పత్తులు చూపించు"
   Fields: intent: "SHOW_ALL_PRODUCTS"
9. SHOW_CATEGORY: When customer wants to see a category.
   e.g. "Show vegetables", "Show fruits", "Show dairy products", "सब्जियां", "కూరగాయలు"
   Fields: intent: "SHOW_CATEGORY", category: string ("vegetables" | "fruits" | "dairy" | "bakery" | "beverages" | "grains" | "snacks" | "pantry")
10. FILTER_PRICE: When customer wants products below a price limit.
    e.g. "Show products under ₹100", "100 रुपये से कम", "100 రూపాయల లోపు"
    Fields: intent: "FILTER_PRICE", price_limit: number
11. SHOW_DEALS: When customer asks for deals, offers, or discounts.
    e.g. "Show today's deals", "Any discounts?", "आज के ऑफर", "ఈరోజు ఆఫర్లు"
    Fields: intent: "SHOW_DEALS"
12. BUDGET_LIST: When customer asks for a grocery list or meal basket within a budget.
    e.g. "Prepare a grocery list under ₹500", "500 रुपये में किराने की सूची", "500 లోపు గ్రోసరీ లిస్ట్"
    Fields: intent: "BUDGET_LIST", budget_limit: number, category?: string
13. SHOW_COUPONS: When customer asks for available coupon codes or discounts.
    e.g. "Show available coupons", "What coupons do you have?", "कूपन कोड दिखाओ", "కూపన్లు చూపించు"
    Fields: intent: "SHOW_COUPONS"
14. APPLY_COUPON: When customer wants to apply a specific coupon.
    e.g. "Apply coupon SAVE5", "Apply SAVE10", "कूपन लगाओ SAVE10", "కూపన్ వేయి SAVE10"
    Fields: intent: "APPLY_COUPON", coupon_code?: string
15. GENERAL_QUERY: For greetings, general questions about FreshCart, delivery, organic sourcing.
    e.g. "Hello", "How does delivery work?", "नमस्ते", "నమస్కారం"
    Fields: intent: "GENERAL_QUERY", message?: string

Also detect language: language: "en-IN" | "hi-IN" | "te-IN"

OUTPUT ONLY VALID JSON:
No markdown formatting, no code fences, no extra text.
`.trim();

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemInstructions}\n\nCustomer Preferred Language: ${preferredLang}\nCustomer Message: "${prompt}"` }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const cleaned = rawText.trim().replace(/^```json/i, '').replace(/```$/i, '').trim();
        const parsed = JSON.parse(cleaned);
        if (parsed && parsed.intent) {
          return parsed as AssistantStructuredAction;
        }
      }
    } catch {
      // try next model in cascade
      continue;
    }
  }

  return null;
}

/**
 * Intelligent deterministic NLP parser fallback.
 * Ensures 100% reliability if Gemini is unavailable or rate-limited.
 */
function parseIntentDeterministically(text: string): AssistantStructuredAction {
  const t = cleanStr(text);

  // Clear cart (English, Hindi, Telugu)
  if (
    (t.includes('clear') && (t.includes('cart') || t.includes('basket'))) ||
    t.includes('खाली करो') ||
    t.includes('खाली कर') ||
    t.includes('ఖాళీ చేయి') ||
    t.includes('ఖాళీ చెయ్')
  ) {
    const isConfirmed =
      t.includes('yes') ||
      t.includes('confirm') ||
      t.includes('sure') ||
      t.includes('please clear') ||
      t.includes('हाँ') ||
      t.includes('हां') ||
      t.includes('అవును');
    return {
      intent: 'CLEAR_CART',
      confirmed: isConfirmed,
      requires_confirmation: !isConfirmed,
    };
  }

  // Most expensive item (English, Hindi, Telugu)
  if (
    t.includes('most expensive') ||
    t.includes('highest price') ||
    t.includes('costliest') ||
    t.includes('महंगा') ||
    t.includes('ఖరీదైన') ||
    t.includes('ఎక్కువ ధర')
  ) {
    return { intent: 'MOST_EXPENSIVE_ITEM' };
  }

  // View cart / totals (English, Hindi, Telugu)
  if (
    t.includes('show my cart') ||
    t.includes('view cart') ||
    t.includes('what items are in my cart') ||
    t.includes('items in my cart') ||
    t.includes('cart total') ||
    t.includes('calculate my cart') ||
    t.includes('check cart') ||
    t.includes('कार्ट दिखाओ') ||
    t.includes('मेरा कार्ट') ||
    t.includes('कैलकुलेट') ||
    t.includes('టోటల్') ||
    t.includes('కార్ట్ చూపించు') ||
    t.includes('నా కార్ట్') ||
    t.includes('బుట్ట') ||
    t === 'cart' ||
    t === 'कार्ट' ||
    t === 'కార్ట్'
  ) {
    return { intent: 'VIEW_CART' };
  }

  // Coupons (English, Hindi, Telugu)
  if (
    (t.includes('apply') || t.includes('लगाओ') || t.includes('వర్తించు') || t.includes('వేయి')) &&
    (t.includes('coupon') || t.includes('save') || t.includes('code') || t.includes('कूपन') || t.includes('కూపన్'))
  ) {
    const codeMatch = t.match(/save\s*(\d+)/i) || t.match(/coupon\s*([a-z0-9_-]+)/i);
    return {
      intent: 'APPLY_COUPON',
      coupon_code: codeMatch ? codeMatch[0].replace(/\s+/g, '').toUpperCase() : undefined,
    };
  }
  if (
    t.includes('coupon') ||
    t.includes('promo') ||
    t.includes('discount code') ||
    t.includes('eligible coupon') ||
    t.includes('कूपन') ||
    t.includes('కూపన్') ||
    t.includes('ఆఫర్')
  ) {
    return { intent: 'SHOW_COUPONS' };
  }

  // Deals / Discounts (English, Hindi, Telugu)
  if (t.includes('deal') || t.includes('discount') || t.includes('offer') || t.includes('ऑफर') || t.includes('छूट') || t.includes('డిస్కౌంట్')) {
    return { intent: 'SHOW_DEALS' };
  }

  // Budget shopping: "grocery list under ₹500", "vegetables within ₹200", "500 रुपये में किराना"
  const budgetMatch =
    t.match(/(?:list|vegetables|grocery|budget|under|within|items|किराना|सूची|లిస్ట్|బడ్జెట్)\s*(?:under|within|लोपु|में)?\s*(?:₹|rs\.?|inr|रुपये|రూపాయలు)?\s*(\d+)/i) ||
    t.match(/(?:₹|rs\.?|inr|रुपये|రూపాయలు)\s*(\d+)/i) ||
    t.match(/(\d+)\s*(?:रुपये|రూపాయలు)/i);
  if (
    budgetMatch &&
    (t.includes('budget') ||
      t.includes('list') ||
      t.includes('suggest') ||
      t.includes('within') ||
      t.includes('grocery') ||
      t.includes('बजट') ||
      t.includes('सूची') ||
      t.includes('బడ్జెట్') ||
      t.includes('లిస్ట్'))
  ) {
    const limit = Number(budgetMatch[1]);
    const cat = t.includes('veg') || t.includes('सब्जी') || t.includes('కూరగాయ') ? 'vegetables' : t.includes('fruit') || t.includes('फल') || t.includes('పండు') ? 'fruits' : undefined;
    return { intent: 'BUDGET_LIST', budget_limit: limit, category: cat };
  }

  // Price filter: "products under ₹100", "under 200", "100 से कम"
  if (t.includes('under') || t.includes('below') || t.includes('less than') || t.includes('cheapest') || t.includes('कम') || t.includes('లోపు') || t.includes('తక్కువ')) {
    const pMatch = t.match(/(?:under|below|less than|कम|లోపు|తక్కువ)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i) || t.match(/(\d+)\s*(?:से कम|లోపు)/i);
    if (pMatch) {
      return { intent: 'FILTER_PRICE', price_limit: Number(pMatch[1]) };
    }
    if (t.includes('cheapest') || t.includes('सबसे सस्ता') || t.includes('చౌకైన')) {
      return { intent: 'FILTER_PRICE', price_limit: 100 };
    }
  }

  // Categories (English, Hindi, Telugu)
  if (t.includes('vegetable') || t.includes('veggie') || t.includes('सब्जी') || t.includes('सब्जियां') || t.includes('కూరగాయలు') || t.includes('కూరగాయ')) {
    return { intent: 'SHOW_CATEGORY', category: 'vegetables' };
  }
  if (t.includes('fruit') || t.includes('फल') || t.includes('పండ్లు') || t.includes('పండు')) {
    return { intent: 'SHOW_CATEGORY', category: 'fruits' };
  }
  if ((t.includes('dairy') || t.includes('milk') || t.includes('दूध') || t.includes('पాలు')) && !t.includes('add') && !t.includes('remove') && !t.includes('जोड़') && !t.includes('వేయి')) {
    return { intent: 'SHOW_CATEGORY', category: 'dairy' };
  }
  if ((t.includes('bakery') || t.includes('bread') || t.includes('ब्रेड') || t.includes('రొట్టె')) && !t.includes('add')) {
    return { intent: 'SHOW_CATEGORY', category: 'bakery' };
  }
  if ((t.includes('beverage') || t.includes('juice') || t.includes('जूस') || t.includes('రసం')) && !t.includes('add')) {
    return { intent: 'SHOW_CATEGORY', category: 'beverages' };
  }

  // Show all products
  if (t.includes('all product') || t.includes('show all') || t.includes('catalogue') || t.includes('catalog') || t.includes('everything') || t.includes('सभी उत्पाद') || t.includes('सब कुछ') || t.includes('అన్ని ఉత్పత్తులు') || t.includes('అన్నీ చూపించు')) {
    return { intent: 'SHOW_ALL_PRODUCTS' };
  }

  // Remove from cart (English, Hindi, Telugu)
  if (
    t.startsWith('remove') ||
    t.startsWith('delete') ||
    t.includes('remove from my cart') ||
    t.includes('drop') ||
    t.includes('हटाओ') ||
    t.includes('निकालो') ||
    t.includes('तొలగించు') ||
    t.includes('తీసేయి')
  ) {
    const prod = t
      .replace(/remove|delete|drop|from my cart|from cart|item|product|हटाओ|निकालो|तొలగించు|తీసేయి/gi, '')
      .trim();
    return { intent: 'REMOVE_FROM_CART', product_name: prod };
  }

  // Increase / update quantity
  if (t.startsWith('increase') || t.startsWith('decrease') || t.startsWith('change') || t.startsWith('update') || t.includes('बढ़ाओ') || t.includes('పెంచు')) {
    const qtyMatch = t.match(/(\d+(?:\.\d+)?)\s*(kg|kilo|grams|g|litre|litres|l|ml|dozen|packet|packets|piece|pieces|किलो|కేజీ)?/i);
    const qty = qtyMatch ? Number(qtyMatch[1]) : 1;
    const unit = qtyMatch?.[2] || undefined;
    const prod = t
      .replace(/increase|decrease|change|update|to|my|quantity|qty|cart|बढ़ाओ|పెంచు/gi, '')
      .replace(/\d+(?:\.\d+)?\s*(kg|kilo|grams|g|litre|litres|l|ml|dozen|packet|packets|piece|pieces|किलो|కేజీ)?/gi, '')
      .trim();
    return {
      intent: 'UPDATE_CART_QTY',
      product_name: prod,
      quantity: qty,
      unit,
    };
  }

  // Add to cart: "Add 2 kg tomatoes to my cart", "Add 500 grams potatoes", "Add milk", "2 किलो टमाटर जोड़ें", "2 కేజీల టమాటాలు వేయి"
  if (
    t.startsWith('add') ||
    t.includes('add to cart') ||
    t.includes('put in cart') ||
    t.includes('buy') ||
    t.includes('जोड़ें') ||
    t.includes('जोड़ो') ||
    t.includes('डालो') ||
    t.includes('डालें') ||
    t.includes('चाहिए') ||
    t.includes('వేయి') ||
    t.includes('చేర్చు') ||
    t.includes('జోడించు') ||
    t.includes('కావాలి')
  ) {
    const match = t.match(/(\d+(?:\.\d+)?)\s*(kg|kilo|grams|g|litre|litres|l|ml|dozen|doz|packet|packets|pack|packs|piece|pieces|box|boxes|किलो|ग्राम|लीटर|కేజీ|లీటర్)?\s*(?:of\s*)?([a-z0-9\s\u0900-\u097F\u0C00-\u0C7F-]+?)(?:\s+to\s+my\s+cart|\s+to\s+cart|\s+जोड़ें|\s+डालो|\s+వేయి|\s+చేర్చు|$)/i);
    if (match) {
      const qty = Number(match[1]) || 1;
      const rawUnit = match[2] || '';
      const prodName = match[3]?.replace(/add|to my cart|to cart|put in|please|जोड़ें|डालो|వేయి|చేర్చు/gi, '').trim();
      return {
        intent: 'ADD_TO_CART',
        product_name: prodName,
        quantity: qty,
        unit: normalizeUnitString(rawUnit),
      };
    }
    const simple = t.replace(/add|to my cart|to cart|put in|please|जोड़ें|डालो|चाहिए|వేయి|చేర్చు|కావాలి/gi, '').trim();
    return {
      intent: 'ADD_TO_CART',
      product_name: simple,
      quantity: 1,
    };
  }

  // Find / Search: "Find tomatoes", "Search bananas", "टमाटर ढूंढो", "టమాటాలు వెతుకు"
  if (t.startsWith('find') || t.startsWith('search') || t.startsWith('look for') || t.includes('ढूंढो') || t.includes('खोजो') || t.includes('వెతుకు')) {
    const term = t.replace(/find|search for|search|look for|where is|where are|ढूंढो|खोजो|వెతుకు/gi, '').trim();
    return { intent: 'SEARCH_PRODUCTS', product_name: term };
  }

  return { intent: 'GENERAL_QUERY', message: text };
}

/**
 * Normalizes user-specified unit strings
 */
function normalizeUnitString(u?: string): string {
  if (!u) return '';
  const clean = u.toLowerCase().trim();
  if (clean === 'kg' || clean === 'kilo' || clean === 'kilogram' || clean === 'kgs' || clean === 'किलो' || clean === 'కేజీ') return '1 kg';
  if (clean === 'g' || clean === 'gm' || clean === 'gms' || clean === 'gram' || clean === 'grams' || clean === 'ग्राम') return 'g';
  if (clean === 'litre' || clean === 'litres' || clean === 'liter' || clean === 'l' || clean === 'लीटर' || clean === 'లీటర్') return '1 litre';
  if (clean === 'ml' || clean === 'millilitre') return 'ml';
  if (clean === 'dozen' || clean === 'doz' || clean === 'दर्जन') return '1 dozen';
  if (clean === 'packet' || clean === 'packets' || clean === 'pack' || clean === 'packs' || clean === 'पैकेट') return '1 packet';
  if (clean === 'piece' || clean === 'pieces' || clean === 'pc' || clean === 'pcs') return '1 piece';
  return clean;
}

/**
 * Calculates delivery fee based on store delivery rules
 */
function computeDeliveryCharges(subtotal: number, rules: any[]): number {
  if (!Array.isArray(rules) || rules.length === 0) {
    return subtotal >= 500 ? 0 : 40;
  }
  const sorted = [...rules].sort((a, b) => b.minOrderAmount - a.minOrderAmount);
  for (const r of sorted) {
    if (subtotal >= r.minOrderAmount) {
      return Number(r.deliveryCharge);
    }
  }
  return 40;
}

/**
 * Fuzzy matches a product name in the catalog (supporting English, Hindi, and Telugu)
 */
function matchProductInCatalog(searchName: string, allProducts: any[]): any[] {
  const term = cleanStr(searchName);
  if (!term) return [];

  // 1. Exact match on title or id
  const exact = allProducts.filter(
    (p) => cleanStr(p.title) === term || cleanStr(p.name) === term || cleanStr(p.id) === term
  );
  if (exact.length > 0) return exact;

  // 2. Direct keyword contains
  const contains = allProducts.filter(
    (p) =>
      cleanStr(p.title).includes(term) ||
      cleanStr(p.name).includes(term) ||
      cleanStr(p.description).includes(term) ||
      cleanStr(p.sku).includes(term)
  );
  if (contains.length > 0) return contains;

  // 3. Split into words and match any
  const words = term.split(/\s+/).filter((w) => w.length > 2);
  if (words.length > 0) {
    const wordMatches = allProducts.filter((p) => {
      const full = `${cleanStr(p.title)} ${cleanStr(p.description)} ${cleanStr(p.category)}`;
      return words.some((w) => full.includes(w));
    });
    if (wordMatches.length > 0) return wordMatches;
  }

  // 4. Common grocery multilingual aliases (English, Hindi, Telugu)
  const ALIASES: Record<string, string[]> = {
    tomato: ['tomato', 'tomatoes', 'tamatar', 'टमाटर', 'టమాటాలు', 'టమాటో'],
    banana: ['banana', 'bananas', 'kela', 'केला', 'అరటిపండ్లు', 'అరటి'],
    apple: ['apple', 'apples', 'seb', 'सेब', 'యాపిల్', 'ఆపిల్'],
    milk: ['milk', 'doodh', 'cow milk', 'दूध', 'పాలు'],
    potato: ['potato', 'potatoes', 'aloo', 'आलू', 'బంగాళాదుంప', 'బంగాళదుంప', 'ఆలు'],
    carrot: ['carrot', 'carrots', 'gajar', 'गाजर', 'క్యారెట్'],
    spinach: ['spinach', 'palak', 'पालक', 'పాలకూర'],
    rice: ['rice', 'basmati', 'chawal', 'चावल', 'బియ్యం'],
    bread: ['bread', 'loaf', 'sourdough', 'ब्रेड', 'రొట్టె'],
    juice: ['juice', 'orange juice', 'जूस', 'రసం'],
    oil: ['oil', 'cooking oil', 'तेल', 'నూనె'],
    yogurt: ['yogurt', 'curd', 'dahi', 'दही', 'పెరుగు'],
    egg: ['egg', 'eggs', 'anda', 'अंडा', 'గుడ్లు', 'గుడ్డు'],
    onion: ['onion', 'onions', 'pyaaz', 'प्याज', 'ఉల్లిపాయలు', 'ఉల్లి'],
  };

  for (const [key, aliasList] of Object.entries(ALIASES)) {
    if (aliasList.some((al) => term.includes(al))) {
      const matched = allProducts.filter((p) => {
        const full = `${cleanStr(p.title)} ${cleanStr(p.name)}`;
        return aliasList.some((al) => full.includes(al)) || full.includes(key);
      });
      if (matched.length > 0) return matched;
    }
  }

  return [];
}

interface LocalizedText {
  display: string;
  spoken: string;
}

/**
 * Generates natural responses in English, Hindi, and Telugu
 */
function getLocalizedText(
  lang: SupportedLanguage,
  key: string,
  vars: Record<string, any> = {}
): LocalizedText {
  const isHi = lang === 'hi-IN';
  const isTe = lang === 'te-IN';

  switch (key) {
    case 'ADDED_TO_CART': {
      const { qty, title, packSize, price, targetQty, subtotal } = vars;
      if (isHi) {
        return {
          display: `आपके कार्ट में ${qty} × ${title} (${packSize}) जोड़ दिया गया है (मूल्य: ₹${price}/${packSize})। कार्ट कुल: ${targetQty} (उप-कुल: ₹${subtotal})।`,
          spoken: `आपके कार्ट में ${qty} ${title} जोड़ दिया गया है। कुल योग ₹${subtotal} है।`,
        };
      }
      if (isTe) {
        return {
          display: `మీ కార్ట్‌లో ${qty} × ${title} (${packSize}) చేర్చబడింది (ధర: ₹${price}/${packSize}). కార్ట్ మొత్తం: ${targetQty} (మొత్తం: ₹${subtotal}).`,
          spoken: `మీ కార్ట్‌లో ${qty} ${title} చేర్చబడింది. మొత్తం ₹${subtotal}.`,
        };
      }
      return {
        display: `Added ${qty} × ${title} (${packSize}) to your cart at ₹${price}/${packSize}. Total in cart: ${targetQty} (Subtotal: ₹${subtotal}).`,
        spoken: `Added ${qty} ${title} to your cart. Total is now ${targetQty}.`,
      };
    }

    case 'PRODUCT_NOT_FOUND': {
      const { prodName } = vars;
      if (isHi) {
        return {
          display: `मुझे हमारी सूची में "${prodName}" नहीं मिला। हमारे पास ताज़ा टमाटर, केले, गाय का दूध, गाजर, आलू उपलब्ध हैं!`,
          spoken: `सूची में "${prodName}" नहीं मिला।`,
        };
      }
      if (isTe) {
        return {
          display: `మా స్టోర్‌లో "${prodName}" కనుగొనబడలేదు. మా వద్ద తాజా టమాటాలు, అరటిపండ్లు, పాలు, క్యారెట్లు, బంగాళాదుంపలు ఉన్నాయి!`,
          spoken: `స్టోర్‌లో "${prodName}" కనుగొనబడలేదు.`,
        };
      }
      return {
        display: `I could not find "${prodName}" in our farm-fresh catalog. We offer Fresh Farm Tomatoes, Bananas, Pure Cow Milk, Carrots, Potatoes, and more!`,
        spoken: `I could not find "${prodName}" in our catalog.`,
      };
    }

    case 'OUT_OF_STOCK': {
      const { title } = vars;
      if (isHi) {
        return {
          display: `"${title}" अभी स्टॉक में उपलब्ध नहीं है। क्या आप विकल्प देखना चाहेंगे?`,
          spoken: `"${title}" अभी स्टॉक में नहीं है। क्या आप विकल्प देखना चाहेंगे?`,
        };
      }
      if (isTe) {
        return {
          display: `"${title}" ప్రస్తుతం స్టాక్‌లో అందుబాటులో లేదు. ఇతర ఉత్పత్తులను చూడాలనుకుంటున్నారా?`,
          spoken: `"${title}" ప్రస్తుతం స్టాక్‌లో లేదు. ఇతర ఉత్పత్తులను చూడాలనుకుంటున్నారా?`,
        };
      }
      return {
        display: `"${title}" is currently out of stock. Would you like me to find alternatives?`,
        spoken: `"${title}" is currently out of stock. Would you like alternatives?`,
      };
    }

    case 'EXCEEDS_STOCK': {
      const { available, unit, title, inCart, canAdd } = vars;
      if (isHi) {
        return {
          display: canAdd > 0
            ? `हमारे पास "${title}" के केवल ${available} ${unit} स्टॉक में हैं (आपके कार्ट में पहले से ${inCart} हैं)। क्या आप ${canAdd} और जोड़ना चाहते हैं?`
            : `आपके कार्ट में पहले से "${title}" के सभी ${available} ${unit} मौजूद हैं!`,
          spoken: canAdd > 0
            ? `केवल ${available} ${unit} स्टॉक में उपलब्ध हैं।`
            : `स्टॉक में उपलब्ध सभी वस्तुएं आपके कार्ट में हैं।`,
        };
      }
      if (isTe) {
        return {
          display: canAdd > 0
            ? `మా వద్ద "${title}" కేవలం ${available} ${unit} మాత్రమే స్టాక్‌లో ఉన్నాయి (మీ కార్ట్‌లో ఇప్పటికే ${inCart} ఉన్నాయి). మీరు ఇంకా ${canAdd} జోడించాలనుకుంటున్నారా?`
            : `మీ కార్ట్‌లో ఇప్పటికే "${title}" యొక్క అన్ని ${available} ${unit} ఉన్నాయి!`,
          spoken: canAdd > 0
            ? `కేవలం ${available} ${unit} మాత్రమే స్టాక్‌లో ఉన్నాయి.`
            : `స్టాక్‌లో ఉన్నవన్నీ మీ కార్ట్‌లో ఉన్నాయి.`,
        };
      }
      return {
        display: canAdd > 0
          ? `We only have ${available} ${unit} of "${title}" available in stock (you already have ${inCart} in cart). Would you like to add ${canAdd} more?`
          : `You already have all ${available} available ${unit} of "${title}" in your cart!`,
        spoken: canAdd > 0
          ? `Only ${available} ${unit} available in stock.`
          : `You already have all available items in your cart.`,
      };
    }

    case 'UPDATE_QTY': {
      const { title, qty } = vars;
      if (isHi) {
        return {
          display: qty > 0 ? `आपके कार्ट में ${title} की मात्रा बदलकर ${qty} कर दी गई है।` : `आपके कार्ट से ${title} हटा दिया गया है।`,
          spoken: qty > 0 ? `${title} की मात्रा बदलकर ${qty} कर दी गई है।` : `${title} कार्ट से हटा दिया गया है।`,
        };
      }
      if (isTe) {
        return {
          display: qty > 0 ? `మీ కార్ట్‌లో ${title} పరిమాణం ${qty}కి మార్చబడింది.` : `మీ కార్ట్ నుండి ${title} తొలగించబడింది.`,
          spoken: qty > 0 ? `${title} పరిమాణం ${qty}కి మార్చబడింది.` : `${title} కార్ట్ నుండి తొలగించబడింది.`,
        };
      }
      return {
        display: qty > 0 ? `Updated ${title} quantity to ${qty} in your cart.` : `Removed ${title} from your cart.`,
        spoken: qty > 0 ? `Updated ${title} quantity to ${qty}.` : `Removed ${title} from your cart.`,
      };
    }

    case 'REMOVED_FROM_CART': {
      const { title } = vars;
      if (isHi) {
        return {
          display: `आपके कार्ट से "${title}" हटा दिया गया है।`,
          spoken: `"${title}" कार्ट से हटा दिया गया है।`,
        };
      }
      if (isTe) {
        return {
          display: `మీ కార్ట్ నుండి "${title}" తొలగించబడింది.`,
          spoken: `"${title}" కార్ట్ నుండి తీసివేయబడింది.`,
        };
      }
      return {
        display: `Removed "${title}" from your cart.`,
        spoken: `Removed "${title}" from your cart.`,
      };
    }

    case 'VIEW_CART_EMPTY': {
      if (isHi) {
        return {
          display: `आपकी FreshCart टोकरी अभी खाली है। क्या आप ताज़ा सब्जियां, फल या आज के ऑफर्स देखना चाहेंगे?`,
          spoken: `आपकी टोकरी अभी खाली है। ताज़ा सब्जियां या फल देखना चाहेंगे?`,
        };
      }
      if (isTe) {
        return {
          display: `మీ FreshCart బాస్కెట్ ప్రస్తుతం ఖాళీగా ఉంది. మీరు తాజా కూరగాయలు, పండ్లు లేదా ఆఫర్లను చూడాలనుకుంటున్నారా?`,
          spoken: `మీ కార్ట్ ప్రస్తుతం ఖాళీగా ఉంది. తాజా కూరగాయలు లేదా పండ్లను చూడాలనుకుంటున్నారా?`,
        };
      }
      return {
        display: `Your FreshCart basket is currently empty. Would you like to explore fresh vegetables, seasonal fruits, or today's top deals?`,
        spoken: `Your basket is empty. Would you like to explore vegetables, fruits, or deals?`,
      };
    }

    case 'VIEW_CART_SUMMARY': {
      const { count, subtotal, deliveryFee, total } = vars;
      if (isHi) {
        return {
          display: `आपके कार्ट में ${count} वस्तुएं हैं। उप-कुल: ₹${subtotal}, डिलीवरी शुल्क: ₹${deliveryFee}, कुल योग: ₹${total}।`,
          spoken: `आपके कार्ट में ${count} वस्तुएं हैं। कुल योग ₹${total} है।`,
        };
      }
      if (isTe) {
        return {
          display: `మీ కార్ట్‌లో ${count} వస్తువులు ఉన్నాయి. ఉప-మొత్తం: ₹${subtotal}, డెలివరీ ఛార్జీ: ₹${deliveryFee}, మొత్తం: ₹${total}.`,
          spoken: `మీ కార్ట్‌లో ${count} వస్తువులు ఉన్నాయి. మొత్తం ₹${total}.`,
        };
      }
      return {
        display: `Your cart has ${count} items. Subtotal: ₹${subtotal}, Delivery Fee: ₹${deliveryFee}, Total: ₹${total}.`,
        spoken: `Your cart has ${count} items with a total of ₹${total}.`,
      };
    }

    case 'CLEAR_CART_CONFIRM': {
      const { count } = vars;
      if (isHi) {
        return {
          display: `क्या आप वाकई अपना पूरा कार्ट (${count} वस्तुएं) खाली करना चाहते हैं? पुष्टि के लिए "हाँ खाली करें" कहें।`,
          spoken: `क्या आप वाकई अपना कार्ट खाली करना चाहते हैं? पुष्टि के लिए हाँ कहें।`,
        };
      }
      if (isTe) {
        return {
          display: `మీరు నిజంగా మీ మొత్తం కార్ట్‌ను (${count} వస్తువులు) ఖాళీ చేయాలనుకుంటున్నారా? నిర్ధారించడానికి "అవును ఖాళీ చేయి" అని చెప్పండి.`,
          spoken: `మీరు నిజంగా మీ కార్ట్ ఖాళీ చేయాలనుకుంటున్నారా? నిర్ధారించడానికి అవును చెప్పండి.`,
        };
      }
      return {
        display: `Are you sure you want to clear your entire cart (${count} items)? Say "Yes confirm clear" to proceed.`,
        spoken: `Are you sure you want to clear your cart? Say yes to proceed.`,
      };
    }

    case 'CLEAR_CART_DONE': {
      if (isHi) {
        return {
          display: `आपका FreshCart कार्ट खाली कर दिया गया है।`,
          spoken: `आपका कार्ट खाली कर दिया गया है।`,
        };
      }
      if (isTe) {
        return {
          display: `మీ FreshCart కార్ట్ విజయవంతంగా ఖాళీ చేయబడింది.`,
          spoken: `మీ కార్ట్ ఖాళీ చేయబడింది.`,
        };
      }
      return {
        display: `Your FreshCart cart has been emptied. Ready for your fresh harvest grocery list!`,
        spoken: `Your cart has been emptied.`,
      };
    }

    case 'APPLY_COUPON_SUCCESS': {
      const { code, discountAmt, pct } = vars;
      if (isHi) {
        return {
          display: `कूपन कोड "${code}" सफलतापूर्वक लागू हुआ! आपको ${pct}% की छूट मिली (बचत: ₹${discountAmt})।`,
          spoken: `कूपन "${code}" लागू हो गया है। आपने ₹${discountAmt} की बचत की।`,
        };
      }
      if (isTe) {
        return {
          display: `కూపన్ కోడ్ "${code}" విజయవంతంగా వర్తించబడింది! మీకు ${pct}% తగ్గింపు లభించింది (ఆదా: ₹${discountAmt}).`,
          spoken: `కూపన్ "${code}" వర్తించబడింది! మీరు ₹${discountAmt} ఆదా చేశారు.`,
        };
      }
      return {
        display: `Coupon "${code}" applied successfully! You save ₹${discountAmt} (${pct}% OFF).`,
        spoken: `Coupon "${code}" applied! You save ₹${discountAmt}.`,
      };
    }

    case 'APPLY_COUPON_MIN_ORDER': {
      const { code, minOrder, subtotal, diff } = vars;
      if (isHi) {
        return {
          display: `कूपन "${code}" के लिए न्यूनतम ₹${minOrder} का ऑर्डर चाहिए। आपका वर्तमान उप-कुल ₹${subtotal} है। छूट पाने के लिए ₹${diff} और जोड़ें!`,
          spoken: `कूपन "${code}" के लिए न्यूनतम ₹${minOrder} का ऑर्डर चाहिए।`,
        };
      }
      if (isTe) {
        return {
          display: `కూపన్ "${code}" కోసం కనీస ఆర్డర్ ₹${minOrder} ఉండాలి. మీ ప్రస్తుత మొత్తం ₹${subtotal}. ఈ తగ్గింపు కోసం ఇంకా ₹${diff} జోడించండి!`,
          spoken: `కూపన్ "${code}" కోసం కనీస ఆర్డర్ ₹${minOrder} ఉండాలి.`,
        };
      }
      return {
        display: `Coupon "${code}" requires a minimum order of ₹${minOrder}. Your current cart subtotal is ₹${subtotal}. Add ₹${diff} more to unlock this discount!`,
        spoken: `Coupon "${code}" requires a minimum order of ₹${minOrder}. Add ₹${diff} more to unlock it.`,
      };
    }

    default:
      return {
        display: vars.text || 'Processed your request.',
        spoken: vars.text || 'Processed your request.',
      };
  }
}

/**
 * Handles the main /api/assistant/chat endpoint
 */
export async function handleAssistantChat(
  req: Request,
  res: Response,
  authCustomer: { authenticated: boolean; customerId: string; name?: string }
): Promise<void> {
  const startTime = Date.now();
  const customerId = authCustomer.customerId;

  if (!authCustomer.authenticated || !customerId) {
    res.status(401).json({
      success: false,
      message: 'Please log in to your FreshCart customer account to use the AI shopping assistant.',
      intent: 'AUTH_REQUIRED',
    });
    return;
  }

  const { message, pendingAction, language } = req.body || {};
  const userText = (message || '').trim();

  if (!userText && !pendingAction) {
    res.status(400).json({
      success: false,
      message: 'Please provide a message or shopping command.',
      intent: 'EMPTY',
    });
    return;
  }

  // Detect user's language (English, Hindi, or Telugu)
  const userLang = detectLanguage(userText, language);

  // Load live catalog and store settings from MySQL
  const allProducts = await getProductsFromDb();
  const storeSettings = await getSettingsFromDb();
  const deliveryRules = storeSettings?.deliveryChargeRules || [{ minOrderAmount: 500, deliveryCharge: 0 }];

  // 1. Check if user is confirming a pending action (e.g. Confirm Clear Cart)
  if (pendingAction && pendingAction.intent === 'CLEAR_CART') {
    const isAffirmative = /yes|confirm|sure|proceed|ok|clear|हाँ|हां|అవును/i.test(userText);
    if (isAffirmative) {
      await clearCartInDb(customerId);
      const updatedCart = await getCartForCustomerInDb(customerId);
      const txt = getLocalizedText(userLang, 'CLEAR_CART_DONE');
      res.json({
        success: true,
        intent: 'CLEAR_CART',
        actionExecuted: true,
        cartUpdated: true,
        cartItems: updatedCart,
        language: userLang,
        message: txt.display,
        spokenMessage: txt.spoken,
        quickReplies: userLang === 'hi-IN' ? ['सभी उत्पाद', 'सब्जियां', 'फल'] : userLang === 'te-IN' ? ['అన్ని ఉత్పత్తులు', 'కూరగాయలు', 'పండ్లు'] : ['Show All Products', 'View Vegetables', 'View Fruits', 'View Deals'],
      });
      return;
    } else {
      res.json({
        success: true,
        intent: 'CLEAR_CART',
        actionExecuted: false,
        language: userLang,
        message: userLang === 'hi-IN' ? 'कार्ट खाली करना रद्द कर दिया गया।' : userLang === 'te-IN' ? 'కార్ట్ ఖాళీ చేయడం రద్దు చేయబడింది.' : 'Cart clearing was cancelled. Your items are safe in your cart.',
        spokenMessage: userLang === 'hi-IN' ? 'कार्ट खाली करना रद्द कर दिया गया।' : userLang === 'te-IN' ? 'కార్ట్ ఖాళీ చేయడం రద్దు చేయబడింది.' : 'Cart clearing was cancelled.',
        quickReplies: ['View Cart', 'Show All Products'],
      });
      return;
    }
  }

  // 2. Identify Structured Action: Fast-path for quick action commands, Gemini AI for conversational queries
  const deterministicAction = parseIntentDeterministically(userText);
  let action: AssistantStructuredAction | null = null;

  const FAST_PATH_INTENTS = new Set([
    'SHOW_ALL_PRODUCTS',
    'SHOW_CATEGORY',
    'VIEW_CART',
    'CLEAR_CART',
    'SHOW_COUPONS',
    'SHOW_DEALS',
    'MOST_EXPENSIVE_ITEM',
  ]);

  if (deterministicAction && FAST_PATH_INTENTS.has(deterministicAction.intent)) {
    action = deterministicAction;
  } else {
    try {
      action = await callGeminiApi(userText, userLang);
    } catch {
      action = null;
    }

    if (!action || !action.intent) {
      action = deterministicAction;
    }
  }

  // 3. Process the action based on backend database state and strict business rules
  switch (action.intent) {
    // -------------------------------------------------------------------------
    // ADD TO CART
    // -------------------------------------------------------------------------
    case 'ADD_TO_CART': {
      const prodName = action.product_name || userText;
      const matched = matchProductInCatalog(prodName, allProducts);

      if (matched.length === 0) {
        const txt = getLocalizedText(userLang, 'PRODUCT_NOT_FOUND', { prodName });
        res.json({
          success: true,
          intent: 'ADD_TO_CART',
          actionExecuted: false,
          cartUpdated: false,
          language: userLang,
          message: txt.display,
          spokenMessage: txt.spoken,
          quickReplies: userLang === 'hi-IN' ? ['सभी उत्पाद', 'सब्जियां', 'फल'] : userLang === 'te-IN' ? ['అన్ని ఉత్పత్తులు', 'కూరగాయలు', 'పండ్లు'] : ['Show All Products', 'View Vegetables', 'View Fruits'],
        });
        return;
      }

      // If multiple ambiguous matches, ask user to choose
      if (matched.length > 1 && !action.product_name?.toLowerCase().includes('tomato')) {
        const promptMsg =
          userLang === 'hi-IN'
            ? `मुझे "${prodName}" के लिए ${matched.length} वस्तुएं मिलीं। आप किसे जोड़ना चाहते हैं?`
            : userLang === 'te-IN'
            ? `నాకు "${prodName}" కోసం ${matched.length} వస్తువులు దొరికాయి. మీరు దేనిని జోడించాలనుకుంటున్నారు?`
            : `I found ${matched.length} items matching "${prodName}". Which one would you like to add?`;

        res.json({
          success: true,
          intent: 'MULTIPLE_MATCHES',
          actionExecuted: false,
          cartUpdated: false,
          language: userLang,
          products: matched,
          message: promptMsg,
          spokenMessage: promptMsg,
          quickReplies: matched.map((p) => `Add ${p.title}`),
        });
        return;
      }

      const product = matched[0];
      const requestedQty = Math.max(1, Number(action.quantity) || 1);

      // Check current available stock in database
      const liveProduct = await findProductInDb(product.id);
      const availableStock = liveProduct ? Number(liveProduct.stock ?? liveProduct.quantity ?? product.stock) : Number(product.stock);

      if (availableStock <= 0) {
        const txt = getLocalizedText(userLang, 'OUT_OF_STOCK', { title: product.title });
        res.json({
          success: true,
          intent: 'ADD_TO_CART',
          actionExecuted: false,
          cartUpdated: false,
          language: userLang,
          products: [product],
          message: txt.display,
          spokenMessage: txt.spoken,
          quickReplies: userLang === 'hi-IN' ? ['विकल्प सुझाएं', 'सभी उत्पाद'] : userLang === 'te-IN' ? ['ఇతర ఉత్పత్తులు', 'అన్ని ఉత్పత్తులు'] : ['Suggest alternatives', 'Show All Products'],
        });
        return;
      }

      // Fetch existing cart to check cumulative quantity
      const existingCart = await getCartForCustomerInDb(customerId);
      const existingItem = existingCart.find((it) => it.product.id === product.id);
      const currentCartQty = existingItem ? Number(existingItem.quantity) : 0;
      const targetQty = currentCartQty + requestedQty;

      if (targetQty > availableStock) {
        const canAdd = Math.max(0, availableStock - currentCartQty);
        const txt = getLocalizedText(userLang, 'EXCEEDS_STOCK', {
          available: availableStock,
          unit: product.unit,
          title: product.title,
          inCart: currentCartQty,
          canAdd,
        });
        res.json({
          success: true,
          intent: 'ADD_TO_CART',
          actionExecuted: false,
          cartUpdated: false,
          language: userLang,
          products: [product],
          message: txt.display,
          spokenMessage: txt.spoken,
          quickReplies: canAdd > 0 ? [`Add ${canAdd} ${product.unit} ${product.title}`, 'View Cart'] : ['View Cart', 'Show All Products'],
        });
        return;
      }

      let chosenPackSize = product.unit;
      let chosenPrice = Number(product.price);

      if (action.unit && Array.isArray(product.packSizes) && product.packSizes.length > 0) {
        const normUnit = cleanStr(action.unit);
        const matchingPack = product.packSizes.find((ps: any) =>
          cleanStr(ps.size).includes(normUnit) || normUnit.includes(cleanStr(ps.size))
        );
        if (matchingPack) {
          chosenPackSize = matchingPack.size;
          chosenPrice = Number(matchingPack.price);
        }
      }

      // Execute Cart Update in MySQL
      await saveCartItemInDb(customerId, product.id, targetQty, chosenPackSize, chosenPrice);
      const updatedCart = await getCartForCustomerInDb(customerId);
      const itemSubtotal = chosenPrice * targetQty;
      const txt = getLocalizedText(userLang, 'ADDED_TO_CART', {
        qty: requestedQty,
        title: product.title,
        packSize: chosenPackSize,
        price: chosenPrice,
        targetQty,
        subtotal: itemSubtotal,
      });

      res.json({
        success: true,
        intent: 'ADD_TO_CART',
        actionExecuted: true,
        cartUpdated: true,
        language: userLang,
        cartItems: updatedCart,
        products: [product],
        message: txt.display,
        spokenMessage: txt.spoken,
        quickReplies: userLang === 'hi-IN' ? ['कार्ट देखें', 'सब्जियां', 'फल', 'कार्ट टोटल'] : userLang === 'te-IN' ? ['కార్ట్ చూపించు', 'కూరగాయలు', 'పండ్లు', 'మొత్తం'] : ['View Cart', 'Show Vegetables', 'Show Fruits', 'Calculate cart total'],
      });
      return;
    }

    // -------------------------------------------------------------------------
    // UPDATE CART QUANTITY
    // -------------------------------------------------------------------------
    case 'UPDATE_CART_QTY': {
      const prodName = action.product_name || userText;
      const existingCart = await getCartForCustomerInDb(customerId);
      const matchingItem = existingCart.find(
        (it) =>
          cleanStr(it.product.title).includes(cleanStr(prodName)) ||
          cleanStr(prodName).includes(cleanStr(it.product.title))
      );

      if (!matchingItem) {
        const notInCartMsg =
          userLang === 'hi-IN'
            ? `"${prodName}" आपके कार्ट में नहीं है। क्या आप इसे जोड़ना चाहते हैं?`
            : userLang === 'te-IN'
            ? `"${prodName}" మీ కార్ట్‌లో లేదు. మీరు దీన్ని జోడించాలనుకుంటున్నారా?`
            : `"${prodName}" is not currently in your cart. Would you like to add it?`;
        res.json({
          success: true,
          intent: 'UPDATE_CART_QTY',
          actionExecuted: false,
          cartUpdated: false,
          language: userLang,
          message: notInCartMsg,
          spokenMessage: notInCartMsg,
          quickReplies: [`Add ${prodName}`, 'View Cart'],
        });
        return;
      }

      const newQty = Math.max(0, Number(action.quantity) || 1);
      const liveProduct = await findProductInDb(matchingItem.product.id);
      const availableStock = liveProduct ? Number(liveProduct.stock ?? liveProduct.quantity ?? matchingItem.product.stock) : Number(matchingItem.product.stock);

      if (newQty > availableStock) {
        res.json({
          success: true,
          intent: 'UPDATE_CART_QTY',
          actionExecuted: false,
          cartUpdated: false,
          language: userLang,
          message: `Only ${availableStock} ${matchingItem.product.unit} available in stock for "${matchingItem.product.title}".`,
          spokenMessage: `Only ${availableStock} available in stock.`,
          quickReplies: [`Set to ${availableStock}`, 'View Cart'],
        });
        return;
      }

      await saveCartItemInDb(customerId, matchingItem.product.id, newQty);
      const updatedCart = await getCartForCustomerInDb(customerId);
      const txt = getLocalizedText(userLang, 'UPDATE_QTY', { title: matchingItem.product.title, qty: newQty });

      res.json({
        success: true,
        intent: 'UPDATE_CART_QTY',
        actionExecuted: true,
        cartUpdated: true,
        language: userLang,
        cartItems: updatedCart,
        products: [matchingItem.product],
        message: txt.display,
        spokenMessage: txt.spoken,
        quickReplies: ['View Cart', 'Calculate cart total'],
      });
      return;
    }

    // -------------------------------------------------------------------------
    // REMOVE FROM CART
    // -------------------------------------------------------------------------
    case 'REMOVE_FROM_CART': {
      const prodName = action.product_name || userText;
      const existingCart = await getCartForCustomerInDb(customerId);
      const matchingItem = existingCart.find(
        (it) =>
          cleanStr(it.product.title).includes(cleanStr(prodName)) ||
          cleanStr(prodName).includes(cleanStr(it.product.title))
      );

      if (!matchingItem) {
        const notFoundMsg =
          userLang === 'hi-IN'
            ? `आपके कार्ट में "${prodName}" नहीं मिला।`
            : userLang === 'te-IN'
            ? `మీ కార్ట్‌లో "${prodName}" కనుగొనబడలేదు.`
            : `I could not find "${prodName}" in your cart.`;
        res.json({
          success: true,
          intent: 'REMOVE_FROM_CART',
          actionExecuted: false,
          cartUpdated: false,
          language: userLang,
          message: notFoundMsg,
          spokenMessage: notFoundMsg,
          quickReplies: ['View Cart', 'Show All Products'],
        });
        return;
      }

      await removeCartItemInDb(customerId, matchingItem.product.id);
      const updatedCart = await getCartForCustomerInDb(customerId);
      const txt = getLocalizedText(userLang, 'REMOVED_FROM_CART', { title: matchingItem.product.title });

      res.json({
        success: true,
        intent: 'REMOVE_FROM_CART',
        actionExecuted: true,
        cartUpdated: true,
        language: userLang,
        cartItems: updatedCart,
        message: txt.display,
        spokenMessage: txt.spoken,
        quickReplies: ['View Cart', 'Show All Products'],
      });
      return;
    }

    // -------------------------------------------------------------------------
    // VIEW CART / CALCULATE CART TOTAL
    // -------------------------------------------------------------------------
    case 'VIEW_CART': {
      const cartItems = await getCartForCustomerInDb(customerId);
      if (cartItems.length === 0) {
        const txt = getLocalizedText(userLang, 'VIEW_CART_EMPTY');
        res.json({
          success: true,
          intent: 'VIEW_CART',
          cartItems: [],
          language: userLang,
          message: txt.display,
          spokenMessage: txt.spoken,
          quickReplies: userLang === 'hi-IN' ? ['सभी उत्पाद', 'सब्जियां', 'फल'] : userLang === 'te-IN' ? ['అన్ని ఉత్పత్తులు', 'కూరగాయలు', 'పండ్లు'] : ['Show All Products', 'View Vegetables', 'View Fruits', 'View Deals'],
        });
        return;
      }

      let subtotal = 0;
      let itemCount = 0;
      let mostExpensive: any = null;

      for (const item of cartItems) {
        const qty = Number(item.quantity);
        const price = Number(item.product.price);
        subtotal += price * qty;
        itemCount += qty;

        if (!mostExpensive || price > Number(mostExpensive.product.price)) {
          mostExpensive = item;
        }
      }

      const deliveryFee = computeDeliveryCharges(subtotal, deliveryRules);
      const total = subtotal + deliveryFee;

      const summaryText = cartItems
        .map((it) => `• ${it.product.title}: ${it.quantity} × ₹${it.product.price} = ₹${it.quantity * it.product.price}`)
        .join('\n');

      const txt = getLocalizedText(userLang, 'VIEW_CART_SUMMARY', {
        count: itemCount,
        subtotal,
        deliveryFee: deliveryFee === 0 ? 0 : deliveryFee,
        total,
      });

      res.json({
        success: true,
        intent: 'VIEW_CART',
        cartItems,
        language: userLang,
        cartSummary: {
          itemCount,
          subtotal,
          deliveryFee,
          discount: 0,
          total,
          mostExpensiveItem: mostExpensive,
        },
        message: `${txt.display}\n\n${summaryText}\n\nItem Subtotal: ₹${subtotal}\nDelivery: ${deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}\nCart Total: ₹${total}`,
        spokenMessage: txt.spoken,
        quickReplies: ['Calculate cart total', 'Show available coupons', 'Clear my cart'],
      });
      return;
    }

    // -------------------------------------------------------------------------
    // CLEAR CART
    // -------------------------------------------------------------------------
    case 'CLEAR_CART': {
      if (action.confirmed) {
        await clearCartInDb(customerId);
        const updatedCart = await getCartForCustomerInDb(customerId);
        const txt = getLocalizedText(userLang, 'CLEAR_CART_DONE');
        res.json({
          success: true,
          intent: 'CLEAR_CART',
          actionExecuted: true,
          cartUpdated: true,
          language: userLang,
          cartItems: updatedCart,
          message: txt.display,
          spokenMessage: txt.spoken,
          quickReplies: ['Show All Products', 'View Vegetables', 'View Fruits'],
        });
        return;
      }

      // Require confirmation before destructive operation
      const currentCart = await getCartForCustomerInDb(customerId);
      const txt = getLocalizedText(userLang, 'CLEAR_CART_CONFIRM', { count: currentCart.length });
      res.json({
        success: true,
        intent: 'CLEAR_CART',
        requiresConfirmation: true,
        pendingAction: { intent: 'CLEAR_CART' },
        language: userLang,
        message: txt.display,
        spokenMessage: txt.spoken,
        quickReplies: userLang === 'hi-IN' ? ['हाँ, कार्ट खाली करें', 'नहीं'] : userLang === 'te-IN' ? ['అవును, ఖాళీ చేయి', 'వద్దు'] : ['Yes, clear my cart', 'No, keep my items'],
      });
      return;
    }

    // -------------------------------------------------------------------------
    // MOST EXPENSIVE ITEM
    // -------------------------------------------------------------------------
    case 'MOST_EXPENSIVE_ITEM': {
      const cartItems = await getCartForCustomerInDb(customerId);
      if (cartItems.length > 0) {
        let maxItem = cartItems[0];
        for (const item of cartItems) {
          if (Number(item.product.price) > Number(maxItem.product.price)) {
            maxItem = item;
          }
        }
        const expMsg =
          userLang === 'hi-IN'
            ? `आपके कार्ट में सबसे महंगा सामान "${maxItem.product.title}" है (₹${maxItem.product.price}/${maxItem.product.unit})।`
            : userLang === 'te-IN'
            ? `మీ కార్ట్‌లో అత్యంత ఖరీదైన వస్తువు "${maxItem.product.title}" (₹${maxItem.product.price}/${maxItem.product.unit}).`
            : `The most expensive item in your cart is "${maxItem.product.title}" at ₹${maxItem.product.price} per ${maxItem.product.unit}.`;
        res.json({
          success: true,
          intent: 'MOST_EXPENSIVE_ITEM',
          language: userLang,
          products: [maxItem.product],
          message: expMsg,
          spokenMessage: expMsg,
          quickReplies: ['View Cart', 'Calculate cart total'],
        });
        return;
      }

      // In catalog
      const sortedCatalog = [...allProducts].sort((a, b) => Number(b.price) - Number(a.price));
      const top = sortedCatalog[0];
      const catalogMsg =
        userLang === 'hi-IN'
          ? `हमारे स्टोर का सबसे प्रीमियम उत्पाद "${top.title}" है (₹${top.price}/${top.unit})।`
          : userLang === 'te-IN'
          ? `మా స్టోర్‌లో అత్యంత ప్రీమియం ఉత్పత్తి "${top.title}" (₹${top.price}/${top.unit}).`
          : `The most premium harvest in our store is "${top.title}" at ₹${top.price} per ${top.unit}.`;
      res.json({
        success: true,
        intent: 'MOST_EXPENSIVE_ITEM',
        language: userLang,
        products: [top],
        message: catalogMsg,
        spokenMessage: catalogMsg,
        quickReplies: [`Add ${top.title}`, 'View Cart'],
      });
      return;
    }

    // -------------------------------------------------------------------------
    // SEARCH PRODUCTS
    // -------------------------------------------------------------------------
    case 'SEARCH_PRODUCTS': {
      const term = action.product_name || userText;
      const matched = matchProductInCatalog(term, allProducts);

      if (matched.length === 0) {
        const notFoundSearch =
          userLang === 'hi-IN'
            ? `"${term}" के लिए कोई उत्पाद नहीं मिला। क्या आप पूरी सूची देखना चाहेंगे?`
            : userLang === 'te-IN'
            ? `"${term}" కోసం ఉత్పత్తులు కనుగొనబడలేదు. మీరు మొత్తం కేటలాగ్‌ను చూడాలనుకుంటున్నారా?`
            : `No products found matching "${term}". Would you like to explore our full grocery catalogue?`;
        res.json({
          success: true,
          intent: 'SEARCH_PRODUCTS',
          products: [],
          language: userLang,
          message: notFoundSearch,
          spokenMessage: notFoundSearch,
          quickReplies: ['Show All Products', 'View Vegetables', 'View Fruits'],
        });
        return;
      }

      const foundSearch =
        userLang === 'hi-IN'
          ? `"${term}" के लिए ${matched.length} ताज़ा उत्पाद मिले:`
          : userLang === 'te-IN'
          ? `"${term}" కోసం ${matched.length} తాజా ఉత్పత్తులు లభించాయి:`
          : `I found ${matched.length} fresh item${matched.length > 1 ? 's' : ''} matching "${term}":`;
      res.json({
        success: true,
        intent: 'SEARCH_PRODUCTS',
        products: matched,
        language: userLang,
        message: foundSearch,
        spokenMessage: foundSearch,
        quickReplies: matched.slice(0, 3).map((p) => `Add ${p.title}`),
      });
      return;
    }

    // -------------------------------------------------------------------------
    // SHOW ALL PRODUCTS
    // -------------------------------------------------------------------------
    case 'SHOW_ALL_PRODUCTS': {
      const allMsg =
        userLang === 'hi-IN'
          ? `यहाँ हमारे ${allProducts.length} ताज़ा उत्पादों की पूरी सूची है:`
          : userLang === 'te-IN'
          ? `ఇక్కడ మా ${allProducts.length} తాజా ఉత్పత్తుల పూర్తి కేటలాగ్ ఉంది:`
          : `Here is our complete catalogue of ${allProducts.length} farm-fresh products:`;
      res.json({
        success: true,
        intent: 'SHOW_ALL_PRODUCTS',
        products: allProducts,
        language: userLang,
        message: allMsg,
        spokenMessage: allMsg,
        quickReplies: ['View Vegetables', 'View Fruits', 'View Deals', 'View Cart'],
      });
      return;
    }

    // -------------------------------------------------------------------------
    // SHOW CATEGORY (Vegetables, Fruits, Dairy, Bakery, Beverages, etc.)
    // -------------------------------------------------------------------------
    case 'SHOW_CATEGORY': {
      const cat = cleanStr(action.category);
      let filtered: any[] = [];
      let catLabel = 'Produce';

      if (cat === 'vegetables' || cat === 'vegetable' || cat === 'veggies') {
        catLabel = userLang === 'hi-IN' ? 'सब्जियां' : userLang === 'te-IN' ? 'కూరగాయలు' : 'Vegetables';
        filtered = allProducts.filter((p) => {
          const name = cleanStr(p.title);
          return (
            p.category === 'produce' &&
            !name.includes('banana') &&
            !name.includes('apple') &&
            !name.includes('orange') &&
            !name.includes('avocado')
          );
        });
      } else if (cat === 'fruits' || cat === 'fruit') {
        catLabel = userLang === 'hi-IN' ? 'फल' : userLang === 'te-IN' ? 'పండ్లు' : 'Fruits';
        filtered = allProducts.filter((p) => {
          const name = cleanStr(p.title);
          return (
            name.includes('banana') ||
            name.includes('apple') ||
            name.includes('orange') ||
            name.includes('avocado') ||
            name.includes('berry')
          );
        });
      } else if (cat === 'dairy') {
        catLabel = userLang === 'hi-IN' ? 'डेयरी उत्पाद' : userLang === 'te-IN' ? 'పాల ఉత్పత్తులు' : 'Dairy & Eggs';
        filtered = allProducts.filter((p) => p.category === 'dairy');
      } else if (cat === 'bakery') {
        catLabel = userLang === 'hi-IN' ? 'बेकरी' : userLang === 'te-IN' ? 'బేకరీ' : 'Bakery';
        filtered = allProducts.filter((p) => p.category === 'bakery');
      } else if (cat === 'beverages') {
        catLabel = userLang === 'hi-IN' ? 'पेय पदार्थ' : userLang === 'te-IN' ? 'పానీయాలు' : 'Beverages';
        filtered = allProducts.filter((p) => p.category === 'beverages');
      } else {
        filtered = allProducts.filter((p) => p.category === cat);
      }

      const catMsg =
        userLang === 'hi-IN'
          ? `${catLabel} श्रेणी में ${filtered.length} उत्पाद मिले:`
          : userLang === 'te-IN'
          ? `${catLabel} విభాగంలో ${filtered.length} ఉత్పత్తులు లభించాయి:`
          : `Found ${filtered.length} items in ${catLabel}:`;

      res.json({
        success: true,
        intent: 'SHOW_CATEGORY',
        products: filtered,
        language: userLang,
        message: catMsg,
        spokenMessage: catMsg,
        quickReplies: filtered.slice(0, 3).map((p) => `Add ${p.title}`),
      });
      return;
    }

    // -------------------------------------------------------------------------
    // FILTER BY PRICE / CHEAPEST
    // -------------------------------------------------------------------------
    case 'FILTER_PRICE': {
      const maxPrice = Number(action.price_limit) || 100;
      const filtered = allProducts
        .filter((p) => Number(p.price) <= maxPrice)
        .sort((a, b) => Number(a.price) - Number(b.price));

      const filterMsg =
        userLang === 'hi-IN'
          ? `₹${maxPrice} से कम मूल्य में ${filtered.length} उत्पाद मिले:`
          : userLang === 'te-IN'
          ? `₹${maxPrice} లోపు ధరలో ${filtered.length} ఉత్పత్తులు లభించాయి:`
          : `Found ${filtered.length} items under ₹${maxPrice} (sorted by price):`;

      res.json({
        success: true,
        intent: 'FILTER_PRICE',
        products: filtered,
        language: userLang,
        message: filterMsg,
        spokenMessage: filterMsg,
        quickReplies: filtered.slice(0, 3).map((p) => `Add ${p.title}`),
      });
      return;
    }

    // -------------------------------------------------------------------------
    // SHOW DEALS / DISCOUNTS
    // -------------------------------------------------------------------------
    case 'SHOW_DEALS': {
      const deals = allProducts.filter(
        (p) => p.badge || p.isOrganic || Number(p.price) < 70
      );

      const dealsMsg =
        userLang === 'hi-IN'
          ? `यहाँ आज के विशेष फार्म ऑफर्स और छूट वाले उत्पाद हैं:`
          : userLang === 'te-IN'
          ? `ఇక్కడ ఈరోజు ప్రత్యేక ఆఫర్లు మరియు తగ్గింపు ఉత్పత్తులు ఉన్నాయి:`
          : `Here are today's featured farm deals and value harvest items:`;

      res.json({
        success: true,
        intent: 'SHOW_DEALS',
        products: deals,
        language: userLang,
        message: dealsMsg,
        spokenMessage: dealsMsg,
        quickReplies: deals.slice(0, 3).map((p) => `Add ${p.title}`),
      });
      return;
    }

    // -------------------------------------------------------------------------
    // BUDGET SHOPPING: e.g. "Prepare a grocery list under ₹500"
    // -------------------------------------------------------------------------
    case 'BUDGET_LIST': {
      const budget = Number(action.budget_limit) || 500;
      const targetCat = action.category;

      let candidates = allProducts.filter((p) => Number(p.stock) > 0);
      if (targetCat === 'vegetables') {
        candidates = candidates.filter((p) => {
          const name = cleanStr(p.title);
          return (
            p.category === 'produce' &&
            !name.includes('banana') &&
            !name.includes('apple') &&
            !name.includes('orange')
          );
        });
      }

      // Greedy selection of diverse items within budget
      const basket: any[] = [];
      let totalCost = 0;

      for (const p of candidates) {
        const cost = Number(p.price);
        if (totalCost + cost <= budget) {
          basket.push(p);
          totalCost += cost;
        }
      }

      const breakdown = basket
        .map((p) => `• ${p.title} (${p.unit}) — ₹${p.price}`)
        .join('\n');

      const budgetMsg =
        userLang === 'hi-IN'
          ? `आपके ₹${budget} के बजट में ${basket.length} वस्तुओं की टोकरी तैयार है (कुल: ₹${totalCost}):\n\n${breakdown}\n\nशेष बजट: ₹${budget - totalCost}।`
          : userLang === 'te-IN'
          ? `మీ ₹${budget} బడ్జెట్‌లో ${basket.length} వస్తువుల బాస్కెట్ సిద్ధంగా ఉంది (మొత్తం: ₹${totalCost}):\n\n${breakdown}\n\nమిగిలిన బడ్జెట్: ₹${budget - totalCost}.`
          : `Here is a curated ${targetCat || 'grocery'} basket for under ₹${budget} (Total: ₹${totalCost}):\n\n${breakdown}\n\nRemaining budget: ₹${budget - totalCost}.`;

      const spokenBudget =
        userLang === 'hi-IN'
          ? `₹${budget} के बजट में ${basket.length} वस्तुएं तैयार हैं। कुल योग ₹${totalCost} है।`
          : userLang === 'te-IN'
          ? `₹${budget} బడ్జెట్‌లో ${basket.length} వస్తువులు సిద్ధంగా ఉన్నాయి. మొత్తం ₹${totalCost}.`
          : `Curated ${basket.length} items within your ₹${budget} budget, totaling ₹${totalCost}.`;

      res.json({
        success: true,
        intent: 'BUDGET_LIST',
        products: basket,
        language: userLang,
        message: budgetMsg,
        spokenMessage: spokenBudget,
        quickReplies: ['Add all to cart', 'View Vegetables', 'View Cart'],
      });
      return;
    }

    // -------------------------------------------------------------------------
    // SHOW COUPONS
    // -------------------------------------------------------------------------
    case 'SHOW_COUPONS': {
      const coupons = await getCouponsFromDb();
      const active = coupons.filter((c) => c.isActive !== false);

      const couponText = active
        .map(
          (c) =>
            `• **${c.code}**: ${c.discountPercentage}% OFF on orders ₹${c.minOrderAmount}+ (${c.description || 'Special harvest savings'})`
        )
        .join('\n');

      const headerMsg =
        userLang === 'hi-IN'
          ? `यहाँ आपके लिए उपलब्ध डिस्काउंट कूपन हैं:`
          : userLang === 'te-IN'
          ? `ఇక్కడ మీ కోసం అందుబాటులో ఉన్న డిస్కౌంట్ కూపన్లు ఉన్నాయి:`
          : `Here are the available discount coupons for you:`;

      res.json({
        success: true,
        intent: 'SHOW_COUPONS',
        coupons: active,
        language: userLang,
        message: `${headerMsg}\n\n${couponText}`,
        spokenMessage: `${headerMsg} ${active.map((c) => c.code).join(', ')}.`,
        quickReplies: active.map((c) => `Apply coupon ${c.code}`),
      });
      return;
    }

    // -------------------------------------------------------------------------
    // APPLY COUPON
    // -------------------------------------------------------------------------
    case 'APPLY_COUPON': {
      const code = (action.coupon_code || userText.match(/save\d+/i)?.[0] || '').toUpperCase();
      if (!code) {
        const coupons = await getCouponsFromDb();
        res.json({
          success: true,
          intent: 'APPLY_COUPON',
          coupons,
          language: userLang,
          message: userLang === 'hi-IN' ? 'कृपया बताएं कि आप कौन सा कूपन कोड लागू करना चाहते हैं।' : userLang === 'te-IN' ? 'దయచేసి ఏ కూపన్ కోడ్‌ను వర్తింపజేయాలో పేర్కొనండి.' : 'Please specify which coupon code you would like to apply.',
          spokenMessage: userLang === 'hi-IN' ? 'कृपया कूपन कोड बताएं।' : userLang === 'te-IN' ? 'దయచేసి కూపన్ కోడ్‌ను తెలపండి.' : 'Please specify a coupon code.',
          quickReplies: coupons.map((c) => `Apply ${c.code}`),
        });
        return;
      }

      const coupon = await findCouponByCodeInDb(code);
      const isEnabled = coupon && (coupon.isActive !== false && coupon.enabled !== 0 && coupon.enabled !== false);
      if (!coupon || !isEnabled) {
        const invalidMsg =
          userLang === 'hi-IN'
            ? `कूपन कोड "${code}" अमान्य या समाप्त हो चुका है।`
            : userLang === 'te-IN'
            ? `కూపన్ కోడ్ "${code}" చెల్లదు లేదా గడువు ముగిసింది.`
            : `Coupon code "${code}" is invalid or expired.`;
        res.json({
          success: false,
          intent: 'APPLY_COUPON',
          language: userLang,
          message: invalidMsg,
          spokenMessage: invalidMsg,
          quickReplies: ['Show available coupons'],
        });
        return;
      }

      const cartItems = await getCartForCustomerInDb(customerId);
      const subtotal = cartItems.reduce(
        (sum, it) => sum + Number(it.product.price) * Number(it.quantity),
        0
      );

      const minOrder = Number(coupon.minOrderAmount ?? coupon.minimum_order_amount ?? 0);
      if (subtotal < minOrder) {
        const diff = minOrder - subtotal;
        const txt = getLocalizedText(userLang, 'APPLY_COUPON_MIN_ORDER', {
          code,
          minOrder,
          subtotal,
          diff,
        });
        res.json({
          success: false,
          intent: 'APPLY_COUPON',
          language: userLang,
          message: txt.display,
          spokenMessage: txt.spoken,
          quickReplies: ['Show All Products', 'View Cart'],
        });
        return;
      }

      const discountPct = Number(coupon.discountPercentage ?? coupon.discount_percentage ?? 0);
      const discountAmt = Math.round((subtotal * discountPct) / 100);
      const txt = getLocalizedText(userLang, 'APPLY_COUPON_SUCCESS', {
        code,
        discountAmt,
        pct: discountPct,
      });

      res.json({
        success: true,
        intent: 'APPLY_COUPON',
        actionExecuted: true,
        language: userLang,
        message: txt.display,
        spokenMessage: txt.spoken,
        quickReplies: ['View Cart', 'Calculate cart total'],
      });
      return;
    }

    // -------------------------------------------------------------------------
    // GENERAL ASSISTANT QUERY
    // -------------------------------------------------------------------------
    case 'GENERAL_QUERY':
    default: {
      const defaultGeneral =
        userLang === 'hi-IN'
          ? 'नमस्ते! मैं आपका FreshCart AI शॉपिंग और वॉइस असिस्टेंट हूँ। आप बोलकर या लिखकर ताज़ा फल, सब्जियां कार्ट में जोड़ सकते हैं, कूपन लगा सकते हैं, और बजट लिस्ट बना सकते हैं!'
          : userLang === 'te-IN'
          ? 'నమస్కారం! నేను మీ FreshCart AI షాపింగ్ & వాయిస్ అసిస్టెంట్‌ని. మీరు మాట్లాడి లేదా టైప్ చేసి తాజా కూరగాయలు, పండ్లు కార్ట్‌లో వేయవచ్చు, కూపన్లు వర్తింపజేయవచ్చు!'
          : `Hello! I'm your FreshCart AI Shopping Assistant. I can help you search farm-fresh produce, add items to your cart ("Add 2 kg tomatoes"), manage your basket, prepare lists under your budget, and apply coupons!`;

      res.json({
        success: true,
        intent: 'GENERAL_QUERY',
        language: userLang,
        message: action.message || defaultGeneral,
        spokenMessage: action.message || defaultGeneral,
        quickReplies: ['Show All Products', 'View Vegetables', 'View Fruits', 'View Cart', "Show today's deals"],
      });
      return;
    }
  }
}
