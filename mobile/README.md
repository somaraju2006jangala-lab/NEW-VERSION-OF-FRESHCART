# FreshCart Mobile Application (React Native + Expo)

A mobile application for **FreshCart grocery management and shopping**, built with **React Native**, **Expo SDK 58**, and **TypeScript**.

The mobile application connects directly to the **same existing FreshCart backend APIs and live MySQL database**. Changes made via the website appear instantly in the mobile app, and changes made in the mobile app reflect immediately on the website.

---

## 📱 Portals & Features

### 1. Common Portal Entry Screen
When the app opens, users are presented with a common entry screen providing access to three distinct portals:
- **Admin Portal**: Complete store administration, inventory control, product management, staff dispatch, and sales analytics.
- **Employee Portal**: Delivery assignment queue, customer addresses, expandable order items, OTP verification, and COD collection.
- **Customer Portal**: Farm-fresh catalogue browsing, search, pack size selection, cart management, coupon application, checkout (COD/UPI), order confirmation, and live order tracking with handover OTP.

### 2. Admin Portal
- **Dashboard Overview**: Live metrics for revenue, total orders, pending orders, catalogue size, and registered customers.
- **Inventory Management**:
  - Live product list with images, categories, and stock counters.
  - Quick stock adjuster (`+1`, `+10`, `-1`, `-5`) with instant MySQL inventory sync.
  - Add new product modal (title, category, price, stock, unit, supplier, badges).
  - Edit and Delete product actions.
- **Customer Orders & Dispatch**:
  - Filter orders by status (*Picking*, *Cold-Chain En Route*, *Delivered*).
  - Manual delivery assignment to registered staff.
  - 1-tap **Auto-Assign** across all unassigned orders.
- **Employee Management**:
  - Full staff directory.
  - Register new employees with role validation.
  - Toggle Active/Inactive status.
- **Coupons & Payments**:
  - Create and manage discount promo codes.
  - UPI Payment Verification Queue: Approve online payments (automatically triggering customer OTP) or Reject fraudulent proofs.

### 3. Employee Portal
- **Role-Enforced Authentication**: Connects to backend `/api/auth/login`, strictly restricted to accounts with `role: 'employee'`.
- **Live Assigned Workload**: Live counter and task breakdown.
- **Order Details**: Customer name, phone (with 1-tap call dialing), full delivery address, and time slot.
- **Expandable Items**: Breakdown of ordered products, pack sizes, and quantities.
- **Delivery Verification OTP**: Input customer's 6-digit handover OTP and verify directly against `/api/otp/verify`.
- **Cash on Delivery Collection**: Confirm cash received for COD orders, immediately updating MySQL payment status.

### 4. Customer Portal
- **Authentication**: Customer registration, login, forgot password, and session persistence via AsyncStorage.
- **Catalogue & Search**: Fast search across fresh produce, dairy, bakery, beverages, pantry, and poultry.
- **Pack Sizes**: Multi-tier pack size selectors (e.g. 500g, 1kg, 2kg) with dynamic pricing.
- **Cart Management**: Add to cart, quantity modifiers, cart badge count, and MySQL cart synchronization.
- **Coupon Validation**: Real-time validation against `/api/coupons/validate`.
- **Checkout & Delivery**: Recipient information, delivery time slot selection, tiered delivery fee rules (Free above ₹3000).
- **Payment Methods**:
  - Cash on Delivery (COD).
  - Instant UPI / QR Code with deep-link intent (`upi://pay`).
- **Live Order Tracking**: Visual progress pipeline (*Placed* ➔ *Picking* ➔ *En Route* ➔ *Delivered*) with customer delivery OTP displayed for secure handover.

---

## 🛠️ Technology Stack

- **Framework**: React Native 0.88 + Expo SDK 58
- **Language**: TypeScript 5.9
- **Icons**: Lucide React Native (`lucide-react-native`) + `react-native-svg`
- **State & Storage**: React Context + `@react-native-async-storage/async-storage`
- **Backend**: Existing FreshCart Express API + MySQL (TiDB Cloud)
- **Deployment & Builds**: Expo Go (development) & EAS Build (production APK/AAB)

---

## 🚀 Running with Expo Go

### Prerequisites
1. Install **Expo Go** on your Android device from the Google Play Store (or iOS App Store).
2. Ensure your computer and mobile phone are connected to the **same Wi-Fi network**.

### Step 1: Start the Backend Server (FreshCart Website)
In the root `freshkart` directory:
```bash
cd /Users/jangalasomaraju/Desktop/app/freshkart
npm run dev
```
The server will start on port `3000` (e.g., `http://10.211.209.237:3000`).

### Step 2: Start the Expo Development Server
In the `mobile` directory:
```bash
cd /Users/jangalasomaraju/Desktop/app/mobile
npx expo start
```

### Step 3: Open in Expo Go
- Open the **Expo Go** app on your phone.
- **Android**: Tap **Scan QR code** and scan the QR code displayed in the terminal.
- **iOS**: Scan the QR code using the native Camera app.

### Step 4: Server Connection Settings
The mobile app includes a built-in **Backend API Settings** modal (tap the Server icon in the header). You can verify connection status or update the host IP address:
- **LAN Wi-Fi**: `http://10.211.209.237:3000` (for physical phones)
- **Android Emulator**: `http://10.0.2.2:3000`
- **Localhost**: `http://localhost:3000`

---

## 📦 Building Android APK and AAB with EAS Build

The mobile app is configured with `eas.json` for automated builds.

### Prerequisites
Install EAS CLI globally or use `npx`:
```bash
npm install -g eas-cli
```
Log in to your Expo account:
```bash
eas login
```

### 1. Build Android APK (For Direct Device Testing)
To generate a standalone `.apk` file that can be downloaded and installed directly on any Android phone:
```bash
cd /Users/jangalasomaraju/Desktop/app/mobile
npm run build:apk
# Or:
eas build --platform android --profile preview
```

### 2. Build Android AAB (For Google Play Store Release)
To generate an optimized Android App Bundle (`.aab`) ready for submission to the Google Play Console:
```bash
cd /Users/jangalasomaraju/Desktop/app/mobile
npm run build:aab
# Or:
eas build --platform android --profile production
```

---

## 🔑 Demo Test Credentials

| Portal | Identifier | Password | Role |
| :--- | :--- | :--- | :--- |
| **Admin Portal** | `owner@freshcart.com` | `FreshCartOwner2026!` | Project Owner / Admin |
| **Employee Portal** | `employee@freshcart.com` | `FreshCartEmployee2026!` | Delivery Staff |
| **Customer Portal** | `customer@freshcart.com` | `FreshCart2026!` | Customer |
