import axios from 'axios';
import cheerio from 'cheerio';
import { URL } from 'url';
import { CrawlConfig, ExpoDocument } from '../types/document.js';
import { MarkdownParser } from './markdown-parser.js';

export interface CrawlResult {
  success: boolean;
  documents: ExpoDocument[];
  errors: Array<{ url: string; error: string }>;
  stats: {
    totalUrls: number;
    successCount: number;
    errorCount: number;
    duration: number;
  };
}

export class ExpoCrawler {
  private parser: MarkdownParser;
  private config: CrawlConfig;
  private visitedUrls = new Set<string>();
  private pendingUrls: string[] = [];

  constructor(config?: Partial<CrawlConfig>) {
    this.parser = new MarkdownParser();
    this.config = {
      baseUrl: 'https://docs.expo.dev',
      allowedPaths: ['/'],
      excludePaths: ['/api/', '/archive/', '/tutorial/'],
      respectRobotsTxt: true,
      respectLlmsTxt: true,
      maxDepth: 3,
      delay: 1000, // 1秒待機
      userAgent: 'expo-mcp-server/1.0',
      ...config
    };
  }

  async crawlExpoDocumentation(): Promise<CrawlResult> {
    const startTime = Date.now();
    const documents: ExpoDocument[] = [];
    const errors: Array<{ url: string; error: string }> = [];

    try {
      // 主要なドキュメントエンドポイントを定義
      const seedUrls = [
        'https://docs.expo.dev/',
        'https://docs.expo.dev/guides/',
        'https://docs.expo.dev/tutorial/',
        'https://docs.expo.dev/versions/',
        'https://docs.expo.dev/workflow/',
      ];

      this.pendingUrls = [...seedUrls];
      let depth = 0;

      while (this.pendingUrls.length > 0 && depth < this.config.maxDepth) {
        const currentBatch = [...this.pendingUrls];
        this.pendingUrls = [];

        for (const url of currentBatch) {
          if (this.visitedUrls.has(url)) {
            continue;
          }

          try {
            await this.delay(this.config.delay);
            const document = await this.crawlSingleDocument(url);
            if (document) {
              documents.push(document);
            }
          } catch (error) {
            errors.push({
              url,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        depth++;
      }

      return {
        success: true,
        documents,
        errors,
        stats: {
          totalUrls: this.visitedUrls.size,
          successCount: documents.length,
          errorCount: errors.length,
          duration: Date.now() - startTime
        }
      };
    } catch (error) {
      console.error('Crawling failed:', error);
      return {
        success: false,
        documents,
        errors: [...errors, { url: 'general', error: error instanceof Error ? error.message : 'Unknown error' }],
        stats: {
          totalUrls: this.visitedUrls.size,
          successCount: documents.length,
          errorCount: errors.length + 1,
          duration: Date.now() - startTime
        }
      };
    }
  }

  async crawlSingleDocument(url: string): Promise<ExpoDocument | null> {
    if (this.visitedUrls.has(url)) {
      return null;
    }

    this.visitedUrls.add(url);

    try {
      console.log(`Crawling: ${url}`);

      // URLの検証
      if (!this.isAllowedUrl(url)) {
        console.log(`Skipped (not allowed): ${url}`);
        return null;
      }

      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': this.config.userAgent,
          'Accept': 'text/html,text/markdown,*/*'
        }
      });

      // Content-Type確認
      const contentType = response.headers['content-type'] || '';
      
      if (contentType.includes('text/html')) {
        return await this.parseHtmlDocument(url, response.data);
      } else if (contentType.includes('text/markdown') || url.endsWith('.md')) {
        return await this.parseMarkdownDocument(url, response.data);
      } else {
        console.log(`Unsupported content type: ${contentType} for ${url}`);
        return null;
      }
    } catch (error) {
      console.error(`Failed to crawl ${url}:`, error);
      throw error;
    }
  }

  private async parseHtmlDocument(url: string, html: string): Promise<ExpoDocument | null> {
    try {
      const $ = cheerio.load(html);
      
      // メタデータ抽出
      const title = $('title').text() || $('h1').first().text() || '';
      const description = $('meta[name="description"]').attr('content') || '';
      
      // メインコンテンツ抽出
      let content = '';
      const mainSelectors = [
        'main',
        '.main-content',
        '.docs-content',
        '.content',
        'article',
        '.markdown-body'
      ];

      for (const selector of mainSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          content = element.text();
          break;
        }
      }

      if (!content) {
        content = $('body').text();
      }

      // リンク収集（次のクロール対象）
      this.collectLinks($, url);

      // ドキュメントタイプ判定
      const docType = this.determineDocumentType(url, title, content);

      // ExpoDocument形式に変換
      const document: ExpoDocument = {
        id: this.generateDocumentId(url),
        url,
        title: title.trim(),
        content: content.trim(),
        markdown: '', // HTMLからMarkdownに変換は複雑なため空にする
        frontmatter: {
          description,
          source: 'html'
        },
        type: docType,
        lastModified: new Date(),
        platforms: this.extractPlatformsFromContent(content),
        sdkVersion: this.extractSdkVersionFromContent(content),
        moduleType: this.determineModuleType(url),
        tags: this.extractTagsFromContent(content, title),
        codeBlocks: this.extractCodeBlocksFromHtml(html)
      };

      return document;
    } catch (error) {
      console.error(`Failed to parse HTML document ${url}:`, error);
      return null;
    }
  }

