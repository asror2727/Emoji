const axios = require("axios");
const FormData = require("form-data");

const TOKEN = process.env.BOT_TOKEN;

const API_BASE = `https://api.telegram.org/bot${TOKEN}`;
const FILE_BASE = `https://api.telegram.org/file/bot${TOKEN}`;

// =====================================================
// UMUMIY JSON SO'ROV (GET/POST oddiy metodlar uchun)
// =====================================================

async function callApi(method, payload = {}) {
    try {
        const { data } = await axios.post(
            `${API_BASE}/${method}`,
            payload,
            { timeout: 30000 }
        );

        if (!data.ok) {
            const err = new Error(
                data.description || `Telegram API error: ${method}`
            );
            err.telegram = data;
            throw err;
        }

        return data.result;
    } catch (error) {
        if (error.response && error.response.data) {
            const err = new Error(
                error.response.data.description ||
                    `Telegram API HTTP error: ${method}`
            );
            err.telegram = error.response.data;
            throw err;
        }

        throw error;
    }
}

// =====================================================
// CUSTOM EMOJI STICKER MA'LUMOTINI OLISH
// =====================================================

async function getCustomEmojiStickers(customEmojiIds) {
    return callApi("getCustomEmojiStickers", {
        custom_emoji_ids: customEmojiIds
    });
}

// =====================================================
// FAYLNI YUKLAB OLISH (file_id -> Buffer)
// =====================================================

async function getFile(fileId) {
    return callApi("getFile", { file_id: fileId });
}

async function downloadFileBuffer(filePath) {
    const url = `${FILE_BASE}/${filePath}`;

    const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 30000
    });

    return Buffer.from(response.data);
}

async function downloadOriginalSticker(fileId) {
    const file = await getFile(fileId);

    if (!file.file_path) {
        throw new Error("file_path topilmadi (CUSTOM_EMOJI_ERROR)");
    }

    const buffer = await downloadFileBuffer(file.file_path);

    return {
        buffer,
        filePath: file.file_path
    };
}

// =====================================================
// STICKER FILE UPLOAD (uploadStickerFile)
// user_id egasi bo'lishi kerak (owner sifatida bot ishlatadi)
// =====================================================

async function uploadStickerFile(userId, buffer, stickerFormat, fileName) {
    const form = new FormData();

    form.append("user_id", String(userId));
    form.append("sticker_format", stickerFormat);
    form.append("sticker", buffer, {
        filename: fileName
    });

    const { data } = await axios.post(
        `${API_BASE}/uploadStickerFile`,
        form,
        {
            headers: form.getHeaders(),
            timeout: 30000,
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        }
    );

    if (!data.ok) {
        const err = new Error(
            data.description || "uploadStickerFile xatoligi"
        );
        err.telegram = data;
        throw err;
    }

    return data.result; // File object -> file_id
}

// =====================================================
// YANGI CUSTOM EMOJI STICKER SET YARATISH
// =====================================================

async function createNewCustomEmojiStickerSet({
    userId,
    name,
    title,
    stickerFileId,
    stickerFormat,
    emojiList
}) {
    return callApi("createNewStickerSet", {
        user_id: userId,
        name,
        title,
        sticker_type: "custom_emoji",
        stickers: [
            {
                sticker: stickerFileId,
                format: stickerFormat,
                emoji_list: emojiList
            }
        ]
    });
}

// =====================================================
// MAVJUD SETGA STICKER QO'SHISH
// =====================================================

async function addStickerToSet({
    userId,
    name,
    stickerFileId,
    stickerFormat,
    emojiList
}) {
    return callApi("addStickerToSet", {
        user_id: userId,
        name,
        sticker: {
            sticker: stickerFileId,
            format: stickerFormat,
            emoji_list: emojiList
        }
    });
}

// =====================================================
// STICKER SET MA'LUMOTINI OLISH (mavjudligini tekshirish)
// =====================================================

async function getStickerSet(name) {
    try {
        return await callApi("getStickerSet", { name });
    } catch (error) {
        return null;
    }
}

module.exports = {
    callApi,
    getCustomEmojiStickers,
    getFile,
    downloadFileBuffer,
    downloadOriginalSticker,
    uploadStickerFile,
    createNewCustomEmojiStickerSet,
    addStickerToSet,
    getStickerSet
};
