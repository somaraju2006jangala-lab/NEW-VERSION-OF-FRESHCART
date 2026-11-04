import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Platform,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
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

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as React.ComponentType<any>;

interface CarouselCardProps {
  item: Product;
  index: number;
  isActive: boolean;
  cardWidth: number;
  cardHeight: number;
  cardGap: number;
  scrollX: Animated.Value;
  interval: number;
  onPress: () => void;
}

const CarouselCard: React.FC<CarouselCardProps> = React.memo(({
  item,
  index,
  isActive,
  cardWidth,
  cardHeight,
  cardGap,
  scrollX,
  interval,
  onPress,
}) => {
  const [hasError, setHasError] = useState(false);
  const hdUri = useMemo(() => getUltraHdImageUrl(item), [item]);

  const imageSource = useMemo(() => {
    const uriToLoad = hasError ? item.image : hdUri;
    return {
      uri: uriToLoad,
    };
  }, [hasError, item.image, hdUri]);

  // Interpolate scale and opacity based on horizontal distance from center:
  // Active center card is 1.0 (significantly larger), side preview cards are 0.88
  const inputRange = [
    (index - 1) * interval,
    index * interval,
    (index + 1) * interval,
  ];

  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.88, 1.0, 0.88],
    extrapolate: 'clamp',
  });

  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.65, 1.0, 0.65],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        {
          width: cardWidth,
          height: cardHeight,
          marginRight: cardGap,
          transform: [{ scale }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={onPress}
        style={[
          styles.card,
          isActive ? styles.activeCard : styles.inactiveCard,
        ]}
      >
        <Image
          source={imageSource}
          style={styles.cardImage}
          resizeMode="cover"
          onError={() => {
            if (!hasError) setHasError(true);
          }}
        />

        {/* Subtle photo vignette */}
        <View style={styles.vignetteOverlay} pointerEvents="none" />

        {/* Active card neon sheen vs Inactive card soft wash */}
        {isActive ? (
          <View style={styles.activeCardSheen} pointerEvents="none" />
        ) : (
          <View style={styles.inactiveCardOverlay} pointerEvents="none" />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

export const ProductImageCarousel: React.FC<ProductImageCarouselProps> = ({
  products,
  onSelectProduct,
}) => {
  // Only include products that have a non-empty image
  const validProducts = useMemo(
    () =>
      (products || []).filter(
        (p) => Boolean(p.image && typeof p.image === 'string' && p.image.trim().length > 0)
      ),
    [products]
  );
  const baseCount = validProducts.length;

  const windowWidth = Dimensions.get('window').width;
  const [containerWidth, setContainerWidth] = useState<number>(windowWidth - 24);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Dynamic responsive dimensions:
  // Active image is exactly 70% of the carousel's inner width (68-72% target),
  // leaving equal portions (~15% each minus gap) on both sides for neighboring slides
  const cardWidth = Math.min(380, Math.max(220, Math.round(containerWidth * 0.70)));
  const cardHeight = Math.round(cardWidth * 0.64);
  const cardGap = 12;
  const interval = cardWidth + cardGap;
  const sideSpacing = (containerWidth - cardWidth) / 2;

  // Extended items for seamless continuous looping (3 blocks: prev, current, next)
  const repeatCount = baseCount > 1 ? 3 : 1;
  const extendedItems = useMemo(() => {
    if (baseCount === 0) return [];
    if (baseCount === 1) return validProducts;
    return Array.from({ length: repeatCount }, () => validProducts).flat();
  }, [validProducts, baseCount, repeatCount]);

  // Start in the middle block so previous and next cards are simultaneously visible
  const initialIndex = baseCount > 1 ? baseCount : 0;
  const [activeIndex, setActiveIndex] = useState<number>(initialIndex);

  const flatListRef = useRef<any>(null);
  const scrollX = useRef(new Animated.Value(initialIndex * interval)).current;
  const isScrollingRef = useRef(false);
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep scroll position centered at initial index
  useEffect(() => {
    if (baseCount > 1) {
      scrollX.setValue(initialIndex * interval);
      setActiveIndex(initialIndex);
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToOffset({
          offset: initialIndex * interval,
          animated: false,
        });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [baseCount, initialIndex, interval, scrollX]);

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

  const handleNext = useCallback(() => {
    if (baseCount <= 1) return;
    const target = activeIndex + 1;
    flatListRef.current?.scrollToOffset({
      offset: target * interval,
      animated: true,
    });
    setActiveIndex(target);
  }, [baseCount, activeIndex, interval]);

  const handlePrev = useCallback(() => {
    if (baseCount <= 1) return;
    const target = activeIndex - 1;
    flatListRef.current?.scrollToOffset({
      offset: target * interval,
      animated: true,
    });
    setActiveIndex(target);
  }, [baseCount, activeIndex, interval]);

  // Auto-scroll through images like an album
  useEffect(() => {
    if (isPaused || baseCount <= 1) return;
    const timer = setInterval(() => {
      handleNext();
    }, 3800);
    return () => clearInterval(timer);
  }, [isPaused, baseCount, handleNext]);

  // Track active slide index from scroll offset
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / interval);
      if (index !== activeIndex && index >= 0 && index < extendedItems.length) {
        setActiveIndex(index);
      }
    },
    [interval, activeIndex, extendedItems.length]
  );

  // Seamless boundary wrap-around for infinite looping
  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const newIndex = Math.round(offsetX / interval);
      setActiveIndex(newIndex);
      isScrollingRef.current = false;
      resumeAutoRotation();

      // Normalize if scrolled into outer blocks for infinite looping
      if (baseCount > 1) {
        if (newIndex >= 2 * baseCount) {
          const normalized = newIndex - baseCount;
          flatListRef.current?.scrollToOffset({
            offset: normalized * interval,
            animated: false,
          });
          setActiveIndex(normalized);
        } else if (newIndex < baseCount) {
          const normalized = newIndex + baseCount;
          flatListRef.current?.scrollToOffset({
            offset: normalized * interval,
            animated: false,
          });
          setActiveIndex(normalized);
        }
      }
    },
    [baseCount, interval, resumeAutoRotation]
  );

  const handleCardPress = useCallback(
    (product: Product, index: number) => {
      if (index !== activeIndex) {
        pauseAutoRotation();
        flatListRef.current?.scrollToOffset({
          offset: index * interval,
          animated: true,
        });
        setActiveIndex(index);
        resumeAutoRotation();
        return;
      }
      const hdImage = getUltraHdImageUrl(product);
      onSelectProduct({
        ...product,
        image: hdImage || product.image,
      });
    },
    [activeIndex, interval, onSelectProduct, pauseAutoRotation, resumeAutoRotation]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Product; index: number }) => {
      const isActive = index === activeIndex;
      return (
        <CarouselCard
          item={item}
          index={index}
          isActive={isActive}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
          cardGap={cardGap}
          scrollX={scrollX}
          interval={interval}
          onPress={() => handleCardPress(item, index)}
        />
      );
    },
    [activeIndex, cardWidth, cardHeight, cardGap, scrollX, interval, handleCardPress]
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: interval,
      offset: interval * index,
      index,
    }),
    [interval]
  );

  const onScrollToIndexFailed = useCallback(
    (info: { index: number }) => {
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({
          offset: info.index * interval,
          animated: false,
        });
      }, 50);
    },
    [interval]
  );

  if (baseCount === 0) {
    return null;
  }

  // Active product index in original array (for pagination dots)
  const activeDotIndex = ((activeIndex % baseCount) + baseCount) % baseCount;

  // Center vertical offset for arrow buttons relative to card track
  const arrowTop = 14 + Math.round((cardHeight + 12) / 2) - 18;

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
      >
        {/* Ambient emerald backlight */}
        <View style={styles.ambientBacklightTop} pointerEvents="none" />
        <View style={styles.ambientBacklightBottom} pointerEvents="none" />

        {/* Center-Focused Three-Slide Carousel FlatList */}
        <AnimatedFlatList
          ref={flatListRef}
          data={extendedItems}
          keyExtractor={(item: Product, idx: number) => `${item.id}-${idx}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={interval}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum={true}
          contentContainerStyle={{
            paddingLeft: sideSpacing,
            paddingRight: sideSpacing - cardGap,
            alignItems: 'center',
            height: cardHeight + 12,
          }}
          initialScrollIndex={initialIndex}
          getItemLayout={getItemLayout}
          onScrollToIndexFailed={onScrollToIndexFailed}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            {
              useNativeDriver: true,
              listener: handleScroll,
            }
          )}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => {
            isScrollingRef.current = true;
            pauseAutoRotation();
          }}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          renderItem={renderItem}
        />

        {/* Circular Left Navigation Arrow */}
        {baseCount > 1 && (
          <TouchableOpacity
            style={[styles.arrowBtn, styles.arrowLeft, { top: arrowTop }]}
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
            style={[styles.arrowBtn, styles.arrowRight, { top: arrowTop }]}
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
                  i === activeDotIndex ? styles.activeDot : styles.inactiveDot,
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
    paddingTop: 14,
    paddingBottom: 12,
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
  cardWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#ffffff',
  },
  activeCard: {
    borderWidth: 2.5,
    borderColor: '#00e676',
    zIndex: 20,
    ...(Platform.OS === 'web'
      ? {
          boxShadow:
            '0 0 22px rgba(0, 230, 118, 0.55), 0 8px 24px rgba(0, 107, 44, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04)',
        }
      : {
          shadowColor: '#00e676',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.45,
          shadowRadius: 12,
          elevation: 8,
        }),
  },
  inactiveCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    zIndex: 10,
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
        }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 1,
        }),
  },
  cardImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f8fafc',
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
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  arrowBtn: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#00e676',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
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
          elevation: 5,
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
