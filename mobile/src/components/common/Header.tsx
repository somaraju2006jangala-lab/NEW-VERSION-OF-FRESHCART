import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar as RNStatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShoppingCart, LogOut, Server, Sparkles, ArrowLeft } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { ServerConfigModal } from './ServerConfigModal';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  showCart?: boolean;
  onCartPress?: () => void;
  portalBadge?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'FreshCart',
  subtitle,
  showBack = false,
  onBack,
  showCart = false,
  onCartPress,
  portalBadge,
}) => {
  const insets = useSafeAreaInsets();
  const { activePortal, setActivePortal, logout } = useAuth();
  const { itemCount } = useCart();
  const [showConfig, setShowConfig] = useState(false);

  const topPadding = Platform.OS === 'android'
    ? Math.max(insets.top, RNStatusBar.currentHeight || 0, 16)
    : Math.max(insets.top, 12);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.content}>
        {/* Left Side: Back or Brand */}
        <View style={styles.left}>
          {showBack ? (
            <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
              <ArrowLeft size={22} color="#166534" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => setActivePortal('selection')}
              style={styles.brandRow}
            >
              <View style={styles.logoBadge}>
                <Sparkles size={16} color="#fff" />
              </View>
              <View>
                <Text style={styles.brandTitle}>FreshCart</Text>
                {portalBadge ? (
                  <View style={styles.portalTag}>
                    <Text style={styles.portalTagText}>{portalBadge}</Text>
                  </View>
                ) : subtitle ? (
                  <Text style={styles.subtitle}>{subtitle}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Right Side: Server Config, Cart, Portal Switch */}
        <View style={styles.right}>
          {/* Server Config Ping */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setShowConfig(true)}
            accessibilityLabel="Server connection settings"
          >
            <Server size={18} color="#006b2c" />
          </TouchableOpacity>

          {/* Cart with count badge */}
          {showCart && (
            <TouchableOpacity style={styles.iconBtn} onPress={onCartPress}>
              <ShoppingCart size={20} color="#006b2c" />
              {itemCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{itemCount > 99 ? '99+' : itemCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* Logout / Switch Portal */}
          {activePortal !== 'selection' && (
            <TouchableOpacity
              style={styles.switchPortalBtn}
              onPress={() => logout()}
              accessibilityLabel="Switch Portal"
            >
              <LogOut size={16} color="#4b5563" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ServerConfigModal visible={showConfig} onClose={() => setShowConfig(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#006b2c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#006b2c',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
  },
  portalTag: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  portalTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#15803d',
    textTransform: 'uppercase',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  switchPortalBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
});
