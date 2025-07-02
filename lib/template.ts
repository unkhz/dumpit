import { resolve } from "path";

export interface TemplateResult {
  input: any;
  query: any;
  method: string;
  path: string;
}

export async function renderTemplate(
  templatePath: string,
  data: any
): Promise<TemplateResult> {
  try {
    const resolvedPath = resolve(process.cwd(), templatePath);

    // Check if it's a TypeScript template
    if (templatePath.endsWith(".ts")) {
      const templateModule = await import(resolvedPath);

      // Validate required exports
      if (typeof templateModule.render !== "function") {
        throw new Error(
          `Template ${templatePath} must export a 'render' function`
        );
      }
      if (!templateModule.method) {
        throw new Error(
          `Template ${templatePath} must export a 'method' string`
        );
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
    }

    // Fallback to Nunjucks for .njk files (for backward compatibility)
    const nunjucks = await import("nunjucks");
    const env = nunjucks.configure({ autoescape: false });
    const templateContent = await Bun.file(resolvedPath).text();
    const body = env.renderString(templateContent, data);

    // For legacy templates, return as input with default values
    return {
      input: JSON.parse(body),
      query: {},
      method: "GET",
      path: "/",
    };
  } catch (error) {
    console.error(
      `Error rendering template ${templatePath}:`,
      error,
      templatePath,
      data
    );
    throw new Error(`Failed to render template ${templatePath}`, {
      cause: error,
    });
  }
}
