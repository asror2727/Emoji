# Premium Emoji Maker Bot

Telegram uchun Premium Emoji Maker Bot. Foydalanuvchi tayyor shablon (custom emoji)
ustiga o'z ismini yozdiradi va Telegram Stars orqali to'lov qilib, yangi custom
emoji sticker pack oladi.

## 1. Texnologiyalar

- Node.js + Express (Render health-check uchun)
- node-telegram-bot-api (polling rejimida)
- Telegram Bot API (`getCustomEmojiStickers`, `uploadStickerFile`,
  `createNewStickerSet`, `addStickerToSet`)
- sharp (statik rasm ustiga matn qo'yish)
- pako (TGS/Lottie gzip siqish-yozish)
- ffmpeg (WEBM video emoji uchun, faqat Docker deployda)

## 2. O'rnatish (lokal)

```bash
git clone <repo-url>
cd emoji-bot
npm install
```

`.env` fayl **kerak emas** — barcha sozlamalar environment variable orqali
beriladi (pastga qarang). Lokal test uchun terminalda export qilib bo'ladi:

```bash
export BOT_TOKEN=123456:AAAA...
export ADMIN_ID=123456789
npm start
```

## 3. Environment Variables

| Nomi         | Tavsif                                              |
|--------------|------------------------------------------------------|
| `BOT_TOKEN`  | @BotFather'dan olingan bot tokeni                    |
| `ADMIN_ID`   | Sizning Telegram ID'ingiz (bepul buyurtma + admin panel) |
| `PORT`       | Render avtomatik beradi, qo'lda kerak emas           |

O'z Telegram ID'ingizni bilish uchun botga `/id` yozing.

## 4. GitHub'ga joylash

```bash
git init
git add .
git commit -m "Premium Emoji Maker Bot"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

## 5. Render.com'ga deploy qilish

Botda **WEBM video emoji** generatsiyasi ishlashi uchun serverda `ffmpeg` va
shrift fayllari kerak. Render'ning standart Node.js muhitida (Native
Environment) `apt-get` orqali paket o'rnatib bo'lmaydi, shuning uchun bu loyiha
**Docker** orqali deploy qilinishi kerak (repo ichida tayyor `Dockerfile` bor).

1. Render.com'da **New + → Web Service** tugmasini bosing.
2. GitHub repo'ingizni ulang.
3. **Environment** qismida `Docker` ni tanlang (Render `Dockerfile`ni
   avtomatik topadi).
4. **Environment Variables** bo'limiga qo'shing:
   - `BOT_TOKEN`
   - `ADMIN_ID`
5. **Create Web Service** bosing.

> Agar sizga faqat **statik** va **TGS (animatsion)** shablonlar kerak bo'lsa
> (WEBM kerak bo'lmasa), Docker shart emas — Render'ning oddiy Node
> environment'ida ham (`Build: npm install`, `Start: npm start`) ishlaydi,
> chunki sharp va pako sof Node paketlari.

## 6. Telegram Stars qanday ishlaydi

- To'lov `sendInvoice` orqali `currency: "XTR"`, `provider_token: ""` bilan
  yuboriladi — Payme/Click yoki boshqa provayder shart emas.
- `pre_checkout_query` avtomatik tasdiqlanadi (buyurtma va foydalanuvchi
  tekshirilgandan keyin).
- Faqat `successful_payment` kelgandan so'ng buyurtma `paid` deb belgilanadi
  va generatsiya boshlanadi.
- `ADMIN_ID` egasi uchun to'lov chiqmaydi — u to'g'ridan-to'g'ri
  "👑 BEPUL YASASH" tugmasi orqali generatsiya qilishi mumkin.

## 7. Admin buyruqlari

- `/pul` — Stars narxini o'zgartirish. Yangi narx `data/settings.json`
  faylida saqlanadi va server qayta ishga tushsa ham yo'qolmaydi.
- `/orders` — oxirgi 10 ta buyurtmani ko'rsatadi.
- `/stats` — umumiy statistika (userlar, buyurtmalar, to'langanlar, Stars,
  yaratilgan emoji soni).
- `/id` — o'z Telegram ID'ingizni ko'rsatadi (har kim uchun ochiq).

> **Diqqat (Render disk):** Render'ning bepul/standart web service disklari
> **ephemeral** — har yangi deploy'da fayllar tozalanadi. Agar narx va
> buyurtmalar tarixi doimiy saqlanishi shart bo'lsa, Render'da **Persistent
> Disk** ulang (Render dashboard → Disks) va `data/` papkasini shu diskka
> mount qiling, aks holda faqat qayta deploy qilinganda ma'lumot tozalanadi
> (oddiy restart'da esa saqlanadi).

## 8. Custom emoji → shablon jarayoni qanday ishlaydi

1. `getCustomEmojiStickers([emoji_id])` orqali shablon custom emoji'ning
   `Sticker` obyekti (shu jumladan `file_id`, `is_animated`, `is_video`)
   olinadi.
2. `getFile` + fayl yuklab olish orqali original fayl (`static webp/png`,
   `.tgs`, yoki `.webm`) yuklab olinadi.
3. Format aniqlanadi va tegishli generator ishga tushadi
   (`generator/static.js`, `generator/tgs.js`, `generator/webm.js`).
4. Natija `uploadStickerFile` orqali Telegram serveriga yuklanadi.
5. `createNewStickerSet` (`sticker_type: "custom_emoji"`) orqali
   foydalanuvchi nomidan (`user_id`) yangi shaxsiy custom emoji pack
   yaratiladi va foydalanuvchiga
   `https://t.me/addemoji/<pack_short_name>` link yuboriladi.

### Muhim texnik cheklov: TGS (animatsion) matn

Lottie/TGS formatida "haqiqiy" vektor matn faqat maxsus text-layer orqali
qo'llab-quvvatlanadi va uning render natijasi klientdagi shriftlarga bog'liq
bo'lib, barcha qurilmalarda bir xil ko'rinishga **kafolat bermaydi**. Shu
sababli bu botda ishonchli va barqaror ishlaydigan yondashuv qo'llanildi:
matn serverda PNG (shaffof fon) sifatida chizib olinadi va Lottie ichiga
`image asset + image layer` sifatida qo'shiladi. Natijada fon animatsiyasi
davom etadi, matn esa doim bir xil, aniq ko'rinishda ustida turadi (lekin
o'zi harakatlanmaydi). Agar sizga matnning ham vektor shaklda
animatsiyalanishi kerak bo'lsa, bu alohida, ancha murakkab ish (har bir harf
uchun shrift glyph'ini vektor path'ga aylantirish) bo'lib, keyingi bosqichda
qo'shimcha talab sifatida ishlab chiqilishi kerak.

