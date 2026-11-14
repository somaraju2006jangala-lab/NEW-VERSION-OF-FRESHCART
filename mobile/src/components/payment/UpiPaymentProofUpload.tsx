import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Modal,
  Platform,
  Linking,
} from 'react-native';
import {
  UploadCloud,
  Image as ImageIcon,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Maximize2,
  X,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { customerApi, cleanErrorMessage } from '../../services/apiClient';
import { UploadedPaymentProof } from '../../types';
import { RecipientInfo } from '../../screens/customer/RecipientDetailsScreen';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB (matches backend limit)
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg'];

interface SelectedScreenshot {
  uri: string;
  fileName: string;
  fileSize: number;
  mimeType: 'image/png' | 'image/jpeg';
  base64: string;
}

interface UpiPaymentProofUploadProps {
  orderId: string;
  transactionRef: string;
  amount: number;
  upiId: string;
  merchantName: string;
  upiSettingsReady?: boolean;
  recipient: RecipientInfo;
  deliveryAddress: string;
  subtotal: number;
  discountAmount: number;
  appliedCouponCode?: string;
  cartSignature?: string;
  uploadedProof: UploadedPaymentProof | null;
  onProofUploaded: (proof: UploadedPaymentProof) => void;
  onProofCleared: () => void;
  onInteractionFocus?: () => void;
  highlightedError?: string | null;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return 'Ready to upload';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function detectImageFormat(
  base64: string,
  declaredMime?: string | null,
  fileName?: string | null
): 'image/png' | 'image/jpeg' | null {
  const cleanB64 = (base64 || '').trim();
  const mime = (declaredMime || '').trim().toLowerCase();
  const lowerName = (fileName || '').trim().toLowerCase();
  const dotIdx = lowerName.lastIndexOf('.');
  const ext = dotIdx >= 0 ? lowerName.slice(dotIdx) : '';

  // Reject explicit non-PNG/JPEG MIME types immediately (e.g., webp, heic, gif, pdf, video)
  if (mime && mime !== 'image/*' && !ALLOWED_MIME_TYPES.includes(mime)) {
    return null;
  }

  // Reject explicit unsupported extensions
  if (ext && !ALLOWED_EXTENSIONS.includes(ext)) {
    return null;
  }

  // Verify binary magic bytes when base64 payload is available (matches backend PNG/JPEG check)
  if (cleanB64.length >= 12) {
    if (cleanB64.startsWith('iVBORw0KGgo')) {
      return 'image/png';
    }
    if (cleanB64.startsWith('/9j/')) {
      return 'image/jpeg';
    }
    return null;
  }

  if (mime === 'image/png' || ext === '.png') return 'image/png';
  if (mime === 'image/jpeg' || mime === 'image/jpg' || ext === '.jpg' || ext === '.jpeg') {
    return 'image/jpeg';
  }
  return null;
}

function estimateBase64ByteLength(base64: string): number {
  const clean = (base64 || '').replace(/\s/g, '');
  if (!clean) return 0;
  let padding = 0;
  if (clean.endsWith('==')) padding = 2;
  else if (clean.endsWith('=')) padding = 1;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

export const UpiPaymentProofUpload: React.FC<UpiPaymentProofUploadProps> = ({
  orderId,
  transactionRef,
  amount,
  upiId,
  merchantName,
  upiSettingsReady = true,
  recipient,
  deliveryAddress,
  subtotal,
  discountAmount,
  appliedCouponCode,
  cartSignature,
  uploadedProof,
  onProofUploaded,
  onProofCleared,
  onInteractionFocus,
  highlightedError,
}) => {
  const { currentCustomer, customerToken } = useAuth();
  const { cart } = useCart();

  const [selectedImage, setSelectedImage] = useState<SelectedScreenshot | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemovingUploaded, setIsRemovingUploaded] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [permissionDeniedPermanent, setPermissionDeniedPermanent] = useState(false);
  const [previewModalUri, setPreviewModalUri] = useState<string | null>(null);

  const isUploadingRef = useRef(false);
  const draftSavedForOrderRef = useRef<string | null>(null);
  const paymentInitiatedForOrderRef = useRef<string | null>(null);
  const needsReplaceDraftRef = useRef(false);

  const extractBase64FromAsset = async (asset: ImagePicker.ImagePickerAsset): Promise<string> => {
    if (asset.base64 && asset.base64.trim()) {
      return asset.base64.trim();
    }
    if (asset.uri && asset.uri.startsWith('data:')) {
      const commaIdx = asset.uri.indexOf(',');
      if (commaIdx !== -1) {
        return asset.uri.slice(commaIdx + 1).trim();
      }
    }
    if (asset.uri) {
      return await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
    return '';
  };

  const handlePickScreenshot = async (replacingUploaded = false) => {
    if (isPicking || isUploading || isRemovingUploaded) return;
    setUploadError(null);
    setPermissionDeniedPermanent(false);

    try {
      setIsPicking(true);

      // 1. Check / Request gallery permissions on native Android/iOS
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setPermissionDeniedPermanent(perm.canAskAgain === false);
          setUploadError(
            perm.canAskAgain === false
              ? 'Gallery permission was denied. Please enable Photos/Media access in Android Settings to upload your UPI screenshot.'
              : 'Gallery access permission is required to select your UPI payment screenshot.'
          );
          onInteractionFocus?.();
          return;
        }
      }

      // 2. Open native image gallery / photo picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const rawUri = asset.uri || '';
      const uriSegment = rawUri.split('/').pop()?.split('?')[0] || '';
      const rawFileName = (asset.fileName || uriSegment || 'upi-payment-screenshot.jpg').trim();

      // 3. Read base64 payload to verify format and size accurately
      let base64Payload = '';
      try {
        base64Payload = await extractBase64FromAsset(asset);
      } catch {
        setUploadError('Could not read the selected image from storage. Please try selecting it again.');
        return;
      }

      if (!base64Payload) {
        setUploadError('Selected image file is empty or unreadable. Please choose another screenshot.');
        return;
      }

      // 4. Validate PNG, JPG, JPEG format strictly
      const detectedMime = detectImageFormat(base64Payload, asset.mimeType, rawFileName);
      if (!detectedMime) {
        setUploadError(
          'Unsupported image format. Please select a PNG, JPG, or JPEG screenshot from your gallery.'
        );
        onInteractionFocus?.();
        return;
      }

      // Normalize extension for display when Android gallery omits filename extension
      const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => rawFileName.toLowerCase().endsWith(ext));
      const normalizedFileName = hasValidExt
        ? rawFileName
        : `${rawFileName}.${detectedMime === 'image/png' ? 'png' : 'jpg'}`;

      // 5. Determine actual byte size and enforce 10 MB limit
      let byteSize = typeof asset.fileSize === 'number' && asset.fileSize > 0 ? asset.fileSize : 0;
      if (!byteSize && rawUri && Platform.OS !== 'web') {
        try {
          const info = await FileSystem.getInfoAsync(rawUri);
          if (info.exists && 'size' in info && typeof info.size === 'number') {
            byteSize = info.size;
          }
        } catch {
          // ignore and fall back to decoded length estimate
        }
      }
      if (!byteSize) {
        byteSize = estimateBase64ByteLength(base64Payload);
      }

      if (byteSize <= 0) {
        setUploadError('Selected image file appears empty. Please select a valid payment screenshot.');
        return;
      }

      if (byteSize > MAX_FILE_SIZE_BYTES) {
        setUploadError(
          `Image is too large (${formatBytes(byteSize)}). Maximum supported size is 10 MB.`
        );
        onInteractionFocus?.();
        return;
      }

      if (replacingUploaded && uploadedProof) {
        // Require fresh upload confirmation when replacing a previously uploaded screenshot
        needsReplaceDraftRef.current = true;
        onProofCleared();
        const effectiveCustId = currentCustomer?.id || 'guest';
        customerApi
          .removeScreenshotProof(orderId, customerToken || undefined, effectiveCustId)
          .catch(() => {});
      }

      setSelectedImage({
        uri: rawUri || `data:${detectedMime};base64,${base64Payload}`,
        fileName: normalizedFileName,
        fileSize: byteSize,
        mimeType: detectedMime,
        base64: base64Payload,
      });
      onInteractionFocus?.();
    } catch (err: any) {
      setUploadError(
        err?.message
          ? `Could not open image gallery: ${err.message}`
          : 'Could not open image gallery. Please check app permissions and try again.'
      );
    } finally {
      setIsPicking(false);
    }
  };

  const handleRemoveImage = () => {
    if (isUploading) return;
    setSelectedImage(null);
    setUploadError(null);
    setUploadProgress(0);
    setUploadStage('');
  };

  const handleRemoveUploadedProof = async () => {
    if (isUploading || isRemovingUploaded) return;
    setUploadError(null);
    setIsRemovingUploaded(true);
    const effectiveCustomerId = currentCustomer?.id || 'guest';

    // Immediately revoke proof state locally so Continue / Submit stays disabled until re-uploaded
    needsReplaceDraftRef.current = true;
    onProofCleared();
    setSelectedImage(null);
    setUploadProgress(0);
    setUploadStage('');

    try {
      await customerApi.removeScreenshotProof(
        orderId,
        customerToken || undefined,
        effectiveCustomerId
      );
      needsReplaceDraftRef.current = false;
    } catch (err: any) {
      // Keep needsReplaceDraftRef=true so re-upload cleanly replaces on the backend
      if (typeof __DEV__ === 'undefined' || __DEV__) {
        console.warn('[UpiPaymentProofUpload] Could not remove server proof immediately:', err);
      }
    } finally {
      setIsRemovingUploaded(false);
    }
  };

  const handleUploadProof = async () => {
    if (isUploading || isUploadingRef.current) return;

    const cleanOrderId = (orderId || '').trim();
    if (!cleanOrderId) {
      setUploadError('Missing Order ID. Please return to your cart and start checkout again.');
      return;
    }

    if (!selectedImage || !selectedImage.base64) {
      setUploadError('Please select a PNG, JPG, or JPEG payment screenshot first.');
      return;
    }

    if (cart.length === 0 || amount <= 0) {
      setUploadError('Your cart total is invalid. Please review your cart before uploading.');
      return;
    }

    if (!upiSettingsReady || !upiId) {
      setUploadError('UPI merchant configuration is unavailable. Please retry loading QR details.');
      return;
    }

    isUploadingRef.current = true;
    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(20);
    setUploadStage('Preparing order & payment record...');

    const effectiveCustomerId = currentCustomer?.id || 'guest';
    const dataUri = `data:${selectedImage.mimeType};base64,${selectedImage.base64}`;

    try {
      // 1. Create / ensure draft order exists in MySQL under the stable orderId (avoids duplicates on retry)
      if (draftSavedForOrderRef.current !== cleanOrderId) {
        setUploadProgress(30);
        setUploadStage('Registering order ID...');

        const draftOrder = {
          id: cleanOrderId,
          orderId: cleanOrderId,
          customerId: effectiveCustomerId,
          customerName: recipient.fullName?.trim() || currentCustomer?.name || 'Customer',
          customerEmail: recipient.email?.trim() || currentCustomer?.email || undefined,
          customerPhone: recipient.phone?.trim() || currentCustomer?.phone || undefined,
          deliveryAddress: deliveryAddress.trim() || currentCustomer?.address || 'Address on file',
          deliveryTimeSlot: 'Express Cold-Chain Delivery, 24-30 Minutes',
          items: cart.map((c) => ({
            product: {
              id: c.product.id,
              title: c.product.title,
              price: c.selectedPrice !== undefined ? c.selectedPrice : c.product.price,
              unit: c.product.unit,
              image: c.product.image,
              category: c.product.category,
            },
            quantity: c.quantity,
            selectedPackSize: c.selectedPackSize,
            selectedPrice: c.selectedPrice,
          })),
          subtotal,
          discount: discountAmount,
          total: amount,
          couponCode: appliedCouponCode || '',
          status: 'Pending',
          paymentMethod: 'UPI',
          paymentStatus: 'INITIATED',
          createdAt: new Date().toISOString(),
        };

        await customerApi.placeOrder(draftOrder, customerToken || undefined);
        draftSavedForOrderRef.current = cleanOrderId;
      }

      // 2. Create / update UPI payment attempt for this exact orderId
      if (paymentInitiatedForOrderRef.current !== cleanOrderId) {
        setUploadProgress(55);
        setUploadStage('Linking UPI transaction reference...');

        await customerApi.initiateUpi({
          orderId: cleanOrderId,
          customerId: effectiveCustomerId,
          amount,
          upiId,
          merchantName,
          transactionRef,
          customerName: recipient.fullName?.trim() || currentCustomer?.name || 'Customer',
          customerEmail: recipient.email?.trim() || currentCustomer?.email || undefined,
          customerPhone: recipient.phone?.trim() || currentCustomer?.phone || undefined,
          deliveryAddress: deliveryAddress.trim() || currentCustomer?.address || undefined,
        });
        paymentInitiatedForOrderRef.current = cleanOrderId;
      }

      // 3. Upload screenshot to shared backend endpoint /api/payments/screenshot/upload
      setUploadProgress(80);
      setUploadStage('Uploading payment screenshot...');

      const uploadRes = await customerApi.uploadScreenshotProof(
        cleanOrderId,
        dataUri,
        customerToken || undefined,
        selectedImage.mimeType,
        selectedImage.fileName,
        effectiveCustomerId,
        needsReplaceDraftRef.current
      );

      if (uploadRes?.success && uploadRes.screenshotUrl) {
        needsReplaceDraftRef.current = false;
        setUploadProgress(100);
        setUploadStage('Proof uploaded');
        onProofUploaded({
          orderId: cleanOrderId,
          transactionRef,
          screenshotUrl: uploadRes.screenshotUrl,
          fileName: selectedImage.fileName,
          fileSize: uploadRes.fileSize || selectedImage.fileSize,
          mimeType: uploadRes.mimeType || selectedImage.mimeType,
          previewUri: selectedImage.uri,
          paymentStatus: uploadRes.paymentStatus || 'PENDING_VERIFICATION',
          amount,
          cartSignature,
        });
      } else {
        setUploadError(uploadRes?.error || 'Failed to upload payment screenshot. Please retry.');
      }
    } catch (err: any) {
      const status = err?.status;
      const cleanRawOrderId = cleanOrderId.replace(/^#/, '');

      if (err?.alreadyPaid) {
        setUploadError(
          'Payment for this order is already confirmed as PAID. No additional screenshot is required.'
        );
      } else if (err?.alreadySubmitted) {
        // Recover gracefully if server already saved proof for this exact order (e.g. previous attempt response dropped)
        onProofUploaded({
          orderId: cleanOrderId,
          transactionRef,
          screenshotUrl: `/api/payments/screenshot/${encodeURIComponent(cleanRawOrderId)}`,
          fileName: selectedImage.fileName,
          fileSize: selectedImage.fileSize,
          mimeType: selectedImage.mimeType,
          previewUri: selectedImage.uri,
          paymentStatus: 'PENDING_VERIFICATION',
          amount,
          cartSignature,
        });
      } else if (status === 401 || status === 403) {
        setUploadError(
          err?.message ||
            'Authentication failed. Please sign in again and retry uploading your screenshot.'
        );
      } else if (status === 404) {
        // Order not found in DB yet: clear cached draft flag so next Retry recreates it cleanly
        draftSavedForOrderRef.current = null;
        paymentInitiatedForOrderRef.current = null;
        setUploadError(err?.message || 'Order reference not found on server. Tap Retry Upload.');
      } else if (status === 429) {
        setUploadError(err?.message || 'Upload already in progress. Please wait a moment and retry.');
      } else if (status === 400) {
        setUploadError(err?.message || 'Invalid image or order details. Please check and retry.');
      } else {
        setUploadError(
          cleanErrorMessage(
            err,
            'Network error while uploading screenshot. Tap Retry Upload without losing your order.'
          )
        );
      }
      onInteractionFocus?.();
    } finally {
      isUploadingRef.current = false;
      setIsUploading(false);
    }
  };

  const activeError = uploadError || (!uploadedProof ? highlightedError : null);

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBox}>
            <UploadCloud size={16} color="#006b2c" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Upload Payment Screenshot</Text>
            <Text style={styles.subtitle}>
              Completed payment? Attach your UPI transfer screenshot below.
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.statusBadge,
            uploadedProof ? styles.statusBadgeSuccess : styles.statusBadgePending,
          ]}
        >
          <Text
            style={[
              styles.statusBadgeText,
              uploadedProof ? styles.statusBadgeTextSuccess : styles.statusBadgeTextPending,
            ]}
          >
            {uploadedProof ? 'Submitted' : 'Required'}
          </Text>
        </View>
      </View>

      {/* State A: Uploaded Confirmation */}
      {uploadedProof ? (
        <View style={styles.successBox}>
          <View style={styles.successBanner}>
            <CheckCircle2 size={18} color="#006b2c" />
            <View style={{ flex: 1 }}>
              <Text style={styles.successTitle}>Payment Proof Uploaded Successfully</Text>
              <Text style={styles.successSub}>
                Order {uploadedProof.orderId} • Status: Pending Admin Verification
              </Text>
            </View>
          </View>

          <View style={styles.uploadedPreviewRow}>
            <TouchableOpacity
              onPress={() => setPreviewModalUri(uploadedProof.previewUri)}
              activeOpacity={0.85}
              style={styles.thumbWrapper}
            >
              <Image source={{ uri: uploadedProof.previewUri }} style={styles.uploadedThumb} />
              <View style={styles.zoomBadge}>
                <Maximize2 size={10} color="#ffffff" />
              </View>
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.fileNameText} numberOfLines={1}>
                {uploadedProof.fileName}
              </Text>
              <Text style={styles.fileMetaText}>
                {formatBytes(uploadedProof.fileSize)} •{' '}
                {uploadedProof.mimeType === 'image/png' ? 'PNG' : 'JPEG'}
              </Text>
              <View style={styles.pendingVerificationTag}>
                <Text style={styles.pendingVerificationText}>PENDING VERIFICATION</Text>
              </View>
            </View>
          </View>

          <View style={styles.secondaryActionsRow}>
            <TouchableOpacity
              style={[styles.replaceBtn, (isPicking || isRemovingUploaded) && styles.disabledBtn]}
              onPress={() => handlePickScreenshot(true)}
              disabled={isPicking || isRemovingUploaded}
            >
              <RefreshCw size={14} color="#006b2c" />
              <Text style={styles.replaceBtnText}>Replace Screenshot</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.removeBtn, (isPicking || isRemovingUploaded) && styles.disabledBtn]}
              onPress={handleRemoveUploadedProof}
              disabled={isPicking || isRemovingUploaded}
            >
              <Trash2 size={14} color="#dc2626" />
              <Text style={styles.removeBtnText}>
                {isRemovingUploaded ? 'Removing...' : 'Remove'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.noteRow}>
            <ShieldCheck size={14} color="#006b2c" style={{ marginTop: 1 }} />
            <Text style={styles.noteText}>
              Tap <Text style={{ fontWeight: '800' }}>Confirm Place Order</Text> below to submit your order. An authorized admin will verify your payment before approval.
            </Text>
          </View>
        </View>
      ) : selectedImage ? (
        /* State B: Selected Preview + Replace/Remove + Upload Payment Proof CTA */
        <View style={styles.selectedBox}>
          <TouchableOpacity
            style={styles.previewFrame}
            onPress={() => setPreviewModalUri(selectedImage.uri)}
            activeOpacity={0.9}
          >
            <Image
              source={{ uri: selectedImage.uri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
            <View style={styles.previewTapHint}>
              <Maximize2 size={12} color="#0f172a" />
              <Text style={styles.previewTapHintText}>Tap to zoom</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.selectedFileMetaRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fileNameText} numberOfLines={1}>
                {selectedImage.fileName}
              </Text>
              <Text style={styles.fileMetaText}>
                {formatBytes(selectedImage.fileSize)} •{' '}
                {selectedImage.mimeType === 'image/png' ? 'PNG' : 'JPEG'} • Order {orderId}
              </Text>
            </View>
          </View>

          <View style={styles.secondaryActionsRow}>
            <TouchableOpacity
              style={[styles.replaceBtn, isUploading && styles.disabledBtn]}
              onPress={() => handlePickScreenshot(false)}
              disabled={isUploading || isPicking}
            >
              <RefreshCw size={14} color="#006b2c" />
              <Text style={styles.replaceBtnText}>Replace</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.removeBtn, isUploading && styles.disabledBtn]}
              onPress={handleRemoveImage}
              disabled={isUploading}
            >
              <Trash2 size={14} color="#dc2626" />
              <Text style={styles.removeBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>

          {isUploading && (
            <View style={styles.progressBox}>
              <View style={styles.progressHeaderRow}>
                <View style={styles.progressStageRow}>
                  <ActivityIndicator size="small" color="#006b2c" />
                  <Text style={styles.progressStageText}>{uploadStage || 'Uploading...'}</Text>
                </View>
                <Text style={styles.progressPercentText}>{uploadProgress}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.uploadProofCta, isUploading && styles.disabledBtn]}
            onPress={handleUploadProof}
            disabled={isUploading}
            activeOpacity={0.85}
          >
            {isUploading ? (
              <>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.uploadProofCtaText}>Uploading Payment Proof...</Text>
              </>
            ) : (
              <>
                <UploadCloud size={17} color="#ffffff" />
                <Text style={styles.uploadProofCtaText}>
                  {uploadError ? 'Retry Upload' : 'Upload Payment Proof'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        /* State C: Initial Upload Payment Screenshot Trigger */
        <TouchableOpacity
          style={styles.pickBtn}
          onPress={() => handlePickScreenshot(false)}
          disabled={isPicking}
          activeOpacity={0.85}
        >
          {isPicking ? (
            <ActivityIndicator size="small" color="#006b2c" />
          ) : (
            <>
              <View style={styles.pickIconCircle}>
                <ImageIcon size={20} color="#006b2c" />
              </View>
              <Text style={styles.pickBtnTitle}>Upload Payment Screenshot</Text>
              <Text style={styles.pickBtnHint}>
                Open gallery to select PNG, JPG, or JPEG screenshot (max 10 MB)
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Clear Error Message */}
      {activeError ? (
        <View style={styles.errorBanner}>
          <AlertCircle size={16} color="#dc2626" style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.errorText}>{activeError}</Text>
            {permissionDeniedPermanent && (
              <TouchableOpacity
                style={styles.settingsBtn}
                onPress={() => Linking.openSettings().catch(() => {})}
              >
                <Text style={styles.settingsBtnText}>Open App Settings</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : null}

      {/* Fullscreen Zoom Preview Modal */}
      <Modal
        visible={!!previewModalUri}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewModalUri(null)}
      >
        <View style={styles.zoomOverlay}>
          <View style={styles.zoomCard}>
            <View style={styles.zoomHeader}>
              <Text style={styles.zoomTitle}>Payment Screenshot Preview</Text>
              <TouchableOpacity onPress={() => setPreviewModalUri(null)} style={styles.zoomCloseBtn}>
                <X size={20} color="#0f172a" />
              </TouchableOpacity>
            </View>
            {previewModalUri ? (
              <Image
                source={{ uri: previewModalUri }}
                style={styles.zoomImage}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
    lineHeight: 15,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgePending: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  statusBadgeSuccess: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusBadgeTextPending: {
    color: '#006b2c',
  },
  statusBadgeTextSuccess: {
    color: '#15803d',
  },
  pickBtn: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#22c55e',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pickIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#86efac',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  pickBtnTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#006b2c',
  },
  pickBtnHint: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
  },
  selectedBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  previewFrame: {
    width: '100%',
    height: 180,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewTapHint: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  previewTapHintText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0f172a',
  },
  selectedFileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fileNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  fileMetaText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  replaceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 10,
    paddingVertical: 9,
  },
  replaceBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#006b2c',
  },
  removeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    paddingVertical: 9,
  },
  removeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },
  progressBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressStageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressStageText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
  progressPercentText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#006b2c',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#dcfce7',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#00e676',
  },
  uploadProofCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#006b2c',
    borderRadius: 12,
    height: 44,
    shadowColor: '#006b2c',
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 2,
  },
  uploadProofCtaText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  disabledBtn: {
    opacity: 0.65,
  },
  successBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#22c55e',
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  successTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },
  successSub: {
    fontSize: 11,
    color: '#15803d',
    marginTop: 1,
    fontWeight: '600',
  },
  uploadedPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    padding: 8,
  },
  thumbWrapper: {
    position: 'relative',
  },
  uploadedThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  zoomBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(15,23,42,0.75)',
    borderRadius: 6,
    padding: 3,
  },
  pendingVerificationTag: {
    alignSelf: 'flex-start',
    marginTop: 5,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pendingVerificationText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#b45309',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  noteText: {
    flex: 1,
    fontSize: 11,
    color: '#166534',
    lineHeight: 15,
  },
  errorBanner: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    fontSize: 12,
    color: '#991b1b',
    fontWeight: '600',
    lineHeight: 16,
  },
  settingsBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  settingsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b91c1c',
  },
  zoomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  zoomCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
  },
  zoomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  zoomTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  zoomCloseBtn: {
    padding: 4,
  },
  zoomImage: {
    width: '100%',
    height: 360,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
  },
});
