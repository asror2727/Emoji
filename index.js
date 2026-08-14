const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

const storage = require("./utils/storage");
const helpers = require("./utils/helpers");
const tgApi = require("./utils/telegram");
const { generateEmoji } = require("./generator");

// =====================================================
// ENV
// =====================================================

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = String(process.env.ADMIN_ID || "");
const PORT = process.env.PORT || 3000;

if (!TOKEN) {
    console.error("❌ BOT_TOKEN topilmadi! Render Environment Variables bo'limida qo'shing.");
    process.exit(1);
}

if (!ADMIN_ID) {
    console.warn("⚠️ ADMIN_ID berilmagan! Admin buyruqlari ishlamaydi.");
}

// =====================================================
// BOT (POLLING)
// =====================================================

const bot = new TelegramBot(TOKEN, { polling: true });

let BOT_USERNAME = "your_bot";

bot.getMe()
    .then((me) => {
        BOT_USERNAME = me.username;
        console.log(`🤖 Bot username: @${BOT_USERNAME}`);
    })
    .catch((error) => {
        console.error("⚠️ getMe xato:", error.message);
    });

// =====================================================
// EXPRESS (RENDER UCHUN)
// =====================================================

const app = express();

app.get("/", (req, res) => {
    res.status(200).send("Emoji Bot ishlayapti ✅");
});

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", bot: "online" });
});

app.listen(PORT, () => {
    console.log(`🌐 Server ${PORT} portda ishlayapti`);
});

// =====================================================
// SHABLONLAR (CUSTOM EMOJI ID'LAR)
// Hozircha 4 tasi funksional. Yangi shablon qo'shish uchun
// shu obyektga qator qo'shish va getStartKeyboard()'ga
// tugma qo'shish yetarli.
// =====================================================

const EMOJIS = {
    kurs: { key: "kurs", name: "2-kurs", id: "5449752159283327567" },
    uyda: { key: "uyda", name: "Uyda", id: "5474236307548939628" },
    darsda: { key: "darsda", name: "Darsda", id: "5472185692593333530" },
    dollar: { key: "dollar", name: "Dollar", id: "5222126026536004111" }
};

const DISPLAY_NAMES = [
    "Jasur", "AXI", "SPAM", "MUNIS", "ASLIDDIN", "Millioner",
    "PAYSHANBA", "WORK", "Bekzod", "Bahor", "Great", "Muzlik",
    "HACK", "USDT", "VIP"
];

// =====================================================
// USER STATE (RAM). Agar bot qayta ishga tushsa, jarayon
// o'rtasidagi userlar reset bo'ladi — bu xavfsiz xatti-harakat,
// chunki to'lov holati orders.json'da alohida saqlanadi.
// =====================================================

const users = new Map();

function resetUser(chatId) {
    users.set(chatId, { step: "choose_emoji" });
}

function isAdmin(chatId) {
    return ADMIN_ID.length > 0 && String(chatId) === ADMIN_ID;
}

// =====================================================
// NARX (PERSISTENT)
// =====================================================

let settings = storage.loadSettings();

function getPrice() {
    return settings.price;
}

function setPrice(newPrice) {
    settings.price = newPrice;
    storage.saveSettings(settings);
}

// =====================================================
// ADMINGA XABAR / LOG YUBORISH
// =====================================================

async function notifyAdmin(text) {
    if (!ADMIN_ID) return;

    try {
        await bot.sendMessage(ADMIN_ID, text, { parse_mode: "HTML" });
    } catch (error) {
        console.error("⚠️ ADMINGA XABAR YUBORILMADI:", error.message);
    }
}

function customEmojiHtml(id, fallback = "✨") {
    return `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`;
}

// =====================================================
// START MATNI / TUGMALARI
// =====================================================

function getStartText() {
    const list = DISPLAY_NAMES.map((n) => `🔸 ${n}`).join("\n");

    return (
        "Assalomu alaykum! 👋\n\n" +
        "✨ <b>Emoji yasash botiga xush kelibsiz!</b>\n\n" +
        "Bu bot orqali o'zingizga chiroyli ism emoji yaratishingiz mumkin.\n\n" +
        "Quyidagi shablonlardan birini tanlang 👇\n\n" +
        `<b>Mavjud shablonlar:</b>\n\n${list}\n\n` +
        "<b>Nimani yasaymiz? 👇</b>"
    );
}

function getStartKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: "2-kurs", callback_data: "emoji_kurs" },
                { text: "Uyda", callback_data: "emoji_uyda" }
            ],
            [
                { text: "Darsda", callback_data: "emoji_darsda" },
                { text: "Dollar", callback_data: "emoji_dollar" }
            ]
        ]
    };
}

