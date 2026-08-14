const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

const TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;

// =========================
// SOZLAMALAR
// =========================

const ADMIN_ID = Number(process.env.ADMIN_ID);

// Hozircha 2 Stars
let PRICE = 2;

// 4 ta emoji
const EMOJIS = {
  kurs: {
    name: "2-kurs",
    id: "5449752159283327567"
  },

  uyda: {
    name: "Uyda",
    id: "5474236307548939628"
  },

  darsda: {
    name: "Darsda",
    id: "5472185692593333530"
  },

  dollar: {
    name: "Dollar",
    id: "5222126026536004111"
  }
};

// User state
const users = new Map();

// =========================
// BOT
// =========================

const bot = new TelegramBot(TOKEN, {
  polling: true
});

// =========================
// START
// =========================

bot.onText(/^\/start$/, async (msg) => {

  const chatId = msg.chat.id;

  users.set(chatId, {
    step: "choose_emoji"
  });

  await bot.sendMessage(
    chatId,
    "Nima yasaymiz? 👇",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "2-kurs 🟡",
              callback_data: "emoji_kurs"
            },
            {
              text: "Uyda 🔴",
              callback_data: "emoji_uyda"
            }
          ],
          [
            {
              text: "Darsda 🟢",
              callback_data: "emoji_darsda"
            },
            {
              text: "Dollar 💵",
              callback_data: "emoji_dollar"
            }
          ]
        ]
      }
    }
  );
});

// =========================
// CALLBACK
// =========================

bot.on("callback_query", async (query) => {

  const chatId = query.message.chat.id;
  const data = query.data;

  await bot.answerCallbackQuery(query.id);

  // Emoji tanlash
  if (data.startsWith("emoji_")) {

    const key = data.replace("emoji_", "");
    const emoji = EMOJIS[key];

    if (!emoji) return;

    users.set(chatId, {
      step: "name",
      emoji: key
    });

    await bot.sendMessage(
      chatId,
      `✅ ${emoji.name} tanlandi.\n\nSo'zni yozing (maksimum 7 ta harf):`
    );

    return;
  }

  // To'lov tugmasi
  if (data.startsWith("pay_")) {

    const key = data.replace("pay_", "");
    const user = users.get(chatId);

    if (!user || user.emoji !== key) {
      await bot.sendMessage(
        chatId,
        "❌ Buyurtma topilmadi. /start ni bosing."
      );
      return;
    }

    const payload = JSON.stringify({
      type: "emoji",
      userId: chatId,
      emoji: key,
      name: user.name,
      packName: user.packName
    });

    try {

      await bot.sendInvoice(
        chatId,

        "Premium Emoji",

        `${EMOJIS[key].name} — ${user.name}`,

        payload,

        "",

        "XTR",

        [
          {
            label: "Premium Emoji",
            amount: PRICE
          }
        ],

        {
          start_parameter: "emoji_payment"
        }
      );

    } catch (error) {

      console.error(error);

      await bot.sendMessage(
        chatId,
        "❌ To'lov oynasini ochishda xatolik."
      );
    }

    return;
  }

  // Orqaga
  if (data === "back") {

    users.set(chatId, {
      step: "choose_emoji"
    });

    await bot.sendMessage(
      chatId,
      "Nima yasaymiz? 👇",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "2-kurs 🟡",
                callback_data: "emoji_kurs"
              },
              {
                text: "Uyda 🔴",
                callback_data: "emoji_uyda"
              }
            ],
            [
              {
                text: "Darsda 🟢",
                callback_data: "emoji_darsda"
              },
              {
                text: "Dollar 💵",
                callback_data: "emoji_dollar"
              }
            ]
          ]
        }
      }
    );
  }
});

// =========================
// TEXT
// =========================

