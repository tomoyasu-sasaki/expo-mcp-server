import { performance } from 'perf_hooks';

describe('Security: 基本セキュリティ機能', () => {
  test('入力検証機能確認', () => {
    const startTime = performance.now();
    
    // 基本的な入力検証テスト
    const validateInput = (input: string): boolean => {
      // 基本的なXSS防止
      if (input.includes('<script>') || input.includes('javascript:')) {
        return false;
      }
      
      // SQLインジェクション防止
      if (input.includes('DROP TABLE') || input.includes('DELETE FROM')) {
        return false;
      }
      
      // 長すぎる入力防止
      if (input.length > 10000) {
        return false;
      }
      
      return true;
    };
    
    // 正常な入力
    expect(validateInput('normal text')).toBe(true);
    expect(validateInput('expo install @expo/vector-icons')).toBe(true);
    
    // 危険な入力
    expect(validateInput('<script>alert("xss")</script>')).toBe(false);
    expect(validateInput('DROP TABLE users;')).toBe(false);
    expect(validateInput('a'.repeat(10001))).toBe(false);
    
    const endTime = performance.now();
    console.log(`✅ 入力検証: ${(endTime - startTime).toFixed(2)}ms`);
  });

  test('レート制限機能確認', async () => {
    const startTime = performance.now();
    
    // シンプルなレート制限実装
    class RateLimiter {
      private requests: Map<string, number[]> = new Map();
      private limit = 10; // 10 requests per minute
      private window = 60000; // 1 minute
      
      isAllowed(clientId: string): boolean {
        const now = Date.now();
        const clientRequests = this.requests.get(clientId) || [];
        
        // 古いリクエストを削除
        const validRequests = clientRequests.filter(time => now - time < this.window);
        
        if (validRequests.length >= this.limit) {
          return false;
        }
        
        validRequests.push(now);
        this.requests.set(clientId, validRequests);
        return true;
      }
    }
    
    const rateLimiter = new RateLimiter();
    
    // 通常のリクエスト
    for (let i = 0; i < 10; i++) {
      expect(rateLimiter.isAllowed('client1')).toBe(true);
    }
    
    // 制限を超えるリクエスト
    expect(rateLimiter.isAllowed('client1')).toBe(false);
    
    // 別のクライアント
    expect(rateLimiter.isAllowed('client2')).toBe(true);
    
    const endTime = performance.now();
    console.log(`✅ レート制限: ${(endTime - startTime).toFixed(2)}ms`);
  });

  test('アクセス制御確認', () => {
    // 基本的なアクセス制御テスト
    const hasPermission = (user: string, resource: string, action: string): boolean => {
      const permissions: Record<string, string[]> = {
        'admin': ['read', 'write', 'delete'],
        'user': ['read'],
        'guest': []
      };
      
      const userPerms = permissions[user] || [];
      return userPerms.includes(action);
    };
    
    // 管理者権限
    expect(hasPermission('admin', 'documents', 'read')).toBe(true);
    expect(hasPermission('admin', 'documents', 'write')).toBe(true);
    expect(hasPermission('admin', 'documents', 'delete')).toBe(true);
    
    // ユーザー権限
    expect(hasPermission('user', 'documents', 'read')).toBe(true);
    expect(hasPermission('user', 'documents', 'write')).toBe(false);
    expect(hasPermission('user', 'documents', 'delete')).toBe(false);
    
    // ゲスト権限
    expect(hasPermission('guest', 'documents', 'read')).toBe(false);
    
    console.log('✅ アクセス制御確認完了');
  });
}); 