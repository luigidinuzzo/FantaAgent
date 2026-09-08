import { writeFileSync, mkdirSync } from 'node:fs';
import { renderTokens } from './palette.mjs';

mkdirSync(new URL('../src/styles/', import.meta.url), { recursive: true });
writeFileSync(new URL('../src/styles/tokens.css', import.meta.url), renderTokens());
console.log('tokens.css rigenerato');
