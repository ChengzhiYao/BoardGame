// 用法：node tools/add-song.mjs <编号> <视频或音频文件> <封面图片>
// 例子：node tools/add-song.mjs 02 "../音乐2/song.mp4" "../音乐2/cover.png"
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [id, src, cover] = process.argv.slice(2);
if (!id || !src || !cover) {
  console.log('用法：node tools/add-song.mjs 02 "../音乐2/song.mp4" "../音乐2/cover.png"');
  process.exit(1);
}

const out = join(root, "media", id);
mkdirSync(out, { recursive: true });
const ff = (...a) => execFileSync("ffmpeg", ["-v", "error", "-y", ...a], { stdio: "inherit" });

// 音频：如果原本就是 AAC 就直接拷贝（无损），否则转成 AAC 192k
let codec = "";
try {
  codec = execFileSync("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_name", "-of", "csv=p=0", src]).toString().trim();
} catch {}
ff("-i", src, "-vn", ...(codec === "aac" ? ["-c:a", "copy"] : ["-c:a", "aac", "-b:a", "192k"]), "-movflags", "+faststart", join(out, "audio.m4a"));

// 封面：最长边 1536 的 jpg（横版封面会自动用横版排版）+ 128 的方形小图
ff("-i", cover, "-vf", "scale='min(1536,iw)':-2", "-q:v", "3", join(out, "cover.jpg"));
ff("-i", cover, "-vf", "crop='min(iw,ih)':'min(iw,ih)',scale=128:128", "-q:v", "4", join(out, "thumb.jpg"));

// 页面：复制第 1 首的模板，只换编号
const page = join(root, "s", id, "index.html");
if (!existsSync(page)) {
  mkdirSync(dirname(page), { recursive: true });
  writeFileSync(page, readFileSync(join(root, "s", "01", "index.html"), "utf8").replace('data-song="01"', `data-song="${id}"`));
}

console.log(`✓ 第 ${id} 首素材和页面已生成。别忘了在 assets/songs.js 里加上 id: "${id}" 的那一条。`);
