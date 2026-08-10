const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "SIPO / 田平茂樹";
pres.title = "Midnight MCP ハンズオンマニュアル";

const BLACK = "1a1a2e";
const DARK_BLUE = "16213e";
const BLUE = "0066ff";
const WHITE = "ffffff";
const GRAY = "cccccc";
const DARK_GRAY = "888888";
const CODE_BG = "0d1117";

function addHeader(slide, title, subtitle) {
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.06, fill: { color: BLUE } });
  slide.addText(title, { x: 0.6, y: 0.3, w: 8.8, h: 0.7, fontSize: 28, fontFace: "Arial", color: WHITE, bold: true, margin: 0 });
  if (subtitle) {
    slide.addText(subtitle, { x: 0.6, y: 1.0, w: 8.8, h: 0.4, fontSize: 16, color: BLUE, margin: 0 });
  }
}

function addCodeBlock(slide, code, x, y, w, h) {
  slide.addShape(pres.shapes.RECTANGLE, { x: x, y: y, w: w, h: h, fill: { color: CODE_BG } });
  slide.addText(code, { x: x + 0.15, y: y + 0.1, w: w - 0.3, h: h - 0.2, fontSize: 11, fontFace: "Consolas", color: "e6edf3", margin: 0 });
}

// ── Slide 1: Title ──
let s1 = pres.addSlide();
s1.background = { color: BLACK };
s1.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.08, fill: { color: BLUE } });
s1.addText("Midnight MCP", { x: 0.6, y: 1.0, w: 8.8, h: 0.8, fontSize: 44, fontFace: "Arial", color: BLUE, bold: true, margin: 0 });
s1.addText("ハンズオンマニュアル", { x: 0.6, y: 1.8, w: 8.8, h: 0.7, fontSize: 36, fontFace: "Arial", color: WHITE, margin: 0 });
s1.addText("Claude Code × Midnight でプライバシーコントラクトを作る", { x: 0.6, y: 2.7, w: 8.8, h: 0.4, fontSize: 16, color: GRAY, margin: 0 });
s1.addText([
  { text: "対象: 開発者・ビジネス受講者", options: { fontSize: 14, color: GRAY, breakLine: true } },
  { text: "所要時間: 約60〜90分", options: { fontSize: 14, color: GRAY, breakLine: true } },
  { text: "SIPO | Midnight Ambassador", options: { fontSize: 14, color: BLUE } }
], { x: 0.6, y: 3.6, w: 8.8, h: 1.0, margin: 0 });

// ── Slide 2: 学ぶこと ──
let s2 = pres.addSlide();
s2.background = { color: BLACK };
addHeader(s2, "このワークショップで学ぶこと");
const learns = [
  "Claude Code に Midnight MCP を接続し、29種類のツールを使う方法",
  "自然言語プロンプトからプライバシーコントラクトを生成する方法",
  "MCP経由でコンパイル・エラー自動修正する方法",
  "Midnight Preprodテストネットにデプロイする方法（オプション）"
];
learns.forEach((text, i) => {
  s2.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.5 + i * 0.8, w: 0.5, h: 0.5, fill: { color: BLUE } });
  s2.addText(String(i + 1), { x: 0.6, y: 1.5 + i * 0.8, w: 0.5, h: 0.5, fontSize: 18, color: WHITE, align: "center", valign: "middle", bold: true, margin: 0 });
  s2.addText(text, { x: 1.3, y: 1.5 + i * 0.8, w: 8.1, h: 0.5, fontSize: 16, color: GRAY, valign: "middle", margin: 0 });
});

// ── Slide 3: Part 1 環境準備 ──
let s3 = pres.addSlide();
s3.background = { color: BLACK };
addHeader(s3, "Part 1: 環境準備", "必要ツール チェックリスト");

const tools = [
  { name: "Node.js", req: "v22以上", cmd: "node -v" },
  { name: "Claude Code", req: "最新版", cmd: "claude --version" },
  { name: "Compact CLI", req: "v0.5.1", cmd: "compact --version" },
  { name: "Docker Desktop", req: "最新版（デプロイ時のみ）", cmd: "docker --version" }
];
// Table header
s3.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.6, w: 8.8, h: 0.45, fill: { color: BLUE } });
s3.addText("ツール", { x: 0.8, y: 1.6, w: 2.5, h: 0.45, fontSize: 14, color: WHITE, bold: true, valign: "middle", margin: 0 });
s3.addText("要件", { x: 3.3, y: 1.6, w: 3.0, h: 0.45, fontSize: 14, color: WHITE, bold: true, valign: "middle", margin: 0 });
s3.addText("確認コマンド", { x: 6.3, y: 1.6, w: 3.0, h: 0.45, fontSize: 14, color: WHITE, bold: true, valign: "middle", margin: 0 });