// =====================================================
// /START
// =====================================================

bot.onText(/^\/start$/, async (msg) => {
    const chatId = msg.chat.id;
    resetUser(chatId);

    try {
        await bot.sendMessage(chatId, getStartText(), {
            parse_mode: "HTML",
            reply_markup: getStartKeyboard()
        });
    } catch (error) {
        console.error("START ERROR:", error.message);
    }
});

// =====================================================
// CALLBACK QUERY
// =====================================================

bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    try {
        await bot.answerCallbackQuery(query.id);
    } catch (e) {}

    // ---------------- EMOJI TANLASH ----------------
    if (data.startsWith("emoji_")) {
        const key = data.replace("emoji_", "");
        const emoji = EMOJIS[key];

        if (!emoji) {
            await bot.sendMessage(chatId, "❌ Emoji topilmadi.");
            return;
        }

        users.set(chatId, { step: "name", emoji: key });

        await bot.sendMessage(
            chatId,
            `${customEmojiHtml(emoji.id)} <b>${emoji.name}</b>\n\n` +
                "So'zni yozing\n(maksimum 7 ta harf):",
            { parse_mode: "HTML" }
        );
        return;
    }

    // ---------------- ORQAGA ----------------
    if (data === "back_start") {
        resetUser(chatId);
        await bot.sendMessage(chatId, getStartText(), {
            parse_mode: "HTML",
            reply_markup: getStartKeyboard()
        });
        return;
    }

    // ---------------- TO'LOV / BEPUL YASASH ----------------
    if (data === "payment") {
        const user = users.get(chatId);

        if (!user || !user.emoji || !user.name || !user.packName) {
            await bot.sendMessage(
                chatId,
                "❌ Buyurtma topilmadi.\n/start ni bosing."
            );
            return;
        }

        const emoji = EMOJIS[user.emoji];

        if (!emoji) {
            await bot.sendMessage(chatId, "❌ Emoji topilmadi.");
            return;
        }

        // ---------- OWNER: BEPUL, DARHOL GENERATSIYA ----------
        if (isAdmin(chatId)) {
            const orderId = helpers.generateOrderId();

            const order = storage.addOrder({
                orderId,
                userId: chatId,
                emojiKey: user.emoji,
                emojiId: emoji.id,
                emojiName: emoji.name,
                text: user.name,
                packName: user.packName,
                price: 0,
                paymentStatus: "paid",
                telegramChargeId: "OWNER_FREE",
                createdAt: new Date().toISOString()
            });

            await bot.sendMessage(
                chatId,
                "👑 <b>Owner buyurtmasi qabul qilindi.</b>\n⏳ Tayyorlanmoqda...",
                { parse_mode: "HTML" }
            );

            await runGenerator(chatId, order);
            return;
        }

        // ---------- ODDIY USER: TELEGRAM STARS ----------
        const orderId = helpers.generateOrderId();

        const order = storage.addOrder({
            orderId,
            userId: chatId,
            emojiKey: user.emoji,
            emojiId: emoji.id,
            emojiName: emoji.name,
            text: user.name,
            packName: user.packName,
            price: getPrice(),
            paymentStatus: "pending",
            telegramChargeId: null,
            createdAt: new Date().toISOString()
        });

        const payload = JSON.stringify({ orderId });

        try {
            await bot.sendInvoice(
                chatId,
                "Premium Emoji",
                `${emoji.name} — ${user.name}`,
                payload,
                "", // provider_token — Telegram Stars uchun bo'sh bo'lishi shart
                "XTR",
                [{ label: "Premium Emoji", amount: getPrice() }]
            );
        } catch (error) {
            console.error("SEND INVOICE ERROR:", error.message);
            storage.updateOrder(orderId, { paymentStatus: "failed" });

            await bot.sendMessage(
                chatId,
                "❌ To'lov oynasini ochishda xatolik.\nIltimos, keyinroq qayta urinib ko'ring."
            );
        }

        return;
    }
});

// =====================================================
// TEXT XABARLAR (ism, pack nomi, admin narx)
// =====================================================

bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith("/")) return;

    const user = users.get(chatId);
    if (!user) return;

    // ---------------- ADMIN: NARX KIRITISH ----------------
    if (isAdmin(chatId) && user.step === "set_price") {
        const price = Number(text.trim());

        if (!Number.isInteger(price) || price < 0) {
            await bot.sendMessage(chatId, "❌ Faqat raqam yozing.\n\nMasalan: 2");
            return;
        }

        setPrice(price);
        users.delete(chatId);

        await bot.sendMessage(
            chatId,
            `✅ <b>Narx o'zgartirildi!</b>\n\n⭐ Yangi narx: <b>${price}</b>`,
            { parse_mode: "HTML" }
        );
        return;
    }

    // ---------------- ISM ----------------
    if (user.step === "name") {
        const check = helpers.validateText(text, 7);

        if (!check.valid) {
            await bot.sendMessage(
                chatId,
                check.reason === "too_long"
                    ? "❌ Maksimum 7 ta harf yozish mumkin."
                    : "❌ So'z yozing."
            );
            return;
        }

        user.name = check.value;
        user.step = "pack_name";
        users.set(chatId, user);

        await bot.sendMessage(
            chatId,
            "📦 <b>To'plam nomini yozing</b>\n\n(bu Telegram'da ko'rinadigan sarlavha bo'ladi):",
            { parse_mode: "HTML" }
        );
        return;
    }

    // ---------------- PACK NOMI ----------------
    if (user.step === "pack_name") {
        const check = helpers.validatePackTitle(text, 64);

        if (!check.valid) {
            await bot.sendMessage(
                chatId,
                check.reason === "too_long"
                    ? "❌ To'plam nomi maksimum 64 belgidan iborat."
                    : "❌ To'plam nomini yozing."
            );
            return;
        }

        user.packName = check.value;
        user.step = "payment";
        users.set(chatId, user);

        const emoji = EMOJIS[user.emoji];
        const price = getPrice();
        const isOwner = isAdmin(chatId);

        await bot.sendMessage(
            chatId,
            "🎨 <b>Buyurtma</b>\n\n" +
                `${customEmojiHtml(emoji.id)} <b>${emoji.name}</b>\n\n` +
                `👤 Ism: <b>${user.name}</b>\n` +
                `📦 Pack: <b>${user.packName}</b>\n\n` +
                (isOwner
                    ? "💰 Narx: <b>BEPUL</b>\n\n"
                    : `💰 Narxi: <b>⭐ ${price}</b>\n\n`) +
                "Tayyorlash uchun to'lov qiling:",
            {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: isOwner
                                    ? "👑 BEPUL YASASH"
                                    : `⭐ ${price} Stars to'lash`,
                                callback_data: "payment"
                            }
                        ],
                        [{ text: "⬅️ Orqaga", callback_data: "back_start" }]
                    ]
                }
            }
        );
        return;
    }
});

// =====================================================
// PRE-CHECKOUT
// =====================================================

bot.on("pre_checkout_query", async (query) => {
    try {
        let data;

        try {
            data = JSON.parse(query.invoice_payload);
        } catch (e) {
            await bot.answerPreCheckoutQuery(query.id, false, {
                error_message: "Buyurtma ma'lumoti noto'g'ri."
            });
            return;
        }

        const order = storage.getOrder(data.orderId);

        if (!order) {
            await bot.answerPreCheckoutQuery(query.id, false, {
                error_message: "Buyurtma topilmadi."
            });
            return;
        }

        // Faqat buyurtma egasi to'lay olsin
        if (String(order.userId) !== String(query.from.id)) {
            await bot.answerPreCheckoutQuery(query.id, false, {
                error_message: "Bu buyurtma sizga tegishli emas."
            });
            return;
        }

        await bot.answerPreCheckoutQuery(query.id, true);
    } catch (error) {
        console.error("PRE CHECKOUT ERROR:", error.message);

        try {
            await bot.answerPreCheckoutQuery(query.id, false, {
                error_message: "Xatolik yuz berdi."
            });
        } catch (e) {}
    }
});

// =====================================================
// SUCCESSFUL PAYMENT
// =====================================================

bot.on("message", async (msg) => {
    if (!msg.successful_payment) return;

    const chatId = msg.chat.id;
    const payment = msg.successful_payment;

    let data;

    try {
        data = JSON.parse(payment.invoice_payload);
    } catch (error) {
        console.error("PAYLOAD PARSE ERROR:", error.message);
        await bot.sendMessage(chatId, "✅ To'lov qabul qilindi!");
        return;
    }

    const order = storage.updateOrder(data.orderId, {
        paymentStatus: "paid",
        telegramChargeId: payment.telegram_payment_charge_id
    });

    if (!order) {
        console.error("ORDER NOT FOUND AFTER PAYMENT:", data.orderId);
        await bot.sendMessage(chatId, "✅ To'lov qabul qilindi!");
        return;
    }

    console.log("✅ PAYMENT SUCCESS:", order.orderId, payment.telegram_payment_charge_id);

    await bot.sendMessage(
        chatId,
        "✅ <b>To'lov muvaffaqiyatli!</b>\n\n⏳ Buyurtmangiz tayyorlanmoqda...",
        { parse_mode: "HTML" }
    );

    await runGenerator(chatId, order);
});

