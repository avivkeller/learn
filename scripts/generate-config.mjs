import { readFile, writeFile, glob } from 'node:fs/promises';
import { join, sep } from 'node:path';
import {
  AUTHORS_URL,
  I18N_URL,
  NAV_URL,
  OUTPUT_FILE,
  INDEX_FILE,
  PAGES_DIR,
} from './constants.mjs';
import config from '../doc-kit.config.mjs';
import { populate } from '@node-core/doc-kit/src/utils/configuration/templates.mjs';

/**
 * @typedef {Object} AuthorEntry
 * @property {string} id       - GitHub username used as a unique key.
 * @property {string} [name]   - Display name (falls back to `id`).
 * @property {string} [website] - Personal URL (falls back to GitHub profile).
 */

/**
 * @typedef {Object} ResolvedAuthor
 * @property {string} image    - GitHub avatar URL.
 * @property {string} name     - Display name.
 * @property {string} nickname - GitHub username.
 * @property {string} fallback - Uppercase initials used as an avatar fallback.
 * @property {string} url      - Link to the author's website or GitHub profile.
 */

/**
 * @typedef {Object} NavItem
 * @property {string} link     - Destination URL.
 * @property {string} text     - Visible label.
 * @property {string} [target] - Optional link target (e.g. `"_blank"`).
 */

/**
 * @typedef {Object} SideNavGroup
 * @property {string} groupName             - Human-readable group heading.
 * @property {{ label: string, link: string }[]} items - Pages in this group.
 */

/**
 * @typedef {Object} ParsedPage
 * @property {string}   group     - Top-level directory slug (first path segment).
 * @property {string}   pathname  - URL pathname derived from the file path.
 * @property {string}   label     - Page title extracted from the first H1.
 * @property {string[]} authorIds - GitHub usernames listed in the YAML front-matter.
 */

/**
 * @typedef {Object} BuildOutput
 * @property {NavItem[]}      topNav  - Top-level navigation items.
 * @property {SideNavGroup[]} sideNav - Grouped sidebar navigation.
 * @property {Record<string, ResolvedAuthor[]>} authors - Authors keyed by edit URL.
 */

/**
 * Extracts the first H1 heading from markdown content.
 * @param {string} content - Raw markdown string.
 * @returns {string} The heading text, or an empty string if none is found.
 */
const extractTitle = content => content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? '';

/**
 * Extracts the ordered list of group slugs from index.md links.
 * @param {string} content - Raw markdown of the index file.
 * @returns {string[]} Ordered, deduplicated group slugs.
 */
