const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const fs = require("fs");
const path = require("path");

// =====================================================
// ENV
// =====================================================

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = String(process.env.ADMIN_ID || "");

const PORT = process.env.PORT || 3000;

if (!TOKEN) {
    console.error("❌ BOT_TOKEN topilmadi!");
    process.exit(1);
}

if (!ADMIN_ID) {
    console.warn("⚠️ ADMIN_ID berilmagan!");
}

// =====================================================
// BOT
// =====================================================

const bot = new TelegramBot(TOKEN, {
    polling: true
});

// =====================================================
// EXPRESS - RENDER UCHUN
// =====================================================

const app = express();

app.get("/", (req, res) => {
    res.status(200).send("Emoji Bot ishlayapti ✅");
});

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        bot: "online"
    });
});

app.listen(PORT, () => {
    console.log(`🌐 Server ${PORT} portda ishlayapti`);
});

// =====================================================
// EMOJI ID'LAR
// =====================================================

const EMOJIS = {

    kurs: {
        key: "kurs",
        name: "2-kurs",
        id: "5449752159283327567"
    },

    uyda: {
        key: "uyda",
        name: "Uyda",
        id: "5474236307548939628"
    },

    darsda: {
        key: "darsda",
        name: "Darsda",
        id: "5472185692593333530"
    },

    dollar: {
        key: "dollar",
        name: "Dollar",
        id: "5222126026536004111"
    }

};

// =====================================================
// 15 TA NOM
// =====================================================

const NAMES = [
    "Jasur",
    "AXI",
    "SPAM",
    "MUNIS",
    "ASLIDDIN",
    "Millioner",
    "PAYSHANBA",
    "WORK",
    "Bekzod",
    "Bahor",
    "Great",
    "Muzlik",
    "HACK",
    "USDT",
    "VIP"
];

// =====================================================
// USER STATE
// =====================================================

const users = new Map();

// =====================================================
// PRICE
// =====================================================

const PRICE_FILE = path.join(__dirname, "price.json");

let PRICE = 2;

try {

    if (fs.existsSync(PRICE_FILE)) {

        const data = JSON.parse(
            fs.readFileSync(PRICE_FILE, "utf8")
        );

        if (
            Number.isInteger(data.price) &&
            data.price >= 0
        ) {
            PRICE = data.price;
        }
    }

} catch (error) {

    console.log(
        "⚠️ price.json o'qilmadi:",
        error.message
    );
}

function savePrice() {

    try {

        fs.writeFileSync(
            PRICE_FILE,
            JSON.stringify({
                price: PRICE
            }, null, 2)
        );

    } catch (error) {

        console.error(
            "❌ Narx saqlanmadi:",
            error.message
        );
    }
}

// =====================================================
// ADMIN CHECK
// =====================================================

function isAdmin(chatId) {

    return String(chatId) === ADMIN_ID;

}

// =====================================================
// CUSTOM EMOJI HTML
// =====================================================

function customEmoji(id, fallback = "✨") {

    return `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`;

}

// =====================================================
// START MENU
// =====================================================

function getStartText() {

    return (
        "Assalomu alaykum! 👋\n\n" +

        "✨ <b>Emoji yasash botiga xush kelibsiz!</b>\n\n" +

        "Bu bot orqali o'zingizga chiroyli " +
        "ism emoji yaratishingiz mumkin.\n\n" +

        "<b>Mavjud shablonlar:</b>\n\n" +

        "🔸 Jasur\n" +
        "🔸 AXI\n" +
        "🔸 SPAM\n" +
        "🔸 MUNIS\n" +
        "🔸 ASLIDDIN\n" +
        "🔸 Millioner\n" +
        "🔸 PAYSHANBA\n" +
        "🔸 WORK\n" +
        "🔸 Bekzod\n" +
        "🔸 Bahor\n" +
        "🔸 Great\n" +
        "🔸 Muzlik\n" +
        "🔸 HACK\n" +
        "🔸 USDT\n" +
        "🔸 VIP\n\n" +

        "<b>Nimani yasaymiz? 👇</b>"
    );

}

// =====================================================
// START BUTTONS
// =====================================================

