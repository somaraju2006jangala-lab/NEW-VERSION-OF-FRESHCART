import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { CartProvider, useCart } from './src/context/CartContext';
import { PortalSelectionScreen } from './src/screens/PortalSelectionScreen';
import { AdminLoginScreen } from './src/screens/admin/AdminLoginScreen';
import { AdminDashboardScreen } from './src/screens/admin/AdminDashboardScreen';
import { EmployeeLoginScreen } from './src/screens/employee/EmployeeLoginScreen';
import { EmployeeDashboardScreen } from './src/screens/employee/EmployeeDashboardScreen';
import { StorefrontScreen } from './src/screens/customer/StorefrontScreen';
import { CartScreen } from './src/screens/customer/CartScreen';
import { RecipientDetailsScreen, RecipientInfo } from './src/screens/customer/RecipientDetailsScreen';
import { DeliveryAddressScreen, DeliveryAddressInfo } from './src/screens/customer/DeliveryAddressScreen';
import { PaymentMethodScreen } from './src/screens/customer/PaymentMethodScreen';
import { ConfirmOrderScreen } from './src/screens/customer/ConfirmOrderScreen';
import { OrderConfirmationScreen } from './src/screens/customer/OrderConfirmationScreen';
import { CustomerOrdersScreen } from './src/screens/customer/CustomerOrdersScreen';
import { settingsApi } from './src/services/apiClient';
import { UploadedPaymentProof } from './src/types';

function createCheckoutSession(): { orderId: string; transactionRef: string } {
  const digits = String(Math.floor(100000 + Math.random() * 900000));
  const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  return {
    orderId: `#FC-${digits}`,
    transactionRef: `FC-${digits}-${suffix}`,
  };
}

type CustomerView =
  | 'storefront'
  | 'cart'
  | 'recipient-details'
  | 'delivery-address'
  | 'payment-method'
  | 'confirm-order'
  | 'confirmation'
  | 'orders';