tools.forEach((t, i) => {
  const y = 2.05 + i * 0.5;
  const bg = i % 2 === 0 ? DARK_BLUE : BLACK;
  s3.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: y, w: 8.8, h: 0.5, fill: { color: bg } });
  s3.addText(t.name, { x: 0.8, y: y, w: 2.5, h: 0.5, fontSize: 14, color: WHITE, valign: "middle", margin: 0 });
  s3.addText(t.req, { x: 3.3, y: y, w: 3.0, h: 0.5, fontSize: 13, color: GRAY, valign: "middle", margin: 0 });
  s3.addText(t.cmd, { x: 6.3, y: y, w: 3.0, h: 0.5, fontSize: 12, fontFace: "Consolas", color: BLUE, valign: "middle", margin: 0 });
});

// ── Slide 4: インストール手順 ──
let s4 = pres.addSlide();
s4.background = { color: BLACK };
addHeader(s4, "Part 1: インストール手順");

s4.addText("Node.js 22", { x: 0.6, y: 1.3, w: 4.0, h: 0.3, fontSize: 16, color: BLUE, bold: true, margin: 0 });
addCodeBlock(s4, "brew install node@22\nnode -v", 0.6, 1.7, 4.0, 0.7);

s4.addText("Compact CLI", { x: 0.6, y: 2.6, w: 4.0, h: 0.3, fontSize: 16, color: BLUE, bold: true, margin: 0 });
addCodeBlock(s4, "curl --proto '=https' --tlsv1.2 -LsSf \\\n  https://github.com/midnightntwrk/\n  compact/releases/latest/download/\n  compact-installer.sh | sh\n\ncompact --version", 0.6, 3.0, 4.0, 1.4);

s4.addText("Docker Desktop", { x: 5.2, y: 1.3, w: 4.2, h: 0.3, fontSize: 16, color: BLUE, bold: true, margin: 0 });
s4.addText("公式サイトからダウンロード\nhttps://docker.com/products/\ndocker-desktop/\n\nApple Silicon Mac用を選択", { x: 5.2, y: 1.7, w: 4.2, h: 1.2, fontSize: 13, color: GRAY, margin: 0 });

s4.addText("Claude Code", { x: 5.2, y: 3.1, w: 4.2, h: 0.3, fontSize: 16, color: BLUE, bold: true, margin: 0 });
s4.addText("公式サイトからダウンロード\nhttps://claude.ai/code", { x: 5.2, y: 3.5, w: 4.2, h: 0.6, fontSize: 13, color: GRAY, margin: 0 });

s4.addText("環境チェック: bash setup/setup-check.sh", { x: 0.6, y: 4.8, w: 8.8, h: 0.3, fontSize: 14, fontFace: "Consolas", color: DARK_GRAY, margin: 0 });

// ── Slide 5: Part 2 MCPセットアップ ──
let s5 = pres.addSlide();
s5.background = { color: BLACK };
addHeader(s5, "Part 2: MCPセットアップ", "Midnight MCP とは？");

s5.addText([
  { text: "Midnight MCP（Model Context Protocol）は、Claude Code が\nMidnightブロックチェーンのツール群を直接呼び出すための拡張インターフェース", options: { fontSize: 15, color: GRAY, breakLine: true } },
  { text: "", options: { fontSize: 8, breakLine: true } },
  { text: "接続後に使えるツールは 29種類", options: { fontSize: 16, color: WHITE, bold: true, breakLine: true } },
  { text: "APIキーは不要", options: { fontSize: 16, color: BLUE, bold: true } }
], { x: 0.6, y: 1.5, w: 8.8, h: 1.6, margin: 0 });

s5.addText(".mcp.json をプロジェクトルートに作成", { x: 0.6, y: 3.3, w: 8.8, h: 0.3, fontSize: 14, color: WHITE, bold: true, margin: 0 });
addCodeBlock(s5, '{\n  "mcpServers": {\n    "midnight": {\n      "command": "npx",\n      "args": ["-y", "midnight-mcp@latest"]\n    }\n  }\n}', 0.6, 3.7, 5.0, 1.6);

