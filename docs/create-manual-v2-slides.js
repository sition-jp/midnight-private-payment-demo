const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "SIPO / 田平茂樹";
pres.title = "Midnight MCP ハンズオンマニュアル v2.0";

const BLACK = "1a1a2e";
const DARK_BLUE = "16213e";
const BLUE = "0066ff";
const WHITE = "ffffff";
const GRAY = "cccccc";
const DARK_GRAY = "888888";
const CODE_BG = "0d1117";
const COPY_BG = "1a3a5c";

function addHeader(slide, title, subtitle) {
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.06, fill: { color: BLUE } });
  slide.addText(title, { x: 0.6, y: 0.3, w: 8.8, h: 0.7, fontSize: 28, fontFace: "Arial", color: WHITE, bold: true, margin: 0 });
  if (subtitle) {
    slide.addText(subtitle, { x: 0.6, y: 1.0, w: 8.8, h: 0.4, fontSize: 16, color: BLUE, margin: 0 });
  }
}

function addCopyBlock(slide, label, code, x, y, w, h) {
  slide.addShape(pres.shapes.RECTANGLE, { x: x, y: y, w: w, h: 0.35, fill: { color: BLUE } });
  slide.addText(label, { x: x + 0.15, y: y, w: w - 0.3, h: 0.35, fontSize: 12, color: WHITE, bold: true, valign: "middle", margin: 0 });
  slide.addShape(pres.shapes.RECTANGLE, { x: x, y: y + 0.35, w: w, h: h - 0.35, fill: { color: CODE_BG } });
  slide.addText(code, { x: x + 0.15, y: y + 0.4, w: w - 0.3, h: h - 0.5, fontSize: 12, fontFace: "Consolas", color: "e6edf3", margin: 0 });
}

function addStep(slide, num, text, y) {
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: y, w: 0.45, h: 0.45, fill: { color: BLUE } });
  slide.addText(num, { x: 0.6, y: y, w: 0.45, h: 0.45, fontSize: 18, color: WHITE, align: "center", valign: "middle", bold: true, margin: 0 });
  slide.addText(text, { x: 1.2, y: y, w: 8.2, h: 0.45, fontSize: 15, color: GRAY, valign: "middle", margin: 0 });
}

// ── Slide 1: Title ──
let s1 = pres.addSlide();
s1.background = { color: BLACK };
s1.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.08, fill: { color: BLUE } });
s1.addText("Midnight MCP", { x: 0.6, y: 1.0, w: 8.8, h: 0.8, fontSize: 44, fontFace: "Arial", color: BLUE, bold: true, margin: 0 });
s1.addText("ハンズオンマニュアル v2.0", { x: 0.6, y: 1.8, w: 8.8, h: 0.7, fontSize: 36, fontFace: "Arial", color: WHITE, margin: 0 });
s1.addText("Claude Code × Midnight でプライバシーコントラクトを作る", { x: 0.6, y: 2.7, w: 8.8, h: 0.4, fontSize: 16, color: GRAY, margin: 0 });
s1.addText([
  { text: "コピペだけで完成する対話型ガイド", options: { fontSize: 18, color: BLUE, bold: true, breakLine: true } },
  { text: "", options: { fontSize: 10, breakLine: true } },
  { text: "対象: 開発者・ビジネス受講者  |  所要時間: 約60〜90分", options: { fontSize: 14, color: GRAY, breakLine: true } },
  { text: "SIPO | Midnight Ambassador", options: { fontSize: 14, color: GRAY } }
], { x: 0.6, y: 3.4, w: 8.8, h: 1.2, margin: 0 });

// ── Slide 2: 学ぶこと ──
let s2 = pres.addSlide();
s2.background = { color: BLACK };
addHeader(s2, "このワークショップで学ぶこと");
const learns = [
  "Claude Code に Midnight MCP を接続（29種類のツール）",
  "自然言語プロンプトからプライバシーコントラクトを生成",
  "MCP経由でコンパイル・エラー自動修正",
  "Midnight Preprodテストネットにデプロイ（オプション）"
];
learns.forEach((text, i) => {
  addStep(s2, String(i + 1), text, 1.5 + i * 0.7);
});
s2.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 4.3, w: 8.8, h: 0.6, fill: { color: COPY_BG } });
s2.addText("このマニュアルのプロンプトをコピペするだけで、全ステップを完了できます", { x: 0.9, y: 4.3, w: 8.2, h: 0.6, fontSize: 15, color: WHITE, valign: "middle", margin: 0 });

