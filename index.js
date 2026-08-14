// =====================================================
// PREMIUM EMOJI MAKER BOT — BITTA FAYLLIK VERSIYA
// Hech qanday papka yoki boshqa fayl kerak emas.
// Faqat: index.js + package.json
// =====================================================

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const axios = require("axios");
const FormData = require("form-data");
const sharp = require("sharp");
const pako = require("pako");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

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

const API_BASE = `https://api.telegram.org/bot${TOKEN}`;
const FILE_BASE = `https://api.telegram.org/file/bot${TOKEN}`;

// =====================================================
// BOT + EXPRESS
// =====================================================

const bot = new TelegramBot(TOKEN, { polling: true });

let BOT_USERNAME = "your_bot";

bot.getMe()
    .then((me) => {
        BOT_USERNAME = me.username;
        console.log(`🤖 Bot username: @${BOT_USERNAME}`);
    })
    .catch((error) => console.error("⚠️ getMe xato:", error.message));

const app = express();

app.get("/", (req, res) => res.status(200).send("Emoji Bot ishlayapti ✅"));
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

app.listen(PORT, () => console.log(`🌐 Server ${PORT} portda ishlayapti`));

// =====================================================
// PERSISTENT STORAGE (root papkada, subfolder yo'q)
// =====================================================

const SETTINGS_FILE = path.join(__dirname, "settings.json");
const ORDERS_FILE = path.join(__dirname, "orders.json");

function ensureDataFiles() {
    try {
        if (!fs.existsSync(SETTINGS_FILE)) {
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ price: 2 }, null, 2));
        }
        if (!fs.existsSync(ORDERS_FILE)) {
            fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2));
        }
    } catch (error) {
        console.error("❌ DATA FILES INIT ERROR:", error.message);
    }
}
ensureDataFiles();

function loadSettings() {
    try {
        const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
        if (!Number.isInteger(data.price) || data.price < 0) return { price: 2 };
        return data;
    } catch (e) {
        return { price: 2 };
    }
}

function saveSettings(settings) {
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error("❌ SETTINGS SAQLANMADI:", error.message);
    }
}

function loadOrders() {
    try {
        const data = JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8"));
        return Array.isArray(data) ? data : [];
    } catch (e) {
        return [];
    }
}

function saveOrders(orders) {
    try {
        fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
    } catch (error) {
        console.error("❌ ORDERS SAQLANMADI:", error.message);
    }
}

function addOrder(order) {
    const orders = loadOrders();
    orders.push(order);
    saveOrders(orders);
    return order;
}

function updateOrder(orderId, patch) {
    const orders = loadOrders();
    const idx = orders.findIndex((o) => o.orderId === orderId);
    if (idx === -1) return null;
    orders[idx] = { ...orders[idx], ...patch };
    saveOrders(orders);
    return orders[idx];
}

function getOrder(orderId) {
    return loadOrders().find((o) => o.orderId === orderId) || null;
}

let settings = loadSettings();
function getPrice() { return settings.price; }
function setPrice(p) { settings.price = p; saveSettings(settings); }

// =====================================================
// HELPERS
// =====================================================