s5.addText("たった3行の設定で\n60秒セットアップ完了", { x: 6.0, y: 3.7, w: 3.4, h: 1.0, fontSize: 18, color: BLUE, bold: true, margin: 0 });

// ── Slide 6: MCP接続確認 ──
let s6 = pres.addSlide();
s6.background = { color: BLACK };
addHeader(s6, "Part 2: MCP接続確認");

s6.addText("Step 1: Claude Codeを起動", { x: 0.6, y: 1.3, w: 8.8, h: 0.3, fontSize: 16, color: BLUE, bold: true, margin: 0 });
addCodeBlock(s6, "cd midnight-workshop\nclaude", 0.6, 1.7, 5.0, 0.6);

s6.addText("Step 2: MCP接続を確認", { x: 0.6, y: 2.5, w: 8.8, h: 0.3, fontSize: 16, color: BLUE, bold: true, margin: 0 });
addCodeBlock(s6, "利用可能なMCPツールをリストアップしてください", 0.6, 2.9, 7.0, 0.5);

s6.addText("Step 3: 29個のmidnight-ツールが表示されればOK", { x: 0.6, y: 3.6, w: 8.8, h: 0.3, fontSize: 16, color: WHITE, margin: 0 });

s6.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 4.1, w: 8.8, h: 1.0, fill: { color: DARK_BLUE } });
s6.addText([
  { text: "接続できない場合の確認ポイント:", options: { fontSize: 13, color: WHITE, bold: true, breakLine: true } },
  { text: "・.mcp.json がプロジェクトルートに存在するか\n・Node.js v22以上か\n・Claude Codeを .mcp.json と同じフォルダで起動しているか", options: { fontSize: 12, color: GRAY } }
], { x: 0.9, y: 4.2, w: 8.2, h: 0.8, margin: 0 });

// ── Slide 7: Part 3 コントラクト生成 ──
let s7 = pres.addSlide();
s7.background = { color: BLACK };
addHeader(s7, "Part 3: コントラクト生成", "プライバシーコントラクトとは？");

s7.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.5, w: 4.0, h: 1.5, fill: { color: DARK_BLUE } });
s7.addText([
  { text: "従来のブロックチェーン", options: { fontSize: 14, bold: true, color: GRAY, breakLine: true } },
  { text: "", options: { fontSize: 6, breakLine: true } },
  { text: "すべての取引情報が\nチェーン上に公開される\n（送金額・送金先）", options: { fontSize: 13, color: GRAY } }
], { x: 0.9, y: 1.6, w: 3.4, h: 1.3, margin: 0 });

s7.addShape(pres.shapes.RECTANGLE, { x: 5.2, y: 1.5, w: 4.2, h: 1.5, fill: { color: BLUE } });
s7.addText([
  { text: "Midnightコントラクト", options: { fontSize: 14, bold: true, color: WHITE, breakLine: true } },
  { text: "", options: { fontSize: 6, breakLine: true } },
  { text: "金額・残高実値・saltを秘匿\n送信者・受取人の公開鍵は公開", options: { fontSize: 13, color: WHITE } }
], { x: 5.5, y: 1.6, w: 3.6, h: 1.3, margin: 0 });

s7.addText("生成プロンプト:", { x: 0.6, y: 3.3, w: 8.8, h: 0.3, fontSize: 14, color: WHITE, bold: true, margin: 0 });
addCodeBlock(s7, "金額と残高実値を非公開にし、両者の公開鍵を公開する\n残高更新コントラクトを作成してください", 0.6, 3.7, 8.8, 0.7);

s7.addText("→ MCPが自動で構文取得 → サンプル参照 → コード生成", { x: 0.6, y: 4.6, w: 8.8, h: 0.3, fontSize: 14, color: BLUE, margin: 0 });

// ── Slide 8: コントラクト構造 ──
let s8 = pres.addSlide();
s8.background = { color: BLACK };
addHeader(s8, "Part 3: 生成されるコントラクトの構造");

