import { z } from "zod";

const HttpMethodSchema = z.enum([
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS",
]);

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

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (nextArg !== undefined && !nextArg.startsWith("-")) {
        named[key] = nextArg;
        skipNext = true;
      } else {
        named[key] = true;
      }
    } else if (arg.startsWith("-") && arg.length > 1) {
      // Handle short flags
      const shortFlag = arg.slice(1);
      let key: string;

      // Map short flags to long flags
      switch (shortFlag) {
        case "t":
          key = "template";
          break;
        case "d":
          key = "template-data";
          break;
        default:
          key = shortFlag; // Keep unknown short flags as-is
      }

      const nextArg = args[i + 1];
      if (nextArg !== undefined && !nextArg.startsWith("-")) {
        named[key] = nextArg;
        skipNext = true;
      } else {
        named[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  // First positional argument should be the command
  const command = positional[0];
  if (!command) {
    // Return a special marker to indicate missing command
    return { _showUsage: true } as any;
  }

  if (command !== "dump") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Unknown command: ${command}. Available commands: dump`,
      path: ["command"],
    });
    return z.NEVER;
  }

  // URL is now the second positional argument
  const parsedUrl = z.string().url().safeParse(positional[1]);
  if (!parsedUrl.success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid URL: ${positional[1] || "undefined"}`,
      path: ["url"],
    });
    return z.NEVER;
  }

  let body: string | undefined;
  let contentType: string | undefined;

  const hasJson = "json" in named;
  const hasText = "text" in named;
  const hasTemplate = "template" in named;

  if ([hasJson, hasText, hasTemplate].filter(Boolean).length > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Cannot specify more than one of --json, --text, or --template.",
      path: ["body"],
    });
    return z.NEVER;
  }

  if (hasJson) {
    const jsonBody = named.json;
    if (typeof jsonBody !== "string") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "--json requires a string value.",
        path: ["json"],
      });
      return z.NEVER;
    }
    try {
      JSON.parse(jsonBody);
      body = jsonBody;
      contentType = "application/json";
    } catch (e) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "--json value is not valid JSON.",
        path: ["json"],
      });
      return z.NEVER;
    }
  } else if (hasText) {
    const textBody = named.text;
    if (typeof textBody !== "string") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "--text requires a string value.",
        path: ["text"],
      });
      return z.NEVER;
    }
    body = textBody;
    contentType = "text/plain";
  } else if (hasTemplate) {
    const templatePath = named.template;
    if (typeof templatePath !== "string") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "--template requires a string value.",
        path: ["template"],
      });
      return z.NEVER;
    }
  }
  let method: z.infer<typeof HttpMethodSchema>;

  if ("method" in named) {
    const rawMethod = String(named.method).toUpperCase();
    const parsedMethod = HttpMethodSchema.safeParse(rawMethod);
    if (!parsedMethod.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid HTTP method: ${rawMethod}. Must be one of ${HttpMethodSchema.options.join(", ")}.`,
        path: ["method"],
      });
      return z.NEVER;
    }
    method = parsedMethod.data;
  } else {
    // Infer method based on body presence
    method = hasJson || hasText || hasTemplate ? "POST" : "GET";
  }

  // Handle template rendering
  let template: string | undefined;
  let templateData: any = {};

  if (hasTemplate) {
    template = named.template as string;
    if ("template-data" in named) {
      const templateDataStr = named["template-data"];
      if (typeof templateDataStr !== "string") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "--template-data requires a string value.",
          path: ["template-data"],
        });
        return z.NEVER;
      }
      try {
        templateData = JSON.parse(templateDataStr);
      } catch (e) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "--template-data value is not valid JSON.",
          path: ["template-data"],
        });
        return z.NEVER;
      }
    }
  }

  // Construct the final object
  return {
    command,
    method,
    url: parsedUrl.data,
    body,
    contentType,
    template,
    templateData,
  };
});

export type ParsedArgs = z.infer<typeof FullArgsSchema>;

export function parseArgs(rawArgs: string[]): ParsedArgs {
  return FullArgsSchema.parse(rawArgs);
}