function generateOrderId() {
    return `ORD-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

function buildStickerSetName(userId, emojiKey, name, botUsername) {
    const safeName = String(name).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || "emoji";
    const safeKey = String(emojiKey).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15) || "tpl";
    let base = `e${userId}_${safeKey}_${safeName}`;
    const suffix = `_by_${botUsername}`;
    const maxBaseLength = 64 - suffix.length;
    if (base.length > maxBaseLength) base = base.slice(0, maxBaseLength);
    if (!/^[a-zA-Z]/.test(base)) base = "e" + base;
    return `${base}${suffix}`;
}

function validateText(text, maxLength = 7) {
    const trimmed = String(text || "").trim();
    if (trimmed.length < 1) return { valid: false, reason: "empty" };
    if ([...trimmed].length > maxLength) return { valid: false, reason: "too_long" };
    return { valid: true, value: trimmed };
}

function validatePackTitle(title, maxLength = 64) {
    const trimmed = String(title || "").trim();
    if (trimmed.length < 1) return { valid: false, reason: "empty" };
    if ([...trimmed].length > maxLength) return { valid: false, reason: "too_long" };
    return { valid: true, value: trimmed };
}

function escapeXml(text) {
    return String(text)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// =====================================================
// TELEGRAM API (raw, uploadStickerFile / createNewStickerSet uchun)
// =====================================================

async function callApi(method, payload = {}) {
    try {
        const { data } = await axios.post(`${API_BASE}/${method}`, payload, { timeout: 30000 });
        if (!data.ok) {
            const err = new Error(data.description || `Telegram API error: ${method}`);
            throw err;
        }
        return data.result;
    } catch (error) {
        if (error.response && error.response.data) {
            throw new Error(error.response.data.description || `Telegram API HTTP error: ${method}`);
        }
        throw error;
    }
}

async function getCustomEmojiStickers(ids) {
    return callApi("getCustomEmojiStickers", { custom_emoji_ids: ids });
}

async function downloadOriginalSticker(fileId) {
    const file = await callApi("getFile", { file_id: fileId });
    if (!file.file_path) throw new Error("file_path topilmadi (CUSTOM_EMOJI_ERROR)");
    const response = await axios.get(`${FILE_BASE}/${file.file_path}`, {
        responseType: "arraybuffer", timeout: 30000
    });
    return Buffer.from(response.data);
}

async function uploadStickerFile(userId, buffer, stickerFormat, fileName) {
    const form = new FormData();
    form.append("user_id", String(userId));
    form.append("sticker_format", stickerFormat);
    form.append("sticker", buffer, { filename: fileName });

    const { data } = await axios.post(`${API_BASE}/uploadStickerFile`, form, {
        headers: form.getHeaders(), timeout: 30000,
        maxBodyLength: Infinity, maxContentLength: Infinity
    });

    if (!data.ok) throw new Error(data.description || "uploadStickerFile xatoligi");
    return data.result;
}

async function createNewCustomEmojiStickerSet({ userId, name, title, stickerFileId, stickerFormat, emojiList }) {
    return callApi("createNewStickerSet", {
        user_id: userId, name, title, sticker_type: "custom_emoji",
        stickers: [{ sticker: stickerFileId, format: stickerFormat, emoji_list: emojiList }]
    });
}

// =====================================================
// GENERATOR: STATIC (PNG/WEBP)
// =====================================================

async function getAverageBrightness(imageBuffer) {
    try {
        const { data } = await sharp(imageBuffer)
            .resize(32, 32, { fit: "cover" }).removeAlpha().greyscale().raw()
            .toBuffer({ resolveWithObject: true });
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        return sum / data.length;
    } catch (e) {
        return 128;
    }
}

function computeFontSize(text, canvasSize) {
    const length = [...text].length;
    if (length <= 3) return Math.round(canvasSize * 0.34);
    if (length <= 5) return Math.round(canvasSize * 0.26);
    return Math.round(canvasSize * 0.2);
}

async function generateStaticEmoji(originalBuffer, text) {
    const base = sharp(originalBuffer).ensureAlpha();
    const metadata = await base.metadata();
    const width = metadata.width || 100;
    const height = metadata.height || 100;

    const brightness = await getAverageBrightness(originalBuffer);
    const useWhiteText = brightness < 140;
    const fillColor = useWhiteText ? "#FFFFFF" : "#111111";
    const strokeColor = useWhiteText ? "#000000" : "#FFFFFF";
    const fontSize = computeFontSize(text, Math.min(width, height));
    const safeText = escapeXml(text.toUpperCase());

    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <style>.t{font-family:'DejaVu Sans',Arial,sans-serif;font-weight:900;font-size:${fontSize}px;}</style>
        <text x="50%" y="50%" class="t" text-anchor="middle" dominant-baseline="central"
            fill="${fillColor}" stroke="${strokeColor}" stroke-width="${Math.max(2, Math.round(fontSize * 0.08))}"
            paint-order="stroke">${safeText}</text></svg>`;

    return base.composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
        .resize(100, 100, { fit: "contain" })
        .webp({ quality: 95, alphaQuality: 100 })
        .toBuffer();
}

// =====================================================
// GENERATOR: TGS (Lottie) — matn PNG image-layer sifatida qo'shiladi
// =====================================================

