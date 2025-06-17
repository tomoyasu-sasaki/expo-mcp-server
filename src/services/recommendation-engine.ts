import { pipeline } from '@xenova/transformers';
import { ExpoDocument, RecommendationRequest, RecommendationResult } from '../types/document.js';

export interface EmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
  calculateSimilarity(embedding1: number[], embedding2: number[]): number;
}

export class ExpoRecommendationEngine implements EmbeddingService {
  private model: any | null = null;
  private modelName = 'Xenova/all-MiniLM-L6-v2';
  private documentEmbeddings = new Map<string, number[]>();
  private documents: ExpoDocument[] = [];

  async initialize(): Promise<void> {
    try {
      console.log('Loading embedding model...');
      this.model = await pipeline('feature-extraction', this.modelName);
      console.log('Embedding model loaded successfully');
    } catch (error) {
      console.error('Failed to load embedding model:', error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.model) {
      throw new Error('Model not initialized. Call initialize() first.');
    }

    try {
      // テキストの前処理
      const cleanText = this.preprocessText(text);
      
      // 埋め込み生成
      const output = await this.model(cleanText, { pooling: 'mean', normalize: true });
      
      // 結果を数値配列に変換
      const embedding = Array.from(output.data) as number[];
      return embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    // コサイン類似度計算
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  async indexDocuments(documents: ExpoDocument[]): Promise<void> {
    console.log(`Indexing ${documents.length} documents for recommendations...`);
    
    this.documents = documents;
    
    for (const doc of documents) {
      try {
        // ドキュメントの埋め込み用テキスト作成
        const embedText = this.createEmbeddingText(doc);
        
        // 埋め込み生成
        const embedding = await this.generateEmbedding(embedText);
        
        // ドキュメントに埋め込みを保存
        doc.embedding = embedding;
        this.documentEmbeddings.set(doc.id, embedding);
        
        console.log(`Generated embedding for: ${doc.id}`);
      } catch (error) {
        console.error(`Failed to generate embedding for document ${doc.id}:`, error);
      }
    }
    
    console.log('Document indexing completed');
  }

  async recommend(request: RecommendationRequest): Promise<RecommendationResult[]> {
    try {
      // コンテキスト強化処理
      const enhancedContext = this.enhanceContext(request.context, request.platform);
      
      // コンテキストの埋め込み生成
      const contextEmbedding = await this.generateEmbedding(enhancedContext);
      
      const recommendations: Array<{
        document: ExpoDocument;
        score: number;
        reason: string;
        contextMatch: number;
        platformBoost: number;
      }> = [];

      // 各ドキュメントとの類似度計算
      for (const doc of this.documents) {
        if (!doc.embedding) {
          continue;
        }

        // プラットフォームフィルタリング
        if (request.platform && !doc.platforms.includes(request.platform)) {
          continue;
        }

        // 基本類似度計算
        const baseSimilarity = this.calculateSimilarity(contextEmbedding, doc.embedding);
        
        // コンテキスト強化スコア
        const contextScore = this.calculateContextScore(request.context, doc);
        
        // プラットフォーム一致ボーナス
        const platformBoost = this.calculatePlatformBoost(request.platform, doc);
        
        // 最終スコア計算
        const finalScore = (baseSimilarity * 0.6) + (contextScore * 0.3) + (platformBoost * 0.1);
        
        // 閾値チェック（より厳しい基準）
        if (finalScore >= (request.threshold || 0.75)) {
          const reason = this.generateEnhancedRecommendationReason(
            doc, 
            finalScore, 
            contextScore,
            platformBoost,
            request.context
          );
          
          recommendations.push({
            document: doc,
            score: finalScore,
            reason,
            contextMatch: contextScore,
            platformBoost
          });
        }
      }

      // 高度なランキングアルゴリズム適用
      const rankedRecommendations = this.applyAdvancedRanking(recommendations, request);

      // 結果をRecommendationResult形式に変換
      const results = rankedRecommendations
        .slice(0, request.maxResults || 5)
        .map(rec => ({
          title: rec.document.title,
          url: rec.document.url,
          reason: rec.reason,
          relevanceScore: rec.score,
          contentType: rec.document.type
        }));

      return results;
    } catch (error) {
      console.error('Enhanced recommendation failed:', error);
      throw error;
    }
  }

  async findSimilarDocuments(documentId: string, maxResults = 5): Promise<RecommendationResult[]> {
    const targetDoc = this.documents.find(doc => doc.id === documentId);
    if (!targetDoc || !targetDoc.embedding) {
      return [];
    }

    const similar: Array<{
      document: ExpoDocument;
      score: number;
    }> = [];

    for (const doc of this.documents) {
      if (doc.id === documentId || !doc.embedding) {
        continue;
      }

      const similarity = this.calculateSimilarity(targetDoc.embedding, doc.embedding);
      if (similarity > 0.6) { // 高い類似度のみ
        similar.push({
          document: doc,
          score: similarity
        });
      }
    }

    similar.sort((a, b) => b.score - a.score);

    return similar.slice(0, maxResults).map(sim => ({
      title: sim.document.title,
      url: sim.document.url,
      reason: `Similar to "${targetDoc.title}" (${Math.round(sim.score * 100)}% match)`,
      relevanceScore: sim.score,
      contentType: sim.document.type
    }));
  }

  async recommendByTags(tags: string[], maxResults = 5): Promise<RecommendationResult[]> {
    const tagMatches: Array<{
      document: ExpoDocument;
      matchCount: number;
      score: number;
    }> = [];

    for (const doc of this.documents) {
      const commonTags = doc.tags.filter(tag => tags.includes(tag));
      if (commonTags.length > 0) {
        const score = commonTags.length / Math.max(tags.length, doc.tags.length);
        tagMatches.push({
          document: doc,
          matchCount: commonTags.length,
          score
        });
      }
    }

    tagMatches.sort((a, b) => b.score - a.score);

    return tagMatches.slice(0, maxResults).map(match => ({
      title: match.document.title,
      url: match.document.url,
      reason: `Matches ${match.matchCount} tags: ${match.document.tags.join(', ')}`,
      relevanceScore: match.score,
      contentType: match.document.type
    }));
  }

  async recommendByPlatform(platform: 'ios' | 'android' | 'web' | 'universal', maxResults = 10): Promise<RecommendationResult[]> {
    const platformDocs = this.documents
      .filter(doc => doc.platforms.includes(platform))
      .sort((a, b) => {
        // プラットフォーム専用性でソート
        const aSpecific = a.platforms.length === 1 ? 1 : 0;
        const bSpecific = b.platforms.length === 1 ? 1 : 0;
        return bSpecific - aSpecific;
      });

    return platformDocs.slice(0, maxResults).map(doc => ({
      title: doc.title,
      url: doc.url,
      reason: `Optimized for ${platform}`,
      relevanceScore: doc.platforms.length === 1 ? 1.0 : 0.8,
      contentType: doc.type
    }));
  }

  private preprocessText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // 特殊文字を除去
      .replace(/\s+/g, ' ') // 連続する空白を単一の空白に
      .trim()
      .substring(0, 512); // 最大512文字に制限
  }

  private createEmbeddingText(doc: ExpoDocument): string {
    // ドキュメントから埋め込み用のテキストを作成
    const parts = [
      doc.title,
      doc.content.substring(0, 500), // 最初の500文字
      doc.tags.join(' '),
      doc.platforms.join(' '),
      doc.type,
      doc.moduleType
    ];

    // コードブロックのコンテキストも追加
    if (doc.codeBlocks.length > 0) {
      const codeContext = doc.codeBlocks
        .map(block => `${block.language} ${block.context}`)
        .join(' ');
      parts.push(codeContext.substring(0, 200));
    }

    return parts.join(' ');
  }

  // コンテキスト強化処理
  private enhanceContext(context: string, platform?: string): string {
    const contextLower = context.toLowerCase();
    const enhancedParts = [context];

    // Expo特有のコンテキストパターン検出と拡張
    const expoPatterns = {
      camera: ['camera', 'photo', 'video', 'image', 'media', 'gallery'],
      navigation: ['navigation', 'router', 'screen', 'navigate', 'route'],
      storage: ['storage', 'file', 'document', 'data', 'cache', 'persist'],
      notification: ['notification', 'push', 'alert', 'message', 'badge'],
      location: ['location', 'gps', 'map', 'geolocation', 'position'],
      audio: ['audio', 'sound', 'music', 'record', 'play', 'volume'],
      bluetooth: ['bluetooth', 'ble', 'wireless', 'connect', 'device'],
      sensor: ['sensor', 'accelerometer', 'gyroscope', 'motion', 'device'],
      auth: ['auth', 'login', 'authentication', 'user', 'session', 'token'],
      payment: ['payment', 'purchase', 'billing', 'subscription', 'monetization']
    };

    for (const [category, keywords] of Object.entries(expoPatterns)) {
      if (keywords.some(keyword => contextLower.includes(keyword))) {
        enhancedParts.push(category);
        enhancedParts.push(...keywords.slice(0, 3)); // 関連キーワード追加
      }
    }

    // プラットフォーム特有の拡張
    if (platform) {
      enhancedParts.push(platform);
      
      if (platform === 'ios') {
        enhancedParts.push('swift', 'objective-c', 'xcode', 'testflight');
      } else if (platform === 'android') {
        enhancedParts.push('java', 'kotlin', 'gradle', 'play store');
      } else if (platform === 'web') {
        enhancedParts.push('browser', 'webpack', 'progressive web app');
      }
    }

    // SDK バージョン関連キーワード
    if (contextLower.includes('latest') || contextLower.includes('new')) {
      enhancedParts.push('sdk-49', 'latest');
    }

    return enhancedParts.join(' ');
  }

  // コンテキストスコア計算
  private calculateContextScore(context: string, document: ExpoDocument): number {
    let score = 0;
    const contextLower = context.toLowerCase();
    const documentText = `${document.title} ${document.content} ${document.tags.join(' ')}`.toLowerCase();

    // キーワード重み付きマッチング
    const contextWords = contextLower.split(/\s+/).filter(word => word.length > 2);
    const matchedWords = contextWords.filter(word => documentText.includes(word));
    
    // 基本マッチスコア
    score += (matchedWords.length / contextWords.length) * 0.4;

    // タイトルでのマッチング（より高い重み）
    const titleMatches = contextWords.filter(word => document.title.toLowerCase().includes(word));
    score += (titleMatches.length / contextWords.length) * 0.3;

    // タグでのマッチング
    const tagMatches = contextWords.filter(word => 
      document.tags.some(tag => tag.toLowerCase().includes(word))
    );
    score += (tagMatches.length / contextWords.length) * 0.2;

    // ドキュメントタイプによるボーナス
    if (contextLower.includes('how to') || contextLower.includes('guide')) {
      if (document.type === 'guide' || document.type === 'tutorial') {
        score += 0.1;
      }
    }

    if (contextLower.includes('api') || contextLower.includes('reference')) {
      if (document.type === 'api' || document.type === 'reference') {
        score += 0.1;
      }
    }

    return Math.min(score, 1.0);
  }

  // プラットフォームブーストスコア計算
  private calculatePlatformBoost(platform: string | undefined, document: ExpoDocument): number {
    if (!platform) return 0;

    const validPlatforms: Array<'ios' | 'android' | 'web' | 'universal'> = ['ios', 'android', 'web', 'universal'];
    if (validPlatforms.includes(platform as any) && document.platforms.includes(platform as any)) {
      // プラットフォーム専用の場合は高いボーナス
      if (document.platforms.length === 1) {
        return 0.3;
      }
      // マルチプラットフォーム対応の場合は中程度のボーナス
      return 0.2;
    }

    // ユニバーサル対応の場合は小さなボーナス
    if (document.platforms.includes('universal')) {
      return 0.1;
    }

    return 0;
  }

  // 高度なランキングアルゴリズム
  private applyAdvancedRanking(
    recommendations: Array<{
      document: ExpoDocument;
      score: number;
      reason: string;
      contextMatch: number;
      platformBoost: number;
    }>,
    _request: RecommendationRequest
  ): typeof recommendations {
    // 多段階ソート
    return recommendations.sort((a, b) => {
      // 1. 最終スコア比較
      if (Math.abs(a.score - b.score) > 0.05) {
        return b.score - a.score;
      }

      // 2. コンテキストマッチ比較
      if (Math.abs(a.contextMatch - b.contextMatch) > 0.05) {
        return b.contextMatch - a.contextMatch;
      }

      // 3. ドキュメントタイプ優先度
      const typePriority = { api: 4, guide: 3, tutorial: 2, reference: 1 };
      const aPriority = typePriority[a.document.type] || 0;
      const bPriority = typePriority[b.document.type] || 0;
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      // 4. SDK バージョン新しさ
      const versionPriority: Record<string, number> = { latest: 3, 'sdk-49': 2, 'sdk-48': 1 };
      const aVersion = versionPriority[a.document.sdkVersion] || 0;
      const bVersion = versionPriority[b.document.sdkVersion] || 0;
      if (aVersion !== bVersion) {
        return bVersion - aVersion;
      }

      // 5. モジュールタイプ優先度
      const modulePriority = { core: 3, community: 2, deprecated: 1 };
      const aModule = modulePriority[a.document.moduleType] || 0;
      const bModule = modulePriority[b.document.moduleType] || 0;

      return bModule - aModule;
    });
  }

  // 強化された推薦理由生成
  private generateEnhancedRecommendationReason(
    doc: ExpoDocument, 
    finalScore: number,
    contextScore: number,
    platformBoost: number,
    _context: string
  ): string {
    const percentage = Math.round(finalScore * 100);
    const reasons: string[] = [];

    // 基本的な類似度
    if (finalScore > 0.9) {
      reasons.push(`Highly relevant (${percentage}% match)`);
    } else if (finalScore > 0.8) {
      reasons.push(`Very relevant (${percentage}% match)`);
    } else {
      reasons.push(`Relevant (${percentage}% match)`);
    }

    // コンテキストマッチの詳細
    if (contextScore > 0.7) {
      reasons.push('Strong context alignment');
    } else if (contextScore > 0.5) {
      reasons.push('Good context match');
    }

    // プラットフォーム情報
    if (platformBoost > 0.2) {
      reasons.push(`Optimized for ${doc.platforms.join(', ')}`);
    } else if (platformBoost > 0) {
      reasons.push(`Supports ${doc.platforms.join(', ')}`);
    }

    // ドキュメントタイプ
    if (doc.type === 'api') {
      reasons.push('API reference');
    } else if (doc.type === 'guide') {
      reasons.push('Step-by-step guide');
    } else if (doc.type === 'tutorial') {
      reasons.push('Hands-on tutorial');
    }

    // コードブロックの存在
    if (doc.codeBlocks.length > 0) {
      reasons.push(`${doc.codeBlocks.length} code examples`);
    }

    return reasons.join(' • ');
  }

  getIndexedDocumentCount(): number {
    return this.documentEmbeddings.size;
  }

  clearIndex(): void {
    this.documentEmbeddings.clear();
    this.documents = [];
  }
} 