import { ComponentRef, useRef, useState, useEffect, useCallback } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  View,
  Dimensions,
  LayoutChangeEvent,
  NativeSyntheticEvent,
  NativeScrollEvent,
  KeyboardEvent,
} from 'react-native';

type ViewRef = ComponentRef<typeof View>;
type ScrollViewRef = ComponentRef<typeof ScrollView>;

function computeKeyboardTopY(windowHeight: number, kbHeight: number, kbScreenY: number): number {
  if (kbHeight <= 0) return windowHeight;
  const kbFromWindow = windowHeight - kbHeight;
  return kbScreenY > 0 ? Math.min(kbFromWindow, kbScreenY) : kbFromWindow;
}

/**
 * Provides cross-platform keyboard visibility state, adaptive ScrollView bottom spacing
 * (handles Android adjustResize, adjustPan, and edge-to-edge Expo Go cleanly),
 * and automatic scrolling to keep the currently focused input completely visible above the keyboard.
 */
export function useKeyboardAwareScroll() {
  const scrollViewRef = useRef<ScrollViewRef | null>(null);
  const containerRef = useRef<ViewRef | null>(null);
  const fieldRefs = useRef<Record<string, ViewRef | null>>({});

  const scrollOffsetRef = useRef(0);
  const keyboardHeightRef = useRef(0);
  const keyboardScreenYRef = useRef(0);
  const activeFieldKeyRef = useRef<string | null>(null);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [uncoveredKeyboardHeight, setUncoveredKeyboardHeight] = useState(0);

  const clearScheduledScrolls = useCallback(() => {
    for (const t of timersRef.current) {
      clearTimeout(t);
    }
    timersRef.current = [];
  }, []);

  /**
   * Measures how many pixels of the scroll container currently extend beneath the keyboard top.
   * Using live window coordinates makes padding invariant to event order between onLayout and keyboardDidShow.
   */
  const syncUncoveredKeyboardHeight = useCallback(() => {
    const kbH = keyboardHeightRef.current;
    if (kbH <= 0) {
      setUncoveredKeyboardHeight(0);
      return;
    }

    const containerView = containerRef.current;
    if (!containerView) {
      setUncoveredKeyboardHeight(kbH);
      return;
    }

    containerView.measureInWindow((_cx: number, cy: number, _cw: number, ch: number) => {
      if (!ch || keyboardHeightRef.current <= 0) return;
      const windowHeight = Dimensions.get('window').height;
      const kbTopY = computeKeyboardTopY(
        windowHeight,
        keyboardHeightRef.current,
        keyboardScreenYRef.current
      );
      setUncoveredKeyboardHeight(Math.max(0, cy + ch - kbTopY));
    });
  }, []);

  const scrollFieldIntoView = useCallback((fieldKey?: string | null) => {
    const key = fieldKey || activeFieldKeyRef.current;
    if (!key) return;

    const fieldView = fieldRefs.current[key];
    const containerView = containerRef.current;
    const scrollView = scrollViewRef.current;
    if (!fieldView || !containerView || !scrollView) return;

    containerView.measureInWindow((_cx: number, cy: number, _cw: number, ch: number) => {
      fieldView.measureInWindow((_fx: number, fy: number, _fw: number, fh: number) => {
        if (!fh && !ch) return;

        const windowHeight = Dimensions.get('window').height;
        const containerBottomY = cy + ch;
        const kbTopY = computeKeyboardTopY(
          windowHeight,
          keyboardHeightRef.current,
          keyboardScreenYRef.current
        );
        const visibleBottomY = Math.min(containerBottomY, kbTopY) - 24;
        const visibleTopY = cy + 8;

        const fieldTop = fy;
        const fieldBottom = fy + fh;

        if (fieldBottom > visibleBottomY) {
          const delta = fieldBottom - visibleBottomY + 12;
          scrollView.scrollTo({
            y: Math.max(0, scrollOffsetRef.current + delta),
            animated: true,
          });
        } else if (fieldTop < visibleTopY) {
          const delta = visibleTopY - fieldTop + 12;
          scrollView.scrollTo({
            y: Math.max(0, scrollOffsetRef.current - delta),
            animated: true,
          });
        }
      });
    });
  }, []);

  const scheduleScrollIntoView = useCallback(
    (fieldKey?: string | null, delayMs = 80) => {
      clearScheduledScrolls();
      const timer = setTimeout(() => {
        scrollFieldIntoView(fieldKey);
      }, delayMs);
      timersRef.current.push(timer);
    },
    [clearScheduledScrolls, scrollFieldIntoView]
  );

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => {
      const h = e?.endCoordinates?.height || 0;
      const screenY = e?.endCoordinates?.screenY || 0;
      keyboardHeightRef.current = h;
      keyboardScreenYRef.current = screenY;
      setUncoveredKeyboardHeight(h);
      setIsKeyboardVisible(true);
      syncUncoveredKeyboardHeight();

      if (activeFieldKeyRef.current) {
        scheduleScrollIntoView(activeFieldKeyRef.current, 60);
      }
    };

    const onHide = () => {
      keyboardHeightRef.current = 0;
      keyboardScreenYRef.current = 0;
      setUncoveredKeyboardHeight(0);
      setIsKeyboardVisible(false);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
      clearScheduledScrolls();
    };
  }, [clearScheduledScrolls, scheduleScrollIntoView, syncUncoveredKeyboardHeight]);

  const onContainerLayout = useCallback(
    (_e: LayoutChangeEvent) => {
      if (keyboardHeightRef.current > 0) {
        syncUncoveredKeyboardHeight();
      }
    },
    [syncUncoveredKeyboardHeight]
  );

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
  }, []);

  const setFieldRef = useCallback((key: string) => {
    return (node: ViewRef | null) => {
      fieldRefs.current[key] = node;
    };
  }, []);

  const handleFieldFocus = useCallback(
    (key: string) => {
      activeFieldKeyRef.current = key;
      // When keyboard is already open, adjust immediately; otherwise keyboardDidShow will also fire cleanly
      if (keyboardHeightRef.current > 0) {
        scheduleScrollIntoView(key, 60);
      } else {
        scheduleScrollIntoView(key, 260);
      }
    },
    [scheduleScrollIntoView]
  );

  const handleFieldBlur = useCallback((key: string) => {
    if (activeFieldKeyRef.current === key) {
      activeFieldKeyRef.current = null;
    }
  }, []);

  const scrollBottomPadding = isKeyboardVisible ? uncoveredKeyboardHeight + 56 : 32;

  return {
    scrollViewRef,
    containerRef,
    isKeyboardVisible,
    scrollBottomPadding,
    onContainerLayout,
    onScroll,
    setFieldRef,
    handleFieldFocus,
    handleFieldBlur,
    scrollSectionIntoView: scheduleScrollIntoView,
  };
}