async function renderTextPng(text, width, height) {
    const fontSize = computeFontSize(text, Math.min(width, height));
    const safeText = escapeXml(text.toUpperCase());
    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <style>.t{font-family:'DejaVu Sans',Arial,sans-serif;font-weight:900;font-size:${fontSize}px;}</style>
        <text x="50%" y="50%" class="t" text-anchor="middle" dominant-baseline="central"
            fill="#FFFFFF" stroke="#000000" stroke-width="${Math.max(2, Math.round(fontSize * 0.09))}"
            paint-order="stroke">${safeText}</text></svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
}

async function generateTgsEmoji(originalBuffer, text) {
    let json;
    try {
        json = JSON.parse(pako.ungzip(originalBuffer, { to: "string" }));
    } catch (error) {
        throw new Error("TGS_PARSE_ERROR: Lottie JSON o'qib bo'lmadi");
    }

    const width = json.w || 100;
    const height = json.h || 100;
    const inPoint = json.ip || 0;
    const outPoint = json.op || (json.fr ? json.fr * 3 : 180);

    const pngBuffer = await renderTextPng(text, width, height);
    const base64Png = pngBuffer.toString("base64");

    if (!Array.isArray(json.assets)) json.assets = [];
    const assetId = "text_overlay_img";
    json.assets.push({ id: assetId, w: width, h: height, u: "", p: `data:image/png;base64,${base64Png}`, e: 1 });

    const textLayer = {
        ddd: 0,
        ind: (json.layers && json.layers.length ? Math.max(...json.layers.map((l) => l.ind || 0)) : 0) + 1,
        ty: 2, nm: "text_overlay", refId: assetId, sr: 1,
        ks: {
            o: { a: 0, k: 100 }, r: { a: 0, k: 0 },
            p: { a: 0, k: [width / 2, height / 2, 0] },
            a: { a: 0, k: [width / 2, height / 2, 0] },
            s: { a: 0, k: [100, 100, 100] }
        },
        ao: 0, ip: inPoint, op: outPoint, st: 0
    };

    if (!Array.isArray(json.layers)) json.layers = [];
    json.layers.unshift(textLayer);

    return Buffer.from(pako.gzip(JSON.stringify(json), { level: 9 }));
}

// =====================================================
// GENERATOR: WEBM (faqat ffmpeg mavjud bo'lsa ishlaydi)
// =====================================================

const FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
];

function findFont() {
    for (const c of FONT_CANDIDATES) if (fs.existsSync(c)) return c;
    return null;
}

function escapeForDrawtext(text) {
    return String(text).replace(/\\/g, "\\\\\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function runFfmpeg(args) {
    return new Promise((resolve, reject) => {
        const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
        let stderr = "";
        proc.stderr.on("data", (c) => (stderr += c.toString()));
        proc.on("error", (error) => reject(new Error(`FFMPEG_NOT_FOUND: ${error.message}`)));
        proc.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`FFMPEG_ERROR: exit code ${code}\n${stderr}`));
        });
    });
}

async function generateWebmEmoji(originalBuffer, text) {
    const font = findFont();
    if (!font) throw new Error("FONT_NOT_FOUND: ffmpeg/shrift bu serverda o'rnatilmagan (Docker deploy kerak)");

    const tmpDir = os.tmpdir();
    const id = Math.random().toString(36).slice(2, 10);
    const inputPath = path.join(tmpDir, `in_${id}.webm`);
    const outputPath = path.join(tmpDir, `out_${id}.webm`);
    fs.writeFileSync(inputPath, originalBuffer);

    const safeText = escapeForDrawtext(text.toUpperCase());
    const drawtext = `drawtext=fontfile='${font}':text='${safeText}':fontcolor=white:fontsize=h*0.22:x=(w-text_w)/2:y=(h-text_h)/2:borderw=3:bordercolor=black@1.0`;

    const args = ["-y", "-i", inputPath, "-vf", drawtext, "-c:v", "libvpx-vp9",
        "-pix_fmt", "yuva420p", "-b:v", "180k", "-an", "-t", "3", outputPath];

    try {
        await runFfmpeg(args);
        if (!fs.existsSync(outputPath)) throw new Error("FFMPEG_ERROR: chiqish fayli yaratilmadi");
        return fs.readFileSync(outputPath);
    } finally {
        try { fs.unlinkSync(inputPath); } catch (e) {}
        try { fs.unlinkSync(outputPath); } catch (e) {}
    }
}

