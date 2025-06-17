import { ExpoCrawler } from '../services/expo-crawler.js';
import { ExpoSearchEngine, SearchEngineConfig } from '../services/search-engine.js';
import { ExpoRecommendationEngine } from '../services/recommendation-engine.js';
import { ExpoDocument } from '../types/document.js';

export interface IndexingConfig {
  searchEngine: SearchEngineConfig;
  crawl: {
    includeDocs: boolean;
    includeGitHub: boolean;
    maxDocuments: number;
  };
  embedding: {
    enabled: boolean;
    batchSize: number;
  };
}

export interface IndexingResult {
  success: boolean;
  totalDocuments: number;
  indexedDocuments: number;
  embeddedDocuments: number;
  errors: string[];
  duration: number;
  stats: {
    docsCrawled: number;
    githubCrawled: number;
    searchIndexed: number;
    embeddingsGenerated: number;
  };
}

export class DocumentIndexer {
  private crawler: ExpoCrawler;
  private searchEngine: ExpoSearchEngine;
  private recommendationEngine: ExpoRecommendationEngine;
  private config: IndexingConfig;

  constructor(config: IndexingConfig) {
    this.config = config;
    this.crawler = new ExpoCrawler();
    this.searchEngine = new ExpoSearchEngine(config.searchEngine);
    this.recommendationEngine = new ExpoRecommendationEngine();
  }

  async initialize(): Promise<void> {
    console.log('Initializing document indexer...');
    
    try {
      // 検索エンジン初期化
      await this.searchEngine.initializeIndex();
      console.log('Search engine initialized');

      // 推薦エンジン初期化（埋め込みモデル読み込み）
      if (this.config.embedding.enabled) {
        await this.recommendationEngine.initialize();
        console.log('Recommendation engine initialized');
      }

      console.log('Document indexer initialization completed');
    } catch (error) {
      console.error('Failed to initialize document indexer:', error);
      throw error;
    }
  }

  async fullIndexing(): Promise<IndexingResult> {
    const startTime = Date.now();
    const result: IndexingResult = {
      success: false,
      totalDocuments: 0,
      indexedDocuments: 0,
      embeddedDocuments: 0,
      errors: [],
      duration: 0,
      stats: {
        docsCrawled: 0,
        githubCrawled: 0,
        searchIndexed: 0,
        embeddingsGenerated: 0
      }
    };

    try {
      console.log('Starting full document indexing...');

      const allDocuments: ExpoDocument[] = [];

      // 1. ドキュメントクロール
      if (this.config.crawl.includeDocs) {
        console.log('Crawling Expo documentation...');
        const docResult = await this.crawler.crawlExpoDocumentation();
        
        if (docResult.success) {
          allDocuments.push(...docResult.documents);
          result.stats.docsCrawled = docResult.documents.length;
          console.log(`Crawled ${docResult.documents.length} documentation pages`);
        } else {
          result.errors.push('Documentation crawling failed');
        }

        // エラーを記録
        result.errors.push(...docResult.errors.map(e => `Doc crawl error: ${e.error}`));
      }

      // 2. GitHub クロール
      if (this.config.crawl.includeGitHub) {
        console.log('Crawling GitHub Expo repository...');
        const githubResult = await this.crawler.crawlGitHubExpoRepo();
        
        if (githubResult.success) {
          allDocuments.push(...githubResult.documents);
          result.stats.githubCrawled = githubResult.documents.length;
          console.log(`Crawled ${githubResult.documents.length} GitHub documents`);
        } else {
          result.errors.push('GitHub crawling failed');
        }

        // エラーを記録
        result.errors.push(...githubResult.errors.map(e => `GitHub crawl error: ${e.error}`));
      }

      // ドキュメント数制限
      const limitedDocuments = allDocuments.slice(0, this.config.crawl.maxDocuments);
      result.totalDocuments = limitedDocuments.length;

      if (limitedDocuments.length === 0) {
        throw new Error('No documents were crawled');
      }

      // 3. 検索インデックス作成
      console.log(`Indexing ${limitedDocuments.length} documents for search...`);
      await this.searchEngine.indexDocuments(limitedDocuments);
      result.stats.searchIndexed = limitedDocuments.length;
      result.indexedDocuments = limitedDocuments.length;
      console.log('Search indexing completed');

      // 4. 埋め込み生成（推薦システム用）
      if (this.config.embedding.enabled) {
        console.log('Generating embeddings for recommendation system...');
        await this.recommendationEngine.indexDocuments(limitedDocuments);
        result.stats.embeddingsGenerated = this.recommendationEngine.getIndexedDocumentCount();
        result.embeddedDocuments = result.stats.embeddingsGenerated;
        console.log('Embedding generation completed');
      }

      result.success = true;
      result.duration = Date.now() - startTime;

      console.log(`Full indexing completed successfully in ${result.duration}ms`);
      console.log(`Stats: ${result.stats.docsCrawled} docs, ${result.stats.githubCrawled} github, ${result.stats.searchIndexed} indexed, ${result.stats.embeddingsGenerated} embedded`);

      return result;
    } catch (error) {
      console.error('Full indexing failed:', error);
      result.success = false;
      result.duration = Date.now() - startTime;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    }
  }

