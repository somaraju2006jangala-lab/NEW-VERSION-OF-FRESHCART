import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Minimize2,
  Maximize2,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  ShoppingCart,
  Plus,
  Minus,
  Check,
  AlertCircle,
  Tag,
  ArrowRight,
  Globe,
  Square,
  RotateCcw,
  Camera,
  Trash2,
  ClipboardList,
  CheckCircle2,
  HelpCircle,
  Edit3,
} from 'lucide-react';
import { Product, CartItem } from '../types';
import {
  AssistantMessage,
  AssistantProductCard,
  AssistantCouponCard,
  RecognizedGroceryItem,
  GroceryListReview,
  sendAssistantMessage,
  VoiceRecognitionManager,
  speakAssistantResponse,
  stopAssistantSpeaking,
} from '../services/assistantService';

interface AssistantChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerToken?: string;
  customerName?: string;
  onAddToCart: (product: Product, quantity: number, packSize?: string, packPrice?: number) => void;
  onUpdateCartQty: (productId: string, delta: number, packSize?: string) => void;
  onRemoveCartItem: (productId: string, packSize?: string) => void;
  onClearCart: () => void;
  onNavigateToCart: () => void;
  onSyncCartFromBackend?: (items: CartItem[]) => void;
  sessionMessages: AssistantMessage[];
  setSessionMessages: React.Dispatch<React.SetStateAction<AssistantMessage[]>>;
}

const QUICK_ACTIONS = [
  'Show All Products',
  'View Vegetables',
  'View Fruits',
  'View Deals',
  'View Cart',
];

const LANGUAGE_OPTIONS = [
  { code: 'en-IN', label: 'English', short: 'EN' },
  { code: 'hi-IN', label: 'हिन्दी', short: 'HI' },
  { code: 'te-IN', label: 'తెలుగు', short: 'TE' },
];

interface AssistantProductCardItemProps {
  product: AssistantProductCard;
  onConfirmAdd: (product: AssistantProductCard, quantity: number, packSize: string, price: number) => void;
  initiallySelecting?: boolean;
}