// =====================================================
// GENERATOR DISPATCH
// =====================================================

function detectFormat(stickerObject) {
    if (stickerObject.is_animated) return "animated";
    if (stickerObject.is_video) return "video";
    return "static";
}

function fileNameForFormat(format) {
    if (format === "animated") return "emoji.tgs";
    if (format === "video") return "emoji.webm";
    return "emoji.webp";
}

async function generateEmoji(stickerObject, originalBuffer, text) {
    const format = detectFormat(stickerObject);
    let buffer;
    if (format === "animated") buffer = await generateTgsEmoji(originalBuffer, text);
    else if (format === "video") buffer = await generateWebmEmoji(originalBuffer, text);
    else buffer = await generateStaticEmoji(originalBuffer, text);
    return { buffer, format, fileName: fileNameForFormat(format) };
}

// =====================================================
// SHABLONLAR
// =====================================================

const EMOJIS = {
    kurs: { key: "kurs", name: "2-kurs", id: "5449752159283327567" },
    uyda: { key: "uyda", name: "Uyda", id: "5474236307548939628" },
    darsda: { key: "darsda", name: "Darsda", id: "5472185692593333530" },
    dollar: { key: "dollar", name: "Dollar", id: "5222126026536004111" }
};

const DISPLAY_NAMES = [
    "Jasur", "AXI", "SPAM", "MUNIS", "ASLIDDIN", "Millioner",
    "PAYSHANBA", "WORK", "Bekzod", "Bahor", "Great", "Muzlik", "HACK", "USDT", "VIP"
];

// =====================================================
// USER STATE
// =====================================================

const users = new Map();
function resetUser(chatId) { users.set(chatId, { step: "choose_emoji" }); }
function isAdmin(chatId) { return ADMIN_ID.length > 0 && String(chatId) === ADMIN_ID; }

async function notifyAdmin(text) {
    if (!ADMIN_ID) return;
    try { await bot.sendMessage(ADMIN_ID, text, { parse_mode: "HTML" }); } catch (e) {}
}

function customEmojiHtml(id, fallback = "✨") {
    return `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`;
}

function getStartText() {
    const list = DISPLAY_NAMES.map((n) => `🔸 ${n}`).join("\n");
    return "Assalomu alaykum! 👋\n\n✨ <b>Emoji yasash botiga xush kelibsiz!</b>\n\n" +
        "Bu bot orqali o'zingizga chiroyli ism emoji yaratishingiz mumkin.\n\n" +
        `Quyidagi shablonlardan birini tanlang 👇\n\n<b>Mavjud shablonlar:</b>\n\n${list}\n\n` +
        "<b>Nimani yasaymiz? 👇</b>";
}

