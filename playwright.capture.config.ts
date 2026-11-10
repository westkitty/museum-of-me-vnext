import baseConfig from './playwright.config';

export default {
  ...baseConfig,
  testMatch: '**/*.capture.ts',
};
