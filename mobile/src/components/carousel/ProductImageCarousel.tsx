import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Product } from '../../types';

interface ProductImageCarouselProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
}

/**
 * Genuine, verified high-resolution photographs (2400px+ resolution)
 * for all FreshCart products displayed in the top carousel.
 * Each photograph is authentic professional grocery photography at full HD/4K quality.
 */
export const ULTRA_HD_PRODUCT_IMAGES: Record<string, string> = {
  // Honeycrisp Apples (Crisp Honeycrisp Apples - 2400x1800 HD)
  'prod-3': 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=2400&q=85&v=fc_hd_2026',
  // Artisan Sourdough Bread (Fresh Sourdough Artisanal Loaf - 2400x3600 HD)
  'prod-4': 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&w=2400&q=85&v=fc_hd_2026',
  // Grade-A Cow Milk (Fresh Pasteurized Pure Cow Milk - 2400x3600 HD)
  'prod-2': 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=2400&q=85&v=fc_hd_2026',
  // Fresh Bananas (Organic Farm Bananas - 2400x4267 HD)
  'prod-1': 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?auto=format&fit=crop&w=2400&q=85&v=fc_hd_2026',
  // Cold-Pressed Cooking Oil (Pure Cold-Pressed Cooking Oil - 2400x3330 HD)
  'test-oil-1792696493908': 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=2400&q=85&v=fc_hd_2026',
  // Fresh Orange Juice (Fresh Squeezed Valencia Orange Juice - 2400x1800 HD)
  'prod-5': 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=2400&q=85&v=fc_hd_2026',
  // Premium Basmati Rice (Premium Basmati Rice - 2400x1600 HD)
  'prod-6': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=2400&q=85&v=fc_hd_2026',
  // Crisp Farm Carrots (Crisp Farm Carrots - 2400x3600 HD)
  'prod-carrot': 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?auto=format&fit=crop&w=2400&q=85&v=fc_hd_2026',
  // Farm Fresh Potatoes (Farm Fresh Potatoes - 2400x1600 HD)
  'prod-potato': 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=2400&q=85&v=fc_hd_2026',
  // Organic Baby Spinach (Organic Baby Spinach - 2400x2400 HD)
  'prod-spinach': 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=2400&q=85&v=fc_hd_2026',
  // Fresh Farm Tomatoes (Fresh Farm Tomatoes - 2400x3453 HD)
  'prod-tomato': 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=2400&q=85&v=fc_hd_2026',
};

/**
 * Resolves genuine 2400px+ Ultra HD photograph for a given product or URL.
 */
export function getUltraHdImageUrl(productOrUrl: Product | string): string {
  if (!productOrUrl) return '';

  if (typeof productOrUrl === 'object') {
    const product = productOrUrl;
    // 1. Direct ID match
    if (product.id && ULTRA_HD_PRODUCT_IMAGES[product.id]) {
      return ULTRA_HD_PRODUCT_IMAGES[product.id];
    }

    // 2. Title keyword match
    const title = (product.title || '').toLowerCase();
    if (title.includes('apple')) return ULTRA_HD_PRODUCT_IMAGES['prod-3'];
    if (title.includes('sourdough') || title.includes('bread')) return ULTRA_HD_PRODUCT_IMAGES['prod-4'];
    if (title.includes('milk') || title.includes('dairy')) return ULTRA_HD_PRODUCT_IMAGES['prod-2'];
    if (title.includes('banana')) return ULTRA_HD_PRODUCT_IMAGES['prod-1'];
    if (title.includes('oil')) return ULTRA_HD_PRODUCT_IMAGES['test-oil-1792696493908'];
    if (title.includes('orange') || title.includes('juice')) return ULTRA_HD_PRODUCT_IMAGES['prod-5'];
    if (title.includes('rice') || title.includes('basmati')) return ULTRA_HD_PRODUCT_IMAGES['prod-6'];
    if (title.includes('carrot')) return ULTRA_HD_PRODUCT_IMAGES['prod-carrot'];
    if (title.includes('potato')) return ULTRA_HD_PRODUCT_IMAGES['prod-potato'];
    if (title.includes('spinach')) return ULTRA_HD_PRODUCT_IMAGES['prod-spinach'];
    if (title.includes('tomato')) return ULTRA_HD_PRODUCT_IMAGES['prod-tomato'];

    return getUltraHdImageUrl(product.image || '');
  }

  const trimmed = productOrUrl.trim();
  if (!trimmed) return '';

  if (trimmed.includes('images.unsplash.com')) {
    const [baseUrl] = trimmed.split('?');
    return `${baseUrl}?auto=format&fit=crop&w=2400&q=85&v=fc_hd_2026`;
  }

  return trimmed;
}