// =====================================================
// ASOSIY GENERATOR JARAYONI
// (custom emoji ID -> original fayl -> matn overlay -> yangi pack)
// =====================================================

async function runGenerator(chatId, order) {
    try {
        // 1) Original custom emoji ma'lumotini olish
        let stickers;

        try {
            stickers = await tgApi.getCustomEmojiStickers([order.emojiId]);
        } catch (error) {
            console.error("CUSTOM_EMOJI_ERROR (getCustomEmojiStickers):", error.message);
            await bot.sendMessage(chatId, "❌ Template faylini olish imkoni bo'lmadi");
            await notifyAdmin(
                `⚠️ CUSTOM_EMOJI_ERROR\nOrder: ${order.orderId}\n${error.message}`
            );
            return;
        }

        const stickerObject = stickers && stickers[0];

        if (!stickerObject) {
            console.error("CUSTOM_EMOJI_ERROR: sticker topilmadi", order.emojiId);
            await bot.sendMessage(chatId, "❌ Template faylini olish imkoni bo'lmadi");
            await notifyAdmin(
                `⚠️ CUSTOM_EMOJI_ERROR: sticker topilmadi\nOrder: ${order.orderId}`
            );
            return;
        }

        // 2) Original faylni yuklab olish
        let original;

        try {
            original = await tgApi.downloadOriginalSticker(stickerObject.file_id);
        } catch (error) {
            console.error("CUSTOM_EMOJI_ERROR (download):", error.message);
            await bot.sendMessage(chatId, "❌ Template faylini olish imkoni bo'lmadi");
            await notifyAdmin(
                `⚠️ CUSTOM_EMOJI_ERROR (download)\nOrder: ${order.orderId}\n${error.message}`
            );
            return;
        }

        // 3) Matnni shablon ustiga qo'shish (format bo'yicha)
        let generated;

        try {
            generated = await generateEmoji(stickerObject, original.buffer, order.text);
        } catch (error) {
            console.error("GENERATOR_ERROR:", error.message);
            await bot.sendMessage(
                chatId,
                "❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring."
            );
            await notifyAdmin(
                `⚠️ GENERATOR_ERROR\nOrder: ${order.orderId}\n${error.stack || error.message}`
            );
            return;
        }

        // 4) Sticker faylini Telegramga yuklash
        let uploaded;

        try {
            uploaded = await tgApi.uploadStickerFile(
                chatId,
                generated.buffer,
                generated.format,
                generated.fileName
            );
        } catch (error) {
            console.error("UPLOAD_STICKER_ERROR:", error.message);
            await bot.sendMessage(
                chatId,
                "❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring."
            );
            await notifyAdmin(
                `⚠️ UPLOAD_STICKER_ERROR\nOrder: ${order.orderId}\n${error.message}`
            );
            return;
        }

        // 5) Yangi custom emoji sticker set yaratish
        const packShortName = helpers.buildStickerSetName(
            chatId,
            order.emojiKey,
            order.text,
            BOT_USERNAME
        );

        try {
            await tgApi.createNewCustomEmojiStickerSet({
                userId: chatId,
                name: packShortName,
                title: order.packName,
                stickerFileId: uploaded.file_id,
                stickerFormat: generated.format,
                emojiList: ["✨"]
            });
        } catch (error) {
            console.error("CREATE_SET_ERROR:", error.message);
            await bot.sendMessage(
                chatId,
                "❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring."
            );
            await notifyAdmin(
                `⚠️ CREATE_SET_ERROR\nOrder: ${order.orderId}\n${error.message}`
            );
            return;
        }

        // 6) Muvaffaqiyatli — userga natija va linkni yuborish
        const packLink = `https://t.me/addemoji/${packShortName}`;

        storage.updateOrder(order.orderId, {
            paymentStatus: "completed",
            packShortName
        });

        await bot.sendMessage(
            chatId,
            "✅ <b>Tayyor!</b>\n\n" +
                `👤 ${order.text}\n` +
                `📦 ${order.packName}\n\n` +
                "🎨 Premium emoji tayyorlandi!",
            {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "➕ Emoji packni qo'shish", url: packLink }]
                    ]
                }
            }
        );

        users.delete(chatId);
    } catch (error) {
        // Kutilmagan har qanday xatolik uchun umumiy tutqich
        console.error("RUN_GENERATOR_UNEXPECTED_ERROR:", error);
        await bot.sendMessage(
            chatId,
            "❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring."
        );
        await notifyAdmin(
            `⚠️ RUN_GENERATOR_UNEXPECTED_ERROR\nOrder: ${order.orderId}\n${error.stack || error.message}`
        );
    }
}

