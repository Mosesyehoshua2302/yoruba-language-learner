// `dotenv/config`'s default lookup is relative to process.cwd(), which for
// `npm run ...` is the App/ package root, not this server/ directory — so a
// bare `import 'dotenv/config'` silently finds nothing. Load explicitly.
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(dirname, '.env') });