function getStartKeyboard() {
    return {
        inline_keyboard: [
            [{ text: "2-kurs", callback_data: "emoji_kurs" }, { text: "Uyda", callback_data: "emoji_uyda" }],
            [{ text: "Darsda", callback_data: "emoji_darsda" }, { text: "Dollar", callback_data: "emoji_dollar" }]
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
        await bot.sendMessage(chatId, getStartText(), { parse_mode: "HTML", reply_markup: getStartKeyboard() });
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

    try { await bot.answerCallbackQuery(query.id); } catch (e) {}

    if (data.startsWith("emoji_")) {
        const key = data.replace("emoji_", "");
        const emoji = EMOJIS[key];
        if (!emoji) { await bot.sendMessage(chatId, "❌ Emoji topilmadi."); return; }

        users.set(chatId, { step: "name", emoji: key });
        await bot.sendMessage(chatId,
            `${customEmojiHtml(emoji.id)} <b>${emoji.name}</b>\n\nSo'zni yozing\n(maksimum 7 ta harf):`,
            { parse_mode: "HTML" });
        return;
    }

    if (data === "back_start") {
        resetUser(chatId);
        await bot.sendMessage(chatId, getStartText(), { parse_mode: "HTML", reply_markup: getStartKeyboard() });
        return;
    }

    if (data === "payment") {
        const user = users.get(chatId);
        if (!user || !user.emoji || !user.name || !user.packName) {
            await bot.sendMessage(chatId, "❌ Buyurtma topilmadi.\n/start ni bosing.");
            return;
        }

        const emoji = EMOJIS[user.emoji];
        if (!emoji) { await bot.sendMessage(chatId, "❌ Emoji topilmadi."); return; }

        if (isAdmin(chatId)) {
            const orderId = generateOrderId();
            const order = addOrder({
                orderId, userId: chatId, emojiKey: user.emoji, emojiId: emoji.id,
                emojiName: emoji.name, text: user.name, packName: user.packName,
                price: 0, paymentStatus: "paid", telegramChargeId: "OWNER_FREE",
                createdAt: new Date().toISOString()
            });
            await bot.sendMessage(chatId, "👑 <b>Owner buyurtmasi qabul qilindi.</b>\n⏳ Tayyorlanmoqda...", { parse_mode: "HTML" });
            await runGenerator(chatId, order);
            return;
        }

        const orderId = generateOrderId();
        const order = addOrder({
            orderId, userId: chatId, emojiKey: user.emoji, emojiId: emoji.id,
            emojiName: emoji.name, text: user.name, packName: user.packName,
            price: getPrice(), paymentStatus: "pending", telegramChargeId: null,
            createdAt: new Date().toISOString()
        });

        const payload = JSON.stringify({ orderId });

        try {
            await bot.sendInvoice(chatId, "Premium Emoji", `${emoji.name} — ${user.name}`, payload,
                "", "XTR", [{ label: "Premium Emoji", amount: getPrice() }]);
        } catch (error) {
            console.error("SEND INVOICE ERROR:", error.message);
            updateOrder(orderId, { paymentStatus: "failed" });
            await bot.sendMessage(chatId, "❌ To'lov oynasini ochishda xatolik.\nIltimos, keyinroq qayta urinib ko'ring.");
        }
        return;
    }
});

// =====================================================
// TEXT XABARLAR
// =====================================================

bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text || text.startsWith("/")) return;

    const user = users.get(chatId);
    if (!user) return;

    if (isAdmin(chatId) && user.step === "set_price") {
        const price = Number(text.trim());
        if (!Number.isInteger(price) || price < 0) {
            await bot.sendMessage(chatId, "❌ Faqat raqam yozing.\n\nMasalan: 2");
            return;
        }
        setPrice(price);
        users.delete(chatId);
        await bot.sendMessage(chatId, `✅ <b>Narx o'zgartirildi!</b>\n\n⭐ Yangi narx: <b>${price}</b>`, { parse_mode: "HTML" });
        return;
    }

    if (user.step === "name") {
        const check = validateText(text, 7);
        if (!check.valid) {
            await bot.sendMessage(chatId, check.reason === "too_long" ? "❌ Maksimum 7 ta harf yozish mumkin." : "❌ So'z yozing.");
            return;
        }
        user.name = check.value;
        user.step = "pack_name";
        users.set(chatId, user);
        await bot.sendMessage(chatId, "📦 <b>To'plam nomini yozing</b>\n\n(bu Telegram'da ko'rinadigan sarlavha bo'ladi):", { parse_mode: "HTML" });
        return;
    }

    if (user.step === "pack_name") {
        const check = validatePackTitle(text, 64);
        if (!check.valid) {
            await bot.sendMessage(chatId, check.reason === "too_long" ? "❌ To'plam nomi maksimum 64 belgidan iborat." : "❌ To'plam nomini yozing.");
            return;
        }
        user.packName = check.value;
        user.step = "payment";
        users.set(chatId, user);

        const emoji = EMOJIS[user.emoji];
        const price = getPrice();
        const isOwner = isAdmin(chatId);

        await bot.sendMessage(chatId,
            "🎨 <b>Buyurtma</b>\n\n" +
            `${customEmojiHtml(emoji.id)} <b>${emoji.name}</b>\n\n` +
            `👤 Ism: <b>${user.name}</b>\n📦 Pack: <b>${user.packName}</b>\n\n` +
            (isOwner ? "💰 Narx: <b>BEPUL</b>\n\n" : `💰 Narxi: <b>⭐ ${price}</b>\n\n`) +
            "Tayyorlash uchun to'lov qiling:",
            {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: isOwner ? "👑 BEPUL YASASH" : `⭐ ${price} Stars to'lash`, callback_data: "payment" }],
                        [{ text: "⬅️ Orqaga", callback_data: "back_start" }]
                    ]
                }
            });
        return;
    }
});

// =====================================================
// PRE-CHECKOUT
// =====================================================

