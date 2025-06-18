import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ExpoCrawler } from '../src/services/expo-crawler';
import { MarkdownParser } from '../src/services/markdown-parser';
import { RobotsParser } from '../src/services/robots-parser';
import { ExpoSearchEngine } from '../src/services/search-engine';
import { RecommendationEngine } from '../src/services/recommendation-engine';
import { DocumentIndexer } from '../src/indexing/document-indexer';
import * as fs from 'fs-extra';
import * as path from 'path';

describe('Services Unit Tests', () => {
  const testDir = path.join(process.cwd(), 'test-services');
  let expoCrawler: ExpoCrawler;
  let markdownParser: MarkdownParser;
  let robotsParser: RobotsParser;
  let searchEngine: ExpoSearchEngine;
  let recommendationEngine: RecommendationEngine;
  let documentIndexer: DocumentIndexer;

  const mockConfig = {
    external_services: {
      expo: {
        api_base: 'https://api.expo.dev',
        docs_base: 'https://docs.expo.dev',
        snack_base: 'https://snack.expo.dev',
        timeout_ms: 5000,
        retry_attempts: 2,
        rate_limit: {
          requests_per_minute: 60,
          burst: 10
        }
      },
      typesense: {
        url: 'http://localhost:8108',
        api_key: 'test-key',
        timeout_ms: 5000,
        collection_name: 'expo_docs_test'
      },
      github: {
        base_url: 'https://api.github.com',
        timeout_ms: 5000,
        rate_limit: {
          requests_per_hour: 1000
        }
      }
    },
    storage: {
      local: {
        path: testDir,
        max_size_gb: 1,
        compression: true
      }
    },
    features: {
      search: {
        typo_tolerance: true,
        synonyms_enabled: true,
        faceted_search: true,
        code_boost_factor: 2.5,
        api_boost_factor: 3.0
      },
      recommendations: {
        similarity_threshold: 0.7,
        max_results: 10,
        context_window: 1000
      }
    }
  };

  beforeEach(async () => {
    // Create test directory
    await fs.ensureDir(testDir);

    // Initialize services with test config
    expoCrawler = new ExpoCrawler(mockConfig);
    markdownParser = new MarkdownParser();
    robotsParser = new RobotsParser();
    searchEngine = new ExpoSearchEngine(mockConfig);
    recommendationEngine = new RecommendationEngine(mockConfig);
    documentIndexer = new DocumentIndexer(mockConfig);
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.remove(testDir);
  });

  describe('ExpoCrawler', () => {
    test('should initialize with correct configuration', () => {
      expect(expoCrawler).toBeDefined();
    });

    test('should handle robots.txt parsing', async () => {
      const mockRobotsTxt = `
User-agent: *
Allow: /
Disallow: /private/
Crawl-delay: 1
`;

      // Mock fetch response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => mockRobotsTxt
      } as any);

      const result = await expoCrawler.parseRobotsTxt('https://docs.expo.dev');
      
      expect(result).toBeDefined();
      expect(result.userAgent).toBe('*');
      expect(result.allowed).toContain('/');
      expect(result.disallowed).toContain('/private/');
      expect(result.crawlDelay).toBe(1);
    });

    test('should validate URL against robots.txt rules', async () => {
      const mockRobotsTxt = `
User-agent: *
Allow: /docs/
Disallow: /private/
`;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => mockRobotsTxt
      } as any);

      const robotsRules = await expoCrawler.parseRobotsTxt('https://docs.expo.dev');
      
      const allowedUrl = 'https://docs.expo.dev/docs/getting-started';
      const disallowedUrl = 'https://docs.expo.dev/private/secrets';

      expect(expoCrawler.isUrlAllowed(allowedUrl, robotsRules)).toBe(true);
      expect(expoCrawler.isUrlAllowed(disallowedUrl, robotsRules)).toBe(false);
    });

    test('should handle HTTP errors gracefully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as any);

      await expect(
        expoCrawler.crawlPage('https://docs.expo.dev/nonexistent')
      ).rejects.toThrow('Failed to fetch');
    });

    test('should apply rate limiting', async () => {
      const startTime = Date.now();
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => '<html><body>Test content</body></html>'
      } as any);

      // Make multiple requests
      await Promise.all([
        expoCrawler.crawlPage('https://docs.expo.dev/page1'),
        expoCrawler.crawlPage('https://docs.expo.dev/page2')
      ]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should take at least some time due to rate limiting
      expect(duration).toBeGreaterThan(0);
    });

    test('should extract metadata from HTML', async () => {
      const mockHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Expo Documentation</title>
  <meta name="description" content="Learn about Expo">
  <meta property="og:title" content="Expo Docs">
  <meta name="keywords" content="expo,react-native,mobile">
</head>
<body>
  <h1>Getting Started</h1>
  <p>Welcome to Expo documentation.</p>
</body>
</html>
`;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHtml
      } as any);

      const result = await expoCrawler.crawlPage('https://docs.expo.dev/getting-started');
      
      expect(result.title).toBe('Expo Documentation');
      expect(result.description).toBe('Learn about Expo');
      expect(result.content).toContain('Getting Started');
      expect(result.metadata.keywords).toContain('expo');
    });
  });

  describe('MarkdownParser', () => {
    test('should parse basic markdown content', () => {
      const markdown = `
# Main Title

This is a paragraph with **bold** and *italic* text.

## Subsection

- List item 1
- List item 2

\`\`\`javascript
console.log('Hello, World!');
\`\`\`
`;

      const result = markdownParser.parse(markdown);
      
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
title: "Expo Camera API"
description: "Take photos and videos"
platforms: ["ios", "android"]
sdk_version: "49.0.0"
---

# Camera API Documentation

Content here.
`;

      const result = markdownParser.parse(markdown);
      
      expect(result.frontmatter).toBeDefined();
      expect(result.frontmatter.title).toBe('Expo Camera API');
      expect(result.frontmatter.description).toBe('Take photos and videos');
      expect(result.frontmatter.platforms).toEqual(['ios', 'android']);
      expect(result.frontmatter.sdk_version).toBe('49.0.0');
    });

    test('should handle malformed markdown gracefully', () => {
      const malformedMarkdown = `
# Incomplete header

Missing closing quote: "unclosed

\`\`\`javascript
// Missing closing backticks
console.log('test');
`;

      const result = markdownParser.parse(malformedMarkdown);
      
      expect(result.title).toBe('Incomplete header');
      expect(result.content).toContain('Missing closing quote');
      // Should still extract content even if malformed
      expect(result.content.length).toBeGreaterThan(0);
    });

    test('should extract table of contents', () => {
      const markdown = `
# Main Title

## First Section

### Subsection A

#### Deep Section

## Second Section

### Subsection B
`;

      const result = markdownParser.parse(markdown);
      
      expect(result.tableOfContents).toBeDefined();
      expect(result.tableOfContents).toHaveLength(5); // All headers
      expect(result.tableOfContents[0].level).toBe(1);
      expect(result.tableOfContents[0].title).toBe('Main Title');
      expect(result.tableOfContents[1].level).toBe(2);
      expect(result.tableOfContents[1].title).toBe('First Section');
    });

    test('should extract links and images', () => {
      const markdown = `
# Documentation

Check out [Expo documentation](https://docs.expo.dev) for more info.

![Expo Logo](https://docs.expo.dev/static/images/expo-logo.png)

Visit our [GitHub repository](https://github.com/expo/expo) too.
`;

      const result = markdownParser.parse(markdown);
      
      expect(result.links).toBeDefined();
      expect(result.links).toHaveLength(2);
      expect(result.links[0].text).toBe('Expo documentation');
      expect(result.links[0].url).toBe('https://docs.expo.dev');
      
      expect(result.images).toBeDefined();
      expect(result.images).toHaveLength(1);
      expect(result.images[0].alt).toBe('Expo Logo');
      expect(result.images[0].src).toContain('expo-logo.png');
    });
  });

  describe('RobotsParser', () => {
    test('should parse valid robots.txt', () => {
      const robotsTxt = `
User-agent: *
Allow: /
Disallow: /private/
Disallow: /admin/
Crawl-delay: 2

User-agent: Googlebot
Allow: /
Crawl-delay: 1

Sitemap: https://docs.expo.dev/sitemap.xml
`;

      const result = robotsParser.parse(robotsTxt);
      
      expect(result.rules).toBeDefined();
      expect(result.rules['*']).toBeDefined();
      expect(result.rules['*'].allowed).toContain('/');
      expect(result.rules['*'].disallowed).toContain('/private/');
      expect(result.rules['*'].crawlDelay).toBe(2);
      
      expect(result.rules['Googlebot']).toBeDefined();
      expect(result.rules['Googlebot'].crawlDelay).toBe(1);
      
      expect(result.sitemaps).toContain('https://docs.expo.dev/sitemap.xml');
    });

    test('should handle empty robots.txt', () => {
      const emptyRobotsTxt = '';
      
      const result = robotsParser.parse(emptyRobotsTxt);
      
      expect(result.rules).toEqual({});
      expect(result.sitemaps).toEqual([]);
    });

    test('should validate URL permissions', () => {
      const robotsTxt = `
User-agent: *
Allow: /docs/
Disallow: /private/
Disallow: /admin/
`;

      const rules = robotsParser.parse(robotsTxt);
      
      expect(robotsParser.isAllowed('https://docs.expo.dev/docs/getting-started', rules, '*')).toBe(true);
      expect(robotsParser.isAllowed('https://docs.expo.dev/private/secrets', rules, '*')).toBe(false);
      expect(robotsParser.isAllowed('https://docs.expo.dev/admin/panel', rules, '*')).toBe(false);
      expect(robotsParser.isAllowed('https://docs.expo.dev/other/page', rules, '*')).toBe(true); // Default allow
    });

    test('should handle malformed robots.txt gracefully', () => {
      const malformedRobotsTxt = `
User-agent: *
Invalid-directive: value
Allow /docs/ (missing colon)
Disallow: 

User-agent
Sitemap https://example.com/sitemap.xml (missing colon)
`;

      const result = robotsParser.parse(malformedRobotsTxt);
      
      // Should still parse valid parts
      expect(result.rules).toBeDefined();
      expect(result.rules['*']).toBeDefined();
    });
  });

  describe('ExpoSearchEngine', () => {
    test('should initialize with configuration', () => {
      expect(searchEngine).toBeDefined();
    });

    test('should build search query with filters', () => {
      const searchParams = {
        query: 'camera api',
        filters: {
          category: ['api'],
          platform: ['ios', 'android'],
          sdk_version: ['49.0.0']
        }
      };

      const query = searchEngine.buildSearchQuery(searchParams);
      
      expect(query).toBeDefined();
      expect(query.q).toBe('camera api');
      expect(query.filter_by).toContain('category:=api');
      expect(query.filter_by).toContain('platform:=ios');
      expect(query.filter_by).toContain('sdk_version:=49.0.0');
    });

    test('should handle typo tolerance', () => {
      const searchParams = {
        query: 'camra api', // intentional typo
        typo_tolerance: true
      };

      const query = searchEngine.buildSearchQuery(searchParams);
      
      expect(query.num_typos).toBeGreaterThan(0);
    });

    test('should apply code block boosting', () => {
      const searchParams = {
        query: 'camera example',
        boost_code_blocks: true
      };

      const query = searchEngine.buildSearchQuery(searchParams);
      
      expect(query.query_by_weights).toContain(mockConfig.features.search.code_boost_factor);
    });

    test('should handle empty search results gracefully', async () => {
      // Mock Typesense client
      const mockTypesenseClient = {
        collections: () => ({
          documents: () => ({
            search: jest.fn().mockResolvedValue({
              hits: [],
              found: 0,
              search_time_ms: 1
            })
          })
        })
      };

      searchEngine.setClient(mockTypesenseClient as any);

      const result = await searchEngine.search({
        query: 'nonexistent content',
        max_results: 10
      });

      expect(result.hits).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.search_time_ms).toBe(1);
    });

    test('should format search results correctly', async () => {
      const mockSearchResults = {
        hits: [
          {
            document: {
              id: '1',
              title: 'Camera API',
              content: 'Take photos with Camera.takePictureAsync()',
              url: 'https://docs.expo.dev/camera',
              category: 'api',
              platform: ['ios', 'android'],
              sdk_version: '49.0.0'
            },
            highlight: {
              title: { matched_tokens: ['Camera'] },
              content: { matched_tokens: ['takePictureAsync'] }
            }
          }
        ],
        found: 1,
        search_time_ms: 5
      };

      const mockTypesenseClient = {
        collections: () => ({
          documents: () => ({
            search: jest.fn().mockResolvedValue(mockSearchResults)
          })
        })
      };

      searchEngine.setClient(mockTypesenseClient as any);

      const result = await searchEngine.search({
        query: 'camera takePictureAsync',
        max_results: 10
      });

      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].id).toBe('1');
      expect(result.hits[0].title).toBe('Camera API');
      expect(result.hits[0].url).toBe('https://docs.expo.dev/camera');
      expect(result.hits[0].highlights).toBeDefined();
    });
  });

  describe('RecommendationEngine', () => {
    test('should initialize with configuration', () => {
      expect(recommendationEngine).toBeDefined();
    });

    test('should calculate content similarity', () => {
      const content1 = 'Expo Camera API allows you to take photos and videos';
      const content2 = 'Use Camera.takePictureAsync to capture photos with Expo';
      const content3 = 'Location API provides GPS coordinates and address info';

      const similarity1 = recommendationEngine.calculateSimilarity(content1, content2);
      const similarity2 = recommendationEngine.calculateSimilarity(content1, content3);

      expect(similarity1).toBeGreaterThan(similarity2); // Camera content should be more similar
      expect(similarity1).toBeGreaterThan(0.5); // Should exceed similarity threshold
      expect(similarity2).toBeLessThan(0.5); // Different topics should be below threshold
    });

    test('should generate recommendations based on context', async () => {
      const context = 'I want to take photos in my React Native app using Expo';
      const mockDocuments = [
        {
          id: '1',
          title: 'Camera API',
          content: 'Take photos and videos with Camera API',
          category: 'api',
          platform: ['ios', 'android'],
          url: 'https://docs.expo.dev/camera'
        },
        {
          id: '2', 
          title: 'ImagePicker API',
          content: 'Select images from device gallery',
          category: 'api',
          platform: ['ios', 'android'],
          url: 'https://docs.expo.dev/imagepicker'
        },
        {
          id: '3',
          title: 'Location API',
          content: 'Get GPS coordinates and location data',
          category: 'api',
          platform: ['ios', 'android'],
          url: 'https://docs.expo.dev/location'
        }
      ];

      // Mock the document retrieval
      jest.spyOn(recommendationEngine, 'getAllDocuments').mockResolvedValue(mockDocuments as any);

      const recommendations = await recommendationEngine.recommend({
        context,
        max_results: 5,
        similarity_threshold: 0.5
      });

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      
      // Camera and ImagePicker should be recommended for photo-related context
      const cameraRec = recommendations.find(r => r.title === 'Camera API');
      const imagePickerRec = recommendations.find(r => r.title === 'ImagePicker API');
      
      expect(cameraRec).toBeDefined();
      expect(imagePickerRec).toBeDefined();
      expect(cameraRec!.relevance_score).toBeGreaterThan(0.5);
    });

    test('should filter recommendations by platform', async () => {
      const context = 'iOS camera functionality';
      const mockDocuments = [
        {
          id: '1',
          title: 'Camera API',
          content: 'Take photos on all platforms',
          platform: ['ios', 'android', 'web'],
          url: 'https://docs.expo.dev/camera'
        },
        {
          id: '2',
          title: 'iOS Specific Feature',
          content: 'iOS only camera feature',
          platform: ['ios'],
          url: 'https://docs.expo.dev/ios-camera'
        },
        {
          id: '3',
          title: 'Android Feature',
          content: 'Android only functionality',
          platform: ['android'],
          url: 'https://docs.expo.dev/android-only'
        }
      ];

      jest.spyOn(recommendationEngine, 'getAllDocuments').mockResolvedValue(mockDocuments as any);

      const recommendations = await recommendationEngine.recommend({
        context,
        platform: 'ios',
        max_results: 5
      });

      expect(recommendations).toBeDefined();
      
      // Should only include iOS-compatible recommendations
      recommendations.forEach(rec => {
        const doc = mockDocuments.find(d => d.title === rec.title);
        expect(doc?.platform).toContain('ios');
      });
    });

    test('should handle empty context gracefully', async () => {
      const recommendations = await recommendationEngine.recommend({
        context: '',
        max_results: 5
      });

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      // Should return empty or default recommendations for empty context
    });
  });

  describe('DocumentIndexer', () => {
    test('should initialize with configuration', () => {
      expect(documentIndexer).toBeDefined();
    });

    test('should create document index schema', () => {
      const schema = documentIndexer.createIndexSchema();
      
      expect(schema).toBeDefined();
      expect(schema.name).toBe(mockConfig.external_services.typesense.collection_name);
      expect(schema.fields).toBeDefined();
      expect(schema.fields.length).toBeGreaterThan(0);
      
      // Check for required fields
      const titleField = schema.fields.find(f => f.name === 'title');
      const contentField = schema.fields.find(f => f.name === 'content');
      const urlField = schema.fields.find(f => f.name === 'url');
      
      expect(titleField).toBeDefined();
      expect(contentField).toBeDefined();
      expect(urlField).toBeDefined();
    });

    test('should prepare document for indexing', () => {
      const rawDocument = {
        url: 'https://docs.expo.dev/camera',
        title: 'Camera API',
        content: 'Take photos and videos with the Camera API',
        metadata: {
          description: 'Camera functionality for Expo apps',
          keywords: ['camera', 'photo', 'video'],
          platform: ['ios', 'android'],
          sdk_version: '49.0.0'
        },
        lastModified: new Date('2024-01-01'),
        frontmatter: {
          category: 'api',
          difficulty: 'beginner'
        }
      };

      const indexDocument = documentIndexer.prepareDocument(rawDocument);
      
      expect(indexDocument).toBeDefined();
      expect(indexDocument.id).toBeDefined();
      expect(indexDocument.title).toBe('Camera API');
      expect(indexDocument.content).toBe('Take photos and videos with the Camera API');
      expect(indexDocument.url).toBe('https://docs.expo.dev/camera');
      expect(indexDocument.platform).toEqual(['ios', 'android']);
      expect(indexDocument.sdk_version).toBe('49.0.0');
      expect(indexDocument.category).toBe('api');
      expect(indexDocument.indexed_at).toBeDefined();
    });

    test('should handle documents with missing metadata', () => {
      const minimalDocument = {
        url: 'https://docs.expo.dev/minimal',
        title: 'Minimal Doc',
        content: 'Basic content'
      };

      const indexDocument = documentIndexer.prepareDocument(minimalDocument);
      
      expect(indexDocument).toBeDefined();
      expect(indexDocument.title).toBe('Minimal Doc');
      expect(indexDocument.content).toBe('Basic content');
      expect(indexDocument.category).toBe('unknown'); // default value
      expect(indexDocument.platform).toEqual(['universal']); // default value
    });

    test('should batch documents for indexing', () => {
      const documents = [
        { url: 'url1', title: 'Doc 1', content: 'Content 1' },
        { url: 'url2', title: 'Doc 2', content: 'Content 2' },
        { url: 'url3', title: 'Doc 3', content: 'Content 3' }
      ];

      const batches = documentIndexer.batchDocuments(documents, 2);
      
      expect(batches).toHaveLength(2); // 3 docs with batch size 2 = 2 batches
      expect(batches[0]).toHaveLength(2);
      expect(batches[1]).toHaveLength(1);
    });

    test('should extract searchable text from complex content', () => {
      const complexContent = `
# Camera API

The **Camera** API allows you to:

- Take photos
- Record videos
- Access camera settings

\`\`\`javascript
import { Camera } from 'expo-camera';

const photo = await Camera.takePictureAsync();
\`\`\`

> **Note**: Requires camera permissions on device.

For more info, see [ImagePicker](./imagepicker.md).
`;

      const searchableText = documentIndexer.extractSearchableText(complexContent);
      
      expect(searchableText).toBeDefined();
      expect(searchableText).toContain('Camera API');
      expect(searchableText).toContain('Take photos');
      expect(searchableText).toContain('takePictureAsync');
      expect(searchableText).not.toContain('#'); // Should strip markdown syntax
      expect(searchableText).not.toContain('```'); // Should strip code block markers
    });

    test('should calculate document importance score', () => {
      const apiDocument = {
        title: 'Camera API',
        content: 'API documentation for Camera.takePictureAsync()',
        category: 'api',
        platform: ['ios', 'android'],
        codeBlocks: ['Camera.takePictureAsync()']
      };

      const tutorialDocument = {
        title: 'Getting Started Tutorial',
        content: 'Learn how to use Expo',
        category: 'tutorial',
        platform: ['universal'],
        codeBlocks: []
      };

      const apiScore = documentIndexer.calculateImportanceScore(apiDocument as any);
      const tutorialScore = documentIndexer.calculateImportanceScore(tutorialDocument as any);

      expect(apiScore).toBeGreaterThan(tutorialScore); // API docs should have higher importance
      expect(apiScore).toBeGreaterThan(0);
      expect(tutorialScore).toBeGreaterThan(0);
    });
  });
}); 