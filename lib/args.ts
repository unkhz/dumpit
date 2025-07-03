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
        case "a":
          key = "api";
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

  const httpMethods = [
    "get",
    "post",
    "put",
    "delete",
    "patch",
    "head",
    "options",
  ];
  const validCommands = ["dump", "api", ...httpMethods];

  if (!validCommands.includes(command)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Unknown command: ${command}. Available commands: ${validCommands.join(", ")}`,
      path: ["command"],
    });
    return z.NEVER;
  }

  // Handle different command structures
  if (command === "dump" || httpMethods.includes(command)) {
    // URL is the second positional argument for dump
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
    const hasApi = "api" in named;

    // API can be used with template, but not with json/text
    const conflictingOptions = [hasJson, hasText];
    if (hasTemplate && !hasApi) {
      conflictingOptions.push(hasTemplate);
    }
    if (hasApi && !hasTemplate) {
      conflictingOptions.push(hasApi);
    }

    if (conflictingOptions.filter(Boolean).length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Cannot specify more than one of --json, --text, or --template (unless using --api with --template).",
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
      // Infer method based on command or body presence
      if (httpMethods.includes(command)) {
        method = command.toUpperCase() as z.infer<typeof HttpMethodSchema>;
      } else {
        method = hasJson || hasText || hasTemplate || hasApi ? "POST" : "GET";
      }
    }

    // Handle template rendering for dump command
    let template: string | undefined;
    let templateData: any = {};

    if (hasTemplate && hasApi) {
      // Handle API template shortcut

      const apiName = named.api as string;
      if (typeof apiName !== "string") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "--api requires a string value.",
          path: ["api"],
        });
        return z.NEVER;
      }

      const templatePath = named.template as string;
      if (typeof templatePath !== "string") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "--template requires a string value when using --api.",
          path: ["template"],
        });
        return z.NEVER;
      }

      // Construct the full template path
      // For method-based commands, try without method suffix first, then with method suffix
      if (httpMethods.includes(command)) {
        // For method commands like 'post', look for template without method suffix
        template = `.rekku/apis/${apiName}/templates/${templatePath}.ts`;
      } else {
        // For 'dump' command, use the full path as provided
        template = `.rekku/apis/${apiName}/templates/${templatePath}.ts`;
      }

      // Handle template data
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
    } else if (hasTemplate) {
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

    // Construct the final object for dump command
    return {
      command,
      method,
      url: parsedUrl.data,
      body,
      contentType,
      template,
      templateData,
    };
  } else if (command === "api") {
    // Handle api command structure: api <subcommand> <name> <url>
    const subcommand = positional[1];
    const name = positional[2];
    const url = positional[3];

    if (!subcommand) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "API subcommand is required. Available subcommands: create",
        path: ["subcommand"],
      });
      return z.NEVER;
    }

    if (subcommand !== "create") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown API subcommand: ${subcommand}. Available subcommands: create`,
        path: ["subcommand"],
      });
      return z.NEVER;
    }

    if (!name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "API name is required for create command",
        path: ["name"],
      });
      return z.NEVER;
    }

    if (!url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "URL is required for create command",
        path: ["url"],
      });
      return z.NEVER;
    }

    // Validate URL for api command
    const parsedUrl = z.string().url().safeParse(url);
    if (!parsedUrl.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid URL: ${url}`,
        path: ["url"],
      });
      return z.NEVER;
    }

    // Construct the final object for api command
    return {
      command,
      subcommand,
      name,
      url: parsedUrl.data,
    };
  }

  // This should never be reached
  throw new Error("Unexpected command flow");
});

export type ParsedArgs = z.infer<typeof FullArgsSchema>;

export function parseArgs(rawArgs: string[]): ParsedArgs {
  return FullArgsSchema.parse(rawArgs);
}