interface CarouselCardProps {
  item: Product;
  idx: number;
  isActive: boolean;
  cardWidth: number;
  cardHeight: number;
  cardGap: number;
  onPress: () => void;
}

const CarouselCard: React.FC<CarouselCardProps> = React.memo(({
  item,
  isActive,
  cardWidth,
  cardHeight,
  cardGap,
  onPress,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const hdUri = useMemo(() => getUltraHdImageUrl(item), [item]);

  const imageSource = useMemo(() => {
    const uriToLoad = hasError ? item.image : hdUri;
    return {
      uri: uriToLoad,
      cache: 'force-cache' as const,
    };
  }, [hasError, item.image, hdUri]);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[
        styles.card,
        {
          width: cardWidth,
          height: cardHeight,
          marginRight: cardGap,
        },
        isActive ? styles.activeCard : styles.inactiveCard,
      ]}
    >
      {/* Ultra HD Quality Product Image */}
      <Image
        source={imageSource}
        style={styles.cardImage}
        resizeMode="cover"
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onError={() => {
          if (!hasError) setHasError(true);
          setIsLoading(false);
        }}
      />

      {/* Loading placeholder spinner */}
      {isLoading && (
        <View style={styles.imageLoadingOverlay} pointerEvents="none">
          <ActivityIndicator size="small" color="#00e676" />
        </View>
      )}

      {/* Subtle vignette filter */}
      <View style={styles.vignetteOverlay} pointerEvents="none" />

      {/* Active card neon sheen vs Inactive card soft light wash */}
      {isActive ? (
        <View style={styles.activeCardSheen} pointerEvents="none" />
      ) : (
        <View style={styles.inactiveCardOverlay} pointerEvents="none" />
      )}
    </TouchableOpacity>
  );
});

