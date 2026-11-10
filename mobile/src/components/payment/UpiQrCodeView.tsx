import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
} from 'react-native';
import { QrCode, RefreshCw, AlertCircle } from 'lucide-react-native';
import { SvgXml } from 'react-native-svg';
// @ts-ignore
import QRCodeCore from 'qrcode/lib/core/qrcode';
// @ts-ignore
import SvgRenderer from 'qrcode/lib/renderer/svg-tag';
import { customerApi } from '../../services/apiClient';

interface UpiQrCodeViewProps {
  upiId: string;
  merchantName?: string;
  amount?: number;
  size?: number;
  qrDataUrl?: string;
  onRetry?: () => void;
  showCaption?: boolean;
}

export const UpiQrCodeView: React.FC<UpiQrCodeViewProps> = ({
  upiId,
  merchantName = 'FreshCart Store',
  amount,
  size = 180,
  qrDataUrl: preloadedQrDataUrl,
  onRetry,
  showCaption = true,
}) => {
  const [svgString, setSvgString] = useState<string>('');
  const [remoteQrUrl, setRemoteQrUrl] = useState<string>(preloadedQrDataUrl || '');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [retryNonce, setRetryNonce] = useState<number>(0);

  const cleanUpiId = (upiId || '').trim();
  const cleanMerchant = (merchantName || 'FreshCart Store').trim();

  // Standard UPI URI format: upi://pay?pa=VPA&pn=NAME&am=AMOUNT&cu=INR
  const upiUri = useMemo(() => {
    if (!cleanUpiId) return '';
    const pa = encodeURIComponent(cleanUpiId).replace(/%40/g, '@');
    const pn = encodeURIComponent(cleanMerchant);
    const amParam = amount !== undefined && amount > 0 ? `&am=${amount.toFixed(2)}` : '';
    return `upi://pay?pa=${pa}&pn=${pn}${amParam}&cu=INR`;
  }, [cleanUpiId, cleanMerchant, amount]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setHasError(false);

    if (!cleanUpiId || !upiUri) {
      setIsLoading(false);
      setHasError(true);
      return;
    }

    try {
      // 1. Client-Side Pure Vector SVG Generation (0ms, 100% crisp on Android, no canvas dependency)
      const qrData = QRCodeCore.create(upiUri, {
        errorCorrectionLevel: 'M',
        margin: 2,
      });
      const generatedSvg = SvgRenderer.render(qrData);
      if (isMounted && generatedSvg && generatedSvg.startsWith('<svg')) {
        setSvgString(generatedSvg);
        setIsLoading(false);
        setHasError(false);
      }
    } catch (clientErr) {
      console.warn('[UpiQrCodeView] Client-side SVG generation error:', clientErr);
    }

    // 2. Concurrently fetch authoritative backend QR code as fallback
    if (!preloadedQrDataUrl) {
      customerApi
        .getUpiQrCode(amount)
        .then((res) => {
          if (!isMounted) return;
          if (res?.success && res?.qrCodeDataUrl) {
            setRemoteQrUrl(res.qrCodeDataUrl);
          }
        })
        .catch(() => {
          // If client-side SVG already succeeded, ignore network warning
        })
        .finally(() => {
          if (isMounted) {
            setIsLoading(false);
          }
        });
    } else {
      setRemoteQrUrl(preloadedQrDataUrl);
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [upiUri, cleanUpiId, preloadedQrDataUrl, amount, retryNonce]);

  const handleRetry = () => {
    setRetryNonce((prev) => prev + 1);
    if (onRetry) onRetry();
  };

  if (!cleanUpiId || (hasError && !svgString && !remoteQrUrl)) {
    return (
      <View style={[styles.errorContainer, { width: size + 32, height: size + 32 }]}>
        <AlertCircle size={24} color="#dc2626" />
        <Text style={styles.errorText}>UPI QR Code Unavailable</Text>
        <Text style={styles.errorSub}>Please check internet connection or retry.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
          <RefreshCw size={14} color="#006b2c" />
          <Text style={styles.retryBtnText}>Retry QR Loading</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.qrFrame, { width: size + 20, height: size + 20 }]}>
        {isLoading && !svgString && !remoteQrUrl ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#006b2c" />
            <Text style={styles.loadingText}>Generating UPI QR Code...</Text>
          </View>
        ) : svgString ? (
          <SvgXml xml={svgString} width={size} height={size} />
        ) : remoteQrUrl ? (
          <Image
            source={{ uri: remoteQrUrl }}
            style={{ width: size, height: size }}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.loadingBox}>
            <QrCode size={size * 0.6} color="#006b2c" />
          </View>
        )}
      </View>

      {showCaption && (
        <Text style={styles.captionText}>
          Scan with Google Pay, PhonePe, Paytm, BHIM, or any UPI app
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  qrFrame: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  loadingText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  captionText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 15,
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginVertical: 8,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991b1b',
    marginTop: 6,
  },
  errorSub: {
    fontSize: 10,
    color: '#b91c1c',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 8,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#006b2c',
  },
});
