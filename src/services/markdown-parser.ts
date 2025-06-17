import { marked } from 'marked';
import matter from 'gray-matter';
import { ExpoDocument } from '../types/document.js';

export interface ParsedMarkdown {
  frontmatter: Record<string, any>;
  content: string;
  html: string;
  codeBlocks: Array<{
    language: string;
    code: string;
    context: string;
  }>;
  headings: Array<{
    level: number;
    text: string;
    anchor: string;
  }>;
  links: Array<{
    text: string;
    url: string;
    title?: string;
  }>;
}

export class MarkdownParser {
  constructor() {
    this.configureMarked();
  }

  private configureMarked(): void {
    marked.setOptions({
      gfm: true, // GitHub Flavored Markdown
      breaks: true,
      pedantic: false
    });
  }

  private generateAnchor(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
  }

  async parseMarkdown(content: string, url?: string): Promise<ParsedMarkdown> {
    try {
      // フロントマター解析
      const { data: frontmatter, content: markdownContent } = matter(content);

      // HTML変換
      const html = await marked(markdownContent);

      // コードブロック抽出
      const codeBlocks = this.extractCodeBlocks(markdownContent);

      // 見出し抽出
      const headings = this.extractHeadings(markdownContent);

      // リンク抽出
      const links = this.extractLinks(markdownContent, url);

      return {
        frontmatter,
        content: markdownContent,
        html: await html,
        codeBlocks,
        headings,
        links
      };
    } catch (error) {
      console.error('Error parsing markdown:', error);
      throw new Error(`Failed to parse markdown: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractCodeBlocks(content: string): Array<{ language: string; code: string; context: string }> {
    const codeBlocks: Array<{ language: string; code: string; context: string }> = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    
    let match;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1] || 'text';
      const code = match[2].trim();
      
      // コードブロック前後のコンテキストを取得
      const beforeIndex = Math.max(0, match.index - 200);
      const afterIndex = Math.min(content.length, match.index + match[0].length + 200);
      const context = content.substring(beforeIndex, match.index) + 
                     content.substring(match.index + match[0].length, afterIndex);

      codeBlocks.push({
        language,
        code,
        context: context.replace(/\n+/g, ' ').trim()
      });
    }

    return codeBlocks;
  }

  private extractHeadings(content: string): Array<{ level: number; text: string; anchor: string }> {
    const headings: Array<{ level: number; text: string; anchor: string }> = [];
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    
    let match;
    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      const anchor = this.generateAnchor(text);

      headings.push({
        level,
        text,
        anchor
      });
    }

    return headings;
  }

  private extractLinks(content: string, baseUrl?: string): Array<{ text: string; url: string; title?: string }> {
    const links: Array<{ text: string; url: string; title?: string }> = [];
    
    // Markdown リンク形式 [text](url "title")
    const linkRegex = /\[([^\]]+)\]\(([^)]+)(?:\s+"([^"]*)")?\)/g;
    
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      const text = match[1];
      let url = match[2];
      const title = match[3];

      // 相対URLを絶対URLに変換
      if (baseUrl && (url.startsWith('./') || url.startsWith('../'))) {
        try {
          url = new URL(url, baseUrl).href;
        } catch (error) {
          // URL変換に失敗した場合はそのまま保持
        }
      }

      links.push({
        text,
        url,
        title
      });
    }

    return links;
  }

  /**
   * ExpoドキュメントからExpoDocument形式にパース
   */
  async parseExpoDocument(
    content: string, 
    url: string, 
    type: ExpoDocument['type']
  ): Promise<Partial<ExpoDocument>> {
    const parsed = await this.parseMarkdown(content, url);
    
    // フロントマターからメタデータ抽出
    const platforms = this.extractPlatforms(parsed.frontmatter, parsed.content);
    const sdkVersion = this.extractSdkVersion(parsed.frontmatter, parsed.content);
    const moduleType = this.extractModuleType(url, parsed.frontmatter);
    const tags = this.extractTags(parsed.frontmatter, parsed.content);

    return {
      url,
      title: parsed.frontmatter.title || this.extractTitleFromContent(parsed.content),
      content: parsed.content,
      markdown: content,
      frontmatter: parsed.frontmatter,
      type,
      lastModified: this.parseDate(parsed.frontmatter.date || parsed.frontmatter.lastModified),
      platforms,
      sdkVersion,
      moduleType,
      tags,
      codeBlocks: parsed.codeBlocks
    };
  }

  private extractPlatforms(frontmatter: Record<string, any>, content: string): Array<'ios' | 'android' | 'web' | 'universal'> {
    const platforms: Array<'ios' | 'android' | 'web' | 'universal'> = [];
    
    // フロントマターから
    if (frontmatter.platforms) {
      platforms.push(...frontmatter.platforms);
    }

    // コンテンツから推測
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

    // 重複削除
    return [...new Set(platforms)];
  }

  private extractSdkVersion(frontmatter: Record<string, any>, content: string): string {
    if (frontmatter.sdk_version || frontmatter.sdkVersion) {
      return frontmatter.sdk_version || frontmatter.sdkVersion;
    }

    // コンテンツからSDKバージョンを推測
    const sdkVersionMatch = content.match(/SDK\s*(\d+)/i);
    if (sdkVersionMatch) {
      return `sdk-${sdkVersionMatch[1]}`;
    }

    return 'latest';
  }

  private extractModuleType(url: string, frontmatter: Record<string, any>): 'core' | 'community' | 'deprecated' {
    if (frontmatter.moduleType) {
      return frontmatter.moduleType;
    }

    // URLパターンから推測
    if (url.includes('/expo/') || url.includes('/core/')) {
      return 'core';
    }
    if (url.includes('/community/') || url.includes('expo-community')) {
      return 'community';
    }
    if (frontmatter.deprecated || url.includes('/deprecated/')) {
      return 'deprecated';
    }

    return 'core';
  }

  private extractTags(frontmatter: Record<string, any>, content: string): string[] {
    const tags: string[] = [];

    // フロントマターから
    if (frontmatter.tags) {
      tags.push(...frontmatter.tags);
    }
    if (frontmatter.keywords) {
      tags.push(...frontmatter.keywords);
    }

    // コンテンツから自動抽出（簡単な実装）
    const contentLower = content.toLowerCase();
    const commonTags = [
      'navigation', 'camera', 'audio', 'video', 'push-notifications',
      'authentication', 'storage', 'networking', 'ui', 'animation',
      'location', 'maps', 'payments', 'sharing', 'sensors'
    ];

    for (const tag of commonTags) {
      if (contentLower.includes(tag.replace('-', ' ')) || contentLower.includes(tag)) {
        tags.push(tag);
      }
    }

    return [...new Set(tags)];
  }

  private extractTitleFromContent(content: string): string {
    // 最初のh1見出しを探す
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      return h1Match[1].trim();
    }

    // 最初の見出しを探す
    const headingMatch = content.match(/^#+\s+(.+)$/m);
    if (headingMatch) {
      return headingMatch[1].trim();
    }

    // 最初の行を使用
    const firstLine = content.split('\n')[0];
    return firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;
  }

  private parseDate(dateStr: any): Date {
    if (!dateStr) {
      return new Date();
    }

    if (dateStr instanceof Date) {
      return dateStr;
    }

    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }
} 