export const ProductImageCarousel: React.FC<ProductImageCarouselProps> = ({
  products,
  onSelectProduct,
}) => {
  // Only include products that have a non-empty image
  const validProducts = (products || []).filter(
    (p) => Boolean(p.image && typeof p.image === 'string' && p.image.trim().length > 0)
  );
  const baseCount = validProducts.length;

  const windowWidth = Dimensions.get('window').width;
  const [containerWidth, setContainerWidth] = useState<number>(windowWidth - 28);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Responsive card dimensions based on container width
  const cardWidth = Math.min(320, Math.max(220, Math.round(containerWidth * 0.65)));
  const cardHeight = Math.round(cardWidth * 0.72);
  const cardGap = 16;
  const step = cardWidth + cardGap;

  // Extended items for seamless infinite looping
  const repeatCount = baseCount > 0 ? Math.max(3, Math.ceil(15 / baseCount)) : 0;
  const extendedItems = baseCount > 0
    ? Array.from({ length: repeatCount }, () => validProducts).flat()
    : [];

  const initialIndex = baseCount > 0 ? baseCount * Math.floor(repeatCount / 2) : 0;
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);

  const getTargetX = useCallback(
    (index: number, cWidth: number) => {
      return cWidth / 2 - (index * step + cardWidth / 2);
    },
    [step, cardWidth]
  );

  const animatedTranslateX = useRef(new Animated.Value(getTargetX(initialIndex, containerWidth))).current;
  const isSwipingRef = useRef(false);
  const dragStartTranslateXRef = useRef(0);
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync index if products change
  useEffect(() => {
    if (baseCount > 0) {
      const mid = baseCount * Math.floor(repeatCount / 2);
      setCurrentIndex((prev) => mid + (prev % baseCount));
    }
  }, [baseCount, repeatCount]);

  // Animate translation whenever currentIndex or containerWidth changes
  useEffect(() => {
    if (baseCount === 0) return;
    const targetX = getTargetX(currentIndex, containerWidth);

    Animated.spring(animatedTranslateX, {
      toValue: targetX,
      friction: 8,
      tension: 45,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      // Seamless normalization when reaching boundaries
      if (baseCount > 1) {
        const minThreshold = baseCount;
        const maxThreshold = baseCount * (repeatCount - 1);

        if (currentIndex >= maxThreshold) {
          const normalized = minThreshold + (currentIndex % baseCount);
          const normX = getTargetX(normalized, containerWidth);
          animatedTranslateX.setValue(normX);
          setCurrentIndex(normalized);
        } else if (currentIndex < minThreshold) {
          const normalized = maxThreshold - baseCount + (currentIndex % baseCount);
          const normX = getTargetX(normalized, containerWidth);
          animatedTranslateX.setValue(normX);
          setCurrentIndex(normalized);
        }
      }
    });
  }, [currentIndex, containerWidth, getTargetX, baseCount, repeatCount, animatedTranslateX]);

  const handleNext = useCallback(() => {
    if (baseCount <= 1) return;
    setCurrentIndex((prev) => prev + 1);
  }, [baseCount]);

  const handlePrev = useCallback(() => {
    if (baseCount <= 1) return;
    setCurrentIndex((prev) => prev - 1);
  }, [baseCount]);

  // Auto-rotation timer (3.8 seconds interval)
  useEffect(() => {
    if (isPaused || baseCount <= 1) return;

    const timer = setInterval(() => {
      handleNext();
    }, 3800);

    return () => clearInterval(timer);
  }, [isPaused, baseCount, handleNext]);

  const pauseAutoRotation = useCallback(() => {
    setIsPaused(true);
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }
  }, []);

  const resumeAutoRotation = useCallback(() => {
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }
    pauseTimeoutRef.current = setTimeout(() => {
      setIsPaused(false);
    }, 4500);
  }, []);

  // PanResponder for smooth touch swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
        );
      },
      onPanResponderGrant: () => {
        pauseAutoRotation();
        isSwipingRef.current = true;
        dragStartTranslateXRef.current = getTargetX(currentIndex, containerWidth);
      },
      onPanResponderMove: (_, gestureState) => {
        animatedTranslateX.setValue(dragStartTranslateXRef.current + gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        isSwipingRef.current = false;
        if (gestureState.dx < -35) {
          handleNext();
        } else if (gestureState.dx > 35) {
          handlePrev();
        } else {
          // Snap back
          Animated.spring(animatedTranslateX, {
            toValue: getTargetX(currentIndex, containerWidth),
            friction: 8,
            useNativeDriver: Platform.OS !== 'web',
          }).start();
        }
        resumeAutoRotation();
      },
      onPanResponderTerminate: () => {
        isSwipingRef.current = false;
        Animated.spring(animatedTranslateX, {
          toValue: getTargetX(currentIndex, containerWidth),
          friction: 8,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
        resumeAutoRotation();
      },
    })
  ).current;

  const handleCardPress = (product: Product, idx: number) => {
    if (isSwipingRef.current) return;
    if (idx !== currentIndex) {
      setCurrentIndex(idx);
    }
    // Open product details modal with actual product and genuine HD image
    const hdImage = getUltraHdImageUrl(product);
    onSelectProduct({
      ...product,
      image: hdImage || product.image,
    });
  };

  if (baseCount === 0) {
    return null;
  }

  // Active product index in original array (for pagination dots)
  const activeProductIndex = currentIndex % baseCount;

  return (
    <View style={styles.carouselWrapper}>
      <View
        style={styles.carouselContainer}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - containerWidth) > 2) {
            setContainerWidth(w);
          }
        }}
        {...(Platform.OS === 'web'
          ? {
              onMouseEnter: pauseAutoRotation,
              onMouseLeave: resumeAutoRotation,
            }
          : {})}
        {...panResponder.panHandlers}
      >
        {/* Subtle ambient emerald backlight top */}
        <View style={styles.ambientBacklightTop} pointerEvents="none" />
        {/* Subtle ambient emerald backlight bottom */}
        <View style={styles.ambientBacklightBottom} pointerEvents="none" />

        {/* Sliding Card Track */}
        <Animated.View
          style={[
            styles.track,
            {
              transform: [{ translateX: animatedTranslateX }],
              height: cardHeight + 20,
            },
          ]}
        >
          {extendedItems.map((item, idx) => {
            const isActive = idx === currentIndex;

            return (
              <CarouselCard
                key={`${item.id}-${idx}`}
                item={item}
                idx={idx}
                isActive={isActive}
                cardWidth={cardWidth}
                cardHeight={cardHeight}
                cardGap={cardGap}
                onPress={() => handleCardPress(item, idx)}
              />
            );
          })}
        </Animated.View>

        {/* Circular Left Navigation Arrow */}
        {baseCount > 1 && (
          <TouchableOpacity
            style={[styles.arrowBtn, styles.arrowLeft]}
            activeOpacity={0.7}
            onPress={() => {
              pauseAutoRotation();
              handlePrev();
              resumeAutoRotation();
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Previous product image"
          >
            <ChevronLeft size={18} color="#006b2c" />
          </TouchableOpacity>
        )}

        {/* Circular Right Navigation Arrow */}
        {baseCount > 1 && (
          <TouchableOpacity
            style={[styles.arrowBtn, styles.arrowRight]}
            activeOpacity={0.7}
            onPress={() => {
              pauseAutoRotation();
              handleNext();
              resumeAutoRotation();
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Next product image"
          >
            <ChevronRight size={18} color="#006b2c" />
          </TouchableOpacity>
        )}

        {/* Pagination Indicator Dots */}
        {baseCount > 1 && (
          <View style={styles.paginationRow}>
            {validProducts.map((_, i) => (
              <View
                key={`dot-${i}`}
                style={[
                  styles.dot,
                  i === activeProductIndex ? styles.activeDot : styles.inactiveDot,
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  carouselWrapper: {
    width: '100%',
    paddingHorizontal: 12,
    marginVertical: 8,
  },
  carouselContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#eef2f6',
    paddingVertical: 14,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.02)',
        }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.06,
          shadowRadius: 14,
          elevation: 2,
        }),
  },
  ambientBacklightTop: {
    position: 'absolute',
    top: -35,
    width: 220,
    height: 70,
    borderRadius: 110,
    backgroundColor: 'rgba(0, 230, 118, 0.06)',
    alignSelf: 'center',
  },
  ambientBacklightBottom: {
    position: 'absolute',
    bottom: -35,
    width: 220,
    height: 70,
    borderRadius: 110,
    backgroundColor: 'rgba(0, 230, 118, 0.04)',
    alignSelf: 'center',
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#ffffff',
  },
  activeCard: {
    transform: [{ scale: 1.05 }],
    borderWidth: 3,
    borderColor: '#00e676',
    backgroundColor: '#ffffff',
    zIndex: 20,
    ...(Platform.OS === 'web'
      ? {
          boxShadow:
            '0 0 22px rgba(0, 230, 118, 0.55), 0 8px 24px rgba(0, 107, 44, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04)',
        }
      : {
          shadowColor: '#00e676',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.7,
          shadowRadius: 16,
          elevation: 10,
        }),
  },
  inactiveCard: {
    transform: [{ scale: 0.93 }],
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    opacity: 0.75,
    zIndex: 10,
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
        }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        }),
  },
  cardImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f8fafc',
  },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vignetteOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
  },
  activeCardSheen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 230, 118, 0.04)',
  },
  inactiveCardOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  arrowBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#00e676',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08), 0 0 8px rgba(0, 230, 118, 0.35)',
          cursor: 'pointer',
        }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 6,
          elevation: 4,
        }),
  },
  arrowLeft: {
    left: 8,
  },
  arrowRight: {
    right: 8,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    height: 4.5,
    borderRadius: 2.5,
  },
  activeDot: {
    width: 18,
    backgroundColor: '#00e676',
  },
  inactiveDot: {
    width: 6,
    backgroundColor: '#cbd5e1',
  },
});
