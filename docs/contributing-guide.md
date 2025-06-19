# Expo MCP Server 貢献ガイドライン

## 🎉 はじめに

Expo MCP Serverプロジェクトへの貢献をご検討いただき、ありがとうございます！このガイドでは、効果的な貢献のための手順、コーディング規約、テスト要件などを説明します。

## 🤝 貢献の種類

### コード貢献
- 🐛 バグ修正
- ✨ 新機能実装
- ⚡ パフォーマンス改善
- 🔒 セキュリティ強化
- 📝 ドキュメント改善

### 非コード貢献
- 🐞 バグ報告
- 💡 機能提案
- 📋 ドキュメント翻訳
- 🎨 UI/UX改善提案
- 🧪 テスト追加

## 🏗️ 開発環境セットアップ

### 前提条件
```bash
# 必須ソフトウェア
node --version    # v18.0.0+
npm --version     # v8.0.0+
docker --version  # v20.0.0+
git --version     # v2.0.0+
```

### 初期セットアップ
```bash
# 1. リポジトリをフォーク・クローン
git clone https://github.com/YOUR_USERNAME/expo-mcp-server.git
cd expo-mcp-server

# 2. 依存関係インストール
npm install

# 3. 環境設定
cp .env.example .env

# 4. 開発環境起動
npm run dev

# 5. テスト実行確認
npm test
```

### Docker環境（推奨）
```bash
# 完全な開発環境起動
docker-compose -f docker-compose.dev.yml up -d

# 監視ダッシュボード確認
open http://localhost:3001  # Grafana
open http://localhost:9091  # Prometheus
```

## 📁 プロジェクト構造

```
expo-mcp-server/
├── src/                        # ソースコード
│   ├── mcp/                    # MCP Protocol実装
│   │   ├── server.ts           # MCPサーバーコア
│   │   ├── tools/              # MCPツール実装
│   │   ├── resources/          # MCPリソース実装
│   │   └── prompts/            # MCPプロンプト実装
│   ├── services/               # ビジネスロジック
│   │   ├── expo-crawler.ts     # Expoコンテンツクローラ
│   │   ├── search-engine.ts    # 検索エンジン
│   │   ├── recommendation-engine.ts  # 推薦エンジン
│   │   └── markdown-parser.ts  # マークダウンパーサー
│   ├── indexing/               # データインデックス
│   ├── security/               # セキュリティ機能
│   ├── utils/                  # ユーティリティ
│   └── types/                  # TypeScript型定義
├── tests/                      # テストファイル
├── docs/                       # ドキュメント
├── config/                     # 設定ファイル
├── monitoring/                 # 監視設定
└── docker/                     # Docker関連
```

## 🔄 開発プロセス

### 1. イシュー作成・確認

#### バグ報告
```markdown
### 🐛 バグ報告テンプレート

**現象**
- 何が起こったか詳細に記述

**再現手順**
1. MCPサーバーを起動
2. `expo_search_documents`ツールを実行
3. 特定のクエリを入力

**期待する動作**
- 本来起こるべき動作

**環境情報**
- OS: macOS 14.0
- Node.js: v18.17.0
- Docker: v24.0.5

**追加情報**
- ログファイル、スクリーンショット等
```

#### 機能提案
```markdown
### ✨ 機能提案テンプレート

**概要**
- 提案する機能の簡潔な説明

**背景・課題**
- なぜこの機能が必要か

**提案内容**
- 具体的な実装案・API設計

**受け入れ基準**
- [ ] 機能Aが実装される
- [ ] パフォーマンスが劣化しない
- [ ] テストカバレッジ90%以上

**代替案**
- 他の実装方法の検討
```

### 2. 開発ブランチ作成

```bash
# メインブランチから最新コードをpull
git checkout develop
git pull origin develop

# 機能ブランチ作成
git checkout -b feature/add-new-mcp-tool
# または
git checkout -b fix/search-performance-issue
```

### ブランチ命名規則
```yaml
branch_naming:
  feature: "feature/機能名"
  bugfix: "fix/バグ内容"
  hotfix: "hotfix/緊急修正内容"  
  documentation: "docs/ドキュメント内容"
  performance: "perf/パフォーマンス改善内容"
  security: "security/セキュリティ修正内容"
```

### 3. 開発実装

#### コーディング規約