// =====================================================
// /PUL — NARXNI O'ZGARTIRISH (FAQAT ADMIN)
// =====================================================

bot.onText(/^\/pul$/, async (msg) => {
    const chatId = msg.chat.id;

    if (!isAdmin(chatId)) {
        await bot.sendMessage(chatId, "❌ Siz admin emassiz.");
        return;
    }

    users.set(chatId, { step: "set_price" });

    await bot.sendMessage(
        chatId,
        `💰 <b>Hozirgi narx:</b> ⭐ ${getPrice()}\n\nNechi Stars qo'yasiz?`,
        { parse_mode: "HTML" }
    );
});

// =====================================================
// /ORDERS — FAQAT ADMIN
// =====================================================

bot.onText(/^\/orders$/, async (msg) => {
    const chatId = msg.chat.id;

    if (!isAdmin(chatId)) {
        await bot.sendMessage(chatId, "❌ Siz admin emassiz.");
        return;
    }

    const orders = storage.loadOrders().slice(-10).reverse();

    if (orders.length === 0) {
        await bot.sendMessage(chatId, "📦 Hozircha buyurtmalar yo'q.");
        return;
    }

    const statusEmoji = {
        pending: "⏳ PENDING",
        paid: "💳 PAID",
        completed: "✅ COMPLETED",
        failed: "❌ FAILED"
    };

    const lines = orders.map((o) => {
        return (
            `<b>${o.orderId}</b>\n` +
            `👤 ${o.text}\n` +
            `🎨 ${o.emojiName}\n` +
            `📦 ${o.packName}\n` +
            `⭐ ${o.price}\n` +
            `${statusEmoji[o.paymentStatus] || o.paymentStatus}`
        );
    });

    await bot.sendMessage(chatId, lines.join("\n\n"), { parse_mode: "HTML" });
});

// =====================================================
// /STATS — FAQAT ADMIN
// =====================================================

bot.onText(/^\/stats$/, async (msg) => {
    const chatId = msg.chat.id;

    if (!isAdmin(chatId)) {
        await bot.sendMessage(chatId, "❌ Siz admin emassiz.");
        return;
    }

    const orders = storage.loadOrders();
    const uniqueUsers = new Set(orders.map((o) => String(o.userId))).size;
    const paidOrders = orders.filter(
        (o) => o.paymentStatus === "paid" || o.paymentStatus === "completed"
    );
    const totalStars = paidOrders.reduce((sum, o) => sum + (o.price || 0), 0);
    const completed = orders.filter((o) => o.paymentStatus === "completed");

    await bot.sendMessage(
        chatId,
        "📊 <b>Statistika</b>\n\n" +
            `👥 Userlar: <b>${uniqueUsers}</b>\n` +
            `📦 Buyurtmalar: <b>${orders.length}</b>\n` +
            `✅ To'langanlar: <b>${paidOrders.length}</b>\n` +
            `⭐ Jami Stars: <b>${totalStars}</b>\n` +
            `🎨 Yaratilgan emoji: <b>${completed.length}</b>`,
        { parse_mode: "HTML" }
    );
});

// =====================================================
// /ID — TELEGRAM ID'NI BILISH (ADMIN_ID sozlash uchun qulay)
// =====================================================

bot.onText(/^\/id$/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, `🆔 Sizning Telegram ID'ingiz:\n<code>${chatId}</code>`, {
        parse_mode: "HTML"
    });
});

// =====================================================
// POLLING XATOLIKLARI
// =====================================================

bot.on("polling_error", (error) => {
    console.error("POLLING ERROR:", error.message);
});

process.on("unhandledRejection", (reason) => {
    console.error("UNHANDLED REJECTION:", reason);
});

process.on("uncaughtException", (error) => {
    console.error("UNCAUGHT EXCEPTION:", error);
});

console.log("================================");
console.log("🤖 Emoji Bot ishga tushdi");
console.log(`💰 Price: ${getPrice()} Stars`);
console.log("================================");