// ledger
s8.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.3, w: 2.8, h: 3.5, fill: { color: DARK_BLUE } });
s8.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.3, w: 2.8, h: 0.05, fill: { color: BLUE } });
s8.addText("ledger", { x: 0.8, y: 1.4, w: 2.4, h: 0.3, fontSize: 16, color: BLUE, bold: true, margin: 0 });
s8.addText("チェーン上に保存", { x: 0.8, y: 1.7, w: 2.4, h: 0.3, fontSize: 12, color: GRAY, margin: 0 });
s8.addText("balance_commitments:\nMap<Bytes<32>,\n     Bytes<32>>", { x: 0.8, y: 2.2, w: 2.4, h: 0.8, fontSize: 11, fontFace: "Consolas", color: WHITE, margin: 0 });
s8.addText("残高のハッシュ値のみ\n実際の金額は非公開", { x: 0.8, y: 3.2, w: 2.4, h: 0.5, fontSize: 12, color: GRAY, margin: 0 });

// witness
s8.addShape(pres.shapes.RECTANGLE, { x: 3.6, y: 1.3, w: 2.8, h: 3.5, fill: { color: DARK_BLUE } });
s8.addShape(pres.shapes.RECTANGLE, { x: 3.6, y: 1.3, w: 2.8, h: 0.05, fill: { color: "ff4444" } });
s8.addText("witness", { x: 3.8, y: 1.4, w: 2.4, h: 0.3, fontSize: 16, color: "ff4444", bold: true, margin: 0 });
s8.addText("ローカルのみ・非公開", { x: 3.8, y: 1.7, w: 2.4, h: 0.3, fontSize: 12, color: GRAY, margin: 0 });
s8.addText("local_secret_key\nprivate_amount\nprivate_recipient", { x: 3.8, y: 2.2, w: 2.4, h: 0.8, fontSize: 11, fontFace: "Consolas", color: WHITE, margin: 0 });
s8.addText("秘密鍵・送金額・saltは秘匿\n受取人公開鍵は\ndisclose()で公開", { x: 3.8, y: 3.2, w: 2.4, h: 0.6, fontSize: 12, color: GRAY, margin: 0 });

// circuit
s8.addShape(pres.shapes.RECTANGLE, { x: 6.6, y: 1.3, w: 2.8, h: 3.5, fill: { color: DARK_BLUE } });
s8.addShape(pres.shapes.RECTANGLE, { x: 6.6, y: 1.3, w: 2.8, h: 0.05, fill: { color: "44ff44" } });
s8.addText("circuit", { x: 6.8, y: 1.4, w: 2.4, h: 0.3, fontSize: 16, color: "44ff44", bold: true, margin: 0 });
s8.addText("処理ロジック", { x: 6.8, y: 1.7, w: 2.4, h: 0.3, fontSize: 12, color: GRAY, margin: 0 });
s8.addText("deposit\n → 公開額で残高更新\n\nprivate_transfer\n → 金額秘匿・公開鍵公開\n\ncheck_balance\n → 残高を公開", { x: 6.8, y: 2.1, w: 2.4, h: 1.8, fontSize: 11, color: WHITE, margin: 0 });

// ── Slide 9: Part 4 コンパイル ──
let s9 = pres.addSlide();
s9.background = { color: BLACK };
addHeader(s9, "Part 4: MCPコンパイル＆レビュー");

s9.addText("コンパイルの仕組み", { x: 0.6, y: 1.3, w: 8.8, h: 0.3, fontSize: 16, color: BLUE, bold: true, margin: 0 });
s9.addText("Claude Code → MCP → Midnight ホストコンパイラ → 結果を返す", { x: 0.6, y: 1.7, w: 8.8, h: 0.3, fontSize: 14, color: GRAY, margin: 0 });

s9.addText("コンパイル実行プロンプト:", { x: 0.6, y: 2.2, w: 8.8, h: 0.3, fontSize: 14, color: WHITE, bold: true, margin: 0 });
addCodeBlock(s9, "先ほど生成したコントラクトをコンパイルしてください", 0.6, 2.6, 8.0, 0.5);

s9.addText("エラーが出てもMCPが自動修正！", { x: 0.6, y: 3.3, w: 8.8, h: 0.3, fontSize: 16, color: BLUE, bold: true, margin: 0 });