bot.on("pre_checkout_query", async (query) => {
    try {
        let data;
        try { data = JSON.parse(query.invoice_payload); }
        catch (e) {
            await bot.answerPreCheckoutQuery(query.id, false, { error_message: "Buyurtma ma'lumoti noto'g'ri." });
            return;
        }

        const order = getOrder(data.orderId);
        if (!order) {
            await bot.answerPreCheckoutQuery(query.id, false, { error_message: "Buyurtma topilmadi." });
            return;
        }
        if (String(order.userId) !== String(query.from.id)) {
            await bot.answerPreCheckoutQuery(query.id, false, { error_message: "Bu buyurtma sizga tegishli emas." });
            return;
        }
        await bot.answerPreCheckoutQuery(query.id, true);
    } catch (error) {
        console.error("PRE CHECKOUT ERROR:", error.message);
        try { await bot.answerPreCheckoutQuery(query.id, false, { error_message: "Xatolik yuz berdi." }); } catch (e) {}
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
    try { data = JSON.parse(payment.invoice_payload); }
    catch (error) {
        await bot.sendMessage(chatId, "✅ To'lov qabul qilindi!");
        return;
    }

    const order = updateOrder(data.orderId, {
        paymentStatus: "paid",
        telegramChargeId: payment.telegram_payment_charge_id
    });

    if (!order) {
        await bot.sendMessage(chatId, "✅ To'lov qabul qilindi!");
        return;
    }

    console.log("✅ PAYMENT SUCCESS:", order.orderId);
    await bot.sendMessage(chatId, "✅ <b>To'lov muvaffaqiyatli!</b>\n\n⏳ Buyurtmangiz tayyorlanmoqda...", { parse_mode: "HTML" });
    await runGenerator(chatId, order);
});

// =====================================================
// ASOSIY GENERATOR JARAYONI
// =====================================================

async function runGenerator(chatId, order) {
    try {
        let stickers;
        try {
            stickers = await getCustomEmojiStickers([order.emojiId]);
        } catch (error) {
            console.error("CUSTOM_EMOJI_ERROR (getCustomEmojiStickers):", error.message);
            await bot.sendMessage(chatId, "❌ Template faylini olish imkoni bo'lmadi");
            await notifyAdmin(`⚠️ CUSTOM_EMOJI_ERROR\nOrder: ${order.orderId}\n${error.message}`);
            return;
        }

        const stickerObject = stickers && stickers[0];
        if (!stickerObject) {
            await bot.sendMessage(chatId, "❌ Template faylini olish imkoni bo'lmadi");
            await notifyAdmin(`⚠️ CUSTOM_EMOJI_ERROR: sticker topilmadi\nOrder: ${order.orderId}`);
            return;
        }

        let originalBuffer;
        try {
            originalBuffer = await downloadOriginalSticker(stickerObject.file_id);
        } catch (error) {
            console.error("CUSTOM_EMOJI_ERROR (download):", error.message);
            await bot.sendMessage(chatId, "❌ Template faylini olish imkoni bo'lmadi");
            await notifyAdmin(`⚠️ CUSTOM_EMOJI_ERROR (download)\nOrder: ${order.orderId}\n${error.message}`);
            return;
        }

        let generated;
        try {
            generated = await generateEmoji(stickerObject, originalBuffer, order.text);
        } catch (error) {
            console.error("GENERATOR_ERROR:", error.message);
            await bot.sendMessage(chatId, "❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.");
            await notifyAdmin(`⚠️ GENERATOR_ERROR\nOrder: ${order.orderId}\n${error.message}`);
            return;
        }

        let uploaded;
        try {
            uploaded = await uploadStickerFile(chatId, generated.buffer, generated.format, generated.fileName);
        } catch (error) {
            console.error("UPLOAD_STICKER_ERROR:", error.message);
            await bot.sendMessage(chatId, "❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.");
            await notifyAdmin(`⚠️ UPLOAD_STICKER_ERROR\nOrder: ${order.orderId}\n${error.message}`);
            return;
        }

        const packShortName = buildStickerSetName(chatId, order.emojiKey, order.text, BOT_USERNAME);

        try {
            await createNewCustomEmojiStickerSet({
                userId: chatId, name: packShortName, title: order.packName,
                stickerFileId: uploaded.file_id, stickerFormat: generated.format, emojiList: ["✨"]
            });
        } catch (error) {
            console.error("CREATE_SET_ERROR:", error.message);
            await bot.sendMessage(chatId, "❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.");
            await notifyAdmin(`⚠️ CREATE_SET_ERROR\nOrder: ${order.orderId}\n${error.message}`);
            return;
        }

        const packLink = `https://t.me/addemoji/${packShortName}`;
        updateOrder(order.orderId, { paymentStatus: "completed", packShortName });

        await bot.sendMessage(chatId,
            "✅ <b>Tayyor!</b>\n\n" + `👤 ${order.text}\n📦 ${order.packName}\n\n` + "🎨 Premium emoji tayyorlandi!",
            {
                parse_mode: "HTML",
                reply_markup: { inline_keyboard: [[{ text: "➕ Emoji packni qo'shish", url: packLink }]] }
            });

        users.delete(chatId);
    } catch (error) {
        console.error("RUN_GENERATOR_UNEXPECTED_ERROR:", error);
        await bot.sendMessage(chatId, "❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.");
        await notifyAdmin(`⚠️ RUN_GENERATOR_UNEXPECTED_ERROR\nOrder: ${order.orderId}\n${error.message}`);
    }
}

// =====================================================
// /PUL, /ORDERS, /STATS, /ID
// =====================================================

bot.onText(/^\/pul$/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) { await bot.sendMessage(chatId, "❌ Siz admin emassiz."); return; }
    users.set(chatId, { step: "set_price" });
    await bot.sendMessage(chatId, `💰 <b>Hozirgi narx:</b> ⭐ ${getPrice()}\n\nNechi Stars qo'yasiz?`, { parse_mode: "HTML" });
});

