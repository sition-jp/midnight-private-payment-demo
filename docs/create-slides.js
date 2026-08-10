const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "SIPO / 田平茂樹";
pres.title = "Midnight MCP × AI — 60秒で始めるZKP開発";

// Colors (no # prefix)
const BLACK = "1a1a2e";
const DARK_BLUE = "16213e";
const BLUE = "0066ff";
const WHITE = "ffffff";
const GRAY = "cccccc";
const DARK_GRAY = "888888";

// Helper for consistent title style
function addTitle(slide, text) {
  slide.addText(text, {
    x: 0.6, y: 0.4, w: 8.8, h: 0.8,
    fontSize: 32, fontFace: "Arial", color: WHITE, bold: true, margin: 0
  });
}

function addSubtitle(slide, text) {
  slide.addText(text, {
    x: 0.6, y: 1.2, w: 8.8, h: 0.5,
    fontSize: 18, fontFace: "Arial", color: BLUE, margin: 0
  });
}

// ── Slide 1: Title ──
let s1 = pres.addSlide();
s1.background = { color: BLACK };
s1.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.08, fill: { color: BLUE } });
s1.addText("Midnight MCP × AI", {
  x: 0.6, y: 1.2, w: 8.8, h: 1.0,
  fontSize: 44, fontFace: "Arial", color: BLUE, bold: true, margin: 0
});
s1.addText("60秒で始めるZKP開発", {
  x: 0.6, y: 2.2, w: 8.8, h: 0.8,
  fontSize: 36, fontFace: "Arial", color: WHITE, margin: 0
});
s1.addText("SIPO  |  Midnight Ambassador\n田平茂樹", {
  x: 0.6, y: 3.8, w: 5, h: 0.8,
  fontSize: 16, fontFace: "Arial", color: GRAY, margin: 0
});

// ── Slide 2: Problem ──
let s2 = pres.addSlide();
s2.background = { color: BLACK };
addTitle(s2, "データは価値。だが共有はリスク。");
s2.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.5, w: 4.0, h: 3.2, fill: { color: DARK_BLUE } });
s2.addText([
  { text: "BEFORE — 従来の方法", options: { fontSize: 16, bold: true, color: GRAY, breakLine: true } },
  { text: "", options: { fontSize: 8, breakLine: true } },
  { text: "・取引先に生データを渡す必要がある", options: { fontSize: 13, color: GRAY, breakLine: true } },
  { text: "・漏洩・二次利用リスクがある", options: { fontSize: 13, color: GRAY, breakLine: true } },
  { text: "・監査・コンプライアンスの負担が重い", options: { fontSize: 13, color: GRAY, breakLine: true } },
  { text: "・結果：データは活用されにくくなる", options: { fontSize: 13, color: GRAY } }
], { x: 0.9, y: 1.7, w: 3.5, h: 2.8, valign: "top", margin: 0 });

s2.addShape(pres.shapes.RECTANGLE, { x: 5.2, y: 1.5, w: 4.2, h: 3.2, fill: { color: BLUE } });
s2.addText([
  { text: "AFTER — Midnight", options: { fontSize: 16, bold: true, color: WHITE, breakLine: true } },
  { text: "", options: { fontSize: 8, breakLine: true } },
  { text: "・データを外部に渡す必要がない", options: { fontSize: 13, color: WHITE, breakLine: true } },
  { text: "・必要な事実だけを暗号技術で証明", options: { fontSize: 13, color: WHITE, breakLine: true } },
  { text: "・必要な情報だけ開示（選択的開示）", options: { fontSize: 13, color: WHITE, breakLine: true } },
  { text: "・規制・監査にも「証明」で対応", options: { fontSize: 13, color: WHITE } }
], { x: 5.5, y: 1.7, w: 3.7, h: 2.8, valign: "top", margin: 0 });

// ── Slide 3: ZKP ──
let s3 = pres.addSlide();
s3.background = { color: BLACK };
addTitle(s3, "ゼロ知識証明（ZKP）とは？");
addSubtitle(s3, "秘密を明かさずに、その正しさを証明する技術");

s3.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.9, w: 8.8, h: 1.6, fill: { color: DARK_BLUE } });
s3.addText([
  { text: "例：鍵と錠前", options: { fontSize: 16, bold: true, color: BLUE, breakLine: true } },
  { text: "鍵の形（秘密）は見せなくても、錠前を開けてみせることで「この鍵を持っている」ことを証明できる。相手には錠が開いたという事実だけが伝わり、鍵の形は一切わからない。", options: { fontSize: 14, color: GRAY } }
], { x: 0.9, y: 2.0, w: 8.2, h: 1.4, valign: "top", margin: 0 });

