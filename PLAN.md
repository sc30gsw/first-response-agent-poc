# 実装ハンドオフ

## 次セッションの目的

[`REQUIREMENT.md`](./REQUIREMENT.md) を唯一のプロダクト要件として、複雑不動産案件の初動支援PoCを完成させる。コード実装、検証、文書整理、Vercelデプロイまでが対象である。

本ファイルは会話の再掲ではなく、次の担当者が着手するための実行順序と注意事項を示す。詳細な機能・データ・安全性・完了条件は `REQUIREMENT.md` を参照すること。

## 現在の状態

- 要件合意は完了し、`REQUIREMENT.md` へ反映済み
- 決定的検索、ダミーデータ、Eveツール、Reactの初動支援カード、Better Auth匿名認証を実装済み
- Next.js App Routerへの移行とNuxt/Vue/Nitro固有コードの撤去を完了済み
- AIが読むinstructions、skill、ツール説明は英語化済みで、利用者向け出力は日本語に固定している
- Elysia `/api/v1`、OpenAPI、Application Service、better-resultのtyped error境界を実装済み
- Client ComponentはTanStack Query + Eden adapter、Server ComponentはApplication Service直接呼出しへ統一済み
- Eveのsession所有権、共有レート制限、同時実行制限、thread削除後のアクセス失効を実装済み
- Drizzle、Zod、Eve SDKを境界ごとの型の正本とし、ID・DTO・adapter・repository型をutility typeから導出済み
- 破損した保存済みthread stateは履歴なしへ変換せずtyped errorとして500へ変換し、未宣言のEveターン制御fieldはモデル実行前に拒否する
- 自動品質ゲート（`pnpm test` / `pnpm typecheck` / `pnpm build`、React Doctor）は完了済み。残る完了判定はChrome手動確認、Vercelデプロイと公開URL確認である
- Eve 0.20.0の同梱ドキュメントは `node_modules/eve/docs/` にある。古い `dist/docs/public/` パスは存在しない
- Eve 0.20.0は `eve/next` の `withEve()` と `eve/react` の `useEveAgent()` を公式提供している
- Tursoの推奨名は `TURSO_DATABASE_URL` と `TURSO_AUTH_TOKEN`。既存環境の `TURSO_URL` は推奨名未設定時の互換aliasとして扱い、値を表示・記録しないこと
- Vercel Connectは使用しない
- LLM呼び出しはVercel AI Gateway経由とし、ローカル/CIおよび利用量追跡を行うProduction/Previewでは `AI_GATEWAY_API_KEY` を秘密値として設定する

## 作業上の制約

- 既存の未コミット変更を上書き・破棄しない
- `REQUIREMENT.md` と矛盾する実装判断を独断で追加しない
- 特定企業を識別できる名称、URLまたは独自サービス名を追加しない
- 秘密値をログ、文書、テストフィクスチャまたはコミットへ含めない
- デモデータ削除はTurso上の履歴削除とEveアクセス失効を保証するが、Eve基盤上の実行セッション本体の物理削除完了とは表現しない
- Playwrightは導入しない
- UIの最終確認はブラウザで手動実施する
- 元のMIT Licenseと著作権表示を保持する

## 実装順序

### 1. 永続化層をNuxtHubから分離

- `@libsql/client` と `drizzle-orm/libsql` を使うフレームワーク非依存DBクライアントを追加する
- ローカルはSQLiteファイル、Vercelは `TURSO_DATABASE_URL`（既存環境では `TURSO_URL` alias）/ `TURSO_AUTH_TOKEN` へ接続する
- `server/utils/auth.ts` と `server/utils/threads.ts` から `@nuxthub/db` を除去する
- 過去のDrizzleマイグレーションは破壊的に書き換えない
- 認証・ドメインテストを通し、独立コミットにする

### 2. Next.js App Router基盤へ切替

- `next.config.ts` を追加し、`withEve()` でNext.jsとEveを同一オリジンへ統合する
- `app/layout.tsx`、`app/page.tsx`、エラー画面、`robots.ts`、グローバルCSSを追加する
- Better Authを `app/api/auth/[...all]/route.ts` へ、スレッドAPIをElysia `/api/v1` とApplication Serviceへ移植する
- `vercel.json` のWebフレームワークを `nextjs` へ変更する
- Nuxt、Vue、NuxtHub、Nitro固有の設定、依存、API、SFCを撤去する
- `tsconfig.json`、スクリプト、DBコマンドをNext.js向けに置換し、最小構成で型検査とビルドを通す