s9.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 3.8, w: 8.8, h: 1.5, fill: { color: DARK_BLUE } });
s9.addText([
  { text: "よくあるエラーと自動修正:", options: { fontSize: 13, color: WHITE, bold: true, breakLine: true } },
  { text: "", options: { fontSize: 4, breakLine: true } },
  { text: "1. disclose()の欠落 → ZKP証明出力にdisclose()を自動追加", options: { fontSize: 12, color: GRAY, breakLine: true } },
  { text: "2. 型の不一致 → as_bytes()による型変換を追加", options: { fontSize: 12, color: GRAY, breakLine: true } },
  { text: "3. witnessアクセスの誤り → circuit内に参照を移動", options: { fontSize: 12, color: GRAY } }
], { x: 0.9, y: 3.9, w: 8.2, h: 1.3, margin: 0 });

// ── Slide 10: Part 5 デプロイ ──
let s10 = pres.addSlide();
s10.background = { color: BLACK };
addHeader(s10, "Part 5: テストネットデプロイ（オプション）");

s10.addText("Step 1: プロジェクト作成", { x: 0.6, y: 1.3, w: 4.0, h: 0.3, fontSize: 14, color: BLUE, bold: true, margin: 0 });
addCodeBlock(s10, "npx create-mn-app my-app\n# Contract → Hello World を選択", 0.6, 1.7, 4.0, 0.6);

s10.addText("Step 2: ワンコマンドデプロイ", { x: 0.6, y: 2.5, w: 4.0, h: 0.3, fontSize: 14, color: BLUE, bold: true, margin: 0 });
addCodeBlock(s10, "cd my-app\nnpm run setup", 0.6, 2.9, 4.0, 0.6);

s10.addText("Step 3: Faucetでトークン取得", { x: 5.2, y: 1.3, w: 4.2, h: 0.3, fontSize: 14, color: BLUE, bold: true, margin: 0 });
s10.addText("https://faucet.preprod.\nmidnight.network/\n\nウォレットアドレスを入力\n→ tNightトークンを受領", { x: 5.2, y: 1.7, w: 4.2, h: 1.2, fontSize: 13, color: GRAY, margin: 0 });

s10.addText("Step 4: エクスプローラーで確認", { x: 5.2, y: 3.1, w: 4.2, h: 0.3, fontSize: 14, color: BLUE, bold: true, margin: 0 });
s10.addText("https://preprod.\nmidnightexplorer.com/\n\n送金額が「非公開」に\nなっていることを確認", { x: 5.2, y: 3.5, w: 4.2, h: 1.2, fontSize: 13, color: GRAY, margin: 0 });

s10.addText("npm run setup が自動で: Proof Server起動 → コンパイル → デプロイ", { x: 0.6, y: 4.8, w: 8.8, h: 0.3, fontSize: 13, color: DARK_GRAY, margin: 0 });

// ── Slide 11: トラブルシューティング ──
let s11 = pres.addSlide();
s11.background = { color: BLACK };
addHeader(s11, "トラブルシューティング");

const troubles = [
  { symptom: "MCP接続できない", fix: ".mcp.json の存在確認 / Node.js v22+ / 同フォルダで起動" },
  { symptom: "コンパイル失敗", fix: "compact --version 確認 / disclose()エラー → Part 4参照" },
  { symptom: "Docker起動しない", fix: "Docker Desktopアプリ起動確認 / メモリ4GB以上推奨" },
  { symptom: "Preprod接続不可", fix: "ネットワーク状態確認 / 時間を置いてリトライ" }
];

s11.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.4, w: 4.0, h: 0.4, fill: { color: BLUE } });
s11.addText("症状", { x: 0.8, y: 1.4, w: 3.6, h: 0.4, fontSize: 14, color: WHITE, bold: true, valign: "middle", margin: 0 });
s11.addShape(pres.shapes.RECTANGLE, { x: 4.6, y: 1.4, w: 4.8, h: 0.4, fill: { color: BLUE } });
s11.addText("対処法", { x: 4.8, y: 1.4, w: 4.4, h: 0.4, fontSize: 14, color: WHITE, bold: true, valign: "middle", margin: 0 });

