# أسطورة المحاسبة — Legend of Accounting (Google Play Store Release Guide)

- **App Name**: أسطورة المحاسبة - Legend of Accounting
- **Package Name**: `com.ostora.accounting`
- **Version**: `1.0.0` (Version Code `1`)
- **Developer**: Ostora Systems

## 1. Play Store Visual Assets Specification
- **Launcher Icon (512 x 512 px, 32-bit PNG/JPG)**: Deep emerald (`#0A3D2C`) rounded square featuring a brushed gold (`#C9A227`) geometric shield framing balanced ledger pillars and an upward growth trajectory. Adaptive foreground/background XMLs are configured in `android/app/src/main/res/mipmap-anydpi-v26/`.
- **Feature Graphic (1024 x 500 px)**: Wide emerald architectural canvas (`#0A3D2C` to `#051F16`) with fine gold ledger gridlines on the left, clean gold shield emblem on the right, and high-contrast Arabic/English store title overlay ("أسطورة المحاسبة · نظام ERP مالي متكامل").

## 2. Generate Upload Keystore & Build Signed AAB
```bash
# 1. Create release keystore (run once)
keytool -genkey -v -keystore android/app/ostora-release-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias ostora_upload

# 2. Copy android/key.properties.example -> android/key.properties and fill passwords

# 3. Install dependencies & verify
flutter pub get
flutter analyze

# 4. Run on device/emulator
flutter run

# 5. Build Play Store Android App Bundle (.aab)
flutter build appbundle --release
# Output: build/app/outputs/bundle/release/app-release.aab
```
