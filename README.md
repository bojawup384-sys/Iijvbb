# برق v6 Pro

مساعد للسوق الجزائري والعربي: محادثة بالدارجة والعربية والفرنسية، 10 أدوات جاهزة، نظام نقاط يومي، وترقية Pro بالدينار (v6: أدوات الكود، صانع الألعاب، رفع الملفات، أحدث النماذج).
تطبيق **PWA** — Next.js 16 · Firebase Auth · فريق AI موحّد (Claude + Gemini + DeepSeek + Grok + OpenRouter + Groq) · PostgreSQL (Drizzle) · Chargily Pay.

---

## 🚀 النشر على Vercel

1. ارفع المشروع إلى GitHub ثم **Import** في Vercel.
2. في **Settings → Environment Variables** أضف المتغيرات (انظر `.env.example`):

| المتغير | إلزامي؟ | الوصف |
|---|---|---|
| `DATABASE_URL` | ✅ | رابط PostgreSQL (Neon / Supabase / Vercel Postgres) |
| `GEMINI_API_KEY` | ✅ | مفتاح من [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `NEXT_PUBLIC_SITE_URL` | موصى به | نطاقك، مثل `https://barq.example.com` (sitemap وروابط المشاركة) |
| `ADMIN_SECRET` | موصى به | كلمة سرّ (12+ حرفًا) لإنشاء أكواد Pro بدون SQL |
| `CHARGILY_SECRET_KEY` | اختياري | الدفع عبر EDAHABIA / CIB |
| `CHARGILY_MODE` | اختياري | `live` (افتراضي) أو `test` |

3. **Deploy**، ثم **Redeploy** كلما غيّرت المتغيرات.

> ✅ **الجداول تُنشأ تلقائيًا** عند أول طلب — لا حاجة لـ `drizzle-kit push`.
> (اختياري للمطورين: `npm run db:push` يستعمل `DATABASE_URL` من بيئتك.)

### 🔎 تشخيص سريع

| الرابط | ماذا يخبرك |
|---|---|
| `/api/health` | هل قاعدة البيانات والمفتاح يعملان (يعرض سبب الخلل إن وُجد) |
| `/api/ai/status` | هل مفتاح Gemini موجود وهل قبلته Google (لا يعرض المفتاح) |

---

## 🎟️ أكواد تفعيل Pro

بدون SQL — اضبط `ADMIN_SECRET` ثم:

```bash
curl -X POST https://YOUR_DOMAIN/api/admin/promo \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"code":"BARQ-VIP","days":30,"maxUses":100}'
```

- كل مستخدم يستعمل الكود الواحد **مرة واحدة** فقط.
- `GET /api/admin/promo` (بنفس الهيدر) يعرض آخر 50 كودًا.

## 💳 الدفع عبر Chargily

1. سجّل في [pay.chargily.com](https://pay.chargily.com) وأضف `CHARGILY_SECRET_KEY`.
2. في لوحة Chargily → Webhooks أضف: `https://YOUR_DOMAIN/api/billing/webhook`
3. الأسعار: **990 دج/شهر** و**9900 دج/سنة** (في `src/app/api/billing/chargily/route.ts`).

---

## 🗂️ هيكل المشروع

```
src/
├─ app/
│  ├─ page.tsx              الصفحة الرئيسية (Landing)
│  ├─ tools/                صفحات الأدوات العامة (SEO)
│  ├─ privacy · terms       الخصوصية والشروط
│  ├─ login · signup        الدخول والتسجيل
│  ├─ app/                  التطبيق (محادثة، أدوات، سجل، ترقية، إعدادات)
│  ├─ api/
│  │  ├─ ai/                chat · tool · status
│  │  ├─ billing/           chargily · webhook · redeem
│  │  ├─ admin/promo        إنشاء أكواد Pro
│  │  └─ user · history · conversations · health
│  ├─ sitemap.ts · robots.ts
├─ components/              app/ · auth/ · landing/ + عناصر مشتركة
├─ db/                      schema.ts · index.ts (اتصال كسول) · ensure-schema.ts
└─ lib/
   ├─ gemini.ts             عميل Gemini (بث + احتياطي بين النماذج)
   ├─ server-auth.ts        تحقق رسمي من Firebase ID token (RS256 / JWKS)
   ├─ usage.ts              النقاط اليومية (ذرّية)
   ├─ http.ts               json() و serverError() و isUuid()
   ├─ rate-limit.ts         حد الطلبات (حماية من الضغط)
   ├─ firebase-config.ts    إعدادات Firebase (مشتركة بين العميل والسيرفر)
   ├─ site.ts               عنوان الموقع العام
   └─ i18n.tsx · tools.tsx · prompts.ts
public/                     manifest · sw.js · offline.html · icons/ · og.png · favicon.ico
```

## ✨ الميزات

- 🤖 محادثة ببث مباشر + سجل + حذف
- 🛠️ 10 أدوات: وصف منتجات، منشورات، مترجم دارجة، تلخيص، CV، إيميلات، مساعد باك، أفكار مشاريع، ردود زبائن، إعادة صياغة
- 🌍 3 لغات (RTL/LTR تلقائي)
- 🎟️ 20 نقطة/يوم مجانًا (بتوقيت الجزائر)، Pro غير محدود
- 🔐 Firebase Auth: إيميل + Google
- 📱 PWA: تثبيت، أيقونات، Service Worker، صفحة Offline
- 🔎 SEO: sitemap، robots، JSON-LD، صفحات عامة لكل أداة

## 👑 ميزات v6 Pro (للمشتركين فقط)

| الميزة | التفاصيل |
|---|---|
| ⚡ أحدث النماذج + سرعة فائقة | مجاني: نماذج Flash المستقرة. Pro: أحدث Flash (حتى الـ preview) مع **طلبات متوازية** (إذا تأخر نموذج يبدأ التالي ويفوز الأسرع). `src/lib/gemini.ts` |
| 🧠 تفكير عميق | زر في المحادثة: أقوى نموذج Pro متاح بدل الأسرع |
| 🖼️ رفع الصور وPDF والكود | زر 📎 أو لصق صورة. الصور تُصغَّر في المتصفح (1600px)، حتى 4 ملفات / ≈3MB. `src/lib/attachments.ts` |
| 🛠️ 7 أدوات جديدة | مراجعة الكود، مصلح الأخطاء، شرح الكود، محوّل اللغات، فحص الأمان، كاتب الاختبارات، **صانع الألعاب** (`PRO_TOOLS` في `src/lib/tools.tsx`) |
| 🎮 صانع الألعاب | لعبة HTML كاملة بمعاينة حيّة (iframe معزول + CSP يمنع الشبكة) وتحميل `.html` |
| ▶️ معاينة أي كود HTML | أي بلوك ```html في المحادثة يحصل على زر معاينة |
| 🎤 إدخال صوتي · 📥 تصدير المحادثة `.md` · 📋 نسخ/تحميل كل بلوك كود | |

التحقق من الاشتراك يتم **في السيرفر** (`403 PRO_ONLY`) ولا يعتمد على الواجهة. حدود الطلبات: 30/دقيقة لـ Pro و15 للمجاني.

> ⏱️ توليد لعبة كبيرة قد يقترب من حد `maxDuration = 60` في Vercel Hobby. على خطة أعلى ارفعه في `src/app/api/ai/tool/route.ts`.

## 🤝 فريق الذكاء الاصطناعي الموحّد (Pro)

أضف أي مفاتيح تملكها (`ANTHROPIC_API_KEY` · `GEMINI_API_KEY` · `DEEPSEEK_API_KEY` · `XAI_API_KEY` · `OPENROUTER_API_KEY` · `GROQ_API_KEY`) — كل محرّك له مفتاح ينضم تلقائيًا.

1. **المسوّدات بالتوازي**: كل محرّك يكتب نسخته الكاملة (مع نصاب: بعد وصول مسوّدتين، يُمنح الباقي 15 ثانية فقط).
2. **الدمج**: المحرّك القائد (الافتراضي Claude، غيّره بـ `BARQ_LEAD`) يدمج أقوى ما في كل المسوّدات ويصلح الأخطاء. إن سقط القائد يتولّى التالي تلقائيًا.
3. **ترميم القطع**: إن انقطع الكود بسبب حد التوكنات يُكمَّل ويُغلق (`</html>` + إغلاق الكتلة) تلقائيًا.

يُفعَّل في: «صانع الألعاب» وطلبات البناء (لعبة / موقع / تطبيق) في المحادثة. مواصفات الملف الواحد (HTML واحد، محرّك واحد، حالات MENU→PLAYING→PAUSED→GAME OVER، صوت Web Audio، localStorage، لمس + كيبورد) مدمجة في `src/lib/prompts.ts` (`WEB_SPEC`). التشخيص: `/api/ai/status` يعرض أسماء المحرّكات المتصلة.

## 🛡️ الأمان

- التحقق من توكن Firebase بالتوقيع (RS256) مع فحص `exp` و`aud` و`iss`.
- خصم النقاط بعملية SQL واحدة (لا تجاوز بالطلبات المتزامنة).
- أكواد الترقية: استعمال واحد لكل مستخدم + حجز ذرّي لعدد الاستعمالات.
- Webhook بتوقيع HMAC، وتفعيل الاشتراك مرة واحدة فقط لكل دفعة.
- الأخطاء الداخلية تُسجَّل في سجلات Vercel ولا تُرسل للمتصفح.
- حد 15 طلب ذكاء/دقيقة لكل مستخدم.

---

صُنع بحب في الجزائر 🇩🇿⚡
