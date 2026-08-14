const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Dockerfile orqali o'rnatiladigan shrift (fonts-dejavu-core paketi)
const FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
];

function findFont() {
    for (const candidate of FONT_CANDIDATES) {
        if (fs.existsSync(candidate)) return candidate;
    }
    return null;
}

function escapeForDrawtext(text) {
    return String(text)
        .replace(/\\/g, "\\\\\\\\")
        .replace(/:/g, "\\:")
        .replace(/'/g, "\\'");
}

function runFfmpeg(args) {
    return new Promise((resolve, reject) => {
        const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });

        let stderr = "";

        proc.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });

        proc.on("error", (error) => {
            // ffmpeg binary topilmadi
            reject(
                new Error(
                    `FFMPEG_NOT_FOUND: ffmpeg ishga tushmadi (${error.message})`
                )
            );
        });

        proc.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`FFMPEG_ERROR: exit code ${code}\n${stderr}`));
            }
        });
    });
}

// =====================================================
// WEBM EMOJI YARATISH
// originalBuffer: .webm video (VP9, alpha channel)
// text: overlay matni
// =====================================================

async function generateWebmEmoji(originalBuffer, text) {
    const font = findFont();

    if (!font) {
        const err = new Error(
            "FONT_NOT_FOUND: DejaVu shrift topilmadi. Dockerfile orqali " +
                "'fonts-dejavu-core' paketi o'rnatilganini tekshiring."
        );
        throw err;
    }

    const tmpDir = os.tmpdir();
    const id = Math.random().toString(36).slice(2, 10);
    const inputPath = path.join(tmpDir, `in_${id}.webm`);
    const outputPath = path.join(tmpDir, `out_${id}.webm`);

    fs.writeFileSync(inputPath, originalBuffer);

    const safeText = escapeForDrawtext(text.toUpperCase());

    // Matn markazda, oq rang + qora kontur, alpha-channel saqlanadi
    const drawtext =
        `drawtext=fontfile='${font}':text='${safeText}':` +
        `fontcolor=white:fontsize=h*0.22:` +
        `x=(w-text_w)/2:y=(h-text_h)/2:` +
        `borderw=3:bordercolor=black@1.0`;

    const args = [
        "-y",
        "-i", inputPath,
        "-vf", drawtext,
        "-c:v", "libvpx-vp9",
        "-pix_fmt", "yuva420p",
        "-b:v", "180k",
        "-an",
        "-t", "3",
        outputPath
    ];

    try {
        await runFfmpeg(args);

        if (!fs.existsSync(outputPath)) {
            throw new Error("FFMPEG_ERROR: chiqish fayli yaratilmadi");
        }

        const result = fs.readFileSync(outputPath);
        return result;
    } finally {
        try { fs.unlinkSync(inputPath); } catch (e) {}
        try { fs.unlinkSync(outputPath); } catch (e) {}
    }
}

module.exports = { generateWebmEmoji };