// ── Slide 3: 進め方 ──
let s3 = pres.addSlide();
s3.background = { color: BLACK };
addHeader(s3, "ワークショップの進め方");

s3.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.4, w: 2.6, h: 1.8, fill: { color: DARK_BLUE } });
s3.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.4, w: 2.6, h: 0.05, fill: { color: BLUE } });
s3.addText([
  { text: "Step 1", options: { fontSize: 18, color: BLUE, bold: true, breakLine: true } },
  { text: "コピペする", options: { fontSize: 16, color: WHITE, bold: true, breakLine: true } },
  { text: "", options: { fontSize: 6, breakLine: true } },
  { text: "青いボックスの\nプロンプトをコピーして\nClaude Codeに貼り付け", options: { fontSize: 13, color: GRAY } }
], { x: 0.8, y: 1.55, w: 2.2, h: 1.5, margin: 0 });

s3.addShape(pres.shapes.RECTANGLE, { x: 3.7, y: 1.4, w: 2.6, h: 1.8, fill: { color: DARK_BLUE } });
s3.addShape(pres.shapes.RECTANGLE, { x: 3.7, y: 1.4, w: 2.6, h: 0.05, fill: { color: BLUE } });
s3.addText([
  { text: "Step 2", options: { fontSize: 18, color: BLUE, bold: true, breakLine: true } },
  { text: "待つ", options: { fontSize: 16, color: WHITE, bold: true, breakLine: true } },
  { text: "", options: { fontSize: 6, breakLine: true } },
  { text: "MCPが自動で\nツールを呼び出して\n処理してくれます", options: { fontSize: 13, color: GRAY } }
], { x: 3.9, y: 1.55, w: 2.2, h: 1.5, margin: 0 });

s3.addShape(pres.shapes.RECTANGLE, { x: 6.8, y: 1.4, w: 2.6, h: 1.8, fill: { color: DARK_BLUE } });
s3.addShape(pres.shapes.RECTANGLE, { x: 6.8, y: 1.4, w: 2.6, h: 0.05, fill: { color: BLUE } });
s3.addText([
  { text: "Step 3", options: { fontSize: 18, color: BLUE, bold: true, breakLine: true } },
  { text: "次のコピペへ", options: { fontSize: 16, color: WHITE, bold: true, breakLine: true } },
  { text: "", options: { fontSize: 6, breakLine: true } },
  { text: "結果を確認したら\n次のプロンプトを\nコピペする", options: { fontSize: 13, color: GRAY } }
], { x: 7.0, y: 1.55, w: 2.2, h: 1.5, margin: 0 });

s3.addText("ダイアログが出たら:", { x: 0.6, y: 3.6, w: 8.8, h: 0.3, fontSize: 14, color: WHITE, bold: true, margin: 0 });
s3.addText([
  { text: "MCP許可 → 「2. Yes, and don't ask again」を選択", options: { fontSize: 13, color: GRAY, breakLine: true } },
  { text: "ファイル保存 → 「1. Yes」を選択", options: { fontSize: 13, color: GRAY, breakLine: true } },
  { text: "ファイル編集 → 「2. Yes, allow all edits」を選択", options: { fontSize: 13, color: GRAY } }
], { x: 0.6, y: 4.0, w: 8.8, h: 0.8, margin: 0 });

// ── Slide 4: Part 1 環境準備 チェックリスト ──
let s4 = pres.addSlide();
s4.background = { color: BLACK };
addHeader(s4, "Part 1: 環境準備", "必要ツール チェックリスト");

