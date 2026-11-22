declare global {
  interface Window {
    Razorpay: any;
  }
}

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
let sdkPromise: Promise<boolean> | null = null;

/**
 * Loads or returns the existing Promise for the Razorpay Checkout SDK.
 * Handles preloading, existing scripts, polling, deduplication, and safe retry after failure.
 */
export function loadRazorpaySdk(timeoutMs = 15000): Promise<boolean> {
  // 1. Instant check: already loaded and initialized on window
  if (typeof window !== 'undefined' && typeof window.Razorpay === 'function') {
    return Promise.resolve(true);
  }

  // 2. Reuse active in-flight loading promise
  if (sdkPromise) {
    return sdkPromise;
  }

  // 3. Create loader promise with polling, DOM listener fallback, and clean error handling
  sdkPromise = new Promise<boolean>((resolve, reject) => {
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const cleanup = () => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (pollTimer) clearInterval(pollTimer);
    };

    const handleSuccess = () => {
      cleanup();
      resolve(true);
    };

    const handleFailure = (msg: string) => {
      cleanup();
      sdkPromise = null; // Reset so subsequent attempt can retry cleanly
      const deadScript = document.querySelector(`script[src="${SCRIPT_URL}"]`);
      if (deadScript) {
        deadScript.remove();
      }
      reject(new Error(msg));
    };

    // Fast-path polling: catches scripts that completed loading before or during event listener registration
    pollTimer = setInterval(() => {
      if (typeof window !== 'undefined' && typeof window.Razorpay === 'function') {
        handleSuccess();
      }
    }, 25);

    // Guard timeout
    timeoutTimer = setTimeout(() => {
      handleFailure('Razorpay Checkout SDK failed to load within timeout period. Please check your network connection.');
    }, timeoutMs);

    // Check if script tag is already in DOM
    let script = document.querySelector(`script[src="${SCRIPT_URL}"]`) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }

    script.addEventListener(
      'load',
      () => {
        if (typeof window.Razorpay === 'function') {
          handleSuccess();
        } else {
          setTimeout(() => {
            if (typeof window.Razorpay === 'function') {
              handleSuccess();
            } else {
              handleFailure('Razorpay SDK loaded, but window.Razorpay was not found.');
            }
          }, 50);
        }
      },
      { once: true }
    );

    script.addEventListener(
      'error',
      () => {
        handleFailure('Failed to load Razorpay Checkout SDK from CDN. Please check your internet connection.');
      },
      { once: true }
    );
  });

  return sdkPromise;
}

