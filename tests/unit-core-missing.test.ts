import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ExpoCrawler } from '../src/services/expo-crawler';
import { MarkdownParser } from '../src/services/markdown-parser';
import { RobotsParser } from '../src/services/robots-parser';
import { ExpoSearchEngine } from '../src/services/search-engine';
import { RecommendationEngine } from '../src/services/recommendation-engine';
import { DocumentIndexer } from '../src/indexing/document-indexer';
import { ConcurrentProcessor } from '../src/services/concurrent-processor';

describe('Core Missing Coverage Unit Tests', () => {
  const mockConfig = {
    external_services: {
      expo: {
        api_base: 'https://api.expo.dev',
        docs_base: 'https://docs.expo.dev',
        timeout_ms: 5000,
        retry_attempts: 2
      },
      typesense: {
        url: 'http://localhost:8108',
        api_key: 'test-key',
        collection_name: 'test_collection'
      }
    },
    storage: {
      local: {
        path: './test-data',
        max_size_gb: 1
      }
    },
    features: {
      search: {
        typo_tolerance: true,
        synonyms_enabled: true
      },
      recommendations: {
        similarity_threshold: 0.7,
        max_results: 10
      }
    }
  };

  beforeEach(() => {
    // Mock fetch globally
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('ExpoCrawler', () => {
    let crawler: ExpoCrawler;

    beforeEach(() => {
      crawler = new ExpoCrawler(mockConfig);
    });

    test('should initialize with config', () => {
      expect(crawler).toBeInstanceOf(ExpoCrawler);
    });

    test('should parse robots.txt correctly', async () => {
      const mockRobotsTxt = `
User-agent: *
Allow: /
Disallow: /private/
Crawl-delay: 1
`;

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        text: async () => mockRobotsTxt
      } as Response);

      const result = await crawler.parseRobotsTxt('https://docs.expo.dev');
      
      expect(result).toBeDefined();
      expect(result.userAgent).toBe('*');
      expect(result.allowed).toContain('/');
      expect(result.disallowed).toContain('/private/');
      expect(result.crawlDelay).toBe(1);
    });

    test('should validate URL against robots.txt', async () => {
      const robotsRules = {
        userAgent: '*',
        allowed: ['/docs/'],
        disallowed: ['/private/'],
        crawlDelay: 1
      };

      expect(crawler.isUrlAllowed('https://docs.expo.dev/docs/getting-started', robotsRules)).toBe(true);
      expect(crawler.isUrlAllowed('https://docs.expo.dev/private/admin', robotsRules)).toBe(false);
    });

    test('should crawl page and extract content', async () => {
      const mockHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Expo Camera API</title>
  <meta name="description" content="Take photos with Expo">
</head>
<body>
  <h1>Camera API</h1>
  <p>Use Camera.takePictureAsync() to take photos.</p>
</body>
</html>
`;

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml
      } as Response);

      const result = await crawler.crawlPage('https://docs.expo.dev/camera');
      
      expect(result.title).toBe('Expo Camera API');
      expect(result.description).toBe('Take photos with Expo');
      expect(result.content).toContain('Camera API');
      expect(result.content).toContain('takePictureAsync');
    });

    test('should handle crawl errors gracefully', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(crawler.crawlPage('https://invalid-url.test')).rejects.toThrow('Network error');
    });

    test('should respect crawl delay', async () => {
      const startTime = Date.now();

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        text: async () => '<html><body>Test</body></html>'
      } as Response);

      await crawler.crawlPage('https://docs.expo.dev/test1');
      await crawler.crawlPage('https://docs.expo.dev/test2');

      const endTime = Date.now();
      expect(endTime - startTime).toBeGreaterThan(0);
    });
  });

  describe('MarkdownParser', () => {
    let parser: MarkdownParser;

    beforeEach(() => {
      parser = new MarkdownParser();
    });

    test('should parse basic markdown', () => {
      const markdown = `
# Main Title

This is a paragraph with **bold** and *italic* text.

## Subsection

- List item 1
- List item 2

\`\`\`javascript
console.log('Hello');
\`\`\`
`;

      const result = parser.parse(markdown);
      
      expect(result.title).toBe('Main Title');
      expect(result.content).toContain('This is a paragraph');
      expect(result.headings).toContain('Main Title');
      expect(result.headings).toContain('Subsection');
      expect(result.codeBlocks).toHaveLength(1);
      expect(result.codeBlocks[0].language).toBe('javascript');
      expect(result.codeBlocks[0].content).toContain('console.log');
    });

    test('should extract frontmatter', () => {
      const markdown = `
---
title: "Camera API"
description: "Take photos"
platforms: ["ios", "android"]
---

# Camera Documentation

Content here.
`;

      const result = parser.parse(markdown);
      
      expect(result.frontmatter).toBeDefined();
      expect(result.frontmatter.title).toBe('Camera API');
      expect(result.frontmatter.platforms).toEqual(['ios', 'android']);
    });

    test('should extract links and images', () => {
      const markdown = `
# Documentation

Check out [Expo docs](https://docs.expo.dev) for more info.

![Expo Logo](https://docs.expo.dev/logo.png)
`;

      const result = parser.parse(markdown);
      
      expect(result.links).toHaveLength(1);
      expect(result.links[0].text).toBe('Expo docs');
      expect(result.links[0].url).toBe('https://docs.expo.dev');
      
      expect(result.images).toHaveLength(1);
      expect(result.images[0].alt).toBe('Expo Logo');
      expect(result.images[0].src).toBe('https://docs.expo.dev/logo.png');
    });

    test('should handle empty markdown', () => {
      const result = parser.parse('');
      
      expect(result.title).toBe('');
      expect(result.content).toBe('');
      expect(result.headings).toHaveLength(0);
      expect(result.codeBlocks).toHaveLength(0);
    });

    test('should extract table of contents', () => {
      const markdown = `
# Main Title
## Section 1
### Subsection 1.1
## Section 2
`;

      const result = parser.parse(markdown);
      
      expect(result.tableOfContents).toBeDefined();
      expect(result.tableOfContents).toHaveLength(4);
      expect(result.tableOfContents[0].level).toBe(1);
      expect(result.tableOfContents[0].title).toBe('Main Title');
    });
  });

  describe('RobotsParser', () => {
    let parser: RobotsParser;

    beforeEach(() => {
      parser = new RobotsParser();
    });

    test('should parse valid robots.txt', () => {
      const robotsTxt = `
User-agent: *
Allow: /
Disallow: /private/
Crawl-delay: 2

User-agent: Googlebot
Allow: /public/
Crawl-delay: 1

Sitemap: https://example.com/sitemap.xml
`;

      const result = parser.parse(robotsTxt);
      
      expect(result.rules).toBeDefined();
      expect(result.rules['*']).toBeDefined();
      expect(result.rules['*'].allowed).toContain('/');
      expect(result.rules['*'].disallowed).toContain('/private/');
      expect(result.rules['*'].crawlDelay).toBe(2);
      
      expect(result.rules['Googlebot']).toBeDefined();
      expect(result.rules['Googlebot'].crawlDelay).toBe(1);
      
      expect(result.sitemaps).toContain('https://example.com/sitemap.xml');
    });

    test('should handle empty robots.txt', () => {
      const result = parser.parse('');
      
      expect(result.rules).toEqual({});
      expect(result.sitemaps).toEqual([]);
    });

    test('should validate URL permissions', () => {
      const rules = {
        rules: {
          '*': {
            allowed: ['/docs/'],
            disallowed: ['/private/'],
            crawlDelay: 1
          }
        },
        sitemaps: []
      };
      
      expect(parser.isAllowed('https://example.com/docs/api', rules, '*')).toBe(true);
      expect(parser.isAllowed('https://example.com/private/admin', rules, '*')).toBe(false);
    });

    test('should handle malformed robots.txt', () => {
      const malformedRobotsTxt = `
User-agent: *
Invalid-directive: value
Allow /docs/ (missing colon)
`;

      const result = parser.parse(malformedRobotsTxt);
      
      expect(result.rules).toBeDefined();
      expect(result.rules['*']).toBeDefined();
    });
  });

  describe('ExpoSearchEngine', () => {
    let searchEngine: ExpoSearchEngine;

    beforeEach(() => {
      searchEngine = new ExpoSearchEngine(mockConfig);
    });

    test('should initialize with config', () => {
      expect(searchEngine).toBeInstanceOf(ExpoSearchEngine);
    });

    test('should build search query with filters', () => {
      const searchParams = {
        query: 'camera api',
        filters: {
          category: ['api'],
          platform: ['ios']
        }
      };

      const query = searchEngine.buildSearchQuery(searchParams);
      
      expect(query).toBeDefined();
      expect(query.q).toBe('camera api');
      expect(query.filter_by).toContain('category:=api');
      expect(query.filter_by).toContain('platform:=ios');
    });

    test('should handle typo tolerance', () => {
      const searchParams = {
        query: 'camra api', // typo
        typo_tolerance: true
      };

      const query = searchEngine.buildSearchQuery(searchParams);
      
      expect(query.num_typos).toBeGreaterThan(0);
    });

    test('should search documents', async () => {
      const mockSearchResult = {
        hits: [
          {
            document: {
              id: '1',
              title: 'Camera API',
              content: 'Take photos with Camera.takePictureAsync()',
              url: 'https://docs.expo.dev/camera'
            }
          }
        ],
        found: 1,
        search_time_ms: 10
      };

      // Mock Typesense client
      const mockClient = {
        collections: () => ({
          documents: () => ({
            search: jest.fn().mockResolvedValue(mockSearchResult)
          })
        })
      };

      searchEngine.setClient(mockClient as any);

      const result = await searchEngine.search({
        query: 'camera',
        max_results: 10
      });

      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].title).toBe('Camera API');
      expect(result.total).toBe(1);
    });

    test('should handle search errors', async () => {
      const mockClient = {
        collections: () => ({
          documents: () => ({
            search: jest.fn().mockRejectedValue(new Error('Search failed'))
          })
        })
      };

      searchEngine.setClient(mockClient as any);

      await expect(searchEngine.search({ query: 'test' })).rejects.toThrow('Search failed');
    });
  });

  describe('RecommendationEngine', () => {
    let engine: RecommendationEngine;

    beforeEach(() => {
      engine = new RecommendationEngine(mockConfig);
    });

    test('should initialize with config', () => {
      expect(engine).toBeInstanceOf(RecommendationEngine);
    });

    test('should calculate content similarity', () => {
      const content1 = 'Expo Camera API for taking photos';
      const content2 = 'Camera functionality for photos in Expo';
      const content3 = 'Location services and GPS coordinates';

      const similarity1 = engine.calculateSimilarity(content1, content2);
      const similarity2 = engine.calculateSimilarity(content1, content3);

      expect(similarity1).toBeGreaterThan(similarity2);
      expect(similarity1).toBeGreaterThan(0.5);
    });

    test('should generate recommendations', async () => {
      const mockDocuments = [
        {
          id: '1',
          title: 'Camera API',
          content: 'Take photos with Camera.takePictureAsync()',
          category: 'api'
        },
        {
          id: '2',
          title: 'ImagePicker',
          content: 'Select images from gallery',
          category: 'api'
        }
      ];

      jest.spyOn(engine, 'getAllDocuments').mockResolvedValue(mockDocuments as any);

      const recommendations = await engine.recommend({
        context: 'I want to take photos in my app',
        max_results: 5
      });

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
    });

    test('should filter by platform', async () => {
      const mockDocuments = [
        {
          id: '1',
          title: 'iOS Camera',
          content: 'iOS specific camera features',
          platform: ['ios']
        },
        {
          id: '2',
          title: 'Android Camera',
          content: 'Android specific camera features',
          platform: ['android']
        }
      ];

      jest.spyOn(engine, 'getAllDocuments').mockResolvedValue(mockDocuments as any);

      const recommendations = await engine.recommend({
        context: 'camera functionality',
        platform: 'ios',
        max_results: 5
      });

      expect(recommendations).toBeDefined();
      recommendations.forEach(rec => {
        const doc = mockDocuments.find(d => d.title === rec.title);
        expect(doc?.platform).toContain('ios');
      });
    });

    test('should handle empty context', async () => {
      const recommendations = await engine.recommend({
        context: '',
        max_results: 5
      });

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('DocumentIndexer', () => {
    let indexer: DocumentIndexer;

    beforeEach(() => {
      indexer = new DocumentIndexer(mockConfig);
    });

    test('should initialize with config', () => {
      expect(indexer).toBeInstanceOf(DocumentIndexer);
    });

    test('should create index schema', () => {
      const schema = indexer.createIndexSchema();
      
      expect(schema).toBeDefined();
      expect(schema.name).toBe(mockConfig.external_services.typesense.collection_name);
      expect(schema.fields).toBeDefined();
      expect(schema.fields.length).toBeGreaterThan(0);

      const titleField = schema.fields.find(f => f.name === 'title');
      const contentField = schema.fields.find(f => f.name === 'content');
      
      expect(titleField).toBeDefined();
      expect(contentField).toBeDefined();
    });

    test('should prepare document for indexing', () => {
      const rawDoc = {
        url: 'https://docs.expo.dev/camera',
        title: 'Camera API',
        content: 'Take photos with Camera.takePictureAsync()',
        metadata: {
          platform: ['ios', 'android'],
          category: 'api'
        }
      };

      const indexDoc = indexer.prepareDocument(rawDoc);
      
      expect(indexDoc).toBeDefined();
      expect(indexDoc.id).toBeDefined();
      expect(indexDoc.title).toBe('Camera API');
      expect(indexDoc.content).toBe('Take photos with Camera.takePictureAsync()');
      expect(indexDoc.url).toBe('https://docs.expo.dev/camera');
      expect(indexDoc.platform).toEqual(['ios', 'android']);
      expect(indexDoc.category).toBe('api');
    });

    test('should batch documents', () => {
      const docs = [
        { url: 'url1', title: 'Doc 1', content: 'Content 1' },
        { url: 'url2', title: 'Doc 2', content: 'Content 2' },
        { url: 'url3', title: 'Doc 3', content: 'Content 3' }
      ];

      const batches = indexer.batchDocuments(docs, 2);
      
      expect(batches).toHaveLength(2);
      expect(batches[0]).toHaveLength(2);
      expect(batches[1]).toHaveLength(1);
    });

    test('should extract searchable text', () => {
      const complexContent = `
# Camera API

The **Camera** API allows you to:

- Take photos
- Record videos

\`\`\`javascript
import { Camera } from 'expo-camera';
\`\`\`

> Note: Requires permissions
`;

      const searchableText = indexer.extractSearchableText(complexContent);
      
      expect(searchableText).toBeDefined();
      expect(searchableText).toContain('Camera API');
      expect(searchableText).toContain('Take photos');
      expect(searchableText).not.toContain('#');
      expect(searchableText).not.toContain('```');
    });

    test('should calculate importance score', () => {
      const apiDoc = {
        title: 'Camera API',
        content: 'API documentation',
        category: 'api',
        codeBlocks: ['Camera.takePictureAsync()']
      };

      const tutorialDoc = {
        title: 'Tutorial',
        content: 'Tutorial content',
        category: 'tutorial',
        codeBlocks: []
      };

      const apiScore = indexer.calculateImportanceScore(apiDoc as any);
      const tutorialScore = indexer.calculateImportanceScore(tutorialDoc as any);

      expect(apiScore).toBeGreaterThan(tutorialScore);
      expect(apiScore).toBeGreaterThan(0);
    });

    test('should handle missing metadata gracefully', () => {
      const minimalDoc = {
        url: 'https://example.com',
        title: 'Test',
        content: 'Test content'
      };

      const indexDoc = indexer.prepareDocument(minimalDoc);
      
      expect(indexDoc).toBeDefined();
      expect(indexDoc.category).toBe('unknown');
      expect(indexDoc.platform).toEqual(['universal']);
    });
  });

  describe('ConcurrentProcessor', () => {
    let processor: ConcurrentProcessor;

    beforeEach(() => {
      processor = new ConcurrentProcessor({
        maxConcurrency: 3,
        queueLimit: 10,
        timeout: 5000
      });
    });

    test('should initialize with config', () => {
      expect(processor).toBeInstanceOf(ConcurrentProcessor);
    });

    test('should process tasks concurrently', async () => {
      const tasks = [
        async () => { await new Promise(resolve => setTimeout(resolve, 100)); return 'task1'; },
        async () => { await new Promise(resolve => setTimeout(resolve, 100)); return 'task2'; },
        async () => { await new Promise(resolve => setTimeout(resolve, 100)); return 'task3'; }
      ];

      const startTime = Date.now();
      const results = await processor.processAll(tasks);
      const endTime = Date.now();

      expect(results).toHaveLength(3);
      expect(results).toContain('task1');
      expect(results).toContain('task2');
      expect(results).toContain('task3');
      
      // Should process concurrently (faster than sequential)
      expect(endTime - startTime).toBeLessThan(300);
    });

    test('should handle task failures', async () => {
      const tasks = [
        async () => 'success',
        async () => { throw new Error('task failed'); },
        async () => 'success2'
      ];

      const results = await processor.processAll(tasks);
      
      expect(results).toHaveLength(3);
      expect(results[0]).toBe('success');
      expect(results[1]).toBeInstanceOf(Error);
      expect(results[2]).toBe('success2');
    });

    test('should respect concurrency limit', async () => {
      let activeCount = 0;
      let maxActive = 0;

      const tasks = Array.from({ length: 10 }, () => async () => {
        activeCount++;
        maxActive = Math.max(maxActive, activeCount);
        await new Promise(resolve => setTimeout(resolve, 50));
        activeCount--;
        return 'done';
      });

      await processor.processAll(tasks);
      
      expect(maxActive).toBeLessThanOrEqual(3); // maxConcurrency = 3
    });

    test('should handle empty task array', async () => {
      const results = await processor.processAll([]);
      
      expect(results).toHaveLength(0);
    });

    test('should handle queue limit', async () => {
      const tasks = Array.from({ length: 15 }, (_, i) => async () => `task${i}`);

      await expect(processor.processAll(tasks)).rejects.toThrow('Queue limit exceeded');
    });

    test('should handle task timeout', async () => {
      const slowTask = async () => {
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10s > 5s timeout
        return 'slow';
      };

      const results = await processor.processAll([slowTask]);
      
      expect(results[0]).toBeInstanceOf(Error);
      expect(results[0].message).toContain('timeout');
    });
  });
}); 