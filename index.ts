import { z } from 'zod';
import { parseArgs } from './lib/args';

try {
    const args = parseArgs(process.argv.slice(2));
    console.log('Valid URL:', args.url);
    console.log('All args:', args);
} catch (error) {
    if (error instanceof z.ZodError) {
        console.error('Invalid arguments:', error.flatten());
        console.error('Usage: bun run index.ts <url>');
    } else {
        console.error('An unexpected error occurred:', error);
    }
    process.exit(1);
}