/**
 * 基本セットアップテスト
 */

describe('Expo MCP Server Setup', () => {
  it('should import main module successfully', async () => {
    const mainModule = await import('../src/index.ts');
    expect(mainModule.default).toBeDefined();
  });

  it('should have required environment', () => {
    expect(process.version).toBeDefined();
    expect(process.version.startsWith('v')).toBe(true);
    
    const nodeVersion = parseInt(process.version.slice(1).split('.')[0]);
    expect(nodeVersion).toBeGreaterThanOrEqual(18);
  });
}); 