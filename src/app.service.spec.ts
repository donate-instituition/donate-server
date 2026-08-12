import { AppService } from './app.service';

describe('AppService', () => {
  describe('getApiInfo', () => {
    it('returns the service name, ok status, and the list of domains', () => {
      const service = new AppService();

      const result = service.getApiInfo();

      expect(result).toMatchObject({
        name: 'donate-server',
        status: 'ok',
      });
      expect(Array.isArray(result.domains)).toBe(true);
      expect(result.domains.length).toBeGreaterThan(0);
      expect(result.domains).toContain('campaigns');
      expect(result.domains).toContain('donations');
    });
  });
});
