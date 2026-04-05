# Midnight MCP ハンズオンマニュアル
## Claude Code × Midnight でプライバシーコントラクトを作る

**対象:** 日本語話者の開発者・ビジネス受講者
**難易度:** 入門〜中級
**所要時間:** 約60〜90分
**更新日:** 2026-04-02

---

## このワークショップで学ぶこと

- Claude Code に Midnight MCP を接続し、29種類のMCPツールを呼び出す方法
- Compact言語でプライバシーコントラクトを自然言語プロンプトから生成する方法
- MCP経由でコントラクトをコンパイル・エラー自動修正する方法
- Midnight Preprodテストネットにデプロイする方法（オプション）

---

## Part 1: 環境準備

### 1-1 必要ツール チェックリスト

ワークショップ開始前に以下をすべて確認してください。

| # | ツール | 要件 | 確認コマンド |
|---|--------|------|------------|
| 1 | Node.js | v22以上 | `node -v` |
| 2 | Claude Code | 最新版 | `claude --version` |
| 3 | Compact CLI | v0.5.1 | `compact --version` |
| 4 | Docker Desktop | 最新版（デプロイ時のみ） | `docker --version` |

### 1-2 Node.js 22 インストール

ターミナルにコピペしてください：

```bash
brew install node@22
```

確認：

```bash
node -v
```

→ `v22.x.x` が表示されればOK

Homebrew未インストールの場合は先にこちらを実行：

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 1-3 Claude Code インストール

公式サイト（https://claude.ai/code）から最新版をダウンロードしてインストールします。

確認：

```bash
claude --version
```

### 1-4 Compact CLI インストール

ターミナルにコピペしてください：

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
```

ターミナルを再起動してから確認：

```bash
source ~/.zshrc
compact --version
```

→ `compact 0.5.1` が表示されればOK

### 1-5 Docker Desktop インストール（デプロイ時のみ）

テストネットへのデプロイ（Part 5）を行う場合のみ必要です。
公式サイト（https://www.docker.com/products/docker-desktop/）からインストールします。

確認：

```bash
docker --version
```

### 1-6 プロジェクトフォルダの準備

ターミナルにコピペしてください：

```bash
mkdir midnight-workshop
cd midnight-workshop
```

---

## Part 2: MCPセットアップ

### 2-1 Midnight MCP とは

Midnight MCP（Model Context Protocol）は、Claude Code がMidnightブロックチェーンのツール群を直接呼び出すための拡張インターフェースです。

接続後に使えるツールは **29種類**。コントラクトのコンパイル・テスト・デプロイ・エクスプローラー照会まで、チャット上の指示だけで操作できます。

**APIキーは不要です。** `npx` 経由でオンデマンド実行されます。

### 2-2 .mcp.json の作成

📋 **以下をターミナルにコピペしてください：**

```bash
cat > .mcp.json << 'EOF'
{
  "mcpServers": {
    "midnight": {
      "command": "npx",
      "args": ["-y", "midnight-mcp@latest"]
    }
  }
}
EOF
```

作成できたか確認：

```bash
cat .mcp.json
```

### 2-3 Claude Code の起動

📋 **以下をターミナルにコピペしてください：**

```bash
claude
```

初回起動時に「New MCP server found: midnight」と表示されます。
**「1. Use this and all future MCP servers in this project」** を選択してください。

### 2-4 MCP接続の確認

📋 **以下をClaude Codeにコピペしてください：**

```
利用可能なMCPツールをリストアップしてください
```

→ `midnight-` プレフィックスを持つ29種のツールが表示されれば成功です！

MCPツールの許可ダイアログが出たら **「2. Yes, and don't ask again」** を選択してください。以降の操作がスムーズになります。

### 2-5 接続できない場合

- `.mcp.json` がプロジェクトルートに存在するか確認（`ls -la` で隠しファイルも表示）
- Node.js が v22 以上か確認（`node -v`）
- Claude Code を `.mcp.json` と同じフォルダで起動しているか確認

---

## Part 3: コントラクト生成

### 3-1 プライバシーコントラクトとは

従来のブロックチェーンでは、すべての取引情報（送金額・送金先）がチェーン上に公開されます。

Midnight のプライバシーコントラクトは **ZKP（ゼロ知識証明）** を使い、「送金が正当に行われた事実」だけをチェーンに記録し、金額や相手先はチェーンに乗せません。

```
公開される情報  → 取引が正当に完了した証明
公開されない情報 → 送金額・送金先アドレス・残高
```

### 3-2 コントラクトを生成する

📋 **以下をClaude Codeにコピペしてください：**

```
Compact言語で、送金額と送金先を非公開にしたプライベート決済コントラクトを作成してください。