function getStartKeyboard() {

    return {
        inline_keyboard: [

            [
                {
                    text: "2-kurs",
                    callback_data: "emoji_kurs"
                },
                {
                    text: "Uyda",
                    callback_data: "emoji_uyda"
                }
            ],

            [
                {
                    text: "Darsda",
                    callback_data: "emoji_darsda"
                },
                {
                    text: "Dollar",
                    callback_data: "emoji_dollar"
                }
            ]

        ]
    };

}

// =====================================================
// START
// =====================================================

bot.onText(/^\/start$/, async (msg) => {

    const chatId = msg.chat.id;

    users.set(chatId, {
        step: "choose_emoji"
    });

    try {

        await bot.sendMessage(
            chatId,
            getStartText(),
            {
                parse_mode: "HTML",
                reply_markup: getStartKeyboard()
            }
        );

    } catch (error) {

        console.error(
            "START ERROR:",
            error
        );

    }

});

// =====================================================
// CALLBACK QUERY
// =====================================================

bot.on("callback_query", async (query) => {

    const chatId = query.message.chat.id;

    const data = query.data;

    try {

        await bot.answerCallbackQuery(
            query.id
        );

    } catch {}

    // =================================================
    // EMOJI TANLASH
    // =================================================

    if (data.startsWith("emoji_")) {

        const key = data.replace(
            "emoji_",
            ""
        );

        const emoji = EMOJIS[key];

        if (!emoji) {

            await bot.sendMessage(
                chatId,
                "❌ Emoji topilmadi."
            );

            return;
        }

        users.set(chatId, {
            step: "name",
            emoji: key
        });

        await bot.sendMessage(
            chatId,

            customEmoji(
                emoji.id,
                "✨"
            ) +

            ` <b>${emoji.name}</b>\n\n` +

            "So'zni yozing\n" +
            "(maksimum 7 ta harf):",

            {
                parse_mode: "HTML"
            }
        );

        return;
    }

    // =================================================
    // TO'LOV
    // =================================================

    if (data === "payment") {

        const user = users.get(chatId);

        if (!user) {

            await bot.sendMessage(
                chatId,
                "❌ Buyurtma topilmadi.\n/start ni bosing."
            );

            return;
        }

        const emoji = EMOJIS[user.emoji];

        if (!emoji) {

            await bot.sendMessage(
                chatId,
                "❌ Emoji topilmadi."
            );

            return;
        }

        // =============================================
        // OWNER — BEPUL
        // =============================================

        if (isAdmin(chatId)) {

            await bot.sendMessage(
                chatId,

                "👑 <b>Owner buyurtmasi</b>\n\n" +

                customEmoji(
                    emoji.id,
                    "✨"
                ) +

                ` ${user.name}\n` +

                `📦 ${user.packName}\n\n` +

                "💰 Narx: <b>BEPUL</b>\n\n" +

                "⏳ Buyurtma qabul qilindi.",

                {
                    parse_mode: "HTML"
                }
            );

            console.log(
                "OWNER ORDER:",
                user
            );

            // Keyin shu yerga generator ulanadi.

            await bot.sendMessage(
                chatId,
                "⚙️ TEST: emoji generator hali ulanmagan."
            );

            return;
        }

        // =============================================
        // ODDIY USER — STARS
        // =============================================

        const payload = JSON.stringify({

            type: "emoji",

            userId: chatId,

            emoji: user.emoji,

            emojiId: emoji.id,

            emojiName: emoji.name,

            name: user.name,

            packName: user.packName,

            createdAt: Date.now()

        });

        try {

            await bot.sendInvoice(

                chatId,

                "Premium Emoji",

                `${emoji.name} — ${user.name}`,

                payload,

                "",

                "XTR",

                [
                    {
                        label: "Premium Emoji",
                        amount: PRICE
                    }
                ]

            );

        } catch (error) {

            console.error(
                "SEND INVOICE ERROR:",
                error
            );

            await bot.sendMessage(
                chatId,

                "❌ To'lov oynasini ochishda xatolik.\n\n" +
                "Iltimos, keyinroq qayta urinib ko'ring."
            );
        }

        return;
    }

    // =================================================
    // ORQAGA
    // =================================================

    if (data === "back_start") {

        users.set(chatId, {
            step: "choose_emoji"
        });

        await bot.sendMessage(
            chatId,
            getStartText(),
            {
                parse_mode: "HTML",
                reply_markup: getStartKeyboard()
            }
        );

        return;
    }

});

// =====================================================
// TEXT MESSAGE
// =====================================================

