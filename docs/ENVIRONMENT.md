# 環境変数リファレンス

> [README](../README.md) に戻る | 参照: [アーキテクチャ](./ARCHITECTURE.md)

```bash
cp .env.example .env
```

`.env.example` には変数名のみを記載しています。値は各自で用意し、`.env` は絶対にコミットしないでください。

## 一覧

| 変数 | 必須 | 用途 |
|------|------|------|
| `BETTER_AUTH_SECRET` | 本番: 必須 | Better Auth がセッション・トークンの署名に使用（`openssl rand -base64 32` で生成） |
| `BETTER_AUTH_URL` | 本番: 必須 | アプリの公開URL。`trustedOrigins` にも使用（ローカルは未設定で可） |
| `TURSO_DATABASE_URL` | Vercel: 推奨 | リモート libSQL データベースの推奨URL名 |
| `TURSO_URL` | 既存環境のみ | `TURSO_DATABASE_URL` が未設定の場合に使う互換alias |
| `TURSO_AUTH_TOKEN` | Vercel: 必須 | リモート libSQL の認証トークン |
| `AI_GATEWAY_API_KEY` | ローカル/CI: 必須 | Vercel AI Gateway の API キー。Vercel 上は OIDC で省略可能だが、本プロジェクトはキー単位の利用量追跡のため Production / Preview にも設定する |

参照実装: [`server/utils/auth.ts`](../server/utils/auth.ts), [`server/db/config.ts`](../server/db/config.ts)

## データベース

接続URLは `TURSO_DATABASE_URL` を優先し、未設定の場合のみ既存環境との互換alias `TURSO_URL` を参照します。両方が未設定のローカル環境では、`file:.data/db.sqlite` に自動フォールバックします（`.data/` は自動作成）。

Vercel などのサーバーレス環境ではローカルファイルを永続化できないため、推奨名 `TURSO_DATABASE_URL`（または既存設定の `TURSO_URL`）と `TURSO_AUTH_TOKEN` が必須です（[`server/db/config.ts`](../server/db/config.ts) で検証）。新規設定では `TURSO_DATABASE_URL` を使用してください。

マイグレーション:

```bash
pnpm db:generate   # スキーマ変更から生成
pnpm db:migrate    # 適用
```

ローカルDBの初期化:

```bash
rm -rf .data && pnpm db:migrate
```

## AIプロバイダ

LLM のモデル設定は [`agent/agent.ts`](../agent/agent.ts) に集約します。一般向け文書には固定のモデル名を記載せず、呼び出しは **Vercel AI Gateway 経由**でルーティングします（`node_modules/eve/docs/guides/deployment.md` 参照）。

- **ローカル開発 / CI**: `AI_GATEWAY_API_KEY` が必須。AI Gateway ダッシュボードで作成したキーの値を `.env` に設定する
- **Vercel（Production / Preview）**: プロジェクトをリンクすれば OIDC で自動認証されるため技術的には省略可能。ただし本プロジェクトでは、利用量を名前付きキーに紐づけて追跡・失効管理するため、明示的に `AI_GATEWAY_API_KEY` を設定する運用とする

コスト管理（予算・キー失効・アプリ側レートリミットの二重防衛）は [README の「AI Gateway のコスト管理」](../README.md#ai-gateway-のコスト管理) を参照してください。

## データ保持

ユーザーメニューからデモデータを削除すると、Better Authの匿名ユーザー・セッション、Turso上のスレッド、およびEveセッションへのアプリケーション側アクセス権を削除・失効します。Eveランタイムが保持する実行セッション本体はアプリケーションDBとは別管理で、物理削除の完了を本アプリから保証できません。基盤側の保持・削除ポリシーを確認し、実在する顧客・社員情報を入力しないでください。

## コミット禁止のローカル専用ファイル

| パス | 用途 |
|------|------|
| `.env` | ローカルの秘密値 |
| `.data/` | ローカル SQLite データベース |
| `.eve/` | Eve の開発キャッシュ |
| `.vercel/` | Vercel CLI のリンク情報 |