// 3 properties
const props = ["完全性：本当なら証明できる", "健全性：嘘は証明できない", "ゼロ知識性：秘密は漏れない"];
props.forEach((text, i) => {
  s3.addShape(pres.shapes.RECTANGLE, { x: 0.6 + i * 3.1, y: 3.9, w: 2.8, h: 0.7, fill: { color: DARK_BLUE } });
  s3.addText(text, { x: 0.6 + i * 3.1, y: 3.9, w: 2.8, h: 0.7, fontSize: 13, color: WHITE, align: "center", valign: "middle", margin: 0 });
});

// ── Slide 4: Midnight = ZKP × Selective Disclosure ──
let s4 = pres.addSlide();
s4.background = { color: BLACK };
addTitle(s4, "Midnight = ZKP × 選択的開示");
addSubtitle(s4, "オンチェーンでもオフチェーンでも、プライバシーを守りながら検証できる");

s4.addText([
  { text: "機密データ → Midnight（ZKP・選択的開示）→", options: { fontSize: 16, color: WHITE, breakLine: true } },
  { text: "", options: { fontSize: 8, breakLine: true } },
  { text: "  ・取引先（証明のみ）", options: { fontSize: 15, color: GRAY, breakLine: true } },
  { text: "  ・規制当局（必要な開示のみ）", options: { fontSize: 15, color: GRAY, breakLine: true } },
  { text: "  ・ユーザー（情報の選択のみ）", options: { fontSize: 15, color: GRAY, breakLine: true } },
  { text: "", options: { fontSize: 10, breakLine: true } },
  { text: "データは手元に残る。必要な事実だけが相手に届く。", options: { fontSize: 16, color: BLUE, bold: true } }
], { x: 0.6, y: 2.0, w: 8.8, h: 3.0, margin: 0 });

// ── Slide 5: Wall ──
let s5 = pres.addSlide();
s5.background = { color: BLACK };
addTitle(s5, "従来のZKP開発の壁");

const walls = [
  "暗号数学の専門知識が必要",
  "ZKP回路の設計が複雑",
  "専用言語の学習コストが高い",
  "コンパイル環境の構築が面倒",
  "デバッグが困難"
];
walls.forEach((text, i) => {
  s5.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.5 + i * 0.6, w: 8.8, h: 0.5, fill: { color: DARK_BLUE } });
  s5.addText("・" + text, { x: 0.9, y: 1.5 + i * 0.6, w: 8.2, h: 0.5, fontSize: 18, color: GRAY, valign: "middle", margin: 0 });
});
s5.addText("→ 開発者の参入障壁が高すぎる", {
  x: 0.6, y: 4.5, w: 8.8, h: 0.5, fontSize: 20, color: BLUE, bold: true, margin: 0
});

// ── Slide 6: MCP Solves ──
let s6 = pres.addSlide();
s6.background = { color: BLACK };
addTitle(s6, "Midnight MCP = AIが壁を壊す");

const features = [
  "Claude / Cursor / GitHub Copilot に60秒で接続",
  "正確なCompact構文を提供",
  "AI生成コードを自動検証・修正",
  "自然言語でコントラクト生成・セキュリティ検査"
];
features.forEach((text, i) => {
  s6.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.5 + i * 0.7, w: 0.08, h: 0.5, fill: { color: BLUE } });
  s6.addText(text, { x: 0.9, y: 1.5 + i * 0.7, w: 8.5, h: 0.5, fontSize: 18, color: WHITE, valign: "middle", margin: 0 });
});
s6.addText("29個のMidnight専用ツールがAIに直結", {
  x: 0.6, y: 4.0, w: 8.8, h: 0.4, fontSize: 14, color: GRAY, margin: 0
});
s6.addText(".mcp.json に3行書くだけ。", {
  x: 0.6, y: 4.5, w: 8.8, h: 0.5, fontSize: 22, color: BLUE, bold: true, margin: 0
});

// ── Slide 7: Demo Overview ──
let s7 = pres.addSlide();
s7.background = { color: DARK_BLUE };
s7.addText("LIVE DEMO", {
  x: 0.6, y: 0.8, w: 8.8, h: 0.8, fontSize: 40, fontFace: "Arial", color: BLUE, bold: true, margin: 0
});
s7.addText("今から、プライベート決済コントラクトを作ります", {
  x: 0.6, y: 1.7, w: 8.8, h: 0.5, fontSize: 20, color: WHITE, margin: 0
});

