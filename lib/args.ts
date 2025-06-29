
import { z } from 'zod';

export const ArgsSchema = z.array(z.string()).transform((args, ctx) => {
    const positional: string[] = [];
    const named: { [key: string]: any } = {};

    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--')) {
            const key = args[i].slice(2);
            const value = (i + 1 < args.length && !args[i + 1].startsWith('--')) ? args[i + 1] : true;
            if (value !== true) {
                i++;
            }
            named[key] = value;
        } else {
            positional.push(args[i]);
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