bot.onText(/^\/orders$/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) { await bot.sendMessage(chatId, "❌ Siz admin emassiz."); return; }

    const orders = loadOrders().slice(-10).reverse();
    if (orders.length === 0) { await bot.sendMessage(chatId, "📦 Hozircha buyurtmalar yo'q."); return; }

    const statusEmoji = { pending: "⏳ PENDING", paid: "💳 PAID", completed: "✅ COMPLETED", failed: "❌ FAILED" };
    const lines = orders.map((o) =>
        `<b>${o.orderId}</b>\n👤 ${o.text}\n🎨 ${o.emojiName}\n📦 ${o.packName}\n⭐ ${o.price}\n${statusEmoji[o.paymentStatus] || o.paymentStatus}`
    );
    await bot.sendMessage(chatId, lines.join("\n\n"), { parse_mode: "HTML" });
});

bot.onText(/^\/stats$/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) { await bot.sendMessage(chatId, "❌ Siz admin emassiz."); return; }

    const orders = loadOrders();
    const uniqueUsers = new Set(orders.map((o) => String(o.userId))).size;
    const paidOrders = orders.filter((o) => o.paymentStatus === "paid" || o.paymentStatus === "completed");
    const totalStars = paidOrders.reduce((sum, o) => sum + (o.price || 0), 0);
    const completed = orders.filter((o) => o.paymentStatus === "completed");

    await bot.sendMessage(chatId,
        "📊 <b>Statistika</b>\n\n" +
        `👥 Userlar: <b>${uniqueUsers}</b>\n📦 Buyurtmalar: <b>${orders.length}</b>\n` +
        `✅ To'langanlar: <b>${paidOrders.length}</b>\n⭐ Jami Stars: <b>${totalStars}</b>\n` +
        `🎨 Yaratilgan emoji: <b>${completed.length}</b>`,
        { parse_mode: "HTML" });
});

bot.onText(/^\/id$/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, `🆔 Sizning Telegram ID'ingiz:\n<code>${chatId}</code>`, { parse_mode: "HTML" });
});

// =====================================================
// XATOLIKLAR
// =====================================================

bot.on("polling_error", (error) => console.error("POLLING ERROR:", error.message));
process.on("unhandledRejection", (reason) => console.error("UNHANDLED REJECTION:", reason));
process.on("uncaughtException", (error) => console.error("UNCAUGHT EXCEPTION:", error));

console.log("================================");
console.log("🤖 Emoji Bot ishga tushdi");
console.log(`💰 Price: ${getPrice()} Stars`);
console.log("================================");