troubles.forEach((t, i) => {
  const y = 1.8 + i * 0.7;
  const bg = i % 2 === 0 ? DARK_BLUE : BLACK;
  s11.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: y, w: 4.0, h: 0.7, fill: { color: bg } });
  s11.addText(t.symptom, { x: 0.8, y: y, w: 3.6, h: 0.7, fontSize: 14, color: WHITE, valign: "middle", margin: 0 });
  s11.addShape(pres.shapes.RECTANGLE, { x: 4.6, y: y, w: 4.8, h: 0.7, fill: { color: bg } });
  s11.addText(t.fix, { x: 4.8, y: y, w: 4.4, h: 0.7, fontSize: 12, color: GRAY, valign: "middle", margin: 0 });
});

// ── Slide 12: リソース ──
let s12 = pres.addSlide();
s12.background = { color: BLACK };
addHeader(s12, "主要リソース");

const resources = [
  { name: "Midnight 公式ドキュメント", url: "docs.midnight.network" },
  { name: "Midnight MCP GitHub", url: "github.com/Olanetsoft/midnight-mcp" },
  { name: "Compact 言語リファレンス", url: "docs.midnight.network/compact/reference" },
  { name: "インストールガイド", url: "docs.midnight.network/getting-started/installation" },
  { name: "Preprod Faucet", url: "faucet.preprod.midnight.network" },
  { name: "Preprod エクスプローラー", url: "preprod.midnightexplorer.com" }
];
resources.forEach((r, i) => {
  const y = 1.4 + i * 0.6;
  s12.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: y, w: 0.06, h: 0.4, fill: { color: BLUE } });
  s12.addText(r.name, { x: 0.9, y: y, w: 4.0, h: 0.4, fontSize: 15, color: WHITE, valign: "middle", margin: 0 });
  s12.addText(r.url, { x: 5.0, y: y, w: 4.4, h: 0.4, fontSize: 13, fontFace: "Consolas", color: BLUE, valign: "middle", margin: 0 });
});

// ── Slide 13: 振り返りチェックリスト ──
let s13 = pres.addSlide();
s13.background = { color: BLACK };
addHeader(s13, "振り返りチェックリスト");

const checks = [
  ".mcp.json を設置して Claude Code から Midnight MCP に接続できた",
  "自然言語プロンプトで Compact コントラクトが生成できた",
  "ledger / witness / circuit の役割の違いを説明できる",
  "MCP 経由でコンパイルを実行し、エラーを自動修正できた",
  "（オプション）Preprod テストネットにデプロイできた"
];
checks.forEach((text, i) => {
  s13.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.5 + i * 0.7, w: 0.4, h: 0.4, fill: { color: DARK_BLUE }, line: { color: BLUE, width: 2 } });
  s13.addText(text, { x: 1.2, y: 1.5 + i * 0.7, w: 8.2, h: 0.5, fontSize: 16, color: GRAY, valign: "middle", margin: 0 });
});

s13.addText("すべてチェックできたらワークショップ修了です！", { x: 0.6, y: 5.0, w: 8.8, h: 0.3, fontSize: 16, color: BLUE, bold: true, margin: 0 });

// ── Slide 14: 最終スライド ──
let s14 = pres.addSlide();
s14.background = { color: BLACK };
s14.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.08, fill: { color: BLUE } });
s14.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.545, w: 10, h: 0.08, fill: { color: BLUE } });
s14.addText("Midnight MCP\nハンズオンマニュアル", { x: 0.6, y: 1.0, w: 6, h: 1.0, fontSize: 32, fontFace: "Arial", color: WHITE, bold: true, margin: 0 });
s14.addText([
  { text: "midnight.network", options: { fontSize: 18, color: BLUE, breakLine: true } },
  { text: "@midnight_jpn", options: { fontSize: 18, color: BLUE, breakLine: true } },
  { text: "", options: { fontSize: 10, breakLine: true } },
  { text: "SIPO | Midnight Ambassador", options: { fontSize: 16, color: GRAY, breakLine: true } },
  { text: "sipo.tokyo", options: { fontSize: 16, color: BLUE } }
], { x: 0.6, y: 2.4, w: 6, h: 2.0, margin: 0 });
s14.addText("ご質問はお気軽にどうぞ", { x: 0.6, y: 4.6, w: 8.8, h: 0.4, fontSize: 16, color: GRAY, margin: 0 });

// Save
const outputPath = require("node:path").join(__dirname, "midnight-mcp-manual.pptx");
pres.writeFile({ fileName: outputPath }).then(() => {
  console.log("Created: " + outputPath);
  console.log("Slides: " + pres.slides.length);
}).catch(err => {
  console.error("Error:", err);
});
