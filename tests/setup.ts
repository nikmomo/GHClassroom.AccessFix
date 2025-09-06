import { jest } from '@jest/globals';

process.env['NODE_ENV'] = 'test';
process.env['GITHUB_TOKEN'] = 'test-token';
process.env['GITHUB_ORG'] = 'test-org';
process.env['WEBHOOK_SECRET'] = 'test-secret';
process.env['LOG_LEVEL'] = 'error';

jest.setTimeout(10000);

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  jest.restoreAllMocks();
});