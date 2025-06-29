import { z } from 'zod';

const RawArgsSchema = z.array(z.string()).transform((args, ctx) => {
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

    return { positional, named };
});

const ParsedArgsSchema = z.object({
    url: z.string().url(),
});

export type ParsedArgs = z.infer<typeof ParsedArgsSchema>;

export function parseArgs(rawArgs: string[]): ParsedArgs {
    const { positional, named } = RawArgsSchema.parse(rawArgs);

    // Map positional arguments to named properties
    const combinedArgs = {
        url: positional[0],
        ...named,
    };

    return ParsedArgsSchema.parse(combinedArgs);
}