要件:
- 送金額（amount）は非公開（witness）
- 送金先（recipient）は非公開（witness）
- 残高の正当性はZKPで証明
- 残高不足の場合はエラー
- contracts/ フォルダに保存してください
```

→ MCPが自動的に動き始めます。**何もせず待ってください。**

MCPが以下を自動実行します：
1. Compact構文リファレンスを取得
2. サンプルコントラクトを参照
3. コードを生成

MCPツールの許可ダイアログが出たら **「2. Yes, and don't ask again」** を選択。

→ コントラクトファイルが生成されたら成功です！

### 3-3 生成されたコードを理解する

📋 **以下をClaude Codeにコピペしてください：**

```
生成したコントラクトの構造を、ledger・witness・circuitの3つに分けて日本語で解説してください
```

→ Claude Codeが以下の3つのセクションを解説してくれます：

#### ledger（チェーン上に保存されるデータ）

```compact
ledger {
  balance_commitments: Map<Bytes<32>, Bytes<32>>;
}
```

- `balance_commitments`：残高のハッシュ値のみ記録
- 実際の残高・送金額は **一切チェーンに乗らない**

#### witness（ローカルのみ・チェーン非公開）

```compact
witness {
  local_secret_key: Bytes<32>;
  private_amount: Uint<64>;
  private_recipient: Bytes<32>;
}
```

- `local_secret_key`：ユーザーの秘密鍵（絶対に公開されない）
- `private_amount`：送金額（チェーン非公開）
- `private_recipient`：送金先アドレス（チェーン非公開）

#### circuit（処理ロジック）

| 回路名 | 種別 | 説明 |
|--------|------|------|
| `deposit` | 公開 | 残高のコミットをチェーンに登録 |
| `private_transfer` | ZKP | 金額・宛先を秘匿したまま送金 |
| `check_balance` | プライベート読み取り | 自分の残高を確認（他者非公開） |

### 3-4 コードのポイント：disclose()

`disclose()` は「この値を証明として公開する」という Compact の必須構文です。witnessデータをチェーンに書き込む前には必ず `disclose()` で明示的に公開宣言しないといけません。

後述のコンパイルエラーで頻繁に出てくるので覚えておいてください。

---

## Part 4: コンパイル＆レビュー

### 4-1 コンパイルする

📋 **以下をClaude Codeにコピペしてください：**

```
生成したコントラクトをMCPでコンパイルしてください
```

→ MCPがMidnightのホスト型コンパイラに接続してコンパイルします。**何もせず待ってください。**

### 4-2 エラーが出た場合

エラーが出ても大丈夫です。MCPが自動でエラーを解析して修正を提案します。

修正の許可ダイアログが出たら **「1. Yes」** または **「2. Yes, allow all edits」** を選択してください。

よくあるエラーと自動修正パターン：

| エラー | 原因 | MCPの自動修正 |
|--------|------|-------------|
| `value must be disclosed` | disclose()の欠落 | disclose()を自動追加 |
| `expected Bytes<32>, got Uint<64>` | 型の不一致 | as_bytes()を追加 |
| `witness cannot be accessed outside circuit` | witnessアクセスの誤り | circuit内に参照を移動 |

### 4-3 再コンパイル

エラー修正後、MCPが自動で再コンパイルします。

もし自動で再コンパイルされない場合：

📋 **以下をClaude Codeにコピペしてください：**

```
修正したコントラクトを再コンパイルしてください
```

### 4-4 コンパイル成功の確認

「Compilation successful」と表示されればOK！

📋 **以下をClaude Codeにコピペしてください：**

```
コンパイル結果のサマリーを表示してください。回路の数と名前も含めてください
```

→ 3つの回路（deposit, private_transfer, check_balance）が表示されれば完成です。

### 4-5 セキュリティレビュー（オプション）

📋 **以下をClaude Codeにコピペしてください：**

```
このコントラクトのセキュリティレビューを実施してください
```

→ MCPの `midnight-review-contract` ツールが15+項目のチェックを行います。

---

## Part 5: テストネットデプロイ（オプション）

> **注意:** デプロイには Docker Desktop の起動が必要です。また、Preprod テストネットの状態によっては接続が不安定な場合があります。

### 5-1 プロジェクトを作成

📋 **以下をターミナル（Claude Codeではなく通常のターミナル）にコピペしてください：**

```bash
npx create-mn-app my-midnight-app
```

テンプレート選択画面が表示されたら：
1. **「Contract」** を選択
2. **「Hello World」** を選択

### 5-2 デプロイを実行

📋 **以下をターミナルにコピペしてください：**

```bash
cd my-midnight-app
npm run setup
```

→ 以下が自動実行されます：
1. Docker Proof Serverの起動
2. コントラクトのコンパイル
3. テストネットへのデプロイ

### 5-3 ウォレット作成

「Wallet Setup」画面が表示されたら **「1」** を入力してEnter。

→ ウォレットアドレスが表示されます。

### 5-4 テストトークンの取得

「Waiting for funds...」と表示されたら：

1. ブラウザで https://faucet.preprod.midnight.network/ を開く
2. 表示されたウォレットアドレスをコピペして貼り付け
3. 「Request tokens」をクリック

→ 数分後にトークンが届き、デプロイが自動で進みます。

### 5-5 エクスプローラーで確認

デプロイ完了後、ブラウザで確認：

```
https://preprod.midnightexplorer.com/
```

→ コントラクトアドレスを検索して、**送金額が「非公開」になっていること**を確認してください。

---

## Appendix A: コピペプロンプト一覧

ワークショップで使う全プロンプトをまとめました。順番にコピペしてください。

### ターミナル用

```bash
# 1. プロジェクト作成
mkdir midnight-workshop && cd midnight-workshop

