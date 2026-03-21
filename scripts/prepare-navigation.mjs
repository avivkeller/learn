import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const PAGES_DIR = join(import.meta.dirname, '..', 'pages');
const OUTPUT_FILE = join(import.meta.dirname, '..', 'components', 'nav.json');

const NAVIGATION_JSON_URL =
  'https://raw.githubusercontent.com/nodejs/nodejs.org/main/apps/site/navigation.json';
const I18N_JSON_URL =
  'https://raw.githubusercontent.com/nodejs/nodejs.org/main/packages/i18n/src/locales/en.json';

/**
 * Recursively collects all .md files under a directory
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
const collectMarkdownFiles = async dir => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(full)));
    } else if (entry.name.endsWith('.md')) {
      files.push(full);
    }
  }

  return files;
};

/**
 * Extracts the first H1 heading from markdown content
 * @param {string} content
 * @returns {string}
 */
const extractTitle = content => {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '';
};

/**
 * Converts a file path to a URL path
 * e.g. pages/getting-started/intro.md → /learn/getting-started/intro
 * @param {string} filePath
 * @returns {string}
 */
const filePathToURL = filePath => {
  const rel = relative(PAGES_DIR, filePath).split(sep).join('/');
  const withoutExt = rel.replace(/\.md$/, '');
  // Strip trailing /index since index pages map to the directory URL
  const cleaned = withoutExt.replace(/\/index$/, '');
  return `/learn/${cleaned}`;
};

/**
 * Converts a slug like "getting-started" to "Getting Started"
 * @param {string} slug
 * @returns {string}
 */
const slugToTitle = slug =>
  slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/**
 * Builds sideNav from the pages directory
 * @returns {Promise<Array<{groupName: string, items: Array<{label: string, link: string}>}>>}
 */
const buildSideNav = async () => {
  const files = await collectMarkdownFiles(PAGES_DIR);
  const groupMap = new Map();

  for (const file of files) {
    const url = filePathToURL(file);
    // Top-level group is the first directory under pages/
    const rel = relative(PAGES_DIR, file).split(sep);

    // Skip root-level files (e.g. pages/index.md)
    if (rel.length < 2) continue;

    const groupSlug = rel[0];
    const content = await readFile(file, 'utf-8');
    const title = extractTitle(content);

    if (!title) continue;

    if (!groupMap.has(groupSlug)) {
      groupMap.set(groupSlug, {
        groupName: slugToTitle(groupSlug),
        items: [],
      });
    }

    groupMap.get(groupSlug).items.push({ label: title, link: url });
  }

  return Array.from(groupMap.values());
};

/**
 * @param {Object} obj
 * @param {string} path
 */
const getValueByPath = (obj, path) =>
  path.split('.').reduce((c, k) => c?.[k], obj);

/**
 * Fetches topNav from the nodejs.org navigation.json
 * @returns {Promise<Array<{link: string, text: string, target?: string}>>}
 */
const buildTopNav = async () => {
  const navRes = await fetch(NAVIGATION_JSON_URL);
  const nav = await navRes.json();

  const i18nRes = await fetch(I18N_JSON_URL);
  const i18n = await i18nRes.json();

  return Object.values(nav.topNavigation).map(({ link, label, target }) => ({
    link,
    text: getValueByPath(i18n, label),
    ...(target && { target }),
  }));
};

const [sideNav, topNav] = await Promise.all([buildSideNav(), buildTopNav()]);

await writeFile(OUTPUT_FILE, JSON.stringify({ topNav, sideNav }, null, 2));
