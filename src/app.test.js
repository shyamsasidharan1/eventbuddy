const request = require('supertest');
const app = require('./app');

describe('EventBuddy API', () => {
  describe('GET /health', () => {
    it('should return health check information', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('message', 'OK');
      expect(res.body).toHaveProperty('service', 'eventbuddy-api');
      expect(res.body).toHaveProperty('version', '1.0.0');
    });
  });

  describe('GET /', () => {
    it('should return welcome message', async () => {
      const res = await request(app)
        .get('/')
        .expect(200);

      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('service', 'eventbuddy-api');
      expect(res.body).toHaveProperty('version', '1.0.0');
    });
  });

  describe('GET /ready', () => {
    it('should return readiness check', async () => {
      const res = await request(app)
        .get('/ready')
        .expect(200);

      expect(res.body).toHaveProperty('status', 'ready');
    });
  });
});