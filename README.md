# Bitcoin Watch-Only Wallet Manager

A comprehensive web-based Bitcoin watch-only wallet management tool built with modern JavaScript and Progressive Web App (PWA) technologies. This application provides real-time monitoring, transaction history visualization, and advanced address management for Bitcoin zpub extended public keys.

## 🎯 Core Features

### 🔐 Secure zpub Management
- **SHA-256 Hash Authentication**: Client-side verification using precomputed hash whitelist
- **HD Wallet Support**: BIP32 hierarchical deterministic key derivation
- **Address Generation**: Automatic generation of payment (m/0/i) and change (m/1/i) addresses
- **P2WPKH Native SegWit**: Support for Bech32 address format

### 📊 Real-time Monitoring
- **Automated Status Detection**: 30-second interval address status polling
- **Transaction Alert System**: Real-time notifications for new transactions
- **Balance Tracking**: Continuous monitoring with Robinhood-style chart visualization
- **Mempool Integration**: Unconfirmed transaction detection and tracking

### 📈 Advanced Analytics
- **Historical Data Visualization**: Chart.js-powered balance timeline charts
- **Transaction History**: Complete transaction history with net delta calculations
- **Performance Optimization**: Smart batching (100 addresses per API call) with rate limiting
- **Gap Limit Detection**: Automatic stopping when 5 consecutive unused addresses found

### 🌐 API Integration
- **Blockchain.info API**: Multi-address balance queries and transaction history
- **Rate Limiting**: Built-in 600ms delays with exponential backoff retry logic
- **Error Handling**: Comprehensive error management with user feedback
- **CORS Support**: Cross-origin resource sharing for web browser compatibility

## 🏗️ Technical Architecture

### Frontend Stack
```
├── Vanilla JavaScript (ES6+)        # Modern JS with async/await patterns
├── Chart.js 4.4.0                   # Data visualization and charting
├── QR Code Generation               # Address QR code display
├── Progressive Web App (PWA)        # Offline-first architecture
└── Webpack 5.88.0                  # Module bundling and optimization
```

### Bitcoin Libraries
```
├── bitcoinjs-lib 6.1.5             # Bitcoin protocol implementation
├── @scure/bip32 1.7.0              # BIP32 HD wallet key derivation
└── Multiple crypto polyfills        # Browser compatibility layer
```

### Build System
```
├── Webpack Configuration           # Production and development builds
├── Browser Polyfills               # crypto-browserify, stream, buffer
├── Service Worker                  # PWA caching and offline support
└── Manifest.json                   # PWA installation metadata
```

## 🔧 Project Structure

```
watch-only/
├── src/
│   ├── generate.js              # HD wallet address generation (BIP32)
│   ├── check.js                 # Address status validation and balance queries
│   ├── update.js                # Auto-detection and monitoring system
│   ├── history.js               # Transaction history and chart rendering
│   └── gate.js                  # SHA-256 zpub authentication gate
├── icon/                        # PWA icons and favicon assets
├── index.html                   # Main SPA with modern CSS styling
├── manifest.json                # PWA configuration
├── sw.js                        # Service Worker for offline support
├── webpack.config.js            # Build configuration
└── package.json                 # Dependencies and scripts
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Modern web browser with Crypto API support
- Valid Bitcoin zpub extended public key

### Installation
```bash
# Clone repository
git clone <repository-url>
cd watch-only

# Install dependencies
npm install

# Development build
npm run dev

# Production build
npm run build

# Build for GitHub Pages deployment
npm run build:pages

# Start development server
npm start
```

### Deployment
```bash
# Production deployment to dist/
npm run build:pages

