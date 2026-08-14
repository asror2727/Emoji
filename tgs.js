const pako = require("pako");
const sharp = require("sharp");
const { escapeXml } = require("../utils/helpers");

// =====================================================
// MUHIM TEXNIK IZOH (README'da ham yozilgan):
//
// TGS — gzip qilingan Lottie/Bodymovin JSON. Lottie matnni
// "haqiqiy" vektor shrift sifatida faqat maxsus "text layer"
// (ty: 5) orqali qo'llab-quvvatlaydi va bu layer render vaqtida
// tizim shriftlariga bog'liq bo'lib qoladi — Telegram klientlari
// buni har doim bir xil render qilishga kafolat bermaydi va bu
// yondashuv juda mo'rt.
//
// Shu sababli bu yerda ENG ISHONCHLI ishlaydigan alternativa
// qo'llanildi: matn PNG (transparent) sifatida serverda
// rasterizatsiya qilinadi (sharp/SVG orqali) va Lottie ichiga
// "image asset" + "image layer" (ty: 2) sifatida qo'shiladi.
// Bu usul barcha Telegram klientlarida bir xil ko'rinishni
// kafolatlaydi, lekin matn animatsiya davomida STATIK turadi
// (fon animatsiyasi davom etadi, matn esa ustida qotib turadi).
// =====================================================

function computeFontSize(text, canvasSize) {
    const length = [...text].length;

    if (length <= 3) return Math.round(canvasSize * 0.3);
    if (length <= 5) return Math.round(canvasSize * 0.24);
    return Math.round(canvasSize * 0.18);
}

async function renderTextPng(text, width, height) {
    const fontSize = computeFontSize(text, Math.min(width, height));
    const safeText = escapeXml(text.toUpperCase());

    const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <style>
                .t {
                    font-family: 'DejaVu Sans', Arial, sans-serif;
                    font-weight: 900;
                    font-size: ${fontSize}px;
                }
            </style>
            <text
                x="50%"
                y="50%"
                class="t"
                text-anchor="middle"
                dominant-baseline="central"
                fill="#FFFFFF"
                stroke="#000000"
                stroke-width="${Math.max(2, Math.round(fontSize * 0.09))}"
                paint-order="stroke"
            >${safeText}</text>
        </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

// =====================================================
// TGS YARATISH
// originalBuffer: .tgs fayl (gzip Lottie JSON)
// text: overlay matni
// =====================================================

async function generateTgsEmoji(originalBuffer, text) {
    let json;

    try {
        const decompressed = pako.ungzip(originalBuffer, { to: "string" });
        json = JSON.parse(decompressed);
    } catch (error) {
        const err = new Error(
            "TGS_PARSE_ERROR: Lottie JSON o'qib bo'lmadi"
        );
        err.cause = error;
        throw err;
    }

    const width = json.w || 100;
    const height = json.h || 100;
    const inPoint = json.ip || 0;
    const outPoint = json.op || (json.fr ? json.fr * 3 : 180);

    const pngBuffer = await renderTextPng(text, width, height);
    const base64Png = pngBuffer.toString("base64");

    if (!Array.isArray(json.assets)) {
        json.assets = [];
    }

    const assetId = "text_overlay_img";

    json.assets.push({
        id: assetId,
        w: width,
        h: height,
        u: "",
        p: `data:image/png;base64,${base64Png}`,
        e: 1
    });

    const textLayer = {
        ddd: 0,
        ind: (json.layers && json.layers.length
            ? Math.max(...json.layers.map((l) => l.ind || 0))
            : 0) + 1,
        ty: 2, // image layer
        nm: "text_overlay",
        refId: assetId,
        sr: 1,
        ks: {
            o: { a: 0, k: 100 },
            r: { a: 0, k: 0 },
            p: { a: 0, k: [width / 2, height / 2, 0] },
            a: { a: 0, k: [width / 2, height / 2, 0] },
            s: { a: 0, k: [100, 100, 100] }
        },
        ao: 0,
        ip: inPoint,
        op: outPoint,
        st: 0
    };

    if (!Array.isArray(json.layers)) {
        json.layers = [];
    }

    // Matn qatlami eng ustida (birinchi index) bo'lishi kerak
    json.layers.unshift(textLayer);

    let recompressed;

    try {
        const outJson = JSON.stringify(json);
        recompressed = Buffer.from(
            pako.gzip(outJson, { level: 9 })
        );
    } catch (error) {
        const err = new Error(
            "TGS_PARSE_ERROR: Lottie JSON qayta siqib bo'lmadi"
        );
        err.cause = error;
        throw err;
    }

    return recompressed;
}

module.exports = { generateTgsEmoji };
