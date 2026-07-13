# コーディング規約

このドキュメントは「複雑不動産案件 初動支援アシスタント」PoC のコーディング規約を定義します。本リポジトリは、Eve単体のバックエンドではなく、Next.js App Router（React 19）にEveエージェント（`eve/next` の `withEve`）を組み込んだフルスタックアプリケーションです。

## Table of Contents（目次）

1. [優先順位と適用範囲](#優先順位と適用範囲)
2. [PoCの境界](#pocの境界)
3. [プロジェクト構成](#プロジェクト構成)
4. [インポートパス](#インポートパス)
5. [TypeScript](#typescript)
6. [エクスポート](#エクスポート)
7. [Zodによる検証](#zodによる検証)
8. [Eve固有規約](#eve固有規約)
9. [Next.jsとReactの規約](#nextjsとreactの規約)
10. [エラーハンドリング](#エラーハンドリング)
11. [セキュリティ](#セキュリティ)
12. [テストと品質ゲート](#テストと品質ゲート)
13. [データベースとマイグレーション](#データベースとマイグレーション)
14. [整形とコメントとドキュメント](#整形とコメントとドキュメント)

## 優先順位と適用範囲

記述が競合する場合は、次の順で優先します。

1. `REQUIREMENT.md`：プロダクト範囲、安全性、テスト、完了条件
2. `AGENTS.md`：リポジトリ固有の作業手順
3. 本書および `.agents/rules/`：実装規約
4. 既存コードと各ツールの既定動作

Eveのコードを変更する前に、必要であれば依存関係をインストールし、`node_modules/eve/docs/` の該当ガイドを読みます。インストール済みバージョンの配置が異なる場合は、パスやAPIを推測せず `node_modules/eve` 内の同梱ドキュメントを探します。Next.jsのAPIは学習知識で推測せず、`node_modules/next/dist/docs/` の該当ドキュメントを読みます。

## PoCの境界

対象はWebチャネルとダミーJSONデータのみです。次の機能を追加または再有効化しません。

- Web以外のメッセージチャネル
- スケジュール、複数エージェント、サブエージェント
- 実データや外部サービスとの接続
- 任意のWeb検索やURL取得
- モデルから利用できるシェル、ファイル操作、Todo
- 長期メモリやプロフィール

無効化対象のEve組み込みツールは、`agent/tools/` の `disableTool()` スタブで明示的に無効な状態を維持します。AIは法務、税務、査定価格、契約可否の最終判断を行いません。

## プロジェクト構成

```text
agent/   # Eve設定、Webチャネル、instructions、skills、tools、agent/lib/domain の決定的検索
app/     # Next.js App Router（ページ、_components/、app/api/**/route.ts）
server/  # Elysia API、Application Service、サーバーユーティリティ、Drizzle
lib/     # Better Auth/Edenクライアントアダプターとサンプルデータ
shared/  # agent/app/server間で共有する型とヘルパー
tests/   # 決定的なVitestテスト
docs/    # アーキテクチャ、環境、運用ドキュメント
```

1ファイルは1つの主要な責務に集中させます。Eveツールは1ツール1ファイルとします。`app/api/v1/[[...slugs]]/route.ts` はElysiaのfetch exportだけに保ち、HTTP契約を `server/api/`、フレームワーク非依存の処理を `server/application/`、DBアダプターを `server/utils/` へ分離します。

アーキテクチャを意図的に変更しない限り、`src/` や別のfeature階層を導入しません。

## インポートパス

所有レイヤーに対応するエイリアスを使います（`tsconfig.json` の `paths` が正）。

- `@/*`：リポジトリルートへ解決。レイヤーを跨ぐ参照（`@/server/...`、`@/shared/...`、`@/lib/...` など）に使います
- `#lib/*`：`agent/lib/*` へ解決。`package.json` の imports（`#*` → `agent/*`）と対応し、agent配下のコードで使います
- 同じモジュール内の近接ファイルには相対importを使用できます。`../../../` のような深い相対importは避け、エイリアスを使用します

このプロジェクトは `tests/` のVitestを使用するため、`#evals/*` を追加しません。

## TypeScript

- オブジェクト型やunionには原則として `type` を使います。宣言マージまたは外部APIとの整合に利点がある場合のみ `interface` を使います。
- Zodスキーマが正本の場合、型は `z.infer` で導出します。
- DB行が正本の場合、型はDrizzle schemaの `typeof table.$inferSelect` / `$inferInsert`（`server/db/schema/` がexportする `Thread`、`ThreadInsert`、`User` など）から導出します。行shapeやID型を `id: string` のように手書きで再定義しません。
- 関連型は `Pick`、`Omit`、indexed access、`ReturnType` などから導出し、同じフィールドを再定義しません。
- DB行と公開DTOで名前や表現が異なる項目（例：`stateVersion` → `revision`、`Date` → epoch number、JSON文字列 → 検証済みobject）は同一型に見せません。共通scalarだけを `Pick` / `Omit` で導出し、変換は明示的なmapperに集約します。
- URL parameter、HTTP JSON、SDK responseなどの未検証値は、検証前からDB由来の型として扱いません。Zodなら `z.input` を境界入力、`z.output` を検証済み値の正本にします。
- リテラル値を保持しつつ契約を検査する定数には `as const satisfies` を使います。
- 内部関数の戻り値は型推論を優先します。公開境界、または `any` / `unknown` への拡大を防ぐ場合は明示します。
- 信頼できない値は `unknown` として絞り込みます。型アサーションで境界検証を回避しません。
- 新しい値を返す方がデータフローを明確にする場合はイミュータブルな変換を優先します。外部へ漏れず、アルゴリズムを明確にする局所的なミューテーションは許容します。

命名規則は次のとおりです。

| 対象 | 規則 |
| --- | --- |
| 変数・関数 | `lowerCamelCase` |
| 型・Reactコンポーネント | `UpperCamelCase` |
| 真の定数 | `UPPER_SNAKE_CASE` |
| 一般ファイル | 原則kebab-case（Reactコンポーネントのファイルもkebab-case） |
| Eveツール | snake_case ASCII。ファイル名がモデルに見えるツール名になる |

トップレベルでexportするヘルパーは原則として関数宣言を使います。インラインcallback、React hook内のclosure、フレームワーク設定のcallbackではarrow functionを使用できます。

## エクスポート

再利用する型、ヘルパー、スキーマ、定数にはnamed exportを使います。

次のようにフレームワークが要求または期待する場所ではdefault exportを使います。

- `agent/agent.ts`
- `agent/channels/*.ts`
- `agent/tools/*.ts`
- Next.js App Routerの規約ファイル（`page.tsx`、`layout.tsx`、`error.tsx`、`not-found.tsx`、`loading.tsx` など）
- `next.config.ts` や `drizzle.config.ts` などの設定ファイル

Route Handler（`route.ts`）は `GET` / `POST` などのnamed exportを使います。Eveはauthoredスロットのdefaultエクスポートを解決するため、default exportを一律禁止しません。

## Zodによる検証

アプリケーションの検証ライブラリはZodです。Valibotを新規導入しません。

次の信頼境界で検証します。

- Eveツールの入力と構造化出力
- HTTP body、route parameter、必要なquery値
- module load時の全ダミーJSONデータ
- 将来、許可された外部連携を追加する場合のレスポンス

スキーマを一度だけ定義し、TypeScript型を導出します。

```typescript
import { z } from "zod";

export const CaseQuerySchema = z.object({
  summary: z.string().trim().min(1),
});

export type CaseQuery = z.infer<typeof CaseQuerySchema>;
```

不正なダミーデータを黙って除外しません。全レコードを検証し、事例、ガイド、有識者のID重複も拒否します。信頼済みの内部値を関数間で繰り返しparseせず、境界で一度parseして型付きデータを渡します。

## Eve固有規約

- `agent/agent.ts` はランタイム設定に限定します。
- 常時適用する振る舞いと安全制約はinstructionsの正規ソースへ置きます。
- Eveのinstructionsとskillsのソースは英語で記述し、利用者向け回答は日本語に固定します。
- `agent/tools/<tool_name>.ts` に1ツール1ファイルで置き、snake_case ASCIIで命名します。
- プロダクト用ツールの入出力にはZodスキーマを定義します。
- 検索候補と順位はツールコードで決定的に確定します。LLMは説明できますが、根拠の捏造や並べ替えは行いません。
- `execute` はplainなserializable valueを返します。`Error`、`Response`、DBオブジェクト、`Result` wrapperをモデルへ返しません。
- Webチャネルのみを使用します。呼出元IDは検証済みsession/tokenから導出し、body supplied IDを信用しません。

Eveの例とインストール済みバージョンが競合する場合は、インストール済み `eve` packageの同梱ドキュメントを優先します。

## Next.jsとReactの規約

- App Router（`app/`）を使用します。ページは `app/**/page.tsx`、共有UIは `app/_components/`、APIは `app/api/**/route.ts` に置きます。
- Server Componentsを既定とします。状態、イベントハンドラ、ブラウザAPIが必要なコンポーネントだけに `"use client"` を付け、クライアント境界はツリーの末端へ押し下げます。
- server-only secret、DBアクセス、server専用依存をClient Componentやclient bundleへ置きません。secretはserver専用コードでのみ `process.env` から読み、意図的に公開する値だけを `NEXT_PUBLIC_*` にします。
- Elysia Controllerはmethod chainingとinline handlerを使い、認証、same-origin、Content-Type・body上限、If-Matchの検証、Application Serviceの呼出し、plain responseへの変換だけを行います。
- Application Serviceは認証済みuser ID、plain DTO、明示的なexpected revisionを受け取り、repository interfaceだけへ依存します。`Request`、`Response`、`Headers`、HTTP header解析を持ち込みません。
- Server Componentは同一デプロイへself-fetchせず、認証後にuser IDを渡して `server/application/` のserviceを直接呼びます。
- Client Componentのserver stateはTanStack Queryで同期し、`lib/api-client.ts` のEden adapterを `queryFn` / `mutationFn` として使います。TSX内で直接 `fetch`、未検証JSONのcast、独自retryを実装しません。
- client supplied ownership fieldを信用せず、認証済みsessionのuser IDで読み書きをscopeします。
- Server ComponentからClient Componentへ渡すpropsは必要最小限にします。

パフォーマンスは `.claude/skills/vercel-react-best-practices/`（SKILL.md と rules/）に従います。本PoCで特に重要な要点は次のとおりです。

- 独立した非同期処理は `Promise.all` で並列化し、awaitは実際に使うbranchへ遅延させます（waterfall回避）
- barrel fileを経由せず、モジュールを直接importします
- 重いclient-onlyコンポーネントは `next/dynamic` で遅延読み込みします
- 派生stateはrender中に導出し、effectでstateへ複製しません
- コンポーネント内で別コンポーネントを定義しません
- 条件描画は `&&` ではなく三項演算子を使います

semantic HTMLと `REQUIREMENT.md` のアクセシビリティ要件を維持します。利用者向けUI、ダミーデータ、エージェント出力は、技術識別子を除いて日本語にします。

## エラーハンドリング

認証、入力不正、権限不足、未検出、競合、利用上限、外部I/Oなどの想定内失敗には `better-result` の `Result` とdiscriminatedな `TaggedError` を使います。throwするSDK、fetch、DB呼出しは境界で `Result.try` / `Result.tryPromise` に包み、複数手順は `Result.gen` で合成します。

Resultを途中で安易にunwrapせず、Elysia Controller、Eve tool/channel、TanStack Query adapterなどplain値またはPromise rejectionが必要な境界でのみ処理します。HTTP・モデル・serializerへ `Result`、`TaggedError`、`Error`、`Response` のclass instanceを返しません。プログラマー欠陥とフレームワークが要求する制御フローは通常のthrowのまま扱えます。

## セキュリティ

- secretをhardcodeまたはcommitしません。
- server secretは信頼済みのserver専用コードからのみ `process.env` で読みます。
- secretを `NEXT_PUBLIC_*`、client bundle、log、prompt、tool output、dummy JSON、documentation exampleへ出しません。
- 認証・認可はfail closedとします。
- 信頼できないデータを使用前に検証します。
- model/user textはrender時に信頼できないcontentとして扱います。
- 自動PII検出・遮断・maskingを実装済みと表現しません。
- 実在顧客・社員データをrepositoryやdemoへ入れません。

## テストと品質ゲート

新しい振る舞いにはTDDを使います。合意済みの公開境界に失敗するテストを追加し、最小の縦切り実装を行い、その後refactorします。

テストはVitestを使い、`tests/**/*.test.{ts,tsx}` に置きます。デフォルト環境はnodeです。DOMを検証するUIコンポーネントのテストは `.tsx` とし、ファイル先頭の `// @vitest-environment jsdom` プラグマとTesting Libraryで公開挙動のみを検証します。次の決定的なテストを優先します。

- domain search、ranking、evidence、安全確認flag
- Zodによる不正・重複ダミーデータの拒否
- 相談依頼文の生成
- 匿名認証と認証済みHTTP挙動

内部call count、Reactコンポーネントの内部state、DB内部row構造ではなく公開結果を検証します。PlaywrightやLLM依存の非決定的CIテストは追加しません。UI変更後は利用可能な環境でmanual browser smoke testを行います。

必須品質ゲートは次のとおりです。

```bash
pnpm test
pnpm typecheck
pnpm build
```

React / Next.js変更を含む最終レビューでは、上記3コマンドに加えて `npx react-doctor@latest --verbose --scope changed` を実行します。

現在、repositoryにlint/formatter commandはありません。意図的に導入・設定されるまで、`pnpm lint`、`pnpm format`、`pnpm check`、`tsgo`、`oxlint`、`oxfmt`、`fallow`、`eve eval` を規約上のcommandとして扱いません。

## データベースとマイグレーション

- Drizzle schemaは `server/db/schema/` に定義し、`server/db/schema.ts` のschema entry pointからexportします。
- `pnpm db:generate` と `pnpm db:migrate` でmigrationを生成・適用します（`drizzle.config.ts` を参照する `drizzle-kit generate` / `drizzle-kit migrate` が実行されます）。
- リモート libSQL の推奨URL変数名は `TURSO_DATABASE_URL` とします。既存環境との互換性のため、推奨名が未設定の場合だけ `TURSO_URL` をaliasとして受け付けます。
- package scriptsを迂回して、別のフラグや設定を付けた `drizzle-kit` を直接実行しません。
- 復旧作業で明示的に必要な場合を除き、生成済みmigration metadataを手編集しません。
- ownership checkはserver-side queryまたはutilityで行います。

## 整形とコメントとドキュメント

`.editorconfig` に従い、2-space indent、LF、UTF-8、trailing whitespace除去、final newlineを使用します。formatterが正式導入されるまでは、quoteとsemicolonを周辺コードに合わせます。

コメントは「何をしているか」ではなく、制約、trade-off、非自明な理由を説明します。TODOには具体的なfollow-up条件を記載し、既存のownerやissueがあれば参照します。根拠のないdeadlineは作りません。

挙動、command、environment variable、scope、architectureを変更した場合はdocumentationも更新します。`REQUIREMENT.md` をproduct source of truthとして保ち、legacy templateの説明をcurrent behaviorとして残しません。
