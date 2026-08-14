const { generateStaticEmoji } = require("./static");
const { generateTgsEmoji } = require("./tgs");
const { generateWebmEmoji } = require("./webm");

// =====================================================
// ORIGINAL STICKER OBYEKTI ASOSIDA FORMATNI ANIQLASH
// Telegram Sticker obyektida:
//   is_animated -> true bo'lsa TGS (Lottie)
//   is_video    -> true bo'lsa WEBM
//   aks holda   -> static (PNG/WEBP)
// =====================================================

function detectFormat(stickerObject) {
    if (stickerObject.is_animated) return "animated";
    if (stickerObject.is_video) return "video";
    return "static";
}

// =====================================================
// FAYL NOMI
// =====================================================

function fileNameForFormat(format) {
    if (format === "animated") return "emoji.tgs";
    if (format === "video") return "emoji.webm";
    return "emoji.webp";
}

// =====================================================
// GENERATOR DISPATCH
// Qaytaradi: { buffer, format, fileName }
// =====================================================

async function generateEmoji(stickerObject, originalBuffer, text) {
    const format = detectFormat(stickerObject);

    let buffer;

    if (format === "animated") {
        buffer = await generateTgsEmoji(originalBuffer, text);
    } else if (format === "video") {
        buffer = await generateWebmEmoji(originalBuffer, text);
    } else {
        buffer = await generateStaticEmoji(originalBuffer, text);
    }

    return {
        buffer,
        format,
        fileName: fileNameForFormat(format)
    };
}

module.exports = { generateEmoji, detectFormat };