const tools = [
  { name: "Node.js", req: "v22以上", cmd: "node -v" },
  { name: "Claude Code", req: "最新版", cmd: "claude --version" },
  { name: "Compact CLI", req: "v0.5.1", cmd: "compact --version" },
  { name: "Docker Desktop", req: "最新版（デプロイ時のみ）", cmd: "docker --version" }
];
s4.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.6, w: 8.8, h: 0.45, fill: { color: BLUE } });
s4.addText("ツール", { x: 0.8, y: 1.6, w: 2.5, h: 0.45, fontSize: 14, color: WHITE, bold: true, valign: "middle", margin: 0 });
s4.addText("要件", { x: 3.3, y: 1.6, w: 3.0, h: 0.45, fontSize: 14, color: WHITE, bold: true, valign: "middle", margin: 0 });
s4.addText("確認コマンド", { x: 6.3, y: 1.6, w: 3.0, h: 0.45, fontSize: 14, color: WHITE, bold: true, valign: "middle", margin: 0 });
tools.forEach((t, i) => {
  const y = 2.05 + i * 0.5;
  const bg = i % 2 === 0 ? DARK_BLUE : BLACK;
  s4.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: y, w: 8.8, h: 0.5, fill: { color: bg } });
  s4.addText(t.name, { x: 0.8, y: y, w: 2.5, h: 0.5, fontSize: 14, color: WHITE, valign: "middle", margin: 0 });
  s4.addText(t.req, { x: 3.3, y: y, w: 3.0, h: 0.5, fontSize: 13, color: GRAY, valign: "middle", margin: 0 });
  s4.addText(t.cmd, { x: 6.3, y: y, w: 3.0, h: 0.5, fontSize: 12, fontFace: "Consolas", color: BLUE, valign: "middle", margin: 0 });
});

// ── Slide 5: Part 1 インストール ──
let s5 = pres.addSlide();
s5.background = { color: BLACK };
addHeader(s5, "Part 1: インストール手順", "ターミナルにコピペしてください");

addCopyBlock(s5, "Node.js 22 インストール", "brew install node@22\nnode -v", 0.6, 1.4, 4.2, 1.0);
addCopyBlock(s5, "Compact CLI インストール", "curl --proto '=https' --tlsv1.2 \\\n  -LsSf https://github.com/\n  midnightntwrk/compact/releases/\n  latest/download/\n  compact-installer.sh | sh\n\nsource ~/.zshrc\ncompact --version", 0.6, 2.6, 4.2, 2.0);

s5.addText("Docker Desktop", { x: 5.4, y: 1.4, w: 4.0, h: 0.3, fontSize: 16, color: BLUE, bold: true, margin: 0 });
s5.addText("公式サイトからダウンロード:\nhttps://docker.com/products/\ndocker-desktop/\n\n※ デプロイ時のみ必要", { x: 5.4, y: 1.8, w: 4.0, h: 1.2, fontSize: 13, color: GRAY, margin: 0 });

s5.addText("Claude Code", { x: 5.4, y: 3.2, w: 4.0, h: 0.3, fontSize: 16, color: BLUE, bold: true, margin: 0 });
s5.addText("公式サイトからダウンロード:\nhttps://claude.ai/code", { x: 5.4, y: 3.6, w: 4.0, h: 0.6, fontSize: 13, color: GRAY, margin: 0 });

// ── Slide 6: Part 2 MCP設定 ──
let s6 = pres.addSlide();
s6.background = { color: BLACK };
addHeader(s6, "Part 2: MCPセットアップ", "ターミナルにコピペしてください");

addCopyBlock(s6, "Step 1: プロジェクト作成 & MCP設定ファイル作成", 'mkdir midnight-workshop\ncd midnight-workshop\n\ncat > .mcp.json << \'EOF\'\n{\n  "mcpServers": {\n    "midnight": {\n      "command": "npx",\n      "args": ["-y", "midnight-mcp@latest"]\n    }\n  }\n}\nEOF', 0.6, 1.4, 5.0, 3.2);