# 2. MCP設定ファイル作成
cat > .mcp.json << 'EOF'
{
  "mcpServers": {
    "midnight": {
      "command": "npx",
      "args": ["-y", "midnight-mcp@latest"]
    }
  }
}
EOF

# 3. Claude Code起動
claude
```

### Claude Code用（順番にコピペ）

```
① 利用可能なMCPツールをリストアップしてください
```

```
② Compact言語で、送金額と送金先を非公開にしたプライベート決済コントラクトを作成してください。

要件:
- 送金額（amount）は非公開（witness）
- 送金先（recipient）は非公開（witness）
- 残高の正当性はZKPで証明
- 残高不足の場合はエラー
- contracts/ フォルダに保存してください
```

```
③ 生成したコントラクトの構造を、ledger・witness・circuitの3つに分けて日本語で解説してください
```

```
④ 生成したコントラクトをMCPでコンパイルしてください
```

```
⑤ コンパイル結果のサマリーを表示してください。回路の数と名前も含めてください
```

```
⑥ このコントラクトのセキュリティレビューを実施してください
```

---

## Appendix B: トラブルシューティング

| 症状 | 確認ポイント |
|------|------------|
| MCP接続できない | `.mcp.json` の存在 / Node.js v22+ / 同フォルダで起動 |
| コンパイル失敗 | `compact --version` 確認 / disclose()エラー → Part 4参照 |
| Docker起動しない | Docker Desktopアプリ起動確認 / メモリ4GB以上推奨 |
| Preprod接続不可 | ネットワーク状態確認 / 時間を置いてリトライ |

---

## Appendix C: 主要リソース

| リソース | URL |
|----------|-----|
| Midnight 公式ドキュメント | https://docs.midnight.network/ |
| Midnight MCP GitHub | https://github.com/Olanetsoft/midnight-mcp |
| Compact 言語リファレンス | https://docs.midnight.network/compact/reference/compact-reference |
| インストールガイド | https://docs.midnight.network/getting-started/installation |
| Preprod Faucet | https://faucet.preprod.midnight.network/ |
| Preprod エクスプローラー | https://preprod.midnightexplorer.com/ |

---

## 振り返りチェックリスト

ワークショップ終了後、以下を確認してください。

- [ ] `.mcp.json` を設置して Claude Code から Midnight MCP に接続できた
- [ ] 自然言語プロンプトで Compact コントラクトが生成できた
- [ ] `ledger` / `witness` / `circuit` の役割の違いを説明できる
- [ ] MCP 経由でコンパイルを実行し、エラーを自動修正できた
- [ ] （オプション）Preprod テストネットにデプロイしてアドレスを取得できた

---

*Midnight MCP ハンズオンマニュアル v2.0 — SITION Group / SIPO*
