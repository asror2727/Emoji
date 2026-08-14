const sharp = require("sharp");
const { escapeXml } = require("../utils/helpers");

const OUTPUT_SIZE = 100; // Telegram custom emoji talabi ~100x100

// =====================================================
// FONNING O'RTACHA YORQINLIGINI HISOBLASH
// (matn rangini oq/qora avtomatik tanlash uchun)
// =====================================================

async function getAverageBrightness(imageBuffer) {
    try {
        const { data, info } = await sharp(imageBuffer)
            .resize(32, 32, { fit: "cover" })
            .removeAlpha()
            .greyscale()
            .raw()
            .toBuffer({ resolveWithObject: true });

        let sum = 0;

        for (let i = 0; i < data.length; i++) {
            sum += data[i];
        }

        return sum / data.length; // 0 (qora) - 255 (oq)
    } catch (error) {
        return 128;
    }
}

// =====================================================
// TEXT UCHUN FONT O'LCHAMINI HISOBLASH
// =====================================================

function computeFontSize(text, canvasSize) {
    const length = [...text].length;

    if (length <= 3) return Math.round(canvasSize * 0.34);
    if (length <= 5) return Math.round(canvasSize * 0.26);
    return Math.round(canvasSize * 0.2);
}

// =====================================================
// STATIC EMOJI YARATISH
// original: Buffer (PNG/WEBP/JPEG)
// text: matn (max 7 belgi, caller tomonidan validatsiya qilinadi)
// =====================================================

async function generateStaticEmoji(originalBuffer, text) {
    const base = sharp(originalBuffer).ensureAlpha();
    const metadata = await base.metadata();

    const width = metadata.width || OUTPUT_SIZE;
    const height = metadata.height || OUTPUT_SIZE;

    const brightness = await getAverageBrightness(originalBuffer);
    const useWhiteText = brightness < 140;

    const fillColor = useWhiteText ? "#FFFFFF" : "#111111";
    const strokeColor = useWhiteText ? "#000000" : "#FFFFFF";

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
                fill="${fillColor}"
                stroke="${strokeColor}"
                stroke-width="${Math.max(2, Math.round(fontSize * 0.08))}"
                paint-order="stroke"
            >${safeText}</text>
        </svg>
    `;

    const textLayer = Buffer.from(svg);

    const composed = await base
        .composite([{ input: textLayer, top: 0, left: 0 }])
        .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: "contain" })
        .webp({ quality: 95, alphaQuality: 100 })
        .toBuffer();

    return composed;
}

module.exports = { generateStaticEmoji };
