# نغمة — Naghma

مشغل موسيقى وقرآن لأندرويد بواجهة عربية/إنجليزية: قوائم تشغيل، فصل الموسيقى عن القرآن، معادل صوت، ثيمات متعددة، ترتيب بالسحب، وغيرها.
تطبيق مستقل (React + Vite + Capacitor)، يعمل بالكامل على الجهاز بدون خوادم.

## التثبيت المباشر من GitHub

1. ارفع المشروع إلى مستودع GitHub (فرع `main`)، مع التأكد من وجود الملف `.github/workflows/main.yml`.
2. عند كل رفع إلى `main` يُبنى التطبيق تلقائياً (تبويب **Actions**)، ويظهر الملف `Naghma.apk` في **Releases ← Naghma (latest)**.
3. نزّله على الهاتف وثبّته (فعّل «السماح بالتثبيت من هذا المصدر»).

لإصدار برقم محدد: `git tag v1.0.0 && git push origin v1.0.0`.

## التطوير محلياً

```sh
npm install
npm run dev            # تشغيل في المتصفح
npm test               # الاختبارات
npm run android:sync   # بناء الويب ومزامنته مع مشروع أندرويد
npm run android:open   # فتح Android Studio
```

المتطلبات: Node 22+، وJDK 21 لبناء APK محلياً.

## ملاحظات

- **مفتاح التوقيع**: `android/app/naghma-release.jks` مرفق ليعمل البناء مباشرة. للاستخدام الشخصي لا بأس بذلك؛ لو أردت مفتاحك الخاص
  فاستبدله وعدّل كلمات المرور، أو مرّر `ANDROID_KEYSTORE_PATH` و`ANDROID_KEYSTORE_PASSWORD` و`ANDROID_KEY_ALIAS` و`ANDROID_KEY_PASSWORD` كمتغيرات بيئة.
- **المعرّف**: `com.naghma.player` (في `capacitor.config.ts` و`android/app/build.gradle`).
- **المكتبة**: الملفات الصوتية تُخزَّن داخل قاعدة بيانات التطبيق (IndexedDB) بعد اختيارها من الهاتف.