bot.on("message", async (msg) => {

    const chatId = msg.chat.id;

    const text = msg.text;

    if (!text) return;

    // Commandlarni o'tkazib yuboramiz
    if (text.startsWith("/")) return;

    const user = users.get(chatId);

    if (!user) return;

    // =================================================
    // ADMIN PRICE
    // =================================================

    if (
        isAdmin(chatId) &&
        user.step === "set_price"
    ) {

        const price = Number(
            text.trim()
        );

        if (
            !Number.isInteger(price) ||
            price < 0
        ) {

            await bot.sendMessage(
                chatId,
                "❌ Faqat raqam yozing.\n\nMasalan: 2"
            );

            return;
        }

        PRICE = price;

        savePrice();

        users.delete(chatId);

        await bot.sendMessage(
            chatId,

            "✅ <b>Narx o'zgartirildi!</b>\n\n" +
            `⭐ Yangi narx: <b>${PRICE} Stars</b>`,

            {
                parse_mode: "HTML"
            }
        );

        return;
    }

    // =================================================
    // NAME
    // =================================================

    if (user.step === "name") {

        const name = text.trim();

        // Maksimum 7
        if (name.length > 7) {

            await bot.sendMessage(
                chatId,
                "❌ Maksimum 7 ta harf yozish mumkin."
            );

            return;
        }

        if (name.length < 1) {

            await bot.sendMessage(
                chatId,
                "❌ So'z yozing."
            );

            return;
        }

        user.name = name;

        user.step = "pack_name";

        users.set(
            chatId,
            user
        );

        await bot.sendMessage(
            chatId,

            "📦 <b>To'plam nomini yozing</b>\n\n" +
            "(bu Telegram'da ko'rinadigan sarlavha bo'ladi):",

            {
                parse_mode: "HTML"
            }
        );

        return;
    }

    // =================================================
    // PACK NAME
    // =================================================

    if (user.step === "pack_name") {

        const packName = text.trim();

        if (!packName) {

            await bot.sendMessage(
                chatId,
                "❌ To'plam nomini yozing."
            );

            return;
        }

        if (packName.length > 64) {

            await bot.sendMessage(
                chatId,
                "❌ To'plam nomi maksimum 64 belgidan iborat."
            );

            return;
        }

        user.packName = packName;

        user.step = "payment";

        users.set(
            chatId,
            user
        );

        const emoji = EMOJIS[user.emoji];

        // =================================================
        // OWNER
        // =================================================

        if (isAdmin(chatId)) {

            await bot.sendMessage(
                chatId,

                "👑 <b>Owner</b>\n\n" +

                customEmoji(
                    emoji.id,
                    "✨"
                ) +

                ` <b>${emoji.name}</b>\n\n` +

                `👤 Ism: <b>${user.name}</b>\n` +
                `📦 Pack: <b>${packName}</b>\n\n` +

                "💰 Narx: <b>BEPUL</b>\n\n" +

                "Tayyorlash uchun bosing:",

                {
                    parse_mode: "HTML",

                    reply_markup: {
                        inline_keyboard: [

                            [
                                {
                                    text: "👑 BEPUL YASASH",
                                    callback_data: "payment"
                                }
                            ],

                            [
                                {
                                    text: "⬅️ Orqaga",
                                    callback_data: "back_start"
                                }
                            ]

                        ]
                    }
                }
            );

            return;
        }

        // =================================================
        // ODDIY USER
        // =================================================

        await bot.sendMessage(
            chatId,

            "🎨 <b>Buyurtma</b>\n\n" +

            customEmoji(
                emoji.id,
                "✨"
            ) +

            ` <b>${emoji.name}</b>\n\n` +

            `👤 Ism: <b>${user.name}</b>\n` +
            `📦 Pack: <b>${packName}</b>\n\n` +

            `💰 Narxi: <b>⭐ ${PRICE}</b>\n\n` +

            "Tayyorlash uchun to'lov qiling:",

            {
                parse_mode: "HTML",

                reply_markup: {
                    inline_keyboard: [

                        [
                            {
                                text:
                                    `⭐ ${PRICE} Stars to'lash`,
                                callback_data:
                                    "payment"
                            }
                        ],

                        [
                            {
                                text: "⬅️ Orqaga",
                                callback_data:
                                    "back_start"
                            }
                        ]

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

bot.on(
    "pre_checkout_query",
    async (query) => {

        console.log(
            "PRE-CHECKOUT:",
            query.id
        );

        try {

            await bot.answerPreCheckoutQuery(
                query.id,
                true
            );

        } catch (error) {

            console.error(
                "PRE CHECKOUT ERROR:",
                error
            );

        }

    }
);

// =====================================================
// SUCCESSFUL PAYMENT
// =====================================================

bot.on("message", async (msg) => {

    if (!msg.successful_payment) {
        return;
    }

    const chatId = msg.chat.id;

    const payment =
        msg.successful_payment;

    console.log(
        "================================"
    );

    console.log(
        "✅ PAYMENT SUCCESS"
    );

    console.log(
        "Telegram Charge:",
        payment.telegram_payment_charge_id
    );

    console.log(
        "Amount:",
        payment.total_amount
    );

    console.log(
        "================================"
    );

    let data;

    try {

        data = JSON.parse(
            payment.invoice_payload
        );

    } catch (error) {

        console.error(
            "PAYLOAD ERROR:",
            error
        );

        await bot.sendMessage(
            chatId,
            "✅ To'lov qabul qilindi!"
        );

        return;
    }

    const emoji =
        EMOJIS[data.emoji];

    await bot.sendMessage(
        chatId,

        "✅ <b>To'lov muvaffaqiyatli!</b>\n\n" +

        customEmoji(
            emoji.id,
            "✨"
        ) +

        ` <b>${emoji.name}</b>\n\n` +

        `👤 Ism: <b>${data.name}</b>\n` +
        `📦 Pack: <b>${data.packName}</b>\n` +
        `⭐ To'lov: <b>${payment.total_amount}</b>\n\n` +

        "⏳ Buyurtmangiz qabul qilindi.",

        {
            parse_mode: "HTML"
        }
    );

    // =================================================
    // GENERATOR KEYIN SHU YERGA ULANADI
    // =================================================

    console.log(
        "ORDER PAID:",
        {
            userId: chatId,
            emoji: data.emoji,
            emojiId: data.emojiId,
            name: data.name,
            packName: data.packName,
            stars: payment.total_amount
        }
    );

    await bot.sendMessage(
        chatId,

        "⚙️ <b>TEST REJIM</b>\n\n" +
        "To'lov tizimi ishladi ✅\n" +
        "Emoji generator modulini keyingi bosqichda ulaymiz.",

        {
            parse_mode: "HTML"
        }
    );

});

// =====================================================
// /PUL
// =====================================================

bot.onText(
    /^\/pul$/,
    async (msg) => {

        const chatId = msg.chat.id;

        if (!isAdmin(chatId)) {

            await bot.sendMessage(
                chatId,
                "❌ Siz admin emassiz."
            );

            return;
        }

        users.set(
            chatId,
            {
                step: "set_price"
            }
        );

        await bot.sendMessage(
            chatId,

            "💰 <b>Stars narxi</b>\n\n" +

            `Hozirgi narx: ⭐ <b>${PRICE}</b>\n\n` +

            "Nechi Stars qo'yasiz?\n\n" +

            "Masalan: <code>3</code>",

            {
                parse_mode: "HTML"
            }
        );

    }
);

// =====================================================
// /PRICE
// =====================================================

bot.onText(
    /^\/price$/,
    async (msg) => {

        const chatId = msg.chat.id;

        if (!isAdmin(chatId)) return;

        await bot.sendMessage(
            chatId,

            `💰 Hozirgi narx: ⭐ <b>${PRICE}</b>`,

            {
                parse_mode: "HTML"
            }
        );

    }
);

// =====================================================
// /ID
// =====================================================

bot.onText(
    /^\/id$/,
    async (msg) => {

        const chatId = msg.chat.id;

        await bot.sendMessage(
            chatId,
            `🆔 Sizning Telegram ID'ingiz:\n\n<code>${chatId}</code>`,
            {
                parse_mode: "HTML"
            }
        );

    }
);

// =====================================================
// ERROR
// =====================================================

bot.on(
    "polling_error",
    (error) => {

        console.error(
            "POLLING ERROR:",
            error.message
        );

    }
);

console.log("================================");
console.log("🤖 Emoji Bot ishga tushdi");
console.log(`💰 Price: ${PRICE} Stars`);
console.log("================================");
