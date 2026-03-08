import web from '@node-core/doc-kit/src/generators/web/index.mjs';
import { join } from 'node:path';

/** @type {import('@node-core/doc-kit/src/utils/configuration/types.d.ts').Configuration} */
export default {
  global: {
    output: 'out',
    input: ['pages/**/*.md'],
  },
  'jsx-ast': {
    pageURL: 'https://learn.nodejs.org{path}.html',
    editURL: 'https://github.com/nodejs/learn/edit/main{path}.md',
  },
  web: {
    title: '',
    imports: {
      ...web.defaultConfiguration.imports,
      '#theme/Navigation': join(
        import.meta.dirname,
        'components/Navigation/index.jsx'
      ),
      '#theme/Sidebar': join(
        import.meta.dirname,
        'components/Sidebar/index.jsx'
      ),
      '#theme/Metabar': join(
        import.meta.dirname,
        'components/Metabar/index.jsx'
      ),
    },
  },
};
