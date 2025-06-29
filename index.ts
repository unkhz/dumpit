
import { z } from 'zod';
import { ArgsSchema } from './lib/args';

try {
    const { positional: [url], named } = ArgsSchema.parse(process.argv.slice(2));
    console.log('Valid URL:', url);
    console.log('Named args:', named);
} catch (error) {
    if (error instanceof z.ZodError) {
        console.error('Invalid arguments:', error.flatten());
        console.error('Usage: bun run index.ts <url>');
    } else {
        console.error('An unexpected error occurred:', error);
    }
    process.exit(1);
}