const AssistantProductCardItem: React.FC<AssistantProductCardItemProps> = ({
  product,
  onConfirmAdd,
  initiallySelecting = false,
}) => {
  const rawPacks =
    Array.isArray(product.packSizes) && product.packSizes.length > 0
      ? product.packSizes
      : [{ size: product.unit || '1 unit', price: product.price }];

  const availablePacks = rawPacks.filter((ps) => ps.isAvailable !== false && ps.stock !== 0);
  const packsToDisplay = availablePacks.length > 0 ? availablePacks : rawPacks;

  const [isSelecting, setIsSelecting] = useState<boolean>(Boolean(initiallySelecting));
  const [selectedPackSize, setSelectedPackSize] = useState<string>(packsToDisplay[0]?.size || product.unit || '1 unit');
  const [selectedPrice, setSelectedPrice] = useState<number>(packsToDisplay[0]?.price ?? product.price);
  const [quantity, setQuantity] = useState<number>(1);

  if (!isSelecting) {
    return (
      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {product.image ? (
            <img
              src={product.image}
              alt={product.title}
              className="w-11 h-11 rounded-lg object-cover bg-white/5 shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-5 h-5 text-emerald-400" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-xs font-semibold text-white truncate">
                {product.title}
              </h4>
              {product.badge && (
                <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30">
                  {product.badge}
                </span>
              )}
            </div>
            <p className="text-[11px] text-emerald-300 font-bold mt-0.5">
              ₹{selectedPrice}{' '}
              <span className="text-[10px] text-slate-400 font-normal">
                / {selectedPackSize}
              </span>
              {packsToDisplay.length > 1 && (
                <span className="ml-1.5 text-[9.5px] font-normal px-1 py-0.2 rounded bg-white/10 text-slate-300">
                  {packsToDisplay.length} sizes
                </span>
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsSelecting(true)}
          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-transform active:scale-95 cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-xl bg-gradient-to-b from-[#112233] to-[#0c1926] border border-emerald-500/40 shadow-lg shadow-emerald-950/30 space-y-2.5 transition-all">
      {/* Header Row: Thumbnail, Title, Price, Cancel button */}
      <div className="flex items-start justify-between gap-2 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          {product.image ? (
            <img
              src={product.image}
              alt={product.title}
              className="w-10 h-10 rounded-lg object-cover bg-white/5 shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-4 h-4 text-emerald-400" />
            </div>
          )}
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white truncate">
              {product.title}
            </h4>
            <p className="text-xs font-bold text-emerald-400 mt-0.5">
              ₹{selectedPrice}{' '}
              <span className="text-[10px] text-slate-400 font-normal">
                / {selectedPackSize}
              </span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsSelecting(false)}
          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Cancel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Pack Size Selector */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
          <span>Available Pack Sizes:</span>
          {packsToDisplay.length > 1 && (
            <span className="text-[10px] text-emerald-300 font-normal">Tap to choose</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {packsToDisplay.map((ps) => {
            const isChosen = selectedPackSize.toLowerCase() === ps.size.toLowerCase();
            return (
              <button
                type="button"
                key={ps.size}
                onClick={() => {
                  setSelectedPackSize(ps.size);
                  setSelectedPrice(Number(ps.price));
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isChosen
                    ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                }`}
              >
                <span>{ps.size}</span>
                <span className="text-[11px] font-normal opacity-90">₹{ps.price}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quantity Selector */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] font-semibold text-slate-300">Quantity:</span>
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-2 py-1">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Decrease quantity"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="w-8 text-center text-xs font-bold text-white select-none">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => q + 1)}
            className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Increase quantity"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Add to Cart Submit Button */}
      <button
        type="button"
        onClick={() => {
          onConfirmAdd(product, quantity, selectedPackSize, selectedPrice);
          setIsSelecting(false);
          setQuantity(1);
        }}
        className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40 transition-transform active:scale-98 cursor-pointer mt-1"
      >
        <ShoppingCart className="w-3.5 h-3.5" />
        <span>Add {quantity} to Cart • ₹{selectedPrice * quantity}</span>
      </button>
    </div>
  );
};

interface GroceryListReviewCardProps {
  review: GroceryListReview;
  onConfirmAll: (items: RecognizedGroceryItem[], listId: string) => void;
  isSubmitting?: boolean;
}

const GroceryListReviewCard: React.FC<GroceryListReviewCardProps> = ({
  review,
  onConfirmAll,
  isSubmitting = false,
}) => {
  const [items, setItems] = useState<RecognizedGroceryItem[]>(() => [...review.items]);
  const [isConfirmed, setIsConfirmed] = useState<boolean>(Boolean(review.confirmed));
  const [isEditingPacks, setIsEditingPacks] = useState<boolean>(false);

  useEffect(() => {
    if (review.confirmed) {
      setIsConfirmed(true);
    }
  }, [review.confirmed]);

  const matchedItems = items.filter((it) => it.status === 'matched' && it.productId);
  const unavailableItems = items.filter((it) => it.status === 'unavailable');
  const unclearItems = items.filter((it) => it.status === 'unclear');

  const totalPacks = matchedItems.reduce((acc, it) => acc + (it.packsCount || 1), 0);
  const totalSubtotal = matchedItems.reduce(
    (acc, it) => acc + (it.subtotal ?? (it.price ?? 0) * (it.packsCount || 1)),
    0
  );

  const handleUpdateItemQty = (id: string, delta: number) => {
    if (isConfirmed) return;
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const newPacks = Math.max(1, (it.packsCount || 1) + delta);
        const unitPrice = it.price ?? 0;
        return {
          ...it,
          packsCount: newPacks,
          subtotal: unitPrice * newPacks,
        };
      })
    );
  };

  const handleSelectPackSize = (id: string, packSize: string, price: number) => {
    if (isConfirmed) return;
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const count = it.packsCount || 1;
        return {
          ...it,
          selectedPackSize: packSize,
          price: price,
          subtotal: price * count,
        };
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    if (isConfirmed) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleConfirm = () => {
    if (isConfirmed || isSubmitting || matchedItems.length === 0) return;
    onConfirmAll(matchedItems, review.listId);
    setIsConfirmed(true);
  };

  return (
    <div className="rounded-2xl bg-gradient-to-b from-[#102334] to-[#0a1724] border border-emerald-500/40 p-3.5 shadow-xl shadow-black/40 space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center ring-1 ring-emerald-500/40">
            <ClipboardList className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
              <span>Grocery List Review</span>
              <span className="text-[10px] font-normal px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {matchedItems.length} matched
              </span>
            </h4>
            <p className="text-[10px] text-slate-300 mt-0.5">
              Review recognised items and adjust quantities before adding to cart
            </p>
          </div>
        </div>

        {matchedItems.length > 0 && !isConfirmed && (
          <button
            type="button"
            onClick={() => setIsEditingPacks((prev) => !prev)}
            className={`px-2 py-1 rounded-lg text-[10.5px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
              isEditingPacks
                ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-500/50'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
            }`}
          >
            <Edit3 className="w-3 h-3" />
            <span>{isEditingPacks ? 'Done Editing' : 'Edit Items'}</span>
          </button>
        )}
      </div>

      {/* Matched Items List */}
      {matchedItems.length > 0 ? (
        <div className="space-y-2">
          {matchedItems.map((item) => {
            const hasMultiplePacks =
              Array.isArray(item.availablePackSizes) && item.availablePackSizes.length > 1;

            return (
              <div
                key={item.id}
                className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 transition-all space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Thumbnail and title */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    {item.productImage ? (
                      <img
                        src={item.productImage}
                        alt={item.productTitle || item.itemName}
                        className="w-10 h-10 rounded-lg object-cover bg-white/5 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <ShoppingCart className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-white truncate max-w-[160px] sm:max-w-[200px]">
                          {item.productTitle || item.itemName}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>List: <strong className="text-slate-300 font-medium">{item.rawText}</strong></span>
                        <span>•</span>
                        <span className="text-emerald-300 font-semibold">₹{item.price}</span>
                        <span>/</span>
                        <span>{item.selectedPackSize}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right side: Stepper + Subtotal + Remove */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Stepper controls */}
                    <div className="flex items-center gap-1 bg-white/10 border border-white/15 rounded-lg px-1.5 py-0.5">
                      <button
                        type="button"
                        onClick={() => handleUpdateItemQty(item.id, -1)}
                        disabled={isConfirmed || (item.packsCount || 1) <= 1}
                        className="w-5 h-5 rounded hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center cursor-pointer transition-colors"
                        title="Decrease packs"
                      >
                        <Minus className="w-2.5 h-2.5" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-white select-none">
                        {item.packsCount || 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateItemQty(item.id, 1)}
                        disabled={isConfirmed}
                        className="w-5 h-5 rounded hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center cursor-pointer transition-colors"
                        title="Increase packs"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>

                    {/* Subtotal */}
                    <div className="text-right min-w-[50px]">
                      <span className="text-xs font-bold text-emerald-400">
                        ₹{(item.price ?? 0) * (item.packsCount || 1)}
                      </span>
                      <div className="text-[9px] text-slate-400">
                        {item.packsCount || 1} {(item.packsCount || 1) === 1 ? 'pack' : 'packs'}
                      </div>
                    </div>

                    {/* Remove Item button */}
                    {!isConfirmed && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Remove Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Pack Size Selector if multiple pack sizes or edit mode active */}
                {(isEditingPacks || hasMultiplePacks) && hasMultiplePacks && (
                  <div className="pt-1.5 border-t border-white/5 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-medium">Pack size:</span>
                    {item.availablePackSizes?.map((ps) => {
                      const isChosen = item.selectedPackSize?.toLowerCase() === ps.size.toLowerCase();
                      return (
                        <button
                          key={ps.size}
                          type="button"
                          disabled={isConfirmed}
                          onClick={() => handleSelectPackSize(item.id, ps.size, ps.price)}
                          className={`px-2 py-0.5 rounded text-[10.5px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                            isChosen
                              ? 'bg-emerald-600 text-white ring-1 ring-emerald-400 shadow-xs'
                              : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                          }`}
                        >
                          <span>{ps.size}</span>
                          <span className="opacity-80 font-normal">₹{ps.price}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-white/5 text-center text-xs text-slate-400">
          No items remaining in this list.
        </div>
      )}

      {/* Unavailable Items Section */}
      {unavailableItems.length > 0 && (
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-amber-300">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Currently Unavailable in Store ({unavailableItems.length}):</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-200/90 pl-1">
            {unavailableItems.map((u) => (
              <li key={u.id}>
                <span className="font-medium text-amber-100">{u.itemName}</span>
                {u.rawText && u.rawText !== u.itemName && (
                  <span className="text-amber-300/70 text-[10px]"> (from &quot;{u.rawText}&quot;)</span>
                )}
                {' — not in current inventory'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Unclear Handwriting Section */}
      {unclearItems.length > 0 && (
        <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
            <HelpCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Unclear Items Requiring Clarification ({unclearItems.length}):</span>
          </div>
          <p className="text-[10.5px] text-indigo-200/80">
            The following handwriting could not be confidently identified. Please type the product name or search manually:
          </p>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {unclearItems.map((u) => (
              <span
                key={u.id}
                className="px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/40 text-[10.5px] font-mono text-indigo-100"
              >
                &quot;{u.rawText}&quot;
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer: Subtotal and Confirm Button */}
      <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3">
        <div>
          <span className="text-[10.5px] text-slate-400">Total Estimated:</span>
          <div className="text-sm font-extrabold text-white flex items-baseline gap-1">
            <span className="text-emerald-400">₹{totalSubtotal}</span>
            <span className="text-[10px] text-slate-400 font-normal">
              ({matchedItems.length} {matchedItems.length === 1 ? 'item' : 'items'}, {totalPacks} {totalPacks === 1 ? 'pack' : 'packs'})
            </span>
          </div>
        </div>

        {isConfirmed ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Added to Cart</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || matchedItems.length === 0}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 transition-all active:scale-95 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                <span>Adding to Cart...</span>
              </>
            ) : (
              <>
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Confirm and Add All to Cart</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export const AssistantChatModal: React.FC<AssistantChatModalProps> = ({
  isOpen,
  onClose,
  customerToken,
  customerName,
  onAddToCart,
  onUpdateCartQty,
  onRemoveCartItem,
  onClearCart,
  onNavigateToCart,
  onSyncCartFromBackend,
  sessionMessages,
  setSessionMessages,
}) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Voice States
  const [isLiveVoiceMode, setIsLiveVoiceMode] = useState(false);
  const [liveVoiceState, setLiveVoiceState] = useState<'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING'>('IDLE');
  const [isMuted, setIsMuted] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceResponseEnabled, setVoiceResponseEnabled] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState('en-IN');
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<any>(null);

  // Speech Recognition Dictation State (for Microphone button in bottom bar)
  const [isListening, setIsListening] = useState(false);

  // Camera & Image Attachment
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setVoiceError('Please select a valid image file (JPG, PNG, WebP).');
        return;
      }
      setSelectedImageName(file.name || 'Photo');
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const rawResult = uploadEvent.target?.result as string;
        // Scale down oversized images via canvas to ensure fast network transfer and high vision accuracy
        const img = new Image();
        img.onload = () => {
          const maxDim = 1600;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
            try {
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                const compressed = canvas.toDataURL(file.type || 'image/jpeg', 0.85);
                setSelectedImage(compressed);
                return;
              }
            } catch {
              // fallback to rawResult
            }
          }
          setSelectedImage(rawResult);
        };
        img.onerror = () => {
          setSelectedImage(rawResult);
        };
        img.src = rawResult;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearImage = () => {
    setSelectedImage(null);
    setSelectedImageName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Toggle Microphone Speech-to-Text Dictation
  const handleToggleMic = () => {
    if (isListening) {
      voiceManagerRef.current?.stop();
      setIsListening(false);
      return;
    }

    if (!voiceManagerRef.current?.isSupported) {
      setVoiceError(
        'Speech recognition is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Safari.'
      );
      return;
    }

    setVoiceError(null);
    setIsListening(true);

    voiceManagerRef.current.start(
      (transcript, isFinal) => {
        // Display recognized speech in the search input field
        setInputText(transcript);
        if (isFinal) {
          setIsListening(false);
        }
      },
      () => {
        setIsListening(true);
        setVoiceError(null);
      },
      () => {
        setIsListening(false);
      },
      (errorMsg) => {
        setIsListening(false);
        setVoiceError(errorMsg);
      },
      false
    );
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const voiceManagerRef = useRef<VoiceRecognitionManager | null>(null);
  const isLiveVoiceModeRef = useRef(false);
  const isMutedRef = useRef(false);

  // Keep refs in sync with state for callbacks
  useEffect(() => {
    isLiveVoiceModeRef.current = isLiveVoiceMode;
  }, [isLiveVoiceMode]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Initialize Speech Recognition Manager
  useEffect(() => {
    if (typeof window !== 'undefined') {
      voiceManagerRef.current = new VoiceRecognitionManager();
    }
    return () => {
      stopAssistantSpeaking();
      voiceManagerRef.current?.stop();
    };
  }, []);

  // Update recognition language whenever language changes
  useEffect(() => {
    voiceManagerRef.current?.setLanguage(selectedLanguage);
  }, [selectedLanguage]);

  // Initial welcome message for current session if empty
  useEffect(() => {
    if (sessionMessages.length === 0) {
      const welcomeName = customerName ? `, ${customerName}` : '';
      setSessionMessages([
        {
          id: 'welcome-msg',
          sender: 'assistant',
          text: `Hello${welcomeName}! Welcome to FreshCart. I am your Gemini Live Voice & Shopping Assistant. You can speak naturally or type:
• "Add 2 kg tomatoes to my cart"
• "Show fresh vegetables"
• "Prepare a grocery list under ₹500"
• "Show my cart and calculate total"
• "Apply coupon SAVE10"`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          quickReplies: QUICK_ACTIONS,
        },
      ]);
    }
  }, [customerName, sessionMessages.length, setSessionMessages]);

  // Auto-scroll chat area
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sessionMessages, isLoading, isOpen, isMinimized, interimTranscript]);

  // Cleanup on close or minimize
  useEffect(() => {
    if (!isOpen) {
      handleStopLiveVoice();
      stopAssistantSpeaking();
    }
  }, [isOpen]);

  // Stop Live Voice Mode cleanly
  const handleStopLiveVoice = useCallback(() => {
    setIsLiveVoiceMode(false);
    setIsListening(false);
    setLiveVoiceState('IDLE');
    setInterimTranscript('');
    voiceManagerRef.current?.stop();
    stopAssistantSpeaking();
  }, []);

  // Starts continuous listening in the live turn-taking loop
  const startContinuousListening = useCallback(() => {
    if (!voiceManagerRef.current?.isSupported) {
      setVoiceError(
        'Speech recognition is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Safari.'
      );
      setIsLiveVoiceMode(false);
      setLiveVoiceState('IDLE');
      return;
    }

    if (isMutedRef.current) {
      setLiveVoiceState('IDLE');
      return;
    }

    setVoiceError(null);
    setLiveVoiceState('LISTENING');

    voiceManagerRef.current.start(
      (transcript, isFinal) => {
        if (!isLiveVoiceModeRef.current || isMutedRef.current) return;

        setInterimTranscript(transcript);

        if (isFinal && transcript.trim().length > 0) {
          setInterimTranscript('');
          // Trigger conversational turn
          handleSendVoiceUtterance(transcript.trim());
        }
      },
      () => {
        setLiveVoiceState('LISTENING');
        setVoiceError(null);
      },
      () => {
        // If live mode is still active and we're not speaking/thinking, keep state aligned
        if (isLiveVoiceModeRef.current && liveVoiceState === 'LISTENING' && !isMutedRef.current) {
          // Continuous loop managed by manager's safeRestart
        }
      },
      (errorMsg) => {
        if (!isLiveVoiceModeRef.current) return;
        setVoiceError(errorMsg);
        if (errorMsg.includes('denied')) {
          setIsLiveVoiceMode(false);
          setLiveVoiceState('IDLE');
        }
      },
      true // continuous mode
    );
  }, [liveVoiceState]);

  // Toggle Live Voice Mode ON / OFF
  const handleToggleLiveVoiceMode = () => {
    setVoiceError(null);

    if (isLiveVoiceMode) {
      handleStopLiveVoice();
      return;
    }

    if (!voiceManagerRef.current?.isSupported) {
      setVoiceError(
        'Speech recognition is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Safari.'
      );
      return;
    }

    setIsLiveVoiceMode(true);
    setIsMuted(false);
    isMutedRef.current = false;
    isLiveVoiceModeRef.current = true;
    startContinuousListening();
  };

  // Toggle Mute during Live Conversation
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    isMutedRef.current = nextMuted;

    if (nextMuted) {
      voiceManagerRef.current?.stop();
      setLiveVoiceState('IDLE');
      setInterimTranscript('');
    } else {
      if (isLiveVoiceMode) {
        startContinuousListening();
      }
    }
  };

  // Process voice utterance in real-time
  const handleSendVoiceUtterance = async (transcript: string) => {
    if (!transcript.trim()) return;

    // Temporarily halt listening while processing & speaking
    voiceManagerRef.current?.stop();
    setLiveVoiceState('THINKING');

    // Append customer message
    const customerMsg: AssistantMessage = {
      id: `cust-${Date.now()}`,
      sender: 'customer',
      text: transcript,
      language: selectedLanguage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setSessionMessages((prev) => [...prev, customerMsg]);

    try {
      const response = await sendAssistantMessage(
        transcript,
        customerToken,
        pendingAction,
        selectedLanguage
      );

      // Reset pending action
      setPendingAction(response.requiresConfirmation ? response.pendingAction : null);

      // Synchronize cart state if cart was updated on backend
      if (response.cartUpdated && Array.isArray(response.cartItems) && onSyncCartFromBackend) {
        onSyncCartFromBackend(response.cartItems);
      } else if (response.intent === 'CLEAR_CART' && response.actionExecuted) {
        onClearCart();
      }

      // Convert products to AssistantProductCard
      const products: AssistantProductCard[] | undefined = Array.isArray(response.products)
        ? response.products.map((p: any) => ({
            id: p.id || p.product_id,
            title: p.title || p.name,
            price: Number(p.price),
            unit: p.unit || '1 unit',
            stock: Number(p.stock ?? p.quantity ?? 0),
            image: p.image,
            category: p.category,
            badge: p.badge,
            isOrganic: Boolean(p.isOrganic),
            packSizes: Array.isArray(p.packSizes) ? p.packSizes : undefined,
          }))
        : undefined;

      // Convert coupons
      const coupons: AssistantCouponCard[] | undefined = Array.isArray(response.coupons)
        ? response.coupons.map((c: any) => ({
            id: String(c.id),
            code: c.code || c.coupon_code,
            discountPercentage: Number(c.discountPercentage || c.discount_percentage),
            minOrderAmount: Number(c.minOrderAmount || c.minimum_order_amount),
            description: c.description,
          }))
        : undefined;

      const assistantMsg: AssistantMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: response.message || 'I have processed your request.',
        spokenMessage: response.spokenMessage || response.message,
        language: response.language || selectedLanguage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        products,
        coupons,
        quickReplies:
          response.quickReplies ||
          (products && products.length > 0 ? ['View Cart', 'Show Vegetables'] : undefined),
        requiresConfirmation: response.requiresConfirmation,
        pendingAction: response.pendingAction,
        cartSummary: response.cartSummary,
        groceryListReview: response.groceryListReview,
      };

      setSessionMessages((prev) => [...prev, assistantMsg]);

      // Speak response aloud
      const textToSpeak = response.spokenMessage || response.message;
      const speechLang = response.language || selectedLanguage;

      if (textToSpeak) {
        setLiveVoiceState('SPEAKING');
        setSpeakingMessageId(assistantMsg.id);

        speakAssistantResponse(
          textToSpeak,
          speechLang,
          () => {
            // Once speaking finishes, resume listening automatically if Live Voice Mode is active!
            setSpeakingMessageId(null);
            if (isLiveVoiceModeRef.current && !isMutedRef.current) {
              setLiveVoiceState('LISTENING');
              setTimeout(() => {
                if (isLiveVoiceModeRef.current && !isMutedRef.current) {
                  startContinuousListening();
                }
              }, 400);
            } else {
              setLiveVoiceState('IDLE');
            }
          },
          () => {
            setLiveVoiceState('SPEAKING');
          }
        );
      } else {
        if (isLiveVoiceModeRef.current && !isMutedRef.current) {
          startContinuousListening();
        } else {
          setLiveVoiceState('IDLE');
        }
      }
    } catch {
      const errorMsg: AssistantMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: 'Sorry, I encountered an issue processing your request. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setSessionMessages((prev) => [...prev, errorMsg]);

      if (isLiveVoiceModeRef.current && !isMutedRef.current) {
        startContinuousListening();
      } else {
        setLiveVoiceState('IDLE');
      }
    }
  };

  // Typed Chat and Image Send Handler
  const handleSendMessage = async (
    textToSend?: string,
    extraPayload?: {
      productId?: string;
      quantity?: number;
      packSize?: string;
      price?: number;
      image?: string;
    }
  ) => {
    const text = (textToSend || inputText).trim();
    const imageToAttach = selectedImage;

    // Prevent empty submissions (must have either text or image)
    if ((!text && !imageToAttach) || isLoading) return;

    // If microphone is actively listening, stop it
    if (isListening) {
      voiceManagerRef.current?.stop();
      setIsListening(false);
    }

    // Create user message displaying attached photo and any query text
    const customerMsg: AssistantMessage = {
      id: `cust-${Date.now()}`,
      sender: 'customer',
      text: text || (selectedImageName ? `Photo: ${selectedImageName}` : 'Product photo attached'),
      image: imageToAttach || undefined,
      language: selectedLanguage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setSessionMessages((prev) => [...prev, customerMsg]);
    setInputText('');
    handleClearImage();
    setIsLoading(true);
    setVoiceError(null);

    try {
      const response = await sendAssistantMessage(
        text,
        customerToken,
        pendingAction,
        selectedLanguage,
        {
          ...extraPayload,
          image: imageToAttach || undefined,
        }
      );

      // Reset pending action
      setPendingAction(response.requiresConfirmation ? response.pendingAction : null);

      if (!response.success && response.error) {
        const errorMsg: AssistantMessage = {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: response.message || 'Image analysis could not be completed. Please try again.',
          spokenMessage: response.spokenMessage || response.message,
          language: response.language || selectedLanguage,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          quickReplies: response.quickReplies || ['Show All Products', 'View Cart'],
        };
        setSessionMessages((prev) => [...prev, errorMsg]);
        return;
      }

      if (response.cartUpdated && Array.isArray(response.cartItems) && onSyncCartFromBackend) {
        onSyncCartFromBackend(response.cartItems);
      } else if (response.intent === 'CLEAR_CART' && response.actionExecuted) {
        onClearCart();
      }

      const products: AssistantProductCard[] | undefined = Array.isArray(response.products)
        ? response.products.map((p: any) => ({
            id: p.id || p.product_id,
            title: p.title || p.name,
            price: Number(p.price),
            unit: p.unit || '1 unit',
            stock: Number(p.stock ?? p.quantity ?? 0),
            image: p.image,
            category: p.category,
            badge: p.badge,
            isOrganic: Boolean(p.isOrganic),
            packSizes: Array.isArray(p.packSizes) ? p.packSizes : undefined,
          }))
        : undefined;

      const coupons: AssistantCouponCard[] | undefined = Array.isArray(response.coupons)
        ? response.coupons.map((c: any) => ({
            id: String(c.id),
            code: c.code || c.coupon_code,
            discountPercentage: Number(c.discountPercentage || c.discount_percentage),
            minOrderAmount: Number(c.minOrderAmount || c.minimum_order_amount),
            description: c.description,
          }))
        : undefined;

      const assistantMsg: AssistantMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: response.message || 'I have processed your request.',
        spokenMessage: response.spokenMessage || response.message,
        language: response.language || selectedLanguage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        products,
        coupons,
        quickReplies:
          response.quickReplies ||
          (products && products.length > 0 ? ['View Cart', 'Show Vegetables'] : undefined),
        requiresConfirmation: response.requiresConfirmation,
        pendingAction: response.pendingAction,
        cartSummary: response.cartSummary,
        groceryListReview: response.groceryListReview,
      };

      setSessionMessages((prev) => [...prev, assistantMsg]);

      // Speak response if voice responses are enabled or in live voice mode
      if ((voiceResponseEnabled || isLiveVoiceMode) && (response.spokenMessage || response.message)) {
        setSpeakingMessageId(assistantMsg.id);
        speakAssistantResponse(
          response.spokenMessage || response.message,
          response.language || selectedLanguage,
          () => {
            setSpeakingMessageId(null);
            if (isLiveVoiceModeRef.current && !isMutedRef.current) {
              startContinuousListening();
            }
          }
        );
      }
    } catch {
      const errorMsg: AssistantMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: 'Sorry, I encountered an issue processing your request. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setSessionMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Speak a specific message item on demand
  const handleSpeakMessage = (msgId: string, text: string, lang?: string) => {
    if (speakingMessageId === msgId) {
      stopAssistantSpeaking();
      setSpeakingMessageId(null);
      return;
    }
    setSpeakingMessageId(msgId);
    speakAssistantResponse(text, lang || selectedLanguage, () => {
      setSpeakingMessageId(null);
    });
  };

  // Add Product to Cart with explicit quantity, pack size, and price from selector
  const handleProductCardConfirmAdd = (
    p: AssistantProductCard,
    quantity: number,
    packSize: string,
    price: number
  ) => {
    const fullProduct: Product = {
      id: p.id,
      title: p.title,
      price: price,
      unit: packSize,
      stock: p.stock,
      image: p.image || '',
      category: p.category || 'produce',
      categoryLabel: p.category || 'Fruits & Veggies',
      supplier: 'FreshCart Harvest',
      sku: `SKU-${p.id}`,
      badge: p.badge || '',
      isOrganic: p.isOrganic,
      packSizes: p.packSizes,
    };

    onAddToCart(fullProduct, quantity, packSize, price);
    handleSendMessage(`Add ${quantity} ${packSize} ${p.title} to my cart`, {
      productId: p.id,
      quantity,
      packSize,
      price,
    });
  };

  // Confirm and Add All to Cart from Grocery List Review
  const handleConfirmGroceryList = async (
    items: RecognizedGroceryItem[],
    listId: string
  ) => {
    if (isLoading) return;
    const validItems = items.filter((it) => it.status === 'matched' && it.productId);
    if (validItems.length === 0) return;

    setIsLoading(true);
    setVoiceError(null);

    const customerMsg: AssistantMessage = {
      id: `cust-${Date.now()}`,
      sender: 'customer',
      text: `Confirm and Add All to Cart (${validItems.length} ${validItems.length === 1 ? 'item' : 'items'})`,
      language: selectedLanguage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setSessionMessages((prev) => [...prev, customerMsg]);

    try {
      const response = await sendAssistantMessage(
        `Confirm and Add All to Cart (${validItems.length} items)`,
        customerToken,
        {
          intent: 'CONFIRM_GROCERY_LIST',
          listId,
          items: validItems,
        },
        selectedLanguage
      );

      setPendingAction(null);

      // Sync backend cart items if available
      if (response.cartUpdated && Array.isArray(response.cartItems) && onSyncCartFromBackend) {
        onSyncCartFromBackend(response.cartItems);
      }

      // Ensure client cart state is synchronized via onAddToCart
      for (const it of validItems) {
        if (it.productId) {
          const fullProduct: Product = {
            id: it.productId,
            title: it.productTitle || it.itemName,
            price: it.price || 0,
            unit: it.selectedPackSize || '1 unit',
            stock: 99,
            image: it.productImage || '',
            category: it.category || 'produce',
            categoryLabel: it.category || 'Grocery',
            supplier: 'FreshCart Harvest',
            sku: `SKU-${it.productId}`,
            badge: '',
            isOrganic: false,
            packSizes: it.availablePackSizes,
          };
          onAddToCart(fullProduct, it.packsCount || 1, it.selectedPackSize, it.price);
        }
      }

      // Mark the review in sessionMessages as confirmed
      setSessionMessages((prev) =>
        prev.map((m) => {
          if (m.groceryListReview && m.groceryListReview.listId === listId) {
            return {
              ...m,
              groceryListReview: {
                ...m.groceryListReview,
                confirmed: true,
              },
            };
          }
          return m;
        })
      );

      const assistantMsg: AssistantMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: response.message || `Successfully added ${validItems.length} items from your grocery list to your cart!`,
        spokenMessage: response.spokenMessage || response.message,
        language: response.language || selectedLanguage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: ['View Cart', 'Show All Products'],
        cartSummary: response.cartSummary,
      };

      setSessionMessages((prev) => [...prev, assistantMsg]);

      if ((voiceResponseEnabled || isLiveVoiceMode) && (response.spokenMessage || response.message)) {
        setSpeakingMessageId(assistantMsg.id);
        speakAssistantResponse(
          response.spokenMessage || response.message,
          response.language || selectedLanguage,
          () => {
            setSpeakingMessageId(null);
          }
        );
      }
    } catch (err: any) {
      console.error('Failed to confirm grocery list:', err);
      const errorMsg: AssistantMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: 'Failed to add items to cart. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setSessionMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed z-50 transition-all duration-300 ease-out shadow-2xl flex flex-col ${
        isMinimized
          ? 'bottom-6 right-6 w-84 h-16 rounded-2xl bg-[#0b1420]/95 border border-emerald-500/40 backdrop-blur-xl'
          : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-[480px] h-[85vh] sm:h-[700px] max-h-[92vh] rounded-3xl bg-[#070d14]/95 border border-white/15 backdrop-blur-2xl overflow-hidden'
      }`}
      style={{
        boxShadow: isLiveVoiceMode
          ? '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 40px rgba(16, 185, 129, 0.35)'
          : '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 35px rgba(0, 107, 44, 0.25)',
      }}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.03] backdrop-blur-md select-none">
        <div className="flex items-center gap-3">
          {/* Avatar with live status indicator */}
          <div className="relative">
            <img
              src="/assets/ai-avatar.jpg"
              alt="FreshCart AI Assistant"
              className={`w-10 h-10 rounded-full object-cover ring-2 shadow-lg transition-all ${
                isLiveVoiceMode
                  ? 'ring-emerald-400 shadow-emerald-500/40'
                  : 'ring-emerald-500/60 shadow-emerald-500/20'
              }`}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            {/* Live pulsing dot */}
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-[#070d14] rounded-full shadow-xs ${
                isLiveVoiceMode ? 'bg-cyan-400' : 'bg-emerald-400'
              }`}
            >
              <span
                className={`absolute inset-0 rounded-full animate-ping opacity-75 ${
                  isLiveVoiceMode ? 'bg-cyan-400' : 'bg-emerald-400'
                }`}
              />
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-bold text-white tracking-wide flex items-center gap-1.5">
                FreshCart AI Assistant
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              </h3>
            </div>
            <p className="text-[11px] text-emerald-300/80 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Gemini Live Voice Partner
            </p>
          </div>
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-1.5 text-slate-300">
          {/* Language Selector */}
          <div className="relative group">
            <button
              type="button"
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-xs font-semibold text-emerald-300 flex items-center gap-1 cursor-pointer"
              title="Select Conversation Language"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{LANGUAGE_OPTIONS.find((l) => l.code === selectedLanguage)?.short}</span>
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:flex flex-col bg-[#0b1726] border border-white/15 rounded-xl shadow-xl overflow-hidden py-1 z-30 min-w-32">
              {LANGUAGE_OPTIONS.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setSelectedLanguage(lang.code)}
                  className={`px-3 py-1.5 text-left text-xs transition-colors hover:bg-emerald-500/20 cursor-pointer ${
                    selectedLanguage === lang.code ? 'text-emerald-300 font-bold' : 'text-slate-300'
                  }`}
                >
                  {lang.label} ({lang.short})
                </button>
              ))}
            </div>
          </div>

          {/* Voice Audio Toggle */}
          <button
            type="button"
            onClick={() => {
              if (voiceResponseEnabled) {
                stopAssistantSpeaking();
              }
              setVoiceResponseEnabled(!voiceResponseEnabled);
            }}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              voiceResponseEnabled
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'hover:bg-white/10 text-slate-400'
            }`}
            title={voiceResponseEnabled ? 'Voice Responses Enabled' : 'Voice Responses Muted'}
          >
            {voiceResponseEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Minimize / Maximize */}
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-red-500/20 hover:text-red-400 text-slate-300 transition-colors cursor-pointer"
            title="Close Assistant"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Chat Body (hidden if minimized) */}
      {!isMinimized && (
        <>
          {/* Active Live Voice Mode Ribbon Banner */}
          {isLiveVoiceMode && (
            <div className="px-4 py-3 bg-gradient-to-r from-emerald-950/70 via-[#06241a]/80 to-teal-950/70 border-b border-emerald-500/30 flex items-center justify-between gap-3 text-xs shadow-inner">
              <div className="flex items-center gap-3">
                {/* Dynamic Sound Wave Bars */}
                <div className="flex items-center gap-0.5 h-6 px-1">
                  <span
                    className={`w-1 rounded-full bg-emerald-400 transition-all ${
                      liveVoiceState === 'LISTENING' || liveVoiceState === 'SPEAKING'
                        ? 'animate-bounce h-5 [animation-delay:-0.4s]'
                        : 'h-1.5 opacity-40'
                    }`}
                  />
                  <span
                    className={`w-1 rounded-full bg-teal-400 transition-all ${
                      liveVoiceState === 'LISTENING' || liveVoiceState === 'SPEAKING'
                        ? 'animate-bounce h-6 [animation-delay:-0.2s]'
                        : 'h-2 opacity-50'
                    }`}
                  />
                  <span
                    className={`w-1 rounded-full bg-cyan-400 transition-all ${
                      liveVoiceState === 'LISTENING' || liveVoiceState === 'SPEAKING'
                        ? 'animate-bounce h-4 [animation-delay:0s]'
                        : 'h-1.5 opacity-40'
                    }`}
                  />
                  <span
                    className={`w-1 rounded-full bg-emerald-300 transition-all ${
                      liveVoiceState === 'LISTENING' || liveVoiceState === 'SPEAKING'
                        ? 'animate-bounce h-5 [animation-delay:0.2s]'
                        : 'h-2 opacity-50'
                    }`}
                  />
                  <span
                    className={`w-1 rounded-full bg-teal-300 transition-all ${
                      liveVoiceState === 'LISTENING' || liveVoiceState === 'SPEAKING'
                        ? 'animate-bounce h-4 [animation-delay:0.4s]'
                        : 'h-1.5 opacity-40'
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center gap-1.5 font-bold">
                    {liveVoiceState === 'LISTENING' && (
                      <span className="text-emerald-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        Listening continuously... Speak now
                      </span>
                    )}
                    {liveVoiceState === 'THINKING' && (
                      <span className="text-amber-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        Thinking with Gemini Live...
                      </span>
                    )}
                    {liveVoiceState === 'SPEAKING' && (
                      <span className="text-purple-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                        FreshCart speaking response...
                      </span>
                    )}
                    {liveVoiceState === 'IDLE' && (
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-500" />
                        {isMuted ? 'Microphone Muted' : 'Standby'}
                      </span>
                    )}
                  </div>
                  <p className="text-[10.5px] text-emerald-200/60 font-medium">
                    Language: {LANGUAGE_OPTIONS.find((l) => l.code === selectedLanguage)?.label} • Hands-free continuous dialogue
                  </p>
                </div>
              </div>

              {/* Dedicated Stop & Mute Controls */}
              <div className="flex items-center gap-1.5">
                {/* Mute Mic */}
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isMuted
                      ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                      : 'bg-white/10 hover:bg-white/20 text-slate-200'
                  }`}
                  title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                >
                  {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>

                {/* Stop Voice Conversation */}
                <button
                  type="button"
                  id="ai-assistant-stop-live-voice-btn"
                  onClick={handleStopLiveVoice}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/25 hover:bg-rose-500/40 text-rose-300 border border-rose-500/40 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                  title="Stop Live Voice Conversation"
                >
                  <Square className="w-3 h-3 fill-rose-300" />
                  <span>Stop</span>
                </button>
              </div>
            </div>
          )}

          {/* Live Interim Transcript Bubble */}
          {isLiveVoiceMode && interimTranscript && (
            <div className="px-4 py-2 bg-emerald-500/15 border-b border-emerald-500/25 flex items-center gap-2 text-xs text-emerald-200 animate-fadeIn">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span className="italic">"{interimTranscript}"</span>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {sessionMessages.map((msg) => {
              const isCust = msg.sender === 'customer';
              const isSpeaking = speakingMessageId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isCust ? 'items-end' : 'items-start'} transition-all`}
                >
                  <div className="flex items-end gap-2 max-w-[92%] sm:max-w-[85%]">
                    {!isCust && (
                      <img
                        src="/assets/ai-avatar.jpg"
                        alt="AI"
                        className="w-7 h-7 rounded-full object-cover ring-1 ring-emerald-500/40 mb-1 shrink-0"
                      />
                    )}

                    <div
                      className={`relative px-4 py-3 rounded-2xl text-[13.5px] leading-relaxed transition-all shadow-md ${
                        isCust
                          ? 'bg-emerald-700/90 text-white rounded-br-xs border border-emerald-500/30'
                          : 'bg-[#0f1b2b]/95 text-slate-100 rounded-bl-xs border border-white/10 shadow-emerald-950/30'
                      }`}
                    >
                      {/* Attached Customer Image */}
                      {msg.image && (
                        <div className="mb-2 rounded-xl overflow-hidden max-w-[200px] border border-white/20 bg-black/30">
                          <img src={msg.image} alt="Attached" className="w-full h-auto object-cover max-h-48" />
                        </div>
                      )}

                      {/* Message Content */}
                      <div className="whitespace-pre-line break-words">{msg.text}</div>

                      {/* Grocery List Review Card */}
                      {msg.groceryListReview && (
                        <div className="mt-3 pt-2.5 border-t border-white/10">
                          <GroceryListReviewCard
                            review={msg.groceryListReview}
                            onConfirmAll={handleConfirmGroceryList}
                            isSubmitting={isLoading}
                          />
                        </div>
                      )}

                      {/* Attached Product Cards */}
                      {!msg.groceryListReview && msg.products && msg.products.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-white/10">
                          {/* Total Product Count Header */}
                          <div className="flex items-center justify-between text-xs text-slate-300 font-semibold px-1 pb-2">
                            <span className="flex items-center gap-1.5 text-emerald-400">
                              <ShoppingCart className="w-3.5 h-3.5" />
                              <span>
                                {msg.products.length} {msg.products.length === 1 ? 'Product Available' : 'Products in Catalogue'}
                              </span>
                            </span>
                            {msg.products.length > 3 && (
                              <span className="text-[10.5px] text-slate-400 font-normal">
                                Scroll down to browse all
                              </span>
                            )}
                          </div>

                          {/* Vertically scrollable catalogue list displaying all products */}
                          <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {msg.products.map((p) => (
                              <AssistantProductCardItem
                                key={p.id}
                                product={p}
                                onConfirmAdd={handleProductCardConfirmAdd}
                                initiallySelecting={msg.products?.length === 1 && msg.requiresConfirmation !== true}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Attached Coupon Cards */}
                      {msg.coupons && msg.coupons.length > 0 && (
                        <div className="mt-3 space-y-2 pt-2 border-t border-white/10">
                          {msg.coupons.map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25"
                            >
                              <div className="flex items-center gap-2">
                                <Tag className="w-4 h-4 text-emerald-400 shrink-0" />
                                <div>
                                  <span className="font-mono text-xs font-bold text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                                    {c.code}
                                  </span>
                                  <p className="text-[10px] text-slate-300 mt-0.5">
                                    {c.discountPercentage}% OFF on orders ₹{c.minOrderAmount}+
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleSendMessage(`Apply coupon ${c.code}`)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold cursor-pointer transition-colors"
                              >
                                Apply
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Confirmation Action Buttons (e.g. Clear Cart Confirm) */}
                      {msg.requiresConfirmation && (
                        <div className="mt-3 pt-2 border-t border-white/10 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSendMessage('yes confirm clear')}
                            className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Confirm</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendMessage('no cancel')}
                            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-medium cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {/* Footer: Timestamp & Read Aloud Speaker */}
                      <div className="flex items-center justify-end gap-2 mt-1.5 text-[10px] text-slate-400 select-none">
                        <span>{msg.timestamp}</span>
                        {!isCust && (
                          <button
                            type="button"
                            onClick={() =>
                              handleSpeakMessage(
                                msg.id,
                                msg.spokenMessage || msg.text,
                                msg.language
                              )
                            }
                            className={`p-0.5 rounded transition-colors cursor-pointer ${
                              isSpeaking
                                ? 'text-emerald-400 bg-emerald-500/20'
                                : 'hover:text-slate-200'
                            }`}
                            title={isSpeaking ? 'Stop speaking' : 'Read aloud'}
                          >
                            <Volume2
                              className={`w-3.5 h-3.5 ${isSpeaking ? 'animate-pulse' : ''}`}
                            />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Chips attached to message */}
                  {msg.quickReplies && msg.quickReplies.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 ml-9">
                      {msg.quickReplies.map((qr, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (qr === 'View Cart') {
                              onNavigateToCart();
                            } else {
                              handleSendMessage(qr);
                            }
                          }}
                          className="px-3 py-1 rounded-full text-[11px] font-medium bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/60 transition-all cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                        >
                          {qr}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Typing / Loading indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 text-slate-300 text-xs">
                <img
                  src="/assets/ai-avatar.jpg"
                  alt="AI"
                  className="w-6 h-6 rounded-full ring-1 ring-emerald-500/40 object-cover"
                />
                <div className="flex items-center gap-1.5 bg-[#111e2f] px-3.5 py-2.5 rounded-2xl rounded-bl-xs border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]" />
                  <span className="text-[11px] text-emerald-300/80 font-medium ml-1">
                    FreshCart Assistant thinking...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Voice Error Banner */}
          {voiceError && (
            <div className="px-4 py-2 bg-red-500/20 border-t border-red-500/30 text-red-300 text-[11.5px] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{voiceError}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleToggleLiveVoiceMode}
                  className="text-red-300 hover:text-white underline text-[11px] font-semibold cursor-pointer"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceError(null)}
                  className="text-red-300 hover:text-white p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Quick Action Chips Bar */}
          <div className="px-3 py-2 border-t border-white/10 bg-white/[0.02] flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {QUICK_ACTIONS.map((action, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (action === 'View Cart') {
                    onNavigateToCart();
                  } else {
                    handleSendMessage(action);
                  }
                }}
                className="px-2.5 py-1 rounded-xl text-[11px] font-medium text-slate-300 bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/40 whitespace-nowrap transition-all cursor-pointer"
              >
                {action}
              </button>
            ))}
          </div>

          {/* Selected Image Preview (Above Input Bar) */}
          {selectedImage && (
            <div className="px-3 pt-2.5 pb-2 bg-[#08111c] border-t border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative w-11 h-11 rounded-lg overflow-hidden border border-emerald-500/40 bg-black/40 shrink-0">
                  <img src={selectedImage} alt="Selected preview" className="w-full h-full object-cover" />
                </div>
                <div className="text-xs">
                  <p className="text-emerald-300 font-medium truncate max-w-[180px] sm:max-w-[260px]">
                    {selectedImageName || 'Selected image'}
                  </p>
                  <p className="text-[10px] text-slate-400">Click camera to replace or submit</p>
                </div>
              </div>
              <button
                type="button"
                id="ai-assistant-clear-img-btn"
                onClick={handleClearImage}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                title="Remove Image"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Chat Input Controls */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 border-t border-white/10 bg-[#08111c] flex items-center gap-2"
          >
            {/* 1. Voice button (Microphone) - Far Left */}
            <button
              type="button"
              id="ai-assistant-mic-btn"
              onClick={handleToggleMic}
              className={`w-10 h-10 rounded-xl transition-all cursor-pointer relative shrink-0 flex items-center justify-center ${
                isListening
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/40 ring-2 ring-rose-400'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30'
              }`}
              title={isListening ? 'Stop Voice Input' : 'Start Voice Input'}
            >
              {isListening ? (
                <MicOff className="w-4 h-4 animate-pulse" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>

            {/* 2. Search input - Between microphone and camera */}
            <input
              type="text"
              id="ai-assistant-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Search products or type e.g. 'Add 2 kg tomatoes'..."
              disabled={isLoading}
              className="flex-1 min-w-0 h-10 px-3.5 bg-white/[0.05] border border-white/15 focus:border-emerald-500/60 rounded-xl text-white placeholder-slate-400 text-[13px] outline-none transition-all"
            />

            {/* Hidden file input for Camera button */}
            <input
              type="file"
              ref={fileInputRef}
              id="ai-assistant-camera-input"
              accept="image/*"
              capture="environment"
              onChange={handleImageChange}
              className="hidden"
            />

            {/* 3. Camera button - Immediately before submit button */}
            <button
              type="button"
              id="ai-assistant-camera-btn"
              onClick={handleCameraClick}
              disabled={isLoading}
              className={`w-10 h-10 rounded-xl transition-all cursor-pointer shrink-0 flex items-center justify-center ${
                selectedImage
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 border border-emerald-400'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30'
              }`}
              title={selectedImage ? 'Replace Image' : 'Capture or Select Image'}
            >
              <Camera className="w-4 h-4" />
            </button>

            {/* 4. Submit button (Send icon) - Far Right */}
            <button
              type="submit"
              id="ai-assistant-send-btn"
              disabled={isLoading || (!inputText.trim() && !selectedImage)}
              className="w-10 h-10 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-md shadow-emerald-600/30 cursor-pointer shrink-0 flex items-center justify-center"
              title="Submit Request"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </>
      )}
    </div>
  );
};