##### TypeScript規約
```typescript
// ✅ 良い例
interface ExpoSearchOptions {
  query: string;
  filters?: {
    category?: SearchCategory[];
    platform?: Platform[];
    sdkVersion?: string[];
  };
  maxResults?: number;
}

class ExpoSearchService {
  private readonly cache: LRUCache<string, SearchResult[]>;
  
  constructor(
    private readonly searchEngine: SearchEngine,
    private readonly config: SearchConfig
  ) {
    this.cache = new LRUCache({ max: config.cacheSize });
  }
  
  public async search(options: ExpoSearchOptions): Promise<SearchResult[]> {
    const cacheKey = this.generateCacheKey(options);
    
    // キャッシュ確認
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // 実際の検索実行
    const results = await this.searchEngine.execute(options);
    this.cache.set(cacheKey, results);
    
    return results;
  }
  
  private generateCacheKey(options: ExpoSearchOptions): string {
    return `search:${JSON.stringify(options)}`;
  }
}
```

##### エラーハンドリング
```typescript
// ✅ 適切なエラーハンドリング
import { MCPError, ErrorCode } from '../types/errors';

public async handleToolExecution(toolName: string, args: any): Promise<any> {
  try {
    const tool = this.getTool(toolName);
    if (!tool) {
      throw new MCPError(
        ErrorCode.TOOL_NOT_FOUND,
        `Tool '${toolName}' not found`,
        { availableTools: this.getAvailableTools() }
      );
    }
    
    const validationResult = this.validateToolArgs(tool, args);
    if (!validationResult.valid) {
      throw new MCPError(
        ErrorCode.INVALID_ARGUMENTS,
        'Invalid tool arguments',
        { errors: validationResult.errors }
      );
    }
    
    return await tool.execute(args);
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    
    // 予期しないエラーをラップ
    throw new MCPError(
      ErrorCode.INTERNAL_ERROR,
      'Unexpected error during tool execution',
      { originalError: error.message }
    );
  }
}
```

##### セキュリティ実装
```typescript
// ✅ セキュアな実装
import { validateInput, sanitizeString } from '../security/validation';

public async processUserInput(input: string): Promise<string> {
  // 入力検証
  const validation = validateInput(input, {
    maxLength: 1000,
    allowedCharacters: /^[a-zA-Z0-9\s\-_./?&=]+$/,
    preventCodeInjection: true
  });
  
  if (!validation.valid) {
    throw new MCPError(ErrorCode.INVALID_INPUT, validation.error);
  }
  
  // サニタイズ
  const sanitized = sanitizeString(input);
  
  // 処理実行
  return await this.processInternal(sanitized);
}
```

### 4. テスト実装

#### 単体テスト
```typescript
// tests/services/search-engine.test.ts
import { ExpoSearchService } from '../../src/services/search-engine';
import { mockSearchEngine, mockConfig } from '../mocks';

describe('ExpoSearchService', () => {
  let searchService: ExpoSearchService;
  let mockEngine: jest.MockedObject<SearchEngine>;
  
  beforeEach(() => {
    mockEngine = mockSearchEngine();
    searchService = new ExpoSearchService(mockEngine, mockConfig);
  });
  
  describe('search', () => {
    it('should return cached results when available', async () => {
      // Arrange
      const options = { query: 'expo router' };
      const expectedResults = [{ id: '1', title: 'Expo Router Guide' }];
      
      // 初回検索でキャッシュに保存
      mockEngine.execute.mockResolvedValue(expectedResults);
      await searchService.search(options);
      
      // Act - 2回目の検索
      const results = await searchService.search(options);
      
      // Assert
      expect(results).toEqual(expectedResults);
      expect(mockEngine.execute).toHaveBeenCalledTimes(1); // キャッシュヒット
    });
    
    it('should throw MCPError for invalid query', async () => {
      // Arrange
      const options = { query: '' };
      
      // Act & Assert
      await expect(searchService.search(options))
        .rejects
        .toThrow(MCPError);
    });
  });
});
```

#### 統合テスト
```typescript
// tests/integration/mcp-server.test.ts
import { ExpoMcpServer } from '../../src/mcp/server';
import { createTestClient } from '../helpers/mcp-client';

describe('MCP Server Integration', () => {
  let server: ExpoMcpServer;
  let client: TestMCPClient;
  
  beforeAll(async () => {
    server = new ExpoMcpServer(testConfig);
    await server.start();
    client = createTestClient(server);
  });
  
  afterAll(async () => {
    await server.stop();
  });
  
  it('should handle expo_search_documents tool execution', async () => {
    // Act
    const response = await client.callTool('expo_search_documents', {
      query: 'navigation',
      filters: {
        category: ['docs'],
        platform: ['ios', 'android']
      }
    });
    
    // Assert
    expect(response.success).toBe(true);
    expect(response.result).toHaveProperty('documents');
    expect(response.result.documents).toBeInstanceOf(Array);
  });
});
```

