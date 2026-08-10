# deploy-test

Midnight JS 4.1.1とCompact 0.31.1を固定した、Preprod向けのCLI検証環境です。

この契約は、金額・残高の実値・saltを秘匿します。送信者と受取人の公開鍵はチェーン上に残り、`check_balance()`は戻り値を公開します。受取人へprivate stateを配送する経路はないため、実用的な二者間決済ではなく、秘匿残高更新の概念実証です。

## 前提

- Node.js 22以上
- Docker Desktop（ローカルproof server用）
- `compact` CLI
- Preprod専用の使い捨てseed
- Preprod上のNIGHT/DUST

実ウォレットのseedを使わないでください。64文字hex seedは`.midnight-seed`へ直接保存し、チャット・ログ・スクリーンショット・commitへ出さないでください。このファイル、`deployment.json`、生成ウォレットキャッシュはgit管理対象外です。

## 再現可能なセットアップ

```bash
npm ci
npm run build
```

`npm run build`は正本のCompactソースを0.31.1で再コンパイルしてから、全CLIエントリーポイントを抑制なしで型検査します。

## コマンド

- `npm run setup` — proof serverを起動し、コントラクトをコンパイル・デプロイ
- `npm run deploy` — 新しいPreprodコントラクトをデプロイし、アドレスをローカルの`deployment.json`へ保存
- `npm run connect-test` — 既存デプロイとの非破壊互換性確認
- `npm run deposit-test` — 公開額でデモ残高コミットメントを更新（tNIGHT移動なし）
- `npm run transfer-test` — 金額を秘匿し、両者の公開鍵を公開する残高更新PoC
- `npm run check-balance` — 公開戻り値を持つ`check_balance()`を実行
- `npm run full-test` — G-3のdeposit→private_transfer→check_balanceを通し実行
- `npm run cli` — 同じSDK 4.1.1ランタイムを使う対話CLI
- `npm test` — Compact再生成後に開示境界とruntime fileを検証

金額、seed、ウォレットアドレス、コントラクトアドレス、トランザクションハッシュなどの運用識別情報は標準出力へ表示しません。

## Preprod

- Faucet: <https://midnight-tmnight-preprod.nethermind.dev/>
- Indexer: `/api/v4/graphql`
- Explorer: <https://preprod.midnightexplorer.com/>
