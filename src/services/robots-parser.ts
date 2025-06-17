import axios from 'axios';
import robotsParser from 'robots-parser';
import { URL } from 'url';

export interface RobotsInfo {
  isAllowed: boolean;
  crawlDelay?: number;
  reason?: string;
}

export interface LlmsInfo {
  isAllowed: boolean;
  restrictions?: string[];
  reason?: string;
}

export class RobotsAndLlmsParser {
  private robotsCache = new Map<string, any>();
  private llmsCache = new Map<string, string>();
  private userAgent: string;

  constructor(userAgent = 'expo-mcp-server/1.0') {
    this.userAgent = userAgent;
  }

  async checkRobotsTxt(url: string): Promise<RobotsInfo> {
    try {
      const urlObj = new URL(url);
      const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
      
      let robots = this.robotsCache.get(robotsUrl);
      if (!robots) {
        try {
          const response = await axios.get(robotsUrl, {
            timeout: 5000,
            headers: {
              'User-Agent': this.userAgent
            }
          });
          robots = robotsParser(robotsUrl, response.data);
          this.robotsCache.set(robotsUrl, robots);
        } catch (error) {
          // robots.txt が存在しない場合は許可とする
          return { isAllowed: true };
        }
      }

      const isAllowed = robots.isAllowed(url, this.userAgent);
      const crawlDelay = robots.getCrawlDelay(this.userAgent);

      return {
        isAllowed,
        crawlDelay,
        reason: isAllowed ? undefined : 'Disallowed by robots.txt'
      };
    } catch (error) {
      console.warn(`Error checking robots.txt for ${url}:`, error);
      return { isAllowed: true }; // エラー時は許可とする
    }
  }

  async checkLlmsTxt(url: string): Promise<LlmsInfo> {
    try {
      const urlObj = new URL(url);
      const llmsUrl = `${urlObj.protocol}//${urlObj.host}/llms.txt`;
      
      let llmsContent = this.llmsCache.get(llmsUrl) ?? '';
      if (!llmsContent) {
        try {
          const response = await axios.get(llmsUrl, {
            timeout: 5000,
            headers: {
              'User-Agent': this.userAgent
            }
          });
          llmsContent = response.data;
          this.llmsCache.set(llmsUrl, llmsContent);
        } catch (error) {
          // llms.txt が存在しない場合は許可とする
          return { isAllowed: true };
        }
      }

      if (!llmsContent) {
        return { isAllowed: true };
      }

      const restrictions = this.parseLlmsContent(llmsContent);
      const isAllowed = this.isUrlAllowedByLlms(url, restrictions);

      return {
        isAllowed,
        restrictions,
        reason: isAllowed ? undefined : 'Restricted by llms.txt'
      };
    } catch (error) {
      console.warn(`Error checking llms.txt for ${url}:`, error);
      return { isAllowed: true }; // エラー時は許可とする
    }
  }

  private parseLlmsContent(content: string): string[] {
    const lines = content.split('\n');
    const restrictions: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('Disallow:')) {
        const path = trimmed.substring('Disallow:'.length).trim();
        if (path) {
          restrictions.push(path);
        }
      }
    }

    return restrictions;
  }

  private isUrlAllowedByLlms(url: string, restrictions: string[]): boolean {
    if (restrictions.length === 0) {
      return true;
    }

    const urlObj = new URL(url);
    const path = urlObj.pathname;

    for (const restriction of restrictions) {
      if (restriction === '*') {
        return false; // 全て禁止
      }
      if (restriction.endsWith('*')) {
        const prefix = restriction.slice(0, -1);
        if (path.startsWith(prefix)) {
          return false;
        }
      } else if (path === restriction) {
        return false;
      }
    }

    return true;
  }

  async canCrawl(url: string): Promise<{ allowed: boolean; reason?: string; crawlDelay?: number }> {
    const [robotsInfo, llmsInfo] = await Promise.all([
      this.checkRobotsTxt(url),
      this.checkLlmsTxt(url)
    ]);

    if (!robotsInfo.isAllowed) {
      return {
        allowed: false,
        reason: robotsInfo.reason,
        crawlDelay: robotsInfo.crawlDelay
      };
    }

    if (!llmsInfo.isAllowed) {
      return {
        allowed: false,
        reason: llmsInfo.reason
      };
    }

    return {
      allowed: true,
      crawlDelay: robotsInfo.crawlDelay
    };
  }

  clearCache(): void {
    this.robotsCache.clear();
    this.llmsCache.clear();
  }
} 