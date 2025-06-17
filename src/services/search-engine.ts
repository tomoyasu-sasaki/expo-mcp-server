import { Client } from 'typesense';
import { SearchQuery, SearchResult, IndexConfiguration, ExpoDocument } from '../types/document.js';

export interface SearchEngineConfig {
  host: string;
  port: number;
  protocol: 'http' | 'https';
  apiKey: string;
}

export class ExpoSearchEngine {
  private client: Client;
  private collectionName = 'expo_documents';

  constructor(config: SearchEngineConfig) {
    this.client = new Client({
      nodes: [{
        host: config.host,
        port: config.port,
        protocol: config.protocol
      }],
      apiKey: config.apiKey,
      connectionTimeoutSeconds: 2
    });
  }

  async initializeIndex(): Promise<void> {
    try {
      // 既存のコレクションを削除（開発環境のみ）
      try {
        await this.client.collections(this.collectionName).delete();
        console.log(`Deleted existing collection: ${this.collectionName}`);
      } catch (error) {
        // コレクションが存在しない場合は無視
      }

      // コレクション設定
      const schema: IndexConfiguration = {
        name: this.collectionName,
        fields: [
          { name: 'id', type: 'string', facet: false, index: true, optional: false },
          { name: 'title', type: 'string', facet: false, index: true, optional: false },
          { name: 'content', type: 'string', facet: false, index: true, optional: false },
          { name: 'url', type: 'string', facet: false, index: false, optional: false },
          { name: 'type', type: 'string', facet: true, index: true, optional: false },
          { name: 'platforms', type: 'string[]', facet: true, index: true, optional: true },
          { name: 'sdkVersion', type: 'string', facet: true, index: true, optional: false },
          { name: 'moduleType', type: 'string', facet: true, index: true, optional: false },
          { name: 'tags', type: 'string[]', facet: true, index: true, optional: true },
          { name: 'codeContent', type: 'string', facet: false, index: true, optional: true },
          { name: 'lastModified', type: 'int32', facet: false, index: false, sort: true, optional: false },
          { name: 'popularity', type: 'int32', facet: false, index: false, sort: true, optional: true }
        ],
        defaultSortingField: 'popularity'
      };

      await this.client.collections().create(schema);
      console.log(`Created collection: ${this.collectionName}`);
    } catch (error) {
      console.error('Failed to initialize index:', error);
      throw error;
    }
  }

  async indexDocument(document: ExpoDocument): Promise<void> {
    try {
      const indexDoc = this.prepareDocumentForIndex(document);
      await this.client.collections(this.collectionName).documents().create(indexDoc);
      console.log(`Indexed document: ${document.id}`);
    } catch (error) {
      console.error(`Failed to index document ${document.id}:`, error);
      throw error;
    }
  }