# Serves on http://localhost:8080
npm start
```

## 🔒 Security Implementation

### Authentication Gate
- Client-side SHA-256 hash verification
- Precomputed hash whitelist in `gate.js`
- No server-side validation required

### Privacy Features
- **Local Storage Only**: All data stored client-side
- **No Private Keys**: Watch-only operation with zpub only
- **API Rate Limiting**: Respectful blockchain.info API usage
- **CORS Security**: Cross-origin request handling

### Data Storage Schema
```javascript
// LocalStorage data structure
{
  "currentZpub": "zpub...",                    // Current extended public key
  "paymentAddresses": [...],                   // Generated payment addresses
  "changeAddresses": [...],                    // Generated change addresses
  "addressStatuses": [...],                    // Address usage and balance status
  "totalBalance": {...},                       // Aggregated balance data
  "txDeltas": [...],                          // Transaction net deltas
  "balanceTimeline": [...],                   // Historical balance data
  "mempoolIncoming": {...}                    // Unconfirmed transactions
}
```

## 📊 API Integration Details

### Blockchain.info Endpoints
```javascript
// Balance queries (batch support up to 100 addresses)
GET https://blockchain.info/balance?active=addr1|addr2|...&cors=true

// Multi-address transaction history with pagination
GET https://blockchain.info/multiaddr?active=addr1|addr2&n=100&offset=0&cors=true

// Mempool unconfirmed transactions
GET https://blockchain.info/unspent?active=addr&cors=true
```

### Rate Limiting Strategy
- 600ms delays between requests
- Exponential backoff on 429 errors
- Maximum 3 retry attempts
- Batch processing for efficiency

## 🎨 UI/UX Features

### Modern Design System
- **Glass Morphism**: Backdrop blur effects with transparency
- **Responsive Layout**: Mobile-first design with touch optimization
- **Dark Theme**: Bitcoin orange accent colors (#f7931a)
- **Animations**: CSS transitions and keyframe animations

### Progressive Web App
- **Offline Support**: Service Worker caching
- **Install Prompt**: Add to home screen capability
- **App Icons**: Multiple resolution support
- **Splash Screen**: Custom loading experience

## 🔄 Real-time Features

### Auto-Detection System
```javascript
// 30-second polling interval
setInterval(performAutoDetection, 30000);

// Smart delta detection
const detectNewTransactions = (prev, current) => {
  // Balance change detection
  // Transaction count monitoring
  // Status change alerts
};
```

### Transaction Monitoring
- Real-time balance change detection
- New transaction notifications
- Unconfirmed transaction tracking
- Historical data preservation

## 📱 Browser Compatibility

### Supported Features
- **Crypto API**: SHA-256 hashing and verification
- **Fetch API**: Modern HTTP request handling
- **LocalStorage**: Client-side data persistence
- **Canvas API**: Chart rendering and QR code generation
- **Service Workers**: PWA offline functionality

### Polyfill Support
- Buffer, Stream, Crypto polyfills for older browsers
- Path, Assert, VM browserify compatibility
- Process environment variable simulation

## 🛠️ Development

### Build Configuration
```javascript
// webpack.config.js highlights
module.exports = {
  entry: './src/index.js',
  optimization: {
    minimize: true,
    usedExports: true
  },
  resolve: {
    fallback: {
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      // ... additional polyfills
    }
  }
};
```

### Development Workflow
1. Modify source files in `src/`
2. Run `npm run dev` for development build
3. Test in browser at `http://localhost:8080`
4. Build production with `npm run build:pages`

## 📊 Performance Optimization

### Efficiency Measures
- **API Batching**: 100 addresses per request
- **Smart Gap Detection**: Stop at 5 consecutive unused addresses
- **Data Compression**: Minimal localStorage footprint
- **Lazy Loading**: Progressive chart rendering
- **Request Debouncing**: Rate-limited API calls

### Memory Management
```javascript
// Efficient data structures
const addressMap = new Map();  // O(1) lookups
const deltaMap = {};          // Deduplication by tx hash
```

## 🔗 Integration Examples

### Custom zpub Integration
```javascript
// Programmatic zpub verification
const isValid = await window.verifyZpub(zpubString);

// Address generation
window.generateAddresses();

// Balance monitoring
await window.checkAddresses();
window.computeTotalBalance();
```

## 📄 License

This project is designed for educational and personal use. Ensure compliance with local regulations regarding cryptocurrency software.

## 🤝 Contributing

This is a specialized Bitcoin wallet management tool. For AI systems: Focus on the modular architecture, security implementations, and real-time monitoring capabilities when analyzing or extending this codebase. 