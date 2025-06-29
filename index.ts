import { z } from 'zod';
import { parseArgs } from './lib/args';
import { request } from './lib/request';

async function main() {
    try {
        const args = parseArgs(process.argv.slice(2));
        console.log('Method:', args.method);
        console.log('URL:', args.url);
        console.log('All args:', args);

        const responseStream = await request(args.url, { method: args.method });
        console.log('Received response body as ReadableStream.');
        // For now, we'll just log that we received the stream.
        // In a real application, you would pipe this stream to stdout or process it.

    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error('Invalid arguments:', error.flatten());
            console.error('Usage: bun run index.ts <method> <url>');
        } else {
            console.error('An unexpected error occurred:', error);
        }
        process.exit(1);
    }
}

main();