const extractGroupOrder = content => [
  ...new Set([...content.matchAll(/\]\(\/([\w-]+)\//g)].map(m => m[1])),
];

/**
 * Extracts author IDs from a `<!-- YAML authors: id1, id2 -->` block.
 * @param {string} content - Raw markdown string.
 * @returns {string[]} An array of trimmed, non-empty author IDs.
 */
const extractAuthorIds = content => {
  const yaml = content.match(/<!--\s*YAML\s+([\s\S]*?)-->/)?.[1] ?? '';
  const line = yaml.match(/^authors:\s*(.+)$/m)?.[1] ?? '';
  return line
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
};

/**
 * Converts a kebab-case slug to a title-cased string.
 * @param {string} slug - e.g. `"getting-started"`.
 * @returns {string} e.g. `"Getting Started"`.
 */
const slugToTitle = slug =>
  slug.replace(
    /(^|-)(\w)/g,
    (_, _sep, ch) => (_sep ? ' ' : '') + ch.toUpperCase()
  );

/**
 * Derives a URL pathname from a markdown file path.
 * @param {string} file - Relative file path (e.g. `"guides/intro.md"`).
 * @returns {string} URL pathname (e.g. `"/guides/intro"`).
 */
const toPathname = file => '/' + file.replace(sep, '/').replace(/\.mdx?$/, '');

/**
 * Builds the edit-URL key used to index into the authors map.
 * @param {string} pathname - URL pathname of the page.
 * @returns {string} Fully-qualified edit URL.
 */
const toEditUrl = pathname =>
  populate(config['jsx-ast'].editURL, { path: pathname });

/**
 * Fetches and parses JSON from a URL.
 * @param {string} url - The URL to fetch.
 * @returns {Promise<any>} Parsed JSON response.
 */
const fetchJson = url => fetch(url).then(r => r.json());

/**
 * Fetches author data from {@link AUTHORS_URL} and returns an id-keyed lookup.
 * @returns {Promise<Map<string, AuthorEntry>>}
 */
const fetchAuthorsMap = async () => {
  const raw = await fetchJson(AUTHORS_URL);
  return new Map(Object.values(raw).map(entry => [entry.id, entry]));
};

/**
 * Fetches navigation and i18n data, then assembles the top navigation items.
 * @returns {Promise<NavItem[]>}
 */
const fetchTopNav = async () => {
  const [nav, i18n] = await Promise.all([
    fetchJson(NAV_URL),
    fetchJson(I18N_URL),
  ]);

  /**
   * Resolves a dot-separated key path against the i18n object.
   * @param {string} path - e.g. `"nav.home.label"`.
   * @returns {string | undefined}
   */
  const resolve = path =>
    path.split('.').reduce((obj, key) => obj?.[key], i18n);

  return Object.values(nav.topNavigation).map(({ link, label, target }) => ({
    link,
    text: resolve(label),
    ...(target && { target }),
  }));
};

/**
 * Resolves a GitHub author ID into a full {@link ResolvedAuthor} object,
 * enriching it with data from the authors map when available.
 * @param {string} id - GitHub username.
 * @param {Map<string, AuthorEntry>} authorsById - Lookup map of known authors.
 * @returns {ResolvedAuthor}
 */
const resolveAuthor = (id, authorsById) => {
  const entry = authorsById.get(id);
  const name = entry?.name ?? id;
  const initials = (name.match(/\b\w/g) ?? []).join('').toUpperCase();

  return {
    image: `https://avatars.githubusercontent.com/${id}`,
    name,
    nickname: id,
    fallback: initials,
    url: entry?.website ?? `https://github.com/${id}`,
  };
};

/**
 * Parses a single markdown page into its metadata.
 * @param {string} file    - Relative path to the markdown file.
 * @param {string} content - Raw file content.
 * @returns {ParsedPage}
 */
const parsePage = (file, content) => {
  const pathname = toPathname(file);
  const [group] = file.split(sep);

  return {
    group,
    pathname,
    label: extractTitle(content),
    authorIds: extractAuthorIds(content),
  };
};

/**
 * Reads every markdown page under {@link PAGES_DIR} and produces the sidebar
 * navigation groups and a per-page authors mapping.
 * @param {Map<string, AuthorEntry>} authorsById - Lookup map of known authors.
 * @returns {Promise<{ sideNav: SideNavGroup[], authors: Record<string, ResolvedAuthor[]> }>}
 */
const buildPages = async authorsById => {
  const [files, indexContent] = await Promise.all([
    Array.fromAsync(glob('**/*.md', { cwd: PAGES_DIR, exclude: ['index.md'] })),
    readFile(INDEX_FILE, 'utf-8'),
  ]);

  const groupOrder = extractGroupOrder(indexContent);

  const pages = await Promise.all(
    files.map(async file => {
      const content = await readFile(join(PAGES_DIR, file), 'utf-8');
      return parsePage(file, content);
    })
  );
  const groups = Map.groupBy(pages, p => p.group);

  // Sort entries by their position in index.md (unknown groups go to the end)
  const sortedEntries = [...groups.entries()].sort(
    (a, b) =>
      (groupOrder.indexOf(a[0]) >>> 0) - (groupOrder.indexOf(b[0]) >>> 0)
  );

  const sideNav = sortedEntries.map(([key, items]) => ({
    groupName: slugToTitle(key),
    items: items.map(p => ({ label: p.label, link: p.pathname + '.html' })),
  }));

  const authors = Object.fromEntries(
    pages
      .filter(p => p.authorIds.length > 0)
      .map(p => [
        toEditUrl(p.pathname),
        p.authorIds.map(id => resolveAuthor(id, authorsById)),
      ])
  );

  return { sideNav, authors };
};

const [authorsById, topNav] = await Promise.all([
  fetchAuthorsMap(),
  fetchTopNav(),
]);

const { sideNav, authors } = await buildPages(authorsById);

await writeFile(
  OUTPUT_FILE,
  JSON.stringify({ topNav, sideNav, authors }, null, 2)
);