#### E2Eテスト
```typescript
// tests/e2e/full-workflow.test.ts
import { spawn } from 'child_process';
import { promises as fs } from 'fs';

describe('Full MCP Workflow E2E', () => {
  it('should complete full Expo development workflow', async () => {
    // 1. MCPサーバー起動
    const serverProcess = spawn('npm', ['run', 'mcp:stdio']);
    
    // 2. Cursor等のクライアントからの接続シミュレート
    const client = new MCPClient();
    await client.connect(serverProcess);
    
    // 3. プロジェクトセットアップ支援
    const setupResult = await client.callTool('expo_config_templates', {
      template_type: 'app.json',
      project_context: {
        name: 'test-app',
        platforms: ['ios', 'android']
      }
    });
    
    expect(setupResult.success).toBe(true);
    
    // 4. API探索
    const searchResult = await client.callTool('expo_search_documents', {
      query: 'push notifications'
    });
    
    expect(searchResult.result.documents.length).toBeGreaterThan(0);
    
    // 5. コード例生成
    const codeExample = await client.callTool('expo_code_examples', {
      pattern: 'push notifications',
      language: 'typescript'
    });
    
    expect(codeExample.result.code).toContain('Notifications');
    
    // クリーンアップ
    await client.disconnect();
    serverProcess.kill();
  });
});
```

### 5. テストカバレッジ要件

```yaml
coverage_requirements:
  statements: ">= 90%"
  branches: ">= 85%" 
  functions: ">= 90%"
  lines: ">= 90%"
  
  critical_files:
    - "src/mcp/server.ts": ">= 95%"
    - "src/services/*.ts": ">= 90%"
    - "src/security/*.ts": ">= 95%"
```

### 6. Pull Request作成

#### PR テンプレート
```markdown
## 🚀 変更内容

### 概要
- 実装した機能・修正内容の簡潔な説明

### 変更ファイル
- [ ] `src/mcp/tools/expo-new-tool.ts` - 新MCPツール実装
- [ ] `tests/mcp/tools/expo-new-tool.test.ts` - 単体テスト追加
- [ ] `docs/mcp-tools-reference.md` - ドキュメント更新

### テスト実行結果
```bash
npm test
# Test Suites: 16 passed, 0 failed
# Tests: 289 passed, 0 failed
# Coverage: 91.2% statements, 87.8% branches
```

### 破壊的変更
- [ ] Yes - 詳細説明
- [x] No

### 関連イシュー
- Closes #123
- Related to #456

### レビュー観点
- [ ] 機能仕様を満たしているか
- [ ] セキュリティ要件を満たしているか
- [ ] パフォーマンスに影響しないか
- [ ] テストカバレッジが十分か
```

## 📋 レビュープロセス

### レビュー基準

#### コード品質
- [ ] TypeScript型定義が適切
- [ ] エラーハンドリングが実装されている
- [ ] セキュリティ要件を満たしている
- [ ] パフォーマンスに配慮されている
- [ ] コメント・ドキュメントが充実している

#### テスト品質
- [ ] 単体テストが実装されている
- [ ] 統合テストが実装されている（必要時）
- [ ] テストカバレッジが要件を満たしている
- [ ] エッジケースがテストされている

#### MCP準拠性
- [ ] MCP Protocol 2024-11-05仕様に準拠
- [ ] JSON-RPCメッセージ形式が正しい
- [ ] ツール・リソース・プロンプトスキーマが正しい
- [ ] エラーレスポンスが適切

### レビュー手順

1. **自動チェック確認**
   ```bash
   # リント・型チェック
   npm run lint
   npm run type-check
   
   # テスト実行
   npm test
   
   # セキュリティスキャン
   npm audit
   ```

2. **手動レビュー項目**
   - コード設計・アーキテクチャ
   - セキュリティ・パフォーマンス
   - ドキュメント・コメント
   - テストの妥当性

3. **動作確認**
   ```bash
   # 開発環境起動
   npm run dev
   
   # MCPクライアントテスト
   npm run test:mcp
   
   # Docker環境テスト
   docker-compose up -d
   ```

## 🛡️ セキュリティガイドライン

### セキュリティ問題報告