s6.addText("ポイント", { x: 6.0, y: 1.4, w: 3.4, h: 0.3, fontSize: 16, color: WHITE, bold: true, margin: 0 });
s6.addText([
  { text: "たった3行の設定", options: { fontSize: 14, color: BLUE, bold: true, breakLine: true } },
  { text: "", options: { fontSize: 6, breakLine: true } },
  { text: "・APIキー不要", options: { fontSize: 13, color: GRAY, breakLine: true } },
  { text: "・npx経由で自動DL", options: { fontSize: 13, color: GRAY, breakLine: true } },
  { text: "・29ツールが即利用可能", options: { fontSize: 13, color: GRAY, breakLine: true } },
  { text: "", options: { fontSize: 10, breakLine: true } },
  { text: "次のステップ:", options: { fontSize: 14, color: WHITE, bold: true, breakLine: true } },
  { text: "claude と入力して\nClaude Codeを起動", options: { fontSize: 13, color: GRAY } }
], { x: 6.0, y: 1.8, w: 3.4, h: 2.5, margin: 0 });

addCopyBlock(s6, "Step 2: Claude Code起動", "claude", 0.6, 4.8, 3.0, 0.7);

// ── Slide 7: MCP接続確認 ──
let s7 = pres.addSlide();
s7.background = { color: BLACK };
addHeader(s7, "Part 2: MCP接続確認", "Claude Codeにコピペしてください");

addCopyBlock(s7, "プロンプト① MCP接続確認", "利用可能なMCPツールを\nリストアップしてください", 0.6, 1.4, 8.8, 1.0);

s7.addText("→ midnight- プレフィックスの29ツールが表示されれば成功！", { x: 0.6, y: 2.6, w: 8.8, h: 0.4, fontSize: 16, color: BLUE, bold: true, margin: 0 });

s7.addText("初回は「New MCP server found」ダイアログが出ます:", { x: 0.6, y: 3.2, w: 8.8, h: 0.3, fontSize: 14, color: WHITE, margin: 0 });
s7.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 3.6, w: 8.8, h: 1.4, fill: { color: DARK_BLUE } });
s7.addText([
  { text: "MCPサーバー検出時:", options: { fontSize: 14, color: WHITE, bold: true, breakLine: true } },
  { text: "→ 「1. Use this and all future MCP servers」を選択", options: { fontSize: 13, color: BLUE, breakLine: true } },
  { text: "", options: { fontSize: 6, breakLine: true } },
  { text: "MCPツール許可時:", options: { fontSize: 14, color: WHITE, bold: true, breakLine: true } },
  { text: "→ 「2. Yes, and don't ask again」を選択", options: { fontSize: 13, color: BLUE } }
], { x: 0.9, y: 3.7, w: 8.2, h: 1.2, margin: 0 });

// ── Slide 8: Part 3 コントラクト生成 ──
let s8 = pres.addSlide();
s8.background = { color: BLACK };
addHeader(s8, "Part 3: コントラクト生成", "Claude Codeにコピペしてください");

addCopyBlock(s8, "プロンプト② コントラクト生成", "Compact言語で、送金額と送金先を非公開にした\nプライベート決済コントラクトを作成してください。\n\n要件:\n- 送金額（amount）は非公開（witness）\n- 送金先（recipient）は非公開（witness）\n- 残高の正当性はZKPで証明\n- 残高不足の場合はエラー\n- contracts/ フォルダに保存してください", 0.6, 1.4, 8.8, 2.6);

s8.addText("→ 何もせず待ってください。MCPが自動で動きます。", { x: 0.6, y: 4.2, w: 8.8, h: 0.3, fontSize: 16, color: BLUE, bold: true, margin: 0 });
s8.addText([
  { text: "MCPが自動実行: ① 構文リファレンス取得 → ② サンプル参照 → ③ コード生成", options: { fontSize: 13, color: GRAY, breakLine: true } },
  { text: "ファイル保存ダイアログ → 「1. Yes」を選択", options: { fontSize: 13, color: GRAY } }
], { x: 0.6, y: 4.6, w: 8.8, h: 0.6, margin: 0 });

// ── Slide 9: コード解説プロンプト ──
let s9 = pres.addSlide();
s9.background = { color: BLACK };
addHeader(s9, "Part 3: コードを理解する", "Claude Codeにコピペしてください");

