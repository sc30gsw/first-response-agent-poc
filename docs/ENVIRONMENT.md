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
| `TURSO_DATABASE_URL` | Vercel: 必須 | リモート libSQL データベースの URL（別名 `TURSO_URL` も可） |
| `TURSO_AUTH_TOKEN` | `libsql://` 使用時: 必須 | リモート libSQL の認証トークン |

参照実装: [`server/utils/auth.ts`](../server/utils/auth.ts), [`server/db/config.ts`](../server/db/config.ts)

## データベース

ローカルでは `TURSO_DATABASE_URL` が未設定の場合、`file:.data/db.sqlite` に自動フォールバックします（`.data/` は自動作成）。

Vercel などのサーバーレス環境ではローカルファイルを作成できないため、`TURSO_DATABASE_URL` が必須です。`libsql://` スキームの URL を指定する場合は `TURSO_AUTH_TOKEN` も必要です（[`server/db/config.ts`](../server/db/config.ts) で検証）。

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

AI プロバイダのキーは `.env.example` に定義していません。モデルは [`agent/agent.ts`](../agent/agent.ts) で指定します:

```typescript
model: "anthropic/claude-sonnet-4.6"
```

Vercel 上では Eve がプラットフォーム経由でプロバイダ設定を扱います。ローカル開発では利用するプロバイダに応じて Eve のドキュメント（`node_modules/eve/dist/docs/`）を参照してください。

## コミット禁止のローカル専用ファイル

| パス | 用途 |
|------|------|
| `.env` | ローカルの秘密値 |
| `.data/` | ローカル SQLite データベース |
| `.eve/` | Eve の開発キャッシュ |
| `.vercel/` | Vercel CLI のリンク情報 |