  async incrementalUpdate(urls: string[]): Promise<IndexingResult> {
    const startTime = Date.now();
    const result: IndexingResult = {
      success: false,
      totalDocuments: 0,
      indexedDocuments: 0,
      embeddedDocuments: 0,
      errors: [],
      duration: 0,
      stats: {
        docsCrawled: 0,
        githubCrawled: 0,
        searchIndexed: 0,
        embeddingsGenerated: 0
      }
    };

    try {
      console.log(`Starting incremental update for ${urls.length} URLs...`);

      const documents: ExpoDocument[] = [];

      // 指定されたURLをクロール
      for (const url of urls) {
        try {
          const document = await this.crawler.crawlSingleDocument(url);
          if (document) {
            documents.push(document);
          }
        } catch (error) {
          result.errors.push(`Failed to crawl ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      result.totalDocuments = documents.length;

      if (documents.length === 0) {
        throw new Error('No documents were crawled in incremental update');
      }

      // 検索インデックス更新
      for (const doc of documents) {
        try {
          await this.searchEngine.indexDocument(doc);
          result.stats.searchIndexed++;
        } catch (error) {
          result.errors.push(`Failed to index ${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      result.indexedDocuments = result.stats.searchIndexed;

      // 埋め込み更新
      if (this.config.embedding.enabled) {
        await this.recommendationEngine.indexDocuments(documents);
        result.stats.embeddingsGenerated = documents.length;
        result.embeddedDocuments = documents.length;
      }

      result.success = true;
      result.duration = Date.now() - startTime;

      console.log(`Incremental update completed in ${result.duration}ms`);
      return result;
    } catch (error) {
      console.error('Incremental update failed:', error);
      result.success = false;
      result.duration = Date.now() - startTime;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    }
  }

  async getIndexingStats(): Promise<{
    searchDocuments: number;
    embeddedDocuments: number;
    lastIndexed: Date | null;
  }> {
    try {
      const searchCount = await this.searchEngine.getDocumentCount();
      const embeddedCount = this.recommendationEngine.getIndexedDocumentCount();

      return {
        searchDocuments: searchCount,
        embeddedDocuments: embeddedCount,
        lastIndexed: new Date() // 実際の実装では最後のインデックス日時を保存
      };
    } catch (error) {
      console.error('Failed to get indexing stats:', error);
      return {
        searchDocuments: 0,
        embeddedDocuments: 0,
        lastIndexed: null
      };
    }
  }

  async clearAllIndexes(): Promise<void> {
    console.log('Clearing all indexes...');
    
    try {
      await this.searchEngine.clearIndex();
      this.recommendationEngine.clearIndex();
      console.log('All indexes cleared successfully');
    } catch (error) {
      console.error('Failed to clear indexes:', error);
      throw error;
    }
  }

  // テスト用のサンプルドキュメント作成
  async createSampleDocuments(): Promise<ExpoDocument[]> {
    const sampleDocs: ExpoDocument[] = [
      {
        id: 'expo_camera_guide',
        url: 'https://docs.expo.dev/versions/latest/sdk/camera/',
        title: 'Camera - Expo Documentation',
        content: 'A comprehensive guide to using the Camera API in Expo. This API allows you to take photos and record videos using the device camera.',
        markdown: '# Camera\n\nA comprehensive guide to using the Camera API in Expo...',
        frontmatter: { title: 'Camera API Guide' },
        type: 'api',
        lastModified: new Date(),
        platforms: ['ios', 'android'],
        sdkVersion: 'latest',
        moduleType: 'core',
        tags: ['camera', 'photo', 'video', 'media'],
        codeBlocks: [
          {
            language: 'javascript',
            code: 'import { Camera } from "expo-camera";',
            context: 'Import statement for Camera component'
          }
        ]
      },
      {
        id: 'expo_navigation_tutorial',
        url: 'https://docs.expo.dev/guides/navigation/',
        title: 'Navigation Tutorial',
        content: 'Learn how to implement navigation in your Expo app using React Navigation. This tutorial covers stack, tab, and drawer navigation.',
        markdown: '# Navigation Tutorial\n\nLearn how to implement navigation...',
        frontmatter: { title: 'Navigation Tutorial' },
        type: 'tutorial',
        lastModified: new Date(),
        platforms: ['ios', 'android', 'web'],
        sdkVersion: 'latest',
        moduleType: 'core',
        tags: ['navigation', 'routing', 'screens'],
        codeBlocks: [
          {
            language: 'javascript',
            code: 'import { NavigationContainer } from "@react-navigation/native";',
            context: 'Setting up navigation container'
          }
        ]
      }
    ];

    return sampleDocs;
  }

  // アクセサーメソッド
  getSearchEngine(): ExpoSearchEngine {
    return this.searchEngine;
  }

  getRecommendationEngine(): ExpoRecommendationEngine {
    return this.recommendationEngine;
  }

  getCrawler(): ExpoCrawler {
    return this.crawler;
  }
} 