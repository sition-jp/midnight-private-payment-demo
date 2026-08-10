# Midnight Private Balance Demo — 60秒で始めるZKP開発

Midnight MCPを使ってCompact（ZKP）コントラクトを生成し、金額を秘匿した残高更新をPreprodで確認する概念実証です。

この契約が秘匿するのは送金額・残高の実値・saltです。送信者と受取人の公開鍵はチェーン上に残り、`check_balance()`は残高を公開します。受取人へprivate stateを配送する経路はないため、実用的な二者間決済ではありません。

`deposit` 回路は公開額でデモ用の内部残高コミットメントを初期化します。ウォレットのtNIGHTをコントラクトへ移動する処理ではありません。

## Quick Start

1. 環境チェック: `bash setup/setup-check.sh`
2. Claude Codeをこのフォルダで起動: `claude`
3. MCPが自動認識される（.mcp.json）
4. 自然言語でコントラクト生成を指示

## Structure

- `setup/` — 環境チェックスクリプト
- `contracts/` — 生成したコントラクト置き場
- `demo/` — デモ台本
- `docs/` — ハンズオンマニュアル

## Resources

- [Midnight Docs](https://docs.midnight.network/)
- [Midnight MCP](https://github.com/Olanetsoft/midnight-mcp)
- [Compact Reference](https://docs.midnight.network/compact/reference/compact-reference)
- [Preprod Explorer](https://preprod.midnightexplorer.com/)
- [Preprod Faucet](https://midnight-tmnight-preprod.nethermind.dev/)
