
import { z } from 'zod';

const HttpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']);

// This schema will parse the raw string array and transform it into the final structure
const FullArgsSchema = z.array(z.string()).transform((args, ctx) => {
    const positional: string[] = [];
    const named: { [key: string]: string | boolean } = {};
    let skipNext = false;

    for (const [i, arg] of args.entries()) {
        if (skipNext) {
            skipNext = false;
            continue;
        }

        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const nextArg = args[i + 1];

            if (nextArg !== undefined && !nextArg.startsWith('--')) {
                named[key] = nextArg;
                skipNext = true;
            } else {
                named[key] = true;
            }
        } else {
            positional.push(arg);
        }
    }

    // Now, validate the extracted positional and named arguments
    const parsedMethod = HttpMethodSchema.safeParse(positional[0]);
    if (!parsedMethod.success) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid HTTP method: ${positional[0] || 'undefined'}`,
            path: ['method'],
        });
        return z.NEVER;
    }

    const parsedUrl = z.string().url().safeParse(positional[1]);
    if (!parsedUrl.success) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid URL: ${positional[1] || 'undefined'}`,
            path: ['url'],
        });
        return z.NEVER;
    }

    let body: string | undefined;
    let contentType: string | undefined;

    const hasJson = 'json' in named;
    const hasText = 'text' in named;

    if (hasJson && hasText) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Cannot specify both --json and --text.',
            path: ['body'],
        });
        return z.NEVER;
    }

    if (hasJson) {
        const jsonBody = named.json;
        if (typeof jsonBody !== 'string') {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: '--json requires a string value.',
                path: ['json'],
            });
            return z.NEVER;
        }
        try {
            JSON.parse(jsonBody);
            body = jsonBody;
            contentType = 'application/json';
        } catch (e) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: '--json value is not valid JSON.',
                path: ['json'],
            });
            return z.NEVER;
        }
    } else if (hasText) {
        const textBody = named.text;
        if (typeof textBody !== 'string') {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: '--text requires a string value.',
                path: ['text'],
            });
            return z.NEVER;
        }
        body = textBody;
        contentType = 'text/plain';
    }

    // Construct the final object
    return {
        method: parsedMethod.data,
        url: parsedUrl.data,
        body,
        contentType,
    };
});

export type ParsedArgs = z.infer<typeof FullArgsSchema>;

export function parseArgs(rawArgs: string[]): ParsedArgs {
    return FullArgsSchema.parse(rawArgs);
}