#### 脆弱性報告プロセス
1. **非公開報告**: security@expo.dev へメール
2. **情報提供**: 脆弱性詳細・再現手順・影響範囲
3. **確認・修正**: 開発チームによる調査・修正
4. **公開**: 修正後に適切なタイミングで公開

#### セキュリティ実装要件
```typescript
// 必須セキュリティチェック
const securityChecklist = {
  input_validation: "全ユーザー入力のバリデーション実装",
  output_sanitization: "出力データのサニタイゼーション実装", 
  error_handling: "詳細エラー情報の非公開化",
  rate_limiting: "レート制限・DDoS保護実装",
  authentication: "適切な認証・認可実装",
  encryption: "機密データの暗号化実装"
};
```

## 📊 パフォーマンス要件

### パフォーマンス目標
```yaml
performance_targets:
  response_time:
    - "P95 stdio latency < 50ms"
    - "P95 search latency < 100ms" 
    - "P95 tool execution < 500ms"
  
  resource_usage:
    - "Memory usage < 1GB"
    - "CPU usage < 80%"
    - "Cache hit rate > 85%"
  
  scalability:
    - "Concurrent sessions: 200+"
    - "Requests per minute: 6000+"
```

### パフォーマンステスト
```bash
# 負荷テスト実行
npm run test:performance

# メモリリーク検出
npm run test:memory-leak

# ベンチマーク測定
npm run benchmark
```

## 🎯 リリースプロセス

### バージョニング（Semantic Versioning）
```yaml
version_format: "MAJOR.MINOR.PATCH"

increment_rules:
  MAJOR: "破壊的変更"
  MINOR: "新機能追加（後方互換性あり）"
  PATCH: "バグ修正・セキュリティ修正"

examples:
  - "1.0.0 → 1.0.1": バグ修正
  - "1.0.1 → 1.1.0": 新MCPツール追加
  - "1.1.0 → 2.0.0": MCP Protocol メジャーアップデート
```

### リリース手順
```bash
# 1. バージョンアップ
npm version minor  # または major/patch

# 2. タグ作成・プッシュ
git push origin develop --tags

# 3. リリースノート作成
# GitHub Releases にて手動作成

# 4. npm公開（自動）
# GitHub Actions にて自動実行
```

## 🆘 トラブルシューティング

### 一般的な問題

#### 開発環境エラー
```bash
# Node.js バージョン問題
nvm use 18
npm install

# 依存関係問題  
rm -rf node_modules package-lock.json
npm install

# TypeScript コンパイルエラー
npm run type-check
```

#### テスト実行エラー
```bash
# テスト環境初期化
npm run test:setup

# 特定テストのみ実行
npm test -- --testNamePattern="ExpoSearchService"

# カバレッジレポート確認
npm run test:coverage
open coverage/lcov-report/index.html
```

#### Docker環境問題
```bash
# Docker環境リセット
docker-compose down -v
docker-compose up -d

# ログ確認
docker-compose logs expo-mcp-server
```

## 🤔 よくある質問

### Q: 新しいMCPツールを追加するには？
A: 以下の手順で実装してください：
1. `src/mcp/tools/` に新ツールファイル作成
2. JSON Schemaによる入力検証実装
3. 単体テスト・統合テスト作成
4. `docs/mcp-tools-reference.md` 更新

### Q: パフォーマンス要件を満たさない場合は？
A: 以下を確認してください：
1. プロファイリング実行（`npm run profile`）
2. ボトルネック特定
3. キャッシュ・並行処理の活用
4. パフォーマンステスト実行確認

### Q: セキュリティチェックが失敗する場合は？
A: 以下を実装してください：
1. 入力バリデーション強化
2. 出力サニタイゼーション実装
3. エラーハンドリング改善
4. セキュリティテスト追加

## 📞 サポート・連絡先

### コミュニティサポート
- **GitHub Issues**: バグ報告・機能提案
- **GitHub Discussions**: 質問・アイデア共有
- **Discord**: リアルタイム議論（リンクは README参照）

### メールサポート
- **一般的な質問**: expo-mcp@expo.dev
- **セキュリティ報告**: security@expo.dev
- **パフォーマンス相談**: performance@expo.dev

### ドキュメント
- [APIリファレンス](api-reference.md)
- [セキュリティガイド](security-best-practices.md)
- [パフォーマンスガイド](performance-tuning-guide.md)

---

**🙏 感謝**: あなたの貢献がExpo MCP Serverプロジェクトをより良いものにします。質問や提案がありましたら、遠慮なくお聞かせください！

**📝 ガイド更新**: このガイドは定期的に更新されます。最新版を確認して開発を進めてください。 