# セキュリティガイドライン

## 🔒 環境変数の管理

### ⚠️ 重要な注意事項
`.env.local`ファイルには機密情報が含まれています。**絶対にGitにコミットしないでください**。

### 本番環境での環境変数管理

#### 1. Vercel を使用する場合
```bash
# Vercel CLIでの設定
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
vercel env add SUPABASE_SECRET_KEY
```

Vercel ダッシュボード → Settings → Environment Variables から設定することも可能です。

#### 2. その他のホスティングサービス

- **AWS**: AWS Secrets Manager または Systems Manager Parameter Store
- **Google Cloud**: Secret Manager
- **Azure**: Key Vault
- **Heroku**: Config Vars

### ローカル開発環境

1. `.env.example`をコピーして`.env.local`を作成
```bash
cp .env.example .env.local
```

2. `.env.local`に実際の値を設定
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_anon_key
SUPABASE_SECRET_KEY=your_service_role_key
```

3. **重要**: `.env.local`は`.gitignore`に含まれていることを確認

## 🛡️ 実装済みのセキュリティ対策

### 1. レート制限
- 各APIエンドポイントでリクエスト数を制限
- DoS攻撃やブルートフォース攻撃を防止

### 2. エラーハンドリング
- 詳細なエラー情報はログにのみ記録
- ユーザーには汎用的なエラーメッセージを返却

### 3. 認証
- 全APIエンドポイントでSupabase認証を実装
- 未認証アクセスを自動的にブロック

### 4. 入力検証
- Zodスキーマによる厳密な型チェック
- SQLインジェクション対策済み

## 📋 セキュリティチェックリスト

### デプロイ前の確認事項
- [ ] 環境変数が適切に設定されている
- [ ] `.env.local`がGitにコミットされていない
- [ ] 本番環境で環境変数管理サービスを使用
- [ ] HTTPSが有効になっている
- [ ] 不要なデバッグログが削除されている

### 定期的な確認事項
- [ ] 依存パッケージの脆弱性チェック（`npm audit`）
- [ ] アクセスログの監視
- [ ] 異常なトラフィックパターンの確認
- [ ] バックアップの実施

## 🚨 セキュリティインシデント対応

セキュリティ上の問題を発見した場合：

1. **緊急度の評価**
   - Critical: 即座に対応が必要
   - High: 24時間以内に対応
   - Medium: 1週間以内に対応
   - Low: 計画的に対応

2. **対応手順**
   1. 影響範囲の特定
   2. 一時的な対策の実施
   3. 根本的な修正の実装
   4. 再発防止策の検討

3. **報告**
   - システム管理者に即座に報告
   - 必要に応じてユーザーへの通知

## 📚 参考資料

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/authentication)
- [Supabase Security](https://supabase.com/docs/guides/auth/overview)