bot.on("message", async (msg) => {

  const chatId = msg.chat.id;

  // Commandlarni o'tkazib yuboramiz
  if (msg.text && msg.text.startsWith("/")) return;

  const user = users.get(chatId);

  if (!user) return;

  // =========================
  // ISM
  // =========================

  if (user.step === "name") {

    const name = msg.text.trim();

    if (name.length === 0) {
      await bot.sendMessage(chatId, "❌ So'z yozing.");
      return;
    }

    if (name.length > 7) {
      await bot.sendMessage(
        chatId,
        "❌ Maksimum 7 ta harf."
      );
      return;
    }

    user.name = name;
    user.step = "pack_name";

    users.set(chatId, user);

    await bot.sendMessage(
      chatId,
      "To'plam nomini yozing\n" +
      "(bu Telegram'da ko'rinadigan sarlavha bo'ladi):"
    );

    return;
  }

  // =========================
  // PACK NOMI
  // =========================

  if (user.step === "pack_name") {

    const packName = msg.text.trim();

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

    users.set(chatId, user);

    const emoji = EMOJIS[user.emoji];

    await bot.sendMessage(
      chatId,

      `🎨 ${emoji.name}\n` +
      `👤 ${user.name}\n` +
      `📦 ${packName}\n\n` +
      `💰 Narxi: ⭐ ${PRICE}`,

      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `⭐ ${PRICE} Stars to'lash`,
                callback_data: `pay_${user.emoji}`
              }
            ],
            [
              {
                text: "⬅️ Orqaga",
                callback_data: "back"
              }
            ]
          ]
        }
      }
    );

    return;
  }
});

// =========================
// PRE-CHECKOUT
// =========================

bot.on("pre_checkout_query", async (query) => {

  try {

    await bot.answerPreCheckoutQuery(
      query.id,
      true
    );

  } catch (error) {

    console.error(
      "Pre-checkout error:",
      error
    );
  }
});

// =========================
// TO'LOV MUVAFFAQIYATLI
// =========================

bot.on("message", async (msg) => {

  if (!msg.successful_payment) return;

  const payment = msg.successful_payment;

  const chatId = msg.chat.id;

  let data;

  try {
    data = JSON.parse(payment.invoice_payload);
  } catch {
    await bot.sendMessage(
      chatId,
      "✅ To'lov qabul qilindi!"
    );
    return;
  }

  console.log(
    "PAYMENT:",
    payment.telegram_payment_charge_id
  );

  await bot.sendMessage(
    chatId,

    "✅ To'lov muvaffaqiyatli!\n\n" +
    `👤 ${data.name}\n` +
    `🎨 ${EMOJIS[data.emoji].name}\n` +
    `📦 ${data.packName}\n\n` +
    "⏳ Emoji tayyorlanmoqda..."
  );

  // Keyingi bosqichda shu yerga
  // emoji yaratish + sticker pack yaratish qo'shiladi.

  await bot.sendMessage(
    chatId,
    "⚙️ Hozircha TEST rejim.\n\n" +
    "To'lov ishladi ✅\n" +
    "Emoji generatsiyasi keyingi modulda ulanadi."
  );
});

// =========================
// ADMIN /PUL
// =========================

bot.onText(/^\/pul$/, async (msg) => {

  const chatId = msg.chat.id;

  if (chatId !== ADMIN_ID) {
    await bot.sendMessage(
      chatId,
      "❌ Siz admin emassiz."
    );
    return;
  }

  users.set(chatId, {
    step: "set_price"
  });

  await bot.sendMessage(
    chatId,
    `💰 Hozirgi narx: ⭐ ${PRICE}\n\n` +
    "Nechi Stars qo'yasiz?"
  );
});

// =========================
// ADMIN PRICE
// =========================

bot.on("message", async (msg) => {

  const chatId = msg.chat.id;

  if (chatId !== ADMIN_ID) return;

  const user = users.get(chatId);

  if (!user || user.step !== "set_price") return;

  const value = Number(msg.text);

  if (!Number.isInteger(value) || value < 0) {

    await bot.sendMessage(
      chatId,
      "❌ Faqat musbat raqam yozing.\n\nMasalan: 2"
    );

    return;
  }

  PRICE = value;

  users.delete(chatId);

  await bot.sendMessage(
    chatId,
    `✅ Narx o'zgartirildi!\n\n` +
    `⭐ Yangi narx: ${PRICE}`
  );
});

// =========================
// EXPRESS — RENDER
// =========================

const app = express();

app.get("/", (req, res) => {
  res.send("Emoji Bot ishlayapti ✅");
});

app.listen(PORT, () => {
  console.log(
    `Server ${PORT} portda ishlayapti`
  );
});
