import web from '@node-core/doc-kit/src/generators/web/index.mjs';
import { join } from 'node:path';

/** @type {import('@node-core/doc-kit/src/utils/configuration/types.d.ts').Configuration} */
export default {
  global: {
    output: 'out',
    input: ['pages/**/*.md'],
  },
  'jsx-ast': {
    pageURL: '',
    editURL: '',
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
    },
  },
};