function MainNavigator() {
  const { activePortal, setActivePortal, currentAdmin, currentEmployee, currentCustomer, isLoading } = useAuth();
  const { cart, subtotal } = useCart();

  // Sub-view inside customer portal
  const [customerView, setCustomerView] = useState<CustomerView>('storefront');
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | undefined>(
    undefined
  );

  // Checkout sequence state: Cart -> Recipient Details -> Delivery Address -> Confirm Order -> Payment Method -> Confirmation
  const [checkoutRecipient, setCheckoutRecipient] = useState<RecipientInfo>({
    fullName: currentCustomer?.name || '',
    phone: currentCustomer?.phone || '',
    email: currentCustomer?.email || '',
  });

  const [checkoutAddressDetails, setCheckoutAddressDetails] = useState<DeliveryAddressInfo | null>(null);
  const [checkoutFormattedAddress, setCheckoutFormattedAddress] = useState<string>(
    currentCustomer?.address || ''
  );
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<'COD' | 'UPI'>('COD');
  const [deliveryCharge, setDeliveryCharge] = useState(40);
  const [checkoutSession, setCheckoutSession] = useState(() => createCheckoutSession());
  const [uploadedPaymentProof, setUploadedPaymentProof] = useState<UploadedPaymentProof | null>(null);

  const cartSignature = React.useMemo(() => {
    const itemKey = cart
      .map(
        (c) =>
          `${c.product.id}:${c.selectedPackSize || ''}:${c.quantity}:${c.selectedPrice ?? c.product.price}`
      )
      .join('|');
    return `${itemKey}|c:${appliedCoupon?.code || ''}:${appliedCoupon?.discount || 0}|d:${deliveryCharge}`;
  }, [cart, appliedCoupon, deliveryCharge]);

  // Fetch delivery settings and calculate delivery charge
  useEffect(() => {
    settingsApi
      .getSettings()
      .then((res) => {
        if (res?.success && res.settings?.deliveryChargeRules) {
          const rules = res.settings.deliveryChargeRules;
          const sorted = [...rules].sort((a, b) => a.minOrderAmount - b.minOrderAmount);
          let charge = 40;
          for (const rule of sorted) {
            if (subtotal >= rule.minOrderAmount) {
              charge = rule.deliveryCharge;
            }
          }
          setDeliveryCharge(charge);
        }
      })
      .catch(() => {});
  }, [subtotal]);

  // Keep recipient in sync if customer logs in
  React.useEffect(() => {
    if (currentCustomer) {
      setCheckoutRecipient((prev) => ({
        fullName: prev.fullName || currentCustomer.name || '',
        phone: prev.phone || currentCustomer.phone || '',
        email: prev.email || currentCustomer.email || '',
      }));
      if (!checkoutFormattedAddress && currentCustomer.address) {
        setCheckoutFormattedAddress(currentCustomer.address);
      }
    }
  }, [currentCustomer]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#006b2c" />
      </View>
    );
  }

  // 1. Common Portal Selection Page (Entry Point)
  if (activePortal === 'selection') {
    return (
      <PortalSelectionScreen
        onSelectPortal={(portal) => {
          setActivePortal(portal);
          if (portal === 'customer') {
            setCustomerView('storefront');
          }
        }}
      />
    );
  }

  // 2. Admin Portal Flow
  if (activePortal === 'admin') {
    if (currentAdmin) {
      return <AdminDashboardScreen />;
    }
    return <AdminLoginScreen onBackToSelection={() => setActivePortal('selection')} />;
  }

  // 3. Employee Portal Flow
  if (activePortal === 'employee') {
    if (currentEmployee) {
      return <EmployeeDashboardScreen />;
    }
    return <EmployeeLoginScreen onBackToSelection={() => setActivePortal('selection')} />;
  }

  // 4. Customer Portal Flow
  if (activePortal === 'customer') {
    switch (customerView) {
      // Cart Page: Proceed to Checkout -> Recipient Details
      case 'cart':
        return (
          <CartScreen
            onBack={() => setCustomerView('storefront')}
            onProceedToCheckout={(coupon) => {
              const nextCouponSig = `${coupon?.code || ''}:${coupon?.discount || 0}`;
              const itemsOnly = cart
                .map(
                  (c) =>
                    `${c.product.id}:${c.selectedPackSize || ''}:${c.quantity}:${c.selectedPrice ?? c.product.price}`
                )
                .join('|');
              const expectedSig = `${itemsOnly}|c:${nextCouponSig}|d:${deliveryCharge}`;
              if (
                uploadedPaymentProof &&
                uploadedPaymentProof.cartSignature &&
                uploadedPaymentProof.cartSignature !== expectedSig
              ) {
                setUploadedPaymentProof(null);
                setCheckoutSession(createCheckoutSession());
              }
              setAppliedCoupon(coupon);
              setCustomerView('recipient-details');
            }}
          />
        );

      // Page 1: Recipient Details -> Next -> Delivery Address
      case 'recipient-details':
        return (
          <RecipientDetailsScreen
            initialRecipient={checkoutRecipient}
            onContinue={(recipient) => {
              setCheckoutRecipient(recipient);
              setCustomerView('delivery-address');
            }}
            onBack={() => setCustomerView('cart')}
          />
        );

      // Page 2: Delivery Address -> Next -> Confirm Order
      case 'delivery-address':
        return (
          <DeliveryAddressScreen
            initialAddress={
              checkoutAddressDetails || {
                houseNo: '',
                street: checkoutFormattedAddress || currentCustomer?.address || '',
                city: 'Bengaluru',
                state: 'Karnataka',
                pinCode: '',
              }
            }
            savedAddresses={
              currentCustomer?.address
                ? [
                    {
                      houseNo: 'Primary',
                      street: currentCustomer.address,
                      city: 'Bengaluru',
                      state: 'Karnataka',
                      pinCode: '560038',
                      type: 'Home',
                    },
                  ]
                : []
            }
            onContinue={(formatted, details) => {
              setCheckoutFormattedAddress(formatted);
              setCheckoutAddressDetails(details);
              setCustomerView('confirm-order');
            }}
            onBack={() => setCustomerView('recipient-details')}
          />
        );

      // Page 3: Confirm Order (Summary Review) -> Next -> Payment Method
      case 'confirm-order':
        return (
          <ConfirmOrderScreen
            recipient={checkoutRecipient}
            deliveryAddress={checkoutFormattedAddress}
            appliedCoupon={appliedCoupon}
            deliveryCharge={deliveryCharge}
            onEditRecipient={() => setCustomerView('recipient-details')}
            onEditAddress={() => setCustomerView('delivery-address')}
            onNext={() => setCustomerView('payment-method')}
            onBack={() => setCustomerView('delivery-address')}
          />
        );

      // Page 4: Payment Method -> Confirm Place Order -> Final Order Confirmation
      case 'payment-method':
        return (
          <PaymentMethodScreen
            initialPaymentMethod={checkoutPaymentMethod}
            onPaymentMethodChange={(method) => setCheckoutPaymentMethod(method)}
            subtotal={subtotal}
            deliveryCharge={deliveryCharge}
            appliedCoupon={appliedCoupon}
            orderId={checkoutSession.orderId}
            transactionRef={checkoutSession.transactionRef}
            recipient={checkoutRecipient}
            deliveryAddress={checkoutFormattedAddress}
            cartSignature={cartSignature}
            uploadedProof={uploadedPaymentProof}
            onProofUploaded={(proof) => setUploadedPaymentProof(proof)}
            onProofCleared={() => setUploadedPaymentProof(null)}
            onOrderSuccess={(order) => {
              setConfirmedOrder(order);
              setUploadedPaymentProof(null);
              setAppliedCoupon(undefined);
              setCheckoutSession(createCheckoutSession());
              setCustomerView('confirmation');
            }}
            onBack={() => setCustomerView('confirm-order')}
          />
        );

      // Final Order Confirmation
      case 'confirmation':
        return (
          <OrderConfirmationScreen
            order={confirmedOrder}
            onTrackOrder={() => setCustomerView('orders')}
            onContinueShopping={() => setCustomerView('storefront')}
          />
        );

      case 'orders':
        return (
          <CustomerOrdersScreen
            targetOrderId={confirmedOrder?.id || confirmedOrder?.orderId}
            onBack={() => setCustomerView('storefront')}
          />
        );

      case 'storefront':
      default:
        return (
          <StorefrontScreen
            onOpenCart={() => setCustomerView('cart')}
            onOpenOrders={() => setCustomerView('orders')}
            onBackToSelection={() => setActivePortal('selection')}
          />
        );
    }
  }

  return (
    <PortalSelectionScreen
      onSelectPortal={(portal) => setActivePortal(portal)}
    />
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <CartProvider>
          <MainNavigator />
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
