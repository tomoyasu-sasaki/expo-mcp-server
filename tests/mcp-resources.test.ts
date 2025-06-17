import { ExpoResources } from '../src/mcp/resources';

describe.skip('ExpoResources', () => {

  describe('expo://docs/* resources', () => {
    it('should resolve docs resource', async () => {
      const result = await ExpoResources.resolveResource('expo://docs/get-started');

      expect(result).toBeDefined();
      expect(result.uri).toBe('expo://docs/get-started');
      expect(result.mimeType).toBe('text/markdown');
      expect(result.text).toContain('# Expo Documentation: get-started');
      expect(result.text).toContain('npx expo install');
    });

    it('should resolve docs resource with path segments', async () => {
      const result = await ExpoResources.resolveResource('expo://docs/api/camera');

      expect(result).toBeDefined();
      expect(result.uri).toBe('expo://docs/api/camera');
      expect(result.mimeType).toBe('text/markdown');
      expect(result.text).toContain('camera');
    });

    it('should handle empty docs path', async () => {
      const result = await ExpoResources.resolveResource('expo://docs/');

      expect(result).toBeDefined();
      expect(result.uri).toBe('expo://docs/index');
      expect(result.text).toContain('index');
    });
  });

  describe('expo://api/* resources', () => {
    it('should resolve API resource', async () => {
      const result = await ExpoResources.resolveResource('expo://api/camera');

      expect(result).toBeDefined();
      expect(result.uri).toBe('expo://api/camera?version=latest');
      expect(result.mimeType).toBe('text/markdown');
      expect(result.text).toContain('# camera API Reference');
      expect(result.text).toContain('expo-camera');
    });

    it('should resolve API resource with version', async () => {
      const result = await ExpoResources.resolveResource('expo://api/location?version=sdk-49');

      expect(result).toBeDefined();
      expect(result.uri).toBe('expo://api/location?version=sdk-49');
      expect(result.text).toContain('SDK Version: sdk-49');
      expect(result.text).toContain('location');
    });

    it('should handle missing module name', async () => {
      await expect(ExpoResources.resolveResource('expo://api/')).rejects.toThrow('Module name is required');
    });
  });

  describe('expo://examples/* resources', () => {
    it('should resolve examples resource', async () => {
      const result = await ExpoResources.resolveResource('expo://examples/camera');

      expect(result).toBeDefined();
      expect(result.uri).toBe('expo://examples/camera?platform=universal&language=typescript');
      expect(result.mimeType).toBe('application/json');
      
      const parsed = JSON.parse(result.text!);
      expect(parsed.category).toBe('camera');
      expect(parsed.platform).toBe('universal');
      expect(parsed.language).toBe('typescript');
      expect(parsed.examples).toHaveLength(2);
    });

    it('should resolve examples with parameters', async () => {
      const result = await ExpoResources.resolveResource('expo://examples/location?platform=ios&language=javascript');

      expect(result).toBeDefined();
      expect(result.uri).toBe('expo://examples/location?platform=ios&language=javascript');
      
      const parsed = JSON.parse(result.text!);
      expect(parsed.platform).toBe('ios');
      expect(parsed.language).toBe('javascript');
      expect(parsed.examples[0].platforms).toContain('ios');
    });

    it('should handle default category', async () => {
      const result = await ExpoResources.resolveResource('expo://examples/');

      expect(result).toBeDefined();
      const parsed = JSON.parse(result.text!);
      expect(parsed.category).toBe('general');
    });
  });

  describe('expo://config/* resources', () => {
    it('should resolve app.json config', async () => {
      const result = await ExpoResources.resolveResource('expo://config/app.json');

      expect(result).toBeDefined();
      expect(result.uri).toBe('expo://config/app.json?preset=default');
      expect(result.mimeType).toBe('application/json');
      
      const parsed = JSON.parse(result.text!);
      expect(parsed.expo).toBeDefined();
      expect(parsed.expo.name).toBe('MyExpoApp');
    });

    it('should resolve eas.json config', async () => {
      const result = await ExpoResources.resolveResource('expo://config/eas.json?preset=advanced');

      expect(result).toBeDefined();
      expect(result.uri).toBe('expo://config/eas.json?preset=advanced');
      
      const parsed = JSON.parse(result.text!);
      expect(parsed.cli).toBeDefined();
      expect(parsed.build).toBeDefined();
    });

    it('should resolve metro.config.js', async () => {
      const result = await ExpoResources.resolveResource('expo://config/metro.config.js?preset=advanced');

      expect(result).toBeDefined();
      expect(result.mimeType).toBe('application/javascript');
      expect(result.text).toContain('getDefaultConfig');
      expect(result.text).toContain('config.resolver.alias');
    });

    it('should handle missing config type', async () => {
      await expect(ExpoResources.resolveResource('expo://config/')).rejects.toThrow('Configuration type is required');
    });
  });

  describe('expo://eas/* resources', () => {
    it('should resolve EAS build command', async () => {
      const result = await ExpoResources.resolveResource('expo://eas/build');

      expect(result).toBeDefined();
      expect(result.uri).toBe('expo://eas/build?platform=all&profile=development');
      expect(result.mimeType).toBe('text/plain');
      expect(result.text).toContain('# EAS BUILD Command');
      expect(result.text).toContain('eas build --platform all');
    });

    it('should resolve EAS submit command with parameters', async () => {
      const result = await ExpoResources.resolveResource('expo://eas/submit?platform=ios&profile=production');

      expect(result).toBeDefined();
      expect(result.uri).toBe('expo://eas/submit?platform=ios&profile=production');
      expect(result.text).toContain('eas submit --platform ios --profile production');
      expect(result.text).toContain('Submit to TestFlight');
    });

    it('should handle missing command', async () => {
      await expect(ExpoResources.resolveResource('expo://eas/')).rejects.toThrow('EAS command is required');
    });
  });

  describe('Error handling', () => {
    it('should handle unsupported protocol', async () => {
      await expect(ExpoResources.resolveResource('https://example.com')).rejects.toThrow('Unsupported protocol');
    });

    it('should handle unknown resource type', async () => {
      await expect(ExpoResources.resolveResource('expo://unknown/test')).rejects.toThrow('Unknown resource type');
    });

    it('should handle malformed URI', async () => {
      await expect(ExpoResources.resolveResource('not-a-uri')).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should resolve docs resource within timeout', async () => {
      const start = Date.now();
      await ExpoResources.resolveResource('expo://docs/test');
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should resolve API resource within timeout', async () => {
      const start = Date.now();
      await ExpoResources.resolveResource('expo://api/test');
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(1000);
    });

    it('should resolve examples resource within timeout', async () => {
      const start = Date.now();
      await ExpoResources.resolveResource('expo://examples/test');
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(1000);
    });
  });
}); 