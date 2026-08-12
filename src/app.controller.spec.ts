import { AppController } from './app.controller';

describe('AppController', () => {
  describe('getApiInfo', () => {
    it('delegates to AppService.getApiInfo', () => {
      const appService = {
        getApiInfo: jest.fn().mockReturnValue({ name: 'donate-server' }),
      };
      const controller = new AppController(appService as any);

      const result = controller.getApiInfo();

      expect(appService.getApiInfo).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ name: 'donate-server' });
    });
  });
});
