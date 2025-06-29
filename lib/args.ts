
import { z } from 'zod';

export const ArgsSchema = z.array(z.string()).transform((args, ctx) => {
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

    const PositionalArgs = z.tuple([z.string().url()]);
    const NamedArgs = z.object({});

    const parsedPositionals = PositionalArgs.safeParse(positional);
    if (!parsedPositionals.success) {
        parsedPositionals.error.issues.forEach(issue => ctx.addIssue(issue));
        return z.NEVER;
    }

    const parsedNamed = NamedArgs.safeParse(named);
    if (!parsedNamed.success) {
        parsedNamed.error.issues.forEach(issue => ctx.addIssue(issue));
        return z.NEVER;
    }

    return {
        positional: parsedPositionals.data,
        named: parsedNamed.data
    };
});
