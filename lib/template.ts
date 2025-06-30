import { resolve } from "path";

export async function renderTemplate(
  templatePath: string,
  data: any,
): Promise<string> {
  try {
    const resolvedPath = resolve(process.cwd(), templatePath);

    // Check if it's a TypeScript template
    if (templatePath.endsWith(".ts")) {
      const templateModule = await import(resolvedPath);
      if (typeof templateModule.render !== "function") {
        throw new Error(
          `Template ${templatePath} must export a 'render' function`,
        );
      }
      const result = templateModule.render(data);
      return JSON.stringify(result, null, 2);
    }

    // Fallback to Nunjucks for .njk files (for backward compatibility)
    const nunjucks = await import("nunjucks");
    const env = nunjucks.configure({ autoescape: false });
    const templateContent = await Bun.file(resolvedPath).text();
    return env.renderString(templateContent, data);
  } catch (error) {
    throw new Error(`Failed to render template ${templatePath}: ${error}`);
  }
}
