import { ExpoPrompts } from '../src/mcp/prompts';

describe('ExpoPrompts', () => {

  describe('expo_setup_helper', () => {
    it('should generate setup prompt for blank project', async () => {
      const result = await ExpoPrompts.expo_setup_helper({
        project_type: 'blank',
        target_platforms: 'ios,android',
      });

      expect(result).toBeDefined();
      expect(result.description).toContain('Expo project setup assistance for blank project');
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('system');
      expect(result.messages[1].role).toBe('user');
      expect(result.messages[0].content.text).toContain('expert Expo developer assistant');
      expect(result.messages[1].content.text).toContain('**Project Type:** blank');
    });

    it('should generate setup prompt for tabs project', async () => {
      const result = await ExpoPrompts.expo_setup_helper({
        project_type: 'tabs',
        target_platforms: 'ios,android,web',
      });

      expect(result).toBeDefined();
      expect(result.description).toContain('tabs project targeting ios, android, web');
      expect(result.messages[1].content.text).toContain('**Project Type:** tabs');
      expect(result.messages[1].content.text).toContain('web platform support');
    });

    it('should generate setup prompt for bare workflow', async () => {
      const result = await ExpoPrompts.expo_setup_helper({
        project_type: 'bare',
        target_platforms: 'ios,android',
      });

      expect(result).toBeDefined();
      expect(result.messages[1].content.text).toContain('bare workflow setup');
    });

    it('should handle default target platforms', async () => {
      const result = await ExpoPrompts.expo_setup_helper({
        project_type: 'blank',
      });

      expect(result).toBeDefined();
      expect(result.description).toContain('ios, android');
    });

    it('should use default project_type when not provided', async () => {
      const result = await ExpoPrompts.expo_setup_helper({});
      expect(result.description).toContain('blank project');
      expect(result.messages).toHaveLength(2);
    });
  });

  describe('expo_error_helper', () => {
    it('should generate error resolution prompt', async () => {
      const result = await ExpoPrompts.expo_error_helper({
        error_message: 'Module not found: expo-camera',
        context: 'build',
      });

      expect(result).toBeDefined();
      expect(result.description).toContain('Module not found: expo-camera');
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].content.text).toContain('expert Expo developer and debugging specialist');
      expect(result.messages[1].content.text).toContain('Module not found: expo-camera');
      expect(result.messages[1].content.text).toContain('**Context:** build');
    });

    it('should handle runtime errors', async () => {
      const result = await ExpoPrompts.expo_error_helper({
        error_message: 'Cannot read property of undefined',
        context: 'runtime',
      });

      expect(result).toBeDefined();
      expect(result.messages[0].content.text).toContain('**Error Context:** runtime');
    });

    it('should handle default context', async () => {
      const result = await ExpoPrompts.expo_error_helper({
        error_message: 'Some error occurred',
      });

      expect(result).toBeDefined();
      expect(result.messages[1].content.text).toContain('**Context:** general');
    });

    it('should handle missing error_message', async () => {
      await expect(ExpoPrompts.expo_error_helper({})).rejects.toThrow('error_message argument is required');
    });

    it('should truncate long error messages in description', async () => {
      const longError = 'a'.repeat(200);
      const result = await ExpoPrompts.expo_error_helper({
        error_message: longError,
      });

      expect(result).toBeDefined();
      expect(result.description.length).toBeLessThan(200);
      expect(result.description).toContain('...');
    });
  });

  describe('expo_api_helper', () => {
    it('should generate API assistance prompt', async () => {
      const result = await ExpoPrompts.expo_api_helper({
        module_name: 'camera',
        use_case: 'taking photos in my app',
      });

      expect(result).toBeDefined();
      expect(result.description).toContain('camera module - taking photos in my app');
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].content.text).toContain('expert Expo SDK developer');
      expect(result.messages[1].content.text).toContain('**Use Case:** taking photos in my app');
      expect(result.messages[0].content.text).toContain('**Module Focus:** camera');
    });

    it('should handle default use case', async () => {
      const result = await ExpoPrompts.expo_api_helper({
        module_name: 'location',
      });

      expect(result).toBeDefined();
      expect(result.description).toContain('basic usage');
      expect(result.messages[1].content.text).toContain('**Use Case:** basic usage');
    });

    it('should handle missing module_name', async () => {
      await expect(ExpoPrompts.expo_api_helper({})).rejects.toThrow('module_name argument is required');
    });

    it('should include TypeScript and platform considerations', async () => {
      const result = await ExpoPrompts.expo_api_helper({
        module_name: 'notifications',
        use_case: 'sending push notifications',
      });

      expect(result).toBeDefined();
      expect(result.messages[0].content.text).toContain('TypeScript usage');
      expect(result.messages[0].content.text).toContain('Platform support');
      expect(result.messages[1].content.text).toContain('Platform Considerations');
      expect(result.messages[1].content.text).toContain('Permissions & Privacy');
    });
  });

  describe('expo_config_analyzer', () => {
    it('should generate config analysis prompt', async () => {
      const configContent = JSON.stringify({
        expo: {
          name: 'TestApp',
          slug: 'test-app',
          version: '1.0.0',
        },
      });

      const result = await ExpoPrompts.expo_config_analyzer({
        config_content: configContent,
        target_environment: 'production',
      });

      expect(result).toBeDefined();
      expect(result.description).toContain('production environment');
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].content.text).toContain('expert Expo configuration specialist');
      expect(result.messages[1].content.text).toContain('**Target Environment:** production');
      expect(result.messages[1].content.text).toContain(configContent);
    });

    it('should handle default target environment', async () => {
      const result = await ExpoPrompts.expo_config_analyzer({
        config_content: '{"expo": {}}',
      });

      expect(result).toBeDefined();
      expect(result.description).toContain('development environment');
      expect(result.messages[1].content.text).toContain('**Target Environment:** development');
    });

    it('should handle missing config_content', async () => {
      await expect(ExpoPrompts.expo_config_analyzer({})).rejects.toThrow('config_content argument is required');
    });

    it('should include optimization categories', async () => {
      const result = await ExpoPrompts.expo_config_analyzer({
        config_content: '{"test": true}',
        target_environment: 'staging',
      });

      expect(result).toBeDefined();
      expect(result.messages[0].content.text).toContain('Security and privacy best practices');
      expect(result.messages[0].content.text).toContain('Performance optimization settings');
      expect(result.messages[1].content.text).toContain('Security Review');
      expect(result.messages[1].content.text).toContain('Performance Optimization');
      expect(result.messages[1].content.text).toContain('Future-Proofing');
    });
  });

  describe('Unknown prompt handling', () => {
    it('should throw error for unknown prompt', async () => {
      await expect(ExpoPrompts.getPrompt('unknown_prompt')).rejects.toThrow('Unknown prompt: unknown_prompt');
    });
  });

  describe('Prompt message structure', () => {
    it('should have consistent message structure', async () => {
      const result = await ExpoPrompts.expo_setup_helper({
        project_type: 'blank',
      });

      expect(result.messages).toHaveLength(2);
      
      // System message
      expect(result.messages[0]).toMatchObject({
        role: 'system',
        content: {
          type: 'text',
          text: expect.any(String),
        },
      });

      // User message
      expect(result.messages[1]).toMatchObject({
        role: 'user',
        content: {
          type: 'text',
          text: expect.any(String),
        },
      });
    });

    it('should have informative descriptions', async () => {
      const result = await ExpoPrompts.expo_api_helper({
        module_name: 'camera',
        use_case: 'photo taking',
      });

      expect(result.description).toBeTruthy();
      expect(result.description.length).toBeGreaterThan(10);
      expect(result.description).toContain('camera');
      expect(result.description).toContain('photo taking');
    });
  });

  describe('Prompt quality', () => {
    it('should generate substantial system prompts', async () => {
      const result = await ExpoPrompts.expo_error_helper({
        error_message: 'Test error',
      });

      const systemPrompt = result.messages[0].content.text;
      expect(systemPrompt.length).toBeGreaterThan(200);
      expect(systemPrompt).toContain('Your role is to');
      expect(systemPrompt).toContain('Your expertise covers');
    });

    it('should generate detailed user prompts', async () => {
      const result = await ExpoPrompts.expo_setup_helper({
        project_type: 'tabs',
        target_platforms: 'ios,android,web',
      });

      const userPrompt = result.messages[1].content.text;
      expect(userPrompt.length).toBeGreaterThan(300);
      expect(userPrompt).toContain('1. **');
      expect(userPrompt).toContain('2. **');
      expect(userPrompt).toContain('Please provide');
    });
  });
}); 