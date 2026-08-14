// =====================================================
// ORDER ID
// =====================================================

function generateOrderId() {
    const rand = Math.random()
        .toString(36)
        .slice(2, 10)
        .toUpperCase();

    return `ORD-${rand}`;
}

// =====================================================
// STICKER SET SHORT NAME
// Telegram qoidasi:
// - faqat lotin harflar, raqam, "_"
// - "by_<BotUsername>" bilan tugashi shart
// - 1-64 belgi
// =====================================================

function buildStickerSetName(userId, emojiKey, name, botUsername) {
    const safeName = String(name)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 20) || "emoji";

    const safeKey = String(emojiKey)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 15) || "tpl";

    let base = `e${userId}_${safeKey}_${safeName}`;

    // Telegram: 64 belgidan oshmasin, "by_<bot>" uchun joy qoldiramiz
    const suffix = `_by_${botUsername}`;
    const maxBaseLength = 64 - suffix.length;

    if (base.length > maxBaseLength) {
        base = base.slice(0, maxBaseLength);
    }

    // Boshi harf bilan boshlanishi kerak (Telegram talabi)
    if (!/^[a-zA-Z]/.test(base)) {
        base = "e" + base;
    }

    return `${base}${suffix}`;
}

// =====================================================
// TEXT VALIDATSIYA
// =====================================================

function validateText(text, maxLength = 7) {
    const trimmed = String(text || "").trim();

    if (trimmed.length < 1) {
        return { valid: false, reason: "empty" };
    }

    if ([...trimmed].length > maxLength) {
        return { valid: false, reason: "too_long" };
    }

    return { valid: true, value: trimmed };
}

// =====================================================
// PACK NOMI VALIDATSIYA
// =====================================================

function validatePackTitle(title, maxLength = 64) {
    const trimmed = String(title || "").trim();

    if (trimmed.length < 1) {
        return { valid: false, reason: "empty" };
    }

    if ([...trimmed].length > maxLength) {
        return { valid: false, reason: "too_long" };
    }

    return { valid: true, value: trimmed };
}

// =====================================================
// XML/HTML ESCAPE (Telegram HTML parse_mode uchun)
// =====================================================

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// =====================================================
// SVG UCHUN ESCAPE
// =====================================================

function escapeXml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

module.exports = {
    generateOrderId,
    buildStickerSetName,
    validateText,
    validatePackTitle,
    escapeHtml,
    escapeXml
};