### 3. 匿名デモとスレッドUI

- `better-auth/react` とanonymousクライアントプラグインを使用する
- 未認証トップには説明と「デモを開始」だけを表示し、本番でメール・パスワードUIを表示しない
- 認証済みトップに3つのサンプル、自由入力、履歴サイドバーを実装する
- ユーザーメニューから匿名ユーザー、認証セッション、関連スレッドを削除し、Eveセッションbindingを失効できるようにする
- Server Componentを既定とし、対話部分だけをClient Componentにする

### 4. EveチャットをReactへ移植

- `eve/react` の `useEveAgent()` で送信、ストリーミング、停止、HITL応答、セッション再開を実装する
- 既存のイベント履歴とセッションカーソルをスレッド単位で保存する
- ツール結果を案件要約、確認事項、根拠、類似事例、ガイド、有識者、相談文カードとして描画する
- 再分析カードを追記し、過去の分析結果を上書きしない
- 相談依頼文の生成とコピー操作を実装する

### 5. AI向けルールとスキルをNext/Reactへ整理

- `.agents/` と `.claude/` からNuxt/Vue固有ルールとスキル参照を削除する
- `next-best-practices` と `vercel-react-best-practices` をNext/React実装の基準として組み込む
- Server/Client境界、Elysia、TanStack Query、better-result、認証、Turso、TDD、PoC対象範囲をルールへ反映する
- 重複、矛盾、壊れたsymlink、古いEve文書パスを修正する
- モデル向け指示は英語、利用者向け出力とプロダクト文書は日本語という方針を維持する

### 6. 検証

- 各TDDサイクルで対象テストを実行する
- 最終的に次をすべて実行する

```bash
pnpm test
pnpm typecheck
pnpm build
```

- React Doctorを実行し、Next.js/React固有の問題を確認する
- 最新版Chromeで3つのサンプル、自由入力、再分析、相談文コピー、履歴再開、データ削除を手動確認する
- LLMが根拠にない事例・人物を生成しないこと、判断を断定しないことを確認する

### 7. 文書と匿名化

- 実装が確定してからREADMEを日本語で全面整理する
- `REQUIREMENT.md` 第19章の対象文書・メタデータを更新する
- 元テンプレートの古い機能説明、Deployボタン、バッジ、リンクを除去する
- 現在のGitリモートに合わせてパッケージメタデータを更新する
- `rg` で対象企業を識別できる名称・URL・独自名称が残っていないことを確認する
- LICENSEと第三者帰属は保持する

### 8. Vercelデプロイ

- `TURSO_DATABASE_URL`（または既存の `TURSO_URL`）と `TURSO_AUTH_TOKEN` の存在を秘密値を表示せず確認する
- `BETTER_AUTH_SECRET` と本番 `BETTER_AUTH_URL` を設定する
- 新しいDBマイグレーションを破壊的操作なしで適用する
- Vercelへデプロイし、公開URLで主要フローを再確認する
- 新規環境では `TURSO_DATABASE_URL` を設定する。既存の `TURSO_URL` のみの環境は互換aliasで接続できることを確認する

## 推奨スキル

次の担当者は、作業開始時または該当工程で次のスキルを使用すること。

- `tdd`：ドメイン境界とHTTP境界をred-greenで実装する
- `modern-web-guidance`：すべてのHTML/CSS/クライアントJavaScript変更の前に最新ガイドを確認する
- `next-best-practices`：App Router、RSC境界、Route Handler、metadata、error処理を確認する
- `vercel-react-best-practices`：ウォーターフォール、バンドル、再レンダー、RSC転送量を最適化する
- `frontend-design`：匿名の業務向けUIを一貫したデザインへ仕上げる
- `accessibility`：キーボード、フォーカス、コントラスト、ライブ通知を監査する
- `better-auth-best-practices`：anonymousプラグイン、セッション、レート制限、マイグレーションを実装する
- `find-docs`：Eve、Better Auth、Next.js、Vercelの変更されやすいAPIを公式情報で確認する
- `code-review`：実装完了後に要件適合性とリポジトリ規約をレビューする
- `vercel-cli` または `deploy-to-vercel`：環境変数を露出せずデプロイと本番確認を行う

## 完了判定

実装完了の判定には [`REQUIREMENT.md` の「17. 完了条件」](./REQUIREMENT.md#17-完了条件) を使用する。すべて満たすまで完了扱いにしない。