addCopyBlock(s9, "プロンプト③ コード解説", "生成したコントラクトの構造を、\nledger・witness・circuitの3つに分けて\n日本語で解説してください", 0.6, 1.4, 8.8, 1.2);

s9.addText("→ 以下の3層構造が解説されます:", { x: 0.6, y: 2.8, w: 8.8, h: 0.3, fontSize: 14, color: WHITE, margin: 0 });

// 3 columns
const cols = [
  { title: "ledger", color: BLUE, desc: "チェーン上に保存\n\nbalance_commitments\n= ハッシュ値のみ\n\n実際の金額は非公開" },
  { title: "witness", color: "ff4444", desc: "ローカルのみ・非公開\n\nlocal_secret_key\nprivate_amount\nprivate_recipient\n\nチェーンに絶対に乗らない" },
  { title: "circuit", color: "44ff44", desc: "処理ロジック\n\ndeposit = 入金（公開）\nprivate_transfer\n= ZKP送金（非公開）\ncheck_balance\n= 残高確認（非公開）" }
];
cols.forEach((c, i) => {
  const x = 0.6 + i * 3.2;
  s9.addShape(pres.shapes.RECTANGLE, { x: x, y: 3.2, w: 2.9, h: 2.2, fill: { color: DARK_BLUE } });
  s9.addShape(pres.shapes.RECTANGLE, { x: x, y: 3.2, w: 2.9, h: 0.05, fill: { color: c.color } });
  s9.addText(c.title, { x: x + 0.15, y: 3.3, w: 2.6, h: 0.3, fontSize: 16, fontFace: "Consolas", color: c.color, bold: true, margin: 0 });
  s9.addText(c.desc, { x: x + 0.15, y: 3.7, w: 2.6, h: 1.6, fontSize: 11, color: GRAY, margin: 0 });
});

// ── Slide 10: Part 4 コンパイル ──
let s10 = pres.addSlide();
s10.background = { color: BLACK };
addHeader(s10, "Part 4: MCPコンパイル", "Claude Codeにコピペしてください");

addCopyBlock(s10, "プロンプト④ コンパイル", "生成したコントラクトを\nMCPでコンパイルしてください", 0.6, 1.4, 8.8, 0.9);

s10.addText("→ 何もせず待ってください。MCPがホストコンパイラに接続します。", { x: 0.6, y: 2.5, w: 8.8, h: 0.3, fontSize: 15, color: BLUE, bold: true, margin: 0 });

s10.addText("エラーが出ても大丈夫！MCPが自動修正します", { x: 0.6, y: 3.0, w: 8.8, h: 0.3, fontSize: 16, color: WHITE, bold: true, margin: 0 });

s10.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 3.5, w: 8.8, h: 1.6, fill: { color: DARK_BLUE } });
s10.addText([
  { text: "よくあるエラーと自動修正:", options: { fontSize: 13, color: WHITE, bold: true, breakLine: true } },
  { text: "", options: { fontSize: 4, breakLine: true } },
  { text: "1. disclose()の欠落 → ZKP証明出力にdisclose()を自動追加", options: { fontSize: 12, color: GRAY, breakLine: true } },
  { text: "2. 型の不一致 → as_bytes()による型変換を追加", options: { fontSize: 12, color: GRAY, breakLine: true } },
  { text: "3. witnessアクセスの誤り → circuit内に参照を移動", options: { fontSize: 12, color: GRAY, breakLine: true } },
  { text: "", options: { fontSize: 4, breakLine: true } },
  { text: "修正ダイアログ → 「1. Yes」または「2. Yes, allow all edits」を選択", options: { fontSize: 12, color: BLUE } }
], { x: 0.9, y: 3.6, w: 8.2, h: 1.4, margin: 0 });

// ── Slide 11: コンパイル確認 ──
let s11 = pres.addSlide();
s11.background = { color: BLACK };
addHeader(s11, "Part 4: コンパイル結果の確認", "Claude Codeにコピペしてください");