### WEBM video emoji

`ffmpeg`ning `drawtext` filtri orqali matn qo'yiladi, `libvpx-vp9` +
`yuva420p` bilan alpha-channel saqlanadi. Bu **faqat** serverda `ffmpeg`
o'rnatilgan bo'lsa ishlaydi — shuning uchun Render'da Docker deploy shart
(yuqoridagi 5-bo'limga qarang).

### Agar original faylni olib bo'lmasa

Agar Telegram API custom emoji'ning original faylini berishni rad etsa
(masalan, ID noto'g'ri yoki fayl mavjud emas), bot foydalanuvchiga:

```
❌ Template faylini olish imkoni bo'lmadi
```

deb yozadi va konsolga/admin chatiga `CUSTOM_EMOJI_ERROR` sababi bilan to'liq
xatolik yuboradi — jarayon shu yerda halol to'xtaydi, soxta natija
qaytarilmaydi.

## 9. Papka strukturasi

```
emoji-bot/
├── index.js
├── package.json
├── Dockerfile
├── README.md
├── .gitignore
├── data/
│   ├── settings.json
│   └── orders.json
├── generator/
│   ├── index.js
│   ├── static.js
│   ├── tgs.js
│   └── webm.js
└── utils/
    ├── telegram.js
    ├── storage.js
    └── helpers.js
```

## 10. Yangi shablon qo'shish

1. `index.js` ichidagi `EMOJIS` obyektiga yangi qator qo'shing:
   ```js
   yangi_key: { key: "yangi_key", name: "Nomi", id: "CUSTOM_EMOJI_ID" }
   ```
2. `getStartKeyboard()` funksiyasiga yangi tugma qo'shing:
   ```js
   { text: "Nomi", callback_data: "emoji_yangi_key" }
   ```

Boshqa hech narsani o'zgartirish shart emas — qolgan hamma joy (`/start`,
generator, to'lov, pack yaratish) avtomatik ishlaydi.
