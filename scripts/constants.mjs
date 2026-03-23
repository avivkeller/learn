import { join } from 'node:path';

// Inputs & Outputs
export const PAGES_DIR = join(import.meta.dirname, '..', 'pages');
export const OUTPUT_FILE = join(
  import.meta.dirname,
  '..',
  'components',
  'config.json'
);
export const INDEX_FILE = join(PAGES_DIR, 'index.md');

// Site navigation
export const NAV_URL =
  'https://raw.githubusercontent.com/nodejs/nodejs.org/main/apps/site/navigation.json';
// Site translations
export const I18N_URL =
  'https://raw.githubusercontent.com/nodejs/nodejs.org/main/packages/i18n/src/locales/en.json';
// Authors
// TODO(@avivkeller): What if we fetched this data from GitHub directly?
export const AUTHORS_URL =
  'https://raw.githubusercontent.com/nodejs/nodejs.org/refs/heads/main/apps/site/authors.json';
