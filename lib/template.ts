import { resolve } from "path";

export interface TemplateResult {
  input: any;
  query: any;
  method: string;
  path: string;
}

export async function renderTemplate(
  templatePath: string,
  data: any,
): Promise<TemplateResult> {
  try {
    const resolvedPath = resolve(process.cwd(), templatePath);

    // Only support TypeScript templates
    if (!templatePath.endsWith(".ts")) {
      throw new Error(
        `Template ${templatePath} must be a TypeScript file (.ts)`,
      );
    }

    const templateModule = await import(resolvedPath);

    // Validate required exports
    if (typeof templateModule.render !== "function") {
      throw new Error(
        `Template ${templatePath} must export a 'render' function`,
      );
    }
    if (!templateModule.method) {
      throw new Error(`Template ${templatePath} must export a 'method' string`);
    }
    if (!templateModule.path) {
      throw new Error(`Template ${templatePath} must export a 'path' string`);
    }

    // Render the template with provided data
    const rendered = templateModule.render(data);

    return {
      input: rendered.input,
      query: rendered.query,
      method: templateModule.method,
      path: templateModule.path,
    };
  } catch (error) {
    throw new Error(`Failed to render template ${templatePath}: ${error}`);
  }
}
