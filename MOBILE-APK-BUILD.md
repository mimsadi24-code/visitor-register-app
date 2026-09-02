# Harbor Visitor Register — APK package

এই project-এ Android APK বানানোর জন্য Capacitor configuration এবং GitHub Actions workflow যোগ করা হয়েছে। Capacitor একটি existing web app-কে Android native container-এ নেওয়ার official পথ।

## সবচেয়ে সহজ উপায়

1. এই ZIP-টি GitHub repository হিসেবে upload করুন।
2. GitHub-এর **Actions** tab খুলুন।
3. **Build Android APK** workflow নির্বাচন করুন।
4. **Run workflow** চাপুন।
5. Build শেষ হলে **harbor-visitor-register-debug-apk** artifact থেকে `app-debug.apk` নিন।
6. Android ফোনে APK install করুন।

কোনো Android Studio দরকার নেই। Build GitHub-এর server-এ হবে।

## গুরুত্বপূর্ণ

- App-এর offline/local-first visitor saving ইতিমধ্যে project-এ আছে।
- APK-তে local data device-এই থাকবে।
- Remote server sync চালাতে হলে API base URL configure করতে হবে; বর্তমান project-এ default API path relative (`/api`)।
- এই package-এর workflow CI-তে Capacitor Android project তৈরি করে, তাই ZIP-এর ভিতরে বিশাল generated `android/` folder রাখা হয়নি।

## Capacitor config

`artifacts/visitor-register/capacitor.config.ts`

App ID: `com.harbor.visitorregister`
App name: `Harbor Visitor Register`
