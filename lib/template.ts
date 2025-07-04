import { resolve } from "path";
import { z } from "zod";

export interface TemplateSchemas {
  inputSchema: z.ZodTypeAny;
  querySchema: z.ZodTypeAny;
  pathSchema: z.ZodTypeAny;
}

export interface RenderResult<T extends TemplateSchemas> {
  input: z.infer<T["inputSchema"]>;
  query: z.infer<T["querySchema"]>;
  path: z.infer<T["pathSchema"]>;
}

export interface TemplateResult {
  input: any;
  query: any;
  path: any;
  method: string;
  pathTemplate: string;
  url: string;
}

export function render<T extends TemplateSchemas>(
  schemas: T,
  data: Partial<
    z.infer<T["inputSchema"]> &
      z.infer<T["querySchema"]> &
      z.infer<T["pathSchema"]>
  >,
): RenderResult<T> {
  // Handle the case where inputSchema is z.never() (no request body expected)
  // Check if inputSchema is z.never() by checking its type name
  let input: z.infer<T["inputSchema"]>;
  const isNeverSchema = schemas.inputSchema._def.typeName === "ZodNever";

  if (isNeverSchema) {
    // For z.never() schemas, don't parse data - just return undefined
    input = undefined as z.infer<T["inputSchema"]>;
  } else {
    // For real schemas, parse and let validation errors bubble up
    input = schemas.inputSchema.parse(data);
  }

  return {
    input,
    query: schemas.querySchema.parse(data),
    path: schemas.pathSchema.parse(data),
  };
}

export async function renderTemplate(
  templatePath: string,
  data: any,
  baseUrl: string,
): Promise<TemplateResult> {
  // Resolve filesystem template path (always relative to cwd)
  const resolvedTemplatePath = resolve(process.cwd(), templatePath);

  const templateModule = await import(resolvedTemplatePath);

  // Validate required exports for new template format
  if (!templateModule.inputSchema) {
    throw new Error(
      `Template ${resolvedTemplatePath} must export an 'inputSchema'`,
    );
  }
  if (!templateModule.querySchema) {
    throw new Error(
      `Template ${resolvedTemplatePath} must export a 'querySchema'`,
    );
  }
  if (!templateModule.pathSchema) {
    throw new Error(
      `Template ${resolvedTemplatePath} must export a 'pathSchema'`,
    );
  }
  if (!templateModule.method) {
    throw new Error(
      `Template ${resolvedTemplatePath} must export a 'method' string`,
    );
  }
  if (!templateModule.path) {
    throw new Error(
      `Template ${resolvedTemplatePath} must export a 'path' string`,
    );
  }

  // Use the shared render function with the template's schemas
  const rendered = render(templateModule, data);

  // Build the full request URL by combining baseUrl + resolved API path
  const url = resolveApiUrl(baseUrl, templateModule.path, rendered.path);

  return {
    input: rendered.input,
    query: rendered.query,
    path: rendered.path,
    method: templateModule.method,
    pathTemplate: templateModule.path,
    url,
  };
}
function resolveApiUrl(
  baseUrl: string,
  pathTemplate: string,
  pathParams: Record<string, any>,
): string {
  let resolvedPath = pathTemplate;

  // Replace path parameters like {userId} with actual values
  for (const [key, value] of Object.entries(pathParams)) {
    const placeholder = `{${key}}`;
    resolvedPath = resolvedPath.replace(placeholder, String(value));
  }

  return new URL(
    resolvedPath.replace(/^\/+/, ""),
    baseUrl.replace(/\/+$/, "") + "/",
  ).toString();
}