addCopyBlock(s11, "プロンプト⑤ 結果確認", "コンパイル結果のサマリーを表示してください。\n回路の数と名前も含めてください", 0.6, 1.4, 8.8, 0.9);

s11.addText("→ 3つの回路が表示されれば成功！", { x: 0.6, y: 2.5, w: 8.8, h: 0.3, fontSize: 16, color: BLUE, bold: true, margin: 0 });

s11.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 3.0, w: 8.8, h: 0.4, fill: { color: BLUE } });
s11.addText("回路名", { x: 0.8, y: 3.0, w: 2.5, h: 0.4, fontSize: 14, color: WHITE, bold: true, valign: "middle", margin: 0 });
s11.addText("種別", { x: 3.3, y: 3.0, w: 2.5, h: 0.4, fontSize: 14, color: WHITE, bold: true, valign: "middle", margin: 0 });
s11.addText("説明", { x: 5.8, y: 3.0, w: 3.6, h: 0.4, fontSize: 14, color: WHITE, bold: true, valign: "middle", margin: 0 });

const circuits = [
  { name: "deposit", type: "公開", desc: "残高のコミットをチェーンに登録" },
  { name: "private_transfer", type: "ZKP", desc: "金額・宛先を秘匿したまま送金" },
  { name: "check_balance", type: "プライベート", desc: "自分の残高を確認（他者非公開）" }
];
circuits.forEach((c, i) => {
  const y = 3.4 + i * 0.5;
  const bg = i % 2 === 0 ? DARK_BLUE : BLACK;
  s11.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: y, w: 8.8, h: 0.5, fill: { color: bg } });
  s11.addText(c.name, { x: 0.8, y: y, w: 2.5, h: 0.5, fontSize: 13, fontFace: "Consolas", color: WHITE, valign: "middle", margin: 0 });
  s11.addText(c.type, { x: 3.3, y: y, w: 2.5, h: 0.5, fontSize: 13, color: BLUE, valign: "middle", margin: 0 });
  s11.addText(c.desc, { x: 5.8, y: y, w: 3.6, h: 0.5, fontSize: 13, color: GRAY, valign: "middle", margin: 0 });
});

addCopyBlock(s11, "プロンプト⑥ セキュリティレビュー（オプション）", "このコントラクトのセキュリティレビューを\n実施してください", 0.6, 4.6, 8.8, 0.9);

// ── Slide 12: Part 5 デプロイ ──
let s12 = pres.addSlide();
s12.background = { color: BLACK };
addHeader(s12, "Part 5: テストネットデプロイ（オプション）", "ターミナルにコピペしてください（Docker Desktop起動必須）");

addCopyBlock(s12, "Step 1: プロジェクト作成", "npx create-mn-app my-midnight-app\n# → Contract → Hello World を選択", 0.6, 1.4, 4.2, 0.9);

addCopyBlock(s12, "Step 2: デプロイ実行", "cd my-midnight-app\nnpm run setup", 0.6, 2.5, 4.2, 0.9);

s12.addText("Step 3: ウォレット作成", { x: 5.4, y: 1.4, w: 4.0, h: 0.3, fontSize: 14, color: BLUE, bold: true, margin: 0 });
s12.addText("「1」を入力してEnter\n→ ウォレットアドレスが表示", { x: 5.4, y: 1.8, w: 4.0, h: 0.6, fontSize: 13, color: GRAY, margin: 0 });

s12.addText("Step 4: Faucetでトークン取得", { x: 5.4, y: 2.6, w: 4.0, h: 0.3, fontSize: 14, color: BLUE, bold: true, margin: 0 });
s12.addText("ブラウザで:\nfaucet.preprod.midnight.network\n\nアドレスを貼り付け\n→ トークン受領 → 自動で進行", { x: 5.4, y: 3.0, w: 4.0, h: 1.2, fontSize: 13, color: GRAY, margin: 0 });

s12.addText("Step 5: エクスプローラーで確認", { x: 0.6, y: 4.5, w: 9.0, h: 0.3, fontSize: 14, color: BLUE, bold: true, margin: 0 });
s12.addText("https://preprod.midnightexplorer.com/ → 送金額が「非公開」になっていることを確認", { x: 0.6, y: 4.9, w: 9.0, h: 0.3, fontSize: 13, color: GRAY, margin: 0 });

