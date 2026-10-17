# DailyExample

Expo SDK 58 app for trying `react-native-daily-core`. Node 22.13 or newer.

```bash
npm install
cp daily.env.json.example daily.env.json
npm run ios
npm run android
```

`expo run` generates `ios/` and `android/` locally. Those folders are gitignored. For a device build, set the Apple Development team in Xcode after the first prebuild. Do not commit that signing change.
