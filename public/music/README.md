# 给你的歌 · 音乐图册网站

纯静态网站，没有后端，直接部署到 Vercel。

## 目录

```
index.html          首页（全部歌曲）
s/01/index.html     第 1 首歌的页面 → 网址 /s/01（二维码指向这里）
assets/songs.js     ★ 歌单数据：标题、日期、留言、歌词都在这里改
assets/player.js    播放器 + 波形
assets/scene.js     背景场景（跟着音乐变化：雨等）
assets/rain.js      首页的背景雨
assets/style.css    样式
media/01/           audio.m4a（音频）、cover.jpg（封面）、thumb.jpg（列表小图）、lyrics.json（歌词 + 逐字时间轴）
tools/add-song.mjs  加新歌用的脚本
vercel.json         让 /s/01 这种短网址生效
```

## 加一首新歌

1. 在原素材文件夹放好视频/音频和封面，比如 `音乐2/`
2. 在 site 文件夹里运行：
   ```
   node tools/add-song.mjs 02 "../音乐2/xxx.mp4" "../音乐2/封面.png"
   ```
   会自动：抽出音频 → `media/02/audio.m4a`，生成封面和小图，复制出 `s/02/index.html`
   （需要电脑上装了 ffmpeg；封面缩放用的也是 ffmpeg）
3. 打开 `assets/songs.js`，照着第 1 首的格式加一条 `id: "02"`

## 歌词

`media/<id>/lyrics.json` 每一行是一句：`t` 开始秒数，`tr` 中文翻译，`w` 是每个字的 [字, 开始秒, 结束秒]。
时间轴是用语音识别对齐的；某个字亮得早/晚，直接改对应的秒数就行。没有这个文件，页面就不显示歌词区。

## 背景场景

在 `songs.js` 里给每首歌写 `scene: "rain"`。场景在 `assets/scene.js` 里定义：
没播放时不下雨 → 点开始后雨慢慢下大 → 副歌越响雨越大、灯光越亮 → 暂停变毛毛雨。
新歌需要别的意境（雪、星空、海浪、花瓣……）就在 scene.js 里加一个新场景。

## 本地预览

在 site 文件夹里运行 `npx serve .`，手机和电脑连同一个 Wi-Fi 就能用手机打开看。
（直接双击 html 打不开，因为路径是按网站根目录写的。）

## 上线

全部做好后：推到 GitHub → Vercel 导入 → 绑定自己的域名（比如 `music.jestazyao.com`）。
**二维码一定要用自己的域名生成**，不要用 `xxx.vercel.app`，这样以后换平台图册也不用重印。