// ── Slide 13: コピペ一覧 ──
let s13 = pres.addSlide();
s13.background = { color: BLACK };
addHeader(s13, "コピペプロンプト一覧（まとめ）", "Claude Codeに順番にコピペしてください");

const prompts = [
  { num: "①", text: "利用可能なMCPツールをリストアップしてください", purpose: "MCP接続確認" },
  { num: "②", text: "Compact言語で...プライベート決済コントラクトを作成してください", purpose: "コントラクト生成" },
  { num: "③", text: "生成したコントラクトの構造を...日本語で解説してください", purpose: "コード理解" },
  { num: "④", text: "生成したコントラクトをMCPでコンパイルしてください", purpose: "コンパイル" },
  { num: "⑤", text: "コンパイル結果のサマリーを表示してください", purpose: "結果確認" },
  { num: "⑥", text: "このコントラクトのセキュリティレビューを実施してください", purpose: "レビュー" }
];
prompts.forEach((p, i) => {
  const y = 1.4 + i * 0.6;
  s13.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: y, w: 0.45, h: 0.45, fill: { color: BLUE } });
  s13.addText(p.num, { x: 0.6, y: y, w: 0.45, h: 0.45, fontSize: 16, color: WHITE, align: "center", valign: "middle", bold: true, margin: 0 });
  s13.addText(p.text, { x: 1.2, y: y, w: 6.5, h: 0.45, fontSize: 13, color: GRAY, valign: "middle", margin: 0 });
  s13.addText(p.purpose, { x: 7.8, y: y, w: 1.6, h: 0.45, fontSize: 12, color: BLUE, valign: "middle", margin: 0 });
});

s13.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 5.0, w: 8.8, h: 0.4, fill: { color: COPY_BG } });
s13.addText("詳細なプロンプト全文は Markdownマニュアル（docs/manual.md）を参照", { x: 0.9, y: 5.0, w: 8.2, h: 0.4, fontSize: 13, color: WHITE, valign: "middle", margin: 0 });

// ── Slide 14: トラブルシューティング ──
let s14 = pres.addSlide();
s14.background = { color: BLACK };
addHeader(s14, "トラブルシューティング");

const troubles = [
  { symptom: "MCP接続できない", fix: ".mcp.json の存在確認 / Node.js v22+ / 同フォルダで起動" },
  { symptom: "コンパイル失敗", fix: "compact --version 確認 / disclose()エラー → Part 4参照" },
  { symptom: "Docker起動しない", fix: "Docker Desktopアプリ起動確認 / メモリ4GB以上推奨" },
  { symptom: "Preprod接続不可", fix: "ネットワーク状態確認 / 時間を置いてリトライ" }
];
s14.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.4, w: 4.0, h: 0.4, fill: { color: BLUE } });
s14.addText("症状", { x: 0.8, y: 1.4, w: 3.6, h: 0.4, fontSize: 14, color: WHITE, bold: true, valign: "middle", margin: 0 });
s14.addShape(pres.shapes.RECTANGLE, { x: 4.6, y: 1.4, w: 4.8, h: 0.4, fill: { color: BLUE } });
s14.addText("対処法", { x: 4.8, y: 1.4, w: 4.4, h: 0.4, fontSize: 14, color: WHITE, bold: true, valign: "middle", margin: 0 });
troubles.forEach((t, i) => {
  const y = 1.8 + i * 0.7;
  const bg = i % 2 === 0 ? DARK_BLUE : BLACK;
  s14.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: y, w: 4.0, h: 0.7, fill: { color: bg } });
  s14.addText(t.symptom, { x: 0.8, y: y, w: 3.6, h: 0.7, fontSize: 14, color: WHITE, valign: "middle", margin: 0 });
  s14.addShape(pres.shapes.RECTANGLE, { x: 4.6, y: y, w: 4.8, h: 0.7, fill: { color: bg } });
  s14.addText(t.fix, { x: 4.8, y: y, w: 4.4, h: 0.7, fontSize: 12, color: GRAY, valign: "middle", margin: 0 });
});