  async indexDocuments(documents: ExpoDocument[]): Promise<void> {
    try {
      const indexDocs = documents.map(doc => this.prepareDocumentForIndex(doc));
      
      // バッチ処理
      const batchSize = 50;
      for (let i = 0; i < indexDocs.length; i += batchSize) {
        const batch = indexDocs.slice(i, i + batchSize);
        await this.client.collections(this.collectionName).documents().import(batch, {
          action: 'create'
        });
        console.log(`Indexed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(indexDocs.length / batchSize)}`);
      }
      
      console.log(`Successfully indexed ${documents.length} documents`);
    } catch (error) {
      console.error('Failed to index documents:', error);
      throw error;
    }
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    const startTime = Date.now();
    
    try {
      const searchParams = this.buildSearchParams(query);
      const result = await this.client.collections(this.collectionName).documents().search(searchParams);
      
      const documents = result.hits?.map((hit: any) => this.convertHitToDocument(hit)) || [];
      
      // ファセット情報の処理
      const facets: Record<string, Array<{ value: string; count: number }>> = {};
      if (result.facet_counts) {
        for (const facet of result.facet_counts) {
          facets[facet.field_name] = facet.counts?.map((count: any) => ({
            value: count.value,
            count: count.count
          })) || [];
        }
      }

      return {
        documents,
        totalCount: result.found || 0,
        facets,
        searchTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }

  async searchWithTypoTolerance(query: string, maxTypos = 2): Promise<SearchResult> {
    const searchQuery: SearchQuery = {
      query,
      limit: 20
    };

    try {
      // 通常の検索を試行
      const result = await this.search(searchQuery);
      
      if (result.documents.length > 0) {
        return result;
      }

      // タイポ耐性検索
      const typoSearchParams = this.buildSearchParams(searchQuery);
      typoSearchParams.num_typos = maxTypos;
      typoSearchParams.drop_tokens_threshold = 1;
      
      const typoResult = await this.client.collections(this.collectionName).documents().search(typoSearchParams);
      
      const documents = typoResult.hits?.map((hit: any) => this.convertHitToDocument(hit)) || [];
      
      return {
        documents,
        totalCount: typoResult.found || 0,
        facets: {},
        searchTime: Date.now() - Date.now()
      };
    } catch (error) {
      console.error('Typo tolerance search failed:', error);
      throw error;
    }
  }

  async searchByCodeBlock(codeQuery: string): Promise<SearchResult> {
    const searchQuery: SearchQuery = {
      query: codeQuery,
      limit: 10
    };

    const searchParams = this.buildSearchParams(searchQuery);
    
    // コードブロック重み付け
    searchParams.query_by = 'codeContent,title,content';
    searchParams.query_by_weights = '3,2,1'; // コードコンテンツに最高重み
    
    try {
      const result = await this.client.collections(this.collectionName).documents().search(searchParams);
      const documents = result.hits?.map((hit: any) => this.convertHitToDocument(hit)) || [];
      
      return {
        documents,
        totalCount: result.found || 0,
        facets: {},
        searchTime: Date.now() - Date.now()
      };
    } catch (error) {
      console.error('Code block search failed:', error);
      throw error;
    }
  }

  async getFacets(): Promise<Record<string, Array<{ value: string; count: number }>>> {
    try {
      const result = await this.client.collections(this.collectionName).documents().search({
        q: '*',
        facet_by: 'type,platforms,sdkVersion,moduleType,tags',
        max_facet_values: 100,
        per_page: 0
      });

      const facets: Record<string, Array<{ value: string; count: number }>> = {};
      if (result.facet_counts) {
        for (const facet of result.facet_counts) {
          facets[facet.field_name] = facet.counts?.map((count: any) => ({
            value: count.value,
            count: count.count
          })) || [];
        }
      }

      return facets;
    } catch (error) {
      console.error('Failed to get facets:', error);
      return {};
    }
  }

  async getDocumentCount(): Promise<number> {
    try {
      const result = await this.client.collections(this.collectionName).documents().search({
        q: '*',
        per_page: 0
      });
      return result.found || 0;
    } catch (error) {
      console.error('Failed to get document count:', error);
      return 0;
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    try {
      await this.client.collections(this.collectionName).documents(documentId).delete();
      console.log(`Deleted document: ${documentId}`);
    } catch (error) {
      console.error(`Failed to delete document ${documentId}:`, error);
      throw error;
    }
  }

  async clearIndex(): Promise<void> {
    try {
      await this.client.collections(this.collectionName).delete();
      await this.initializeIndex();
      console.log('Index cleared and reinitialized');
    } catch (error) {
      console.error('Failed to clear index:', error);
      throw error;
    }
  }

  private prepareDocumentForIndex(document: ExpoDocument): any {
    // コードブロックをテキストに変換
    const codeContent = document.codeBlocks
      .map(block => `${block.language}: ${block.code} ${block.context}`)
      .join(' ');

    return {
      id: document.id,
      title: document.title,
      content: document.content,
      url: document.url,
      type: document.type,
      platforms: document.platforms,
      sdkVersion: document.sdkVersion,
      moduleType: document.moduleType,
      tags: document.tags,
      codeContent,
      lastModified: Math.floor(document.lastModified.getTime() / 1000),
      popularity: this.calculatePopularity(document)
    };
  }

  private calculatePopularity(document: ExpoDocument): number {
    let score = 0;

    // タイプによる重み付け
    const typeWeights = {
      'api': 10,
      'guide': 8,
      'tutorial': 6,
      'reference': 4
    };
    score += typeWeights[document.type] || 0;

    // モジュールタイプによる重み付け
    const moduleWeights = {
      'core': 10,
      'community': 5,
      'deprecated': 1
    };
    score += moduleWeights[document.moduleType] || 0;

    // プラットフォーム数による重み付け
    score += document.platforms.length * 2;

    // タグ数による重み付け
    score += document.tags.length;

    // コードブロック数による重み付け
    score += document.codeBlocks.length * 3;

    // SDK バージョンによる重み付け
    if (document.sdkVersion === 'latest') {
      score += 10;
    } else if (document.sdkVersion === 'sdk-49') {
      score += 8;
    } else if (document.sdkVersion === 'sdk-48') {
      score += 6;
    }

    return score;
  }

  private buildSearchParams(query: SearchQuery): any {
    const params: any = {
      q: query.query,
      query_by: 'title,content,tags,codeContent',
      query_by_weights: '4,2,3,5', // title, content, tags, codeContent の重み (コードブロック重み強化)
      sort_by: query.sortBy || 'popularity:desc',
      per_page: query.limit || 20,
      page: Math.floor((query.offset || 0) / (query.limit || 20)) + 1,
      highlight_full_fields: 'title,content',
      snippet_threshold: 30,
      num_typos: 1,
      prefix: true,
      drop_tokens_threshold: 1
    };

    // コードクエリ検出による動的重み付け
    if (this.isCodeQuery(query.query)) {
      params.query_by_weights = '3,1,2,10'; // コード検索時はコードブロックに最高重み
      params.sort_by = '_score:desc'; // 関連度優先
    }

    // ファセットフィルター適用
    if (query.filters) {
      const filterBy: string[] = [];
      
      if (query.filters.category) {
        filterBy.push(`type:=[${query.filters.category.join(',')}]`);
      }
      
      if (query.filters.platform) {
        filterBy.push(`platforms:=[${query.filters.platform.join(',')}]`);
      }
      
      if (query.filters.sdkVersion) {
        filterBy.push(`sdkVersion:=[${query.filters.sdkVersion.join(',')}]`);
      }
      
      if (query.filters.moduleType) {
        filterBy.push(`moduleType:=[${query.filters.moduleType.join(',')}]`);
      }
      
      if (filterBy.length > 0) {
        params.filter_by = filterBy.join(' && ');
      }
    }

    // ファセット情報要求
    if (query.facets && query.facets.length > 0) {
      params.facet_by = query.facets.join(',');
      params.max_facet_values = 50;
    }

    return params;
  }

  // コードクエリ検出ヘルパー
  private isCodeQuery(query: string): boolean {
    const codePatterns = [
      /import\s+.*from/i,
      /export\s+(default\s+)?/i,
      /function\s+\w+/i,
      /const\s+\w+\s*=/i,
      /let\s+\w+\s*=/i,
      /var\s+\w+\s*=/i,
      /useState|useEffect|useRef/i,
      /expo-\w+/i,
      /\w+\(\)/i,
      /<\w+.*>/i,
      /\.\w+\(/i
    ];
    
    return codePatterns.some(pattern => pattern.test(query));
  }

  // 高度なコードブロック検索
  async searchByCodeBlockAdvanced(codeQuery: string, language?: string): Promise<SearchResult> {
    const searchQuery: SearchQuery = {
      query: codeQuery,
      limit: 15
    };

    const searchParams = this.buildSearchParams(searchQuery);
    
    // 言語別重み付け
    const languageWeights: Record<string, string> = {
      'javascript': 'codeContent,title,content,tags',
      'typescript': 'codeContent,title,content,tags',
      'jsx': 'codeContent,title,content,tags',
      'tsx': 'codeContent,title,content,tags',
      'json': 'codeContent,content,title,tags',
      'yaml': 'codeContent,content,title,tags'
    };

    if (language && languageWeights[language]) {
      searchParams.query_by = languageWeights[language];
      searchParams.query_by_weights = '10,3,2,1'; // 言語指定時はコードに最高重み
    } else {
      searchParams.query_by = 'codeContent,title,content,tags';
      searchParams.query_by_weights = '8,3,2,1'; // コードブロック重視
    }

    // コードパターンマッチング強化
    searchParams.infix = 'always';
    searchParams.prefix = true;
    searchParams.num_typos = 0; // コード検索は正確性重視

    try {
      const result = await this.client.collections(this.collectionName).documents().search(searchParams);
      const documents = result.hits?.map((hit: any) => this.convertHitToDocument(hit)) || [];
      
      // コード関連度によるスコア調整
      const enhancedDocuments = documents.map(doc => {
        const codeRelevance = this.calculateCodeRelevance(doc, codeQuery, language);
        return {
          ...doc,
          _codeRelevance: codeRelevance
        };
      }).sort((a, b) => (b as any)._codeRelevance - (a as any)._codeRelevance);

      return {
        documents: enhancedDocuments,
        totalCount: result.found || 0,
        facets: {},
        searchTime: Date.now() - Date.now()
      };
    } catch (error) {
      console.error('Advanced code block search failed:', error);
      throw error;
    }
  }

  // コード関連度計算
  private calculateCodeRelevance(document: ExpoDocument, query: string, language?: string): number {
    let relevance = 0;
    const queryLower = query.toLowerCase();

    // コードブロック内での一致
    for (const codeBlock of document.codeBlocks) {
      const codeLower = codeBlock.code.toLowerCase();
      
      // 言語マッチング
      if (language && codeBlock.language === language) {
        relevance += 10;
      }
      
      // 完全一致
      if (codeLower.includes(queryLower)) {
        relevance += 20;
      }
      
      // 関数/変数名マッチング
      const identifiers = query.match(/\b\w+\b/g) || [];
      for (const identifier of identifiers) {
        if (codeLower.includes(identifier.toLowerCase())) {
          relevance += 5;
        }
      }
      
      // Expo特有パターン
      if (queryLower.includes('expo') && codeLower.includes('expo')) {
        relevance += 15;
      }
    }

    // タイトル内のコード関連キーワード
    const titleLower = document.title.toLowerCase();
    if (titleLower.includes('api') || titleLower.includes('hook') || titleLower.includes('component')) {
      relevance += 5;
    }

    return relevance;
  }

  private convertHitToDocument(hit: any): ExpoDocument {
    const doc = hit.document;
    
    return {
      id: doc.id,
      url: doc.url,
      title: doc.title,
      content: doc.content,
      markdown: '', // インデックスには保存していない
      frontmatter: {},
      type: doc.type,
      lastModified: new Date(doc.lastModified * 1000),
      platforms: doc.platforms || [],
      sdkVersion: doc.sdkVersion,
      moduleType: doc.moduleType,
      tags: doc.tags || [],
      codeBlocks: [] // インデックスには詳細は保存していない
    };
  }
} 