const steps = [
  { num: "1", text: "MCPセットアップ — 60秒チャレンジ" },
  { num: "2", text: "自然言語でコントラクト生成" },
  { num: "3", text: "MCPコンパイル & レビュー" },
  { num: "4", text: "テストネットデプロイ & 確認（任意）" }
];
steps.forEach((step, i) => {
  s7.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 2.6 + i * 0.7, w: 0.5, h: 0.5, fill: { color: BLUE } });
  s7.addText(step.num, { x: 0.6, y: 2.6 + i * 0.7, w: 0.5, h: 0.5, fontSize: 18, color: WHITE, align: "center", valign: "middle", bold: true, margin: 0 });
  s7.addText("Step " + step.num + "  " + step.text, { x: 1.3, y: 2.6 + i * 0.7, w: 8, h: 0.5, fontSize: 18, color: GRAY, valign: "middle", margin: 0 });
});

// ── Slides 8-11: Demo Steps ──
const demoSlides = [
  { title: "Step 1", sub: "MCPセットアップ — 60秒チャレンジ", detail: ".mcp.json に3行追加 → Claude Code起動 → 29ツール認識" },
  { title: "Step 2", sub: "自然言語でコントラクト生成", detail: "日本語プロンプト → MCP自動処理 → Compactコード生成" },
  { title: "Step 3", sub: "MCPコンパイル & レビュー", detail: "ホステッドコンパイラ → 自動レビュー → エラー自動修正" },
  { title: "Step 4", sub: "テストネットデプロイ & 確認", detail: "Preprodデプロイ → エクスプローラーで「金額が見えない」を確認" }
];
demoSlides.forEach(d => {
  let ds = pres.addSlide();
  ds.background = { color: DARK_BLUE };
  ds.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.08, fill: { color: BLUE } });
  ds.addText(d.title, { x: 0.6, y: 1.2, w: 8.8, h: 1.0, fontSize: 52, fontFace: "Arial", color: BLUE, bold: true, margin: 0 });
  ds.addText(d.sub, { x: 0.6, y: 2.3, w: 8.8, h: 0.6, fontSize: 26, color: WHITE, margin: 0 });
  ds.addText(d.detail, { x: 0.6, y: 3.2, w: 8.8, h: 0.5, fontSize: 16, color: GRAY, margin: 0 });
  ds.addText("← ここからClaude Codeの画面に切り替え", { x: 0.6, y: 4.5, w: 8.8, h: 0.4, fontSize: 14, color: DARK_GRAY, italic: true, margin: 0 });
});

// ── Slide 12: What Happened ──
let s12 = pres.addSlide();
s12.background = { color: BLACK };
addTitle(s12, "何が起きたか");
addSubtitle(s12, "暗号知識ゼロで、ZKPコントラクトが動いた");

s12.addText([
  { text: "1. .mcp.json 3行 → 60秒でセットアップ完了", options: { fontSize: 16, color: WHITE, breakLine: true } },
  { text: "2. 日本語で指示 → プライベート決済コントラクト生成", options: { fontSize: 16, color: WHITE, breakLine: true } },
  { text: "3. MCPがコンパイル → エラーも自動修正", options: { fontSize: 16, color: WHITE, breakLine: true } },
  { text: "", options: { fontSize: 10, breakLine: true } },
  { text: "ledger（公開）= ハッシュのみ", options: { fontSize: 14, color: GRAY, breakLine: true } },
  { text: "witness入力 = 金額・受取人公開鍵（回路内で公開）", options: { fontSize: 14, color: GRAY, breakLine: true } },
  { text: "circuit = ZKPで正当性を証明", options: { fontSize: 14, color: GRAY } }
], { x: 0.6, y: 2.0, w: 8.8, h: 3.0, margin: 0 });

// ── Slide 13: Use Cases ──
let s13 = pres.addSlide();
s13.background = { color: BLACK };
addTitle(s13, "活用イメージ");

const useCases = [
  { title: "秘匿残高更新PoC", desc: "金額は秘匿・相手公開鍵は公開" },
  { title: "AI学習データ流通", desc: "データを手放さず品質を証明" },
  { title: "医療データ", desc: "受診資格を記録なしで証明" },
  { title: "デジタル本人確認", desc: "属性だけを証明" },
  { title: "投票システム", desc: "投票内容を隠し正当性を保証" },
  { title: "治験データ管理", desc: "個人情報なしで妥当性証明" }
];
useCases.forEach((uc, i) => {
  const col = i % 3;
  const row = Math.floor(i / 3);
  const x = 0.6 + col * 3.1;
  const y = 1.5 + row * 1.8;
  s13.addShape(pres.shapes.RECTANGLE, { x: x, y: y, w: 2.8, h: 1.4, fill: { color: DARK_BLUE } });
  s13.addShape(pres.shapes.RECTANGLE, { x: x, y: y, w: 2.8, h: 0.06, fill: { color: BLUE } });
  s13.addText(uc.title, { x: x + 0.15, y: y + 0.2, w: 2.5, h: 0.4, fontSize: 15, color: WHITE, bold: true, margin: 0 });
  s13.addText(uc.desc, { x: x + 0.15, y: y + 0.7, w: 2.5, h: 0.4, fontSize: 12, color: GRAY, margin: 0 });
});

// ── Slide 14: Next Steps ──
let s14 = pres.addSlide();
s14.background = { color: BLACK };
addTitle(s14, "次のステップ");

s14.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.5, w: 4.2, h: 3.2, fill: { color: DARK_BLUE } });
s14.addText([
  { text: "開発者の方へ", options: { fontSize: 18, bold: true, color: BLUE, breakLine: true } },
  { text: "", options: { fontSize: 8, breakLine: true } },
  { text: "・ハンズオンマニュアル（本日配布）", options: { fontSize: 14, color: GRAY, breakLine: true } },
  { text: "・Midnight Docs: docs.midnight.network", options: { fontSize: 14, color: GRAY, breakLine: true } },
  { text: "・Compact言語リファレンス", options: { fontSize: 14, color: GRAY, breakLine: true } },
  { text: "・Midnight MCP GitHub", options: { fontSize: 14, color: GRAY } }
], { x: 0.9, y: 1.7, w: 3.6, h: 2.8, valign: "top", margin: 0 });

s14.addShape(pres.shapes.RECTANGLE, { x: 5.2, y: 1.5, w: 4.2, h: 3.2, fill: { color: DARK_BLUE } });
s14.addText([
  { text: "企業の方へ", options: { fontSize: 18, bold: true, color: BLUE, breakLine: true } },
  { text: "", options: { fontSize: 8, breakLine: true } },
  { text: "・Midnight Japanチームとの", options: { fontSize: 14, color: GRAY, breakLine: true } },
  { text: "　ミーティングをお繋ぎします", options: { fontSize: 14, color: GRAY, breakLine: true } },
  { text: "・ユースケース相談も歓迎", options: { fontSize: 14, color: GRAY } }
], { x: 5.5, y: 1.7, w: 3.6, h: 2.8, valign: "top", margin: 0 });

// ── Slide 15: Summary ──
let s15 = pres.addSlide();
s15.background = { color: BLACK };
s15.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.08, fill: { color: BLUE } });
s15.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.545, w: 10, h: 0.08, fill: { color: BLUE } });

s15.addText("Midnight MCP × AI\n60秒で始めるZKP開発", {
  x: 0.6, y: 0.8, w: 6, h: 1.2, fontSize: 32, fontFace: "Arial", color: WHITE, bold: true, margin: 0
});
s15.addText([
  { text: "midnight.network", options: { fontSize: 18, color: BLUE, breakLine: true } },
  { text: "@midnight_jpn", options: { fontSize: 18, color: BLUE, breakLine: true } },
  { text: "", options: { fontSize: 10, breakLine: true } },
  { text: "SIPO  |  Midnight Ambassador", options: { fontSize: 16, color: GRAY, breakLine: true } },
  { text: "sipo.tokyo", options: { fontSize: 16, color: BLUE } }
], { x: 0.6, y: 2.4, w: 6, h: 2.0, margin: 0 });

s15.addText("ご質問・ご相談はお気軽にどうぞ", {
  x: 0.6, y: 4.6, w: 8.8, h: 0.4, fontSize: 16, color: GRAY, margin: 0
});

// Save
const outputPath = require("node:path").join(__dirname, "midnight-mcp-demo.pptx");
pres.writeFile({ fileName: outputPath }).then(() => {
  console.log("Created: " + outputPath);
  console.log("Slides: " + pres.slides.length);
}).catch(err => {
  console.error("Error:", err);
});