// ── Slide 15: リソース ──
let s15 = pres.addSlide();
s15.background = { color: BLACK };
addHeader(s15, "主要リソース");

const resources = [
  { name: "Midnight 公式ドキュメント", url: "docs.midnight.network" },
  { name: "Midnight MCP GitHub", url: "github.com/Olanetsoft/midnight-mcp" },
  { name: "Compact 言語リファレンス", url: "docs.midnight.network/compact/reference" },
  { name: "インストールガイド", url: "docs.midnight.network/getting-started" },
  { name: "Preprod Faucet", url: "faucet.preprod.midnight.network" },
  { name: "Preprod エクスプローラー", url: "preprod.midnightexplorer.com" }
];
resources.forEach((r, i) => {
  const y = 1.4 + i * 0.6;
  s15.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: y, w: 0.06, h: 0.4, fill: { color: BLUE } });
  s15.addText(r.name, { x: 0.9, y: y, w: 4.0, h: 0.4, fontSize: 15, color: WHITE, valign: "middle", margin: 0 });
  s15.addText(r.url, { x: 5.0, y: y, w: 4.4, h: 0.4, fontSize: 13, fontFace: "Consolas", color: BLUE, valign: "middle", margin: 0 });
});

// ── Slide 16: チェックリスト ──
let s16 = pres.addSlide();
s16.background = { color: BLACK };
addHeader(s16, "振り返りチェックリスト");

const checks = [
  ".mcp.json を設置して Claude Code から Midnight MCP に接続できた",
  "自然言語プロンプトで Compact コントラクトが生成できた",
  "ledger / witness / circuit の役割の違いを説明できる",
  "MCP 経由でコンパイルを実行し、エラーを自動修正できた",
  "（オプション）Preprod テストネットにデプロイできた"
];
checks.forEach((text, i) => {
  s16.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.5 + i * 0.7, w: 0.4, h: 0.4, fill: { color: DARK_BLUE }, line: { color: BLUE, width: 2 } });
  s16.addText(text, { x: 1.2, y: 1.5 + i * 0.7, w: 8.2, h: 0.5, fontSize: 16, color: GRAY, valign: "middle", margin: 0 });
});
s16.addText("すべてチェックできたらワークショップ修了です！", { x: 0.6, y: 5.0, w: 8.8, h: 0.3, fontSize: 16, color: BLUE, bold: true, margin: 0 });

// ── Slide 17: 最終 ──
let s17 = pres.addSlide();
s17.background = { color: BLACK };
s17.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.08, fill: { color: BLUE } });
s17.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.545, w: 10, h: 0.08, fill: { color: BLUE } });
s17.addText("Midnight MCP\nハンズオンマニュアル v2.0", { x: 0.6, y: 1.0, w: 6, h: 1.0, fontSize: 32, fontFace: "Arial", color: WHITE, bold: true, margin: 0 });
s17.addText([
  { text: "midnight.network", options: { fontSize: 18, color: BLUE, breakLine: true } },
  { text: "@midnight_jpn", options: { fontSize: 18, color: BLUE, breakLine: true } },
  { text: "", options: { fontSize: 10, breakLine: true } },
  { text: "SIPO | Midnight Ambassador", options: { fontSize: 16, color: GRAY, breakLine: true } },
  { text: "sipo.tokyo", options: { fontSize: 16, color: BLUE } }
], { x: 0.6, y: 2.4, w: 6, h: 2.0, margin: 0 });
s17.addText("ご質問はお気軽にどうぞ", { x: 0.6, y: 4.6, w: 8.8, h: 0.4, fontSize: 16, color: GRAY, margin: 0 });

// Save
const outputPath = "/Users/sition/Documents/SITION/DEV/midnight-mcp-demo/docs/midnight-mcp-manual-v2.pptx";
pres.writeFile({ fileName: outputPath }).then(() => {
  console.log("Created: " + outputPath);
  console.log("Slides: " + pres.slides.length);
}).catch(err => {
  console.error("Error:", err);
});