  private async parseMarkdownDocument(url: string, markdown: string): Promise<ExpoDocument | null> {
    try {
      const docType = this.determineDocumentType(url, '', markdown);
      const parsedDoc = await this.parser.parseExpoDocument(markdown, url, docType);
      
      const document: ExpoDocument = {
        id: this.generateDocumentId(url),
        url,
        title: parsedDoc.title || 'Untitled',
        content: parsedDoc.content || '',
        markdown,
        frontmatter: parsedDoc.frontmatter || {},
        type: parsedDoc.type || docType,
        lastModified: parsedDoc.lastModified || new Date(),
        platforms: parsedDoc.platforms || [],
        sdkVersion: parsedDoc.sdkVersion || 'latest',
        moduleType: parsedDoc.moduleType || 'core',
        tags: parsedDoc.tags || [],
        codeBlocks: parsedDoc.codeBlocks || []
      };

      return document;
    } catch (error) {
      console.error(`Failed to parse Markdown document ${url}:`, error);
      return null;
    }
  }

  private collectLinks($: cheerio.CheerioAPI, baseUrl: string): void {
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (!href) return;

      try {
        const absoluteUrl = new URL(href, baseUrl).href;
        
        if (this.isAllowedUrl(absoluteUrl) && !this.visitedUrls.has(absoluteUrl)) {
          this.pendingUrls.push(absoluteUrl);
        }
      } catch (error) {
        // 無効なURLは無視
      }
    });
  }

  private isAllowedUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      
      // ベースURLチェック
      if (!url.startsWith(this.config.baseUrl)) {
        return false;
      }

      // 許可パスチェック
      const allowed = this.config.allowedPaths.some(path => 
        urlObj.pathname.startsWith(path)
      );

      if (!allowed) {
        return false;
      }

      // 除外パスチェック
      const excluded = this.config.excludePaths.some(path => 
        urlObj.pathname.startsWith(path)
      );

      return !excluded;
    } catch (error) {
      return false;
    }
  }

  private determineDocumentType(url: string, title: string, content: string): ExpoDocument['type'] {
    const urlLower = url.toLowerCase();
    const titleLower = title.toLowerCase();
    const contentLower = content.toLowerCase();

    if (urlLower.includes('/api/') || titleLower.includes('api') || contentLower.includes('api reference')) {
      return 'api';
    }
    if (urlLower.includes('/tutorial/') || titleLower.includes('tutorial') || contentLower.includes('step-by-step')) {
      return 'tutorial';
    }
    if (urlLower.includes('/reference/') || titleLower.includes('reference')) {
      return 'reference';
    }
    
    return 'guide';
  }

  private determineModuleType(url: string): 'core' | 'community' | 'deprecated' {
    const urlLower = url.toLowerCase();
    
    if (urlLower.includes('community') || urlLower.includes('expo-community')) {
      return 'community';
    }
    if (urlLower.includes('deprecated') || urlLower.includes('archive')) {
      return 'deprecated';
    }
    
    return 'core';
  }

  private extractPlatformsFromContent(content: string): Array<'ios' | 'android' | 'web' | 'universal'> {
    const platforms: Array<'ios' | 'android' | 'web' | 'universal'> = [];
    const contentLower = content.toLowerCase();

    if (contentLower.includes('ios') || contentLower.includes('iphone') || contentLower.includes('ipad')) {
      platforms.push('ios');
    }
    if (contentLower.includes('android')) {
      platforms.push('android');
    }
    if (contentLower.includes('web') || contentLower.includes('browser')) {
      platforms.push('web');
    }
    if (contentLower.includes('universal') || contentLower.includes('cross-platform')) {
      platforms.push('universal');
    }

    return [...new Set(platforms)];
  }

  private extractSdkVersionFromContent(content: string): string {
    const sdkMatch = content.match(/SDK\s*(\d+)/i);
    return sdkMatch ? `sdk-${sdkMatch[1]}` : 'latest';
  }

  private extractTagsFromContent(content: string, title: string): string[] {
    const tags: string[] = [];
    const text = (content + ' ' + title).toLowerCase();

    const commonTags = [
      'navigation', 'camera', 'audio', 'video', 'push-notifications',
      'authentication', 'storage', 'networking', 'ui', 'animation',
      'location', 'maps', 'payments', 'sharing', 'sensors', 'expo-cli',
      'eas', 'development', 'production', 'configuration'
    ];

    for (const tag of commonTags) {
      if (text.includes(tag.replace('-', ' ')) || text.includes(tag)) {
        tags.push(tag);
      }
    }

    return [...new Set(tags)];
  }

  private extractCodeBlocksFromHtml(html: string): Array<{ language: string; code: string; context: string }> {
    const codeBlocks: Array<{ language: string; code: string; context: string }> = [];
    const $ = cheerio.load(html);

    $('pre code, .highlight code, .language-').each((_, element) => {
      const $element = $(element);
      const code = $element.text().trim();
      
      if (code.length > 10) { // 短すぎるコードブロックは除外
        let language = 'text';
        
        // 言語判定
        const className = $element.attr('class') || '';
        const languageMatch = className.match(/language-(\w+)/);
        if (languageMatch) {
          language = languageMatch[1];
        }

        // コンテキスト取得
        const context = $element.closest('div, section, article')
          .contents()
          .not($element.parent())
          .text()
          .trim()
          .substring(0, 200);

        codeBlocks.push({
          language,
          code,
          context
        });
      }
    });

    return codeBlocks;
  }

  private generateDocumentId(url: string): string {
    // URLからIDを生成
    const urlObj = new URL(url);
    return `expo_${urlObj.pathname.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // GitHub Expo リポジトリ連携
  async crawlGitHubExpoRepo(): Promise<CrawlResult> {
    const startTime = Date.now();
    const documents: ExpoDocument[] = [];
    const errors: Array<{ url: string; error: string }> = [];

    try {
      // 主要なREADMEファイルのパスを取得
      const repoUrl = 'https://api.github.com/repos/expo/expo/contents';
      const packagePaths = await this.getExpoPackagePaths();

      for (const packagePath of packagePaths) {
        try {
          await this.delay(1000); // GitHub APIレート制限対策
          const readmeUrl = `${repoUrl}/${packagePath}/README.md`;
          
          const response = await axios.get(readmeUrl, {
            headers: {
              'User-Agent': this.config.userAgent,
              'Accept': 'application/vnd.github.v3+json'
            }
          });

          if (response.data.download_url) {
            const readmeResponse = await axios.get(response.data.download_url);
            const document = await this.parseMarkdownDocument(
              `https://github.com/expo/expo/tree/main/${packagePath}/README.md`,
              readmeResponse.data
            );

            if (document) {
              documents.push(document);
            }
          }
        } catch (error) {
          errors.push({
            url: packagePath,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return {
        success: true,
        documents,
        errors,
        stats: {
          totalUrls: packagePaths.length,
          successCount: documents.length,
          errorCount: errors.length,
          duration: Date.now() - startTime
        }
      };
    } catch (error) {
      console.error('GitHub crawling failed:', error);
      return {
        success: false,
        documents,
        errors: [...errors, { url: 'github', error: error instanceof Error ? error.message : 'Unknown error' }],
        stats: {
          totalUrls: 0,
          successCount: documents.length,
          errorCount: errors.length + 1,
          duration: Date.now() - startTime
        }
      };
    }
  }

  private async getExpoPackagePaths(): Promise<string[]> {
    try {
      const response = await axios.get('https://api.github.com/repos/expo/expo/contents/packages', {
        headers: {
          'User-Agent': this.config.userAgent,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      return response.data
        .filter((item: any) => item.type === 'dir')
        .map((item: any) => `packages/${item.name}`)
        .slice(0, 20); // 最初の20パッケージのみ（制限）
    } catch (error) {
      console.error('Failed to get package paths:', error);
      return [];
    }
  }
} 