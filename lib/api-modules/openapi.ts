import * as yaml from "js-yaml";

interface OpenAPISpec {
  openapi: string;
  info: any;
  paths: Record<string, Record<string, OpenAPIOperation>>;
  components?: {
    schemas?: Record<string, any>;
  };
}

interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: {
    content: Record<string, { schema: any }>;
  };
  responses: Record<
    string,
    {
      description: string;
      content?: Record<string, { schema: any }>;
    }
  >;
}

interface OpenAPIParameter {
  name: string;
  in: "query" | "path" | "header" | "cookie";
  required?: boolean;
  schema: any;
}

export async function generateTemplatesFromOpenAPI(
  url: string,
  apiName: string,
): Promise<void> {
  try {
    // Fetch OpenAPI spec
    const spec = await fetchOpenAPISpec(url);

    // Generate templates for each operation
    const templates = generateTemplates(spec);

    // Write templates to disk
    await writeTemplatesToDisk(apiName, templates);

    console.log(`Generated ${templates.length} templates for API: ${apiName}`);
  } catch (error) {
    console.error(`Failed to generate templates from OpenAPI spec: ${error}`);
    throw error;
  }
}

async function fetchOpenAPISpec(url: string): Promise<OpenAPISpec> {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    // Fetch from URL
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch OpenAPI spec: ${response.status} ${response.statusText}`,
      );
    }

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    // Parse based on content type or URL extension
    if (
      contentType.includes("yaml") ||
      contentType.includes("yml") ||
      url.endsWith(".yaml") ||
      url.endsWith(".yml")
    ) {
      return parseYaml(text) as OpenAPISpec;
    } else {
      return JSON.parse(text) as OpenAPISpec;
    }
  } else {
    // Read from local file
    const file = Bun.file(url);
    if (!(await file.exists())) {
      throw new Error(`OpenAPI spec file not found: ${url}`);
    }

    // Parse based on file extension
    if (url.endsWith(".yaml") || url.endsWith(".yml")) {
      const text = await file.text();
      return parseYaml(text) as OpenAPISpec;
    } else {
      return (await file.json()) as OpenAPISpec;
    }
  }
}

function parseYaml(yamlText: string): any {
  return yaml.load(yamlText);
}

function generateTemplates(spec: OpenAPISpec): Template[] {
  const templates: Template[] = [];

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!isValidHttpMethod(method)) continue;

      const template = generateTemplate(path, method.toUpperCase(), operation);
      templates.push(template);
    }
  }

  return templates;
}

interface Template {
  filename: string;
  content: string;
}

function generateTemplate(
  path: string,
  method: string,
  operation: OpenAPIOperation,
): Template {
  // Create folder structure based on path and use method as filename
  const filename = generateFilePath(path, method);

  // Generate input schema (request body)
  const inputSchema = generateInputSchema(operation);

  // Generate query schema (query parameters)
  const querySchema = generateQuerySchema(operation);

  // Generate output schema (response)
  const outputSchema = generateOutputSchema(operation);

  const content = `import { z } from "zod";

export const inputSchema = ${inputSchema};

export const querySchema = ${querySchema};

export const outputSchema = ${outputSchema};

export const method = "${method}";

export const path = "${path}";

export function render(data: Partial<z.infer<typeof inputSchema> & z.infer<typeof querySchema>>): {
  input: z.infer<typeof inputSchema>;
  query: z.infer<typeof querySchema>;
} {
  return {
    input: inputSchema.parse(data),
    query: querySchema.parse(data),
  };
}
`;

  return { filename, content };
}

function generateInputSchema(operation: OpenAPIOperation): string {
  // Get request body schema
  const requestBody = operation.requestBody;
  if (!requestBody || !requestBody.content) {
    return "z.never()";
  }

  // Try to get JSON content first, then any other content type
  const contentTypes = Object.keys(requestBody.content);
  const jsonContent = requestBody.content["application/json"];
  const content = jsonContent || requestBody.content[contentTypes[0]!];

  if (!content || !content.schema) {
    return "z.never()";
  }

  // For now, return a simple z.any() - we can improve this later with proper schema conversion
  return "z.any()";
}

function generateQuerySchema(operation: OpenAPIOperation): string {
  const queryParams =
    operation.parameters?.filter((p) => p.in === "query") || [];

  if (queryParams.length === 0) {
    return "z.object({})";
  }

  // Create a simple object schema for query parameters
  const schemaFields = queryParams
    .map((param) => {
      const isRequired = param.required || false;
      return `${param.name}: z.string()${isRequired ? "" : ".optional()"}`;
    })
    .join(", ");

  return `z.object({ ${schemaFields} })`;
}

function generateOutputSchema(operation: OpenAPIOperation): string {
  // Get successful response schema (200, 201, etc.)
  const successResponse =
    operation.responses["200"] ||
    operation.responses["201"] ||
    operation.responses["202"] ||
    Object.values(operation.responses).find((r) =>
      r.description?.toLowerCase().includes("success"),
    );

  if (!successResponse || !successResponse.content) {
    return "z.never()";
  }

  // Try to get JSON content first, then any other content type
  const contentTypes = Object.keys(successResponse.content);
  const jsonContent = successResponse.content["application/json"];
  const content = jsonContent || successResponse.content[contentTypes[0]!];

  if (!content || !content.schema) {
    return "z.never()";
  }

  // For now, return a simple z.any() - we can improve this later with proper schema conversion
  return "z.any()";
}

function generateFilePath(path: string, method: string): string {
  // Convert API path to folder structure
  // e.g., "/v1/chat/completions" -> "v1/chat/completions/post.ts"
  // e.g., "/pet/{petId}" -> "pet/{petId}/get.ts"

  let cleanPath = path
    .replace(/^\/+/, "") // Remove leading slashes
    .replace(/\/+$/, "") // Remove trailing slashes
    .replace(/\/+/g, "/"); // Collapse multiple slashes

  // If path is empty (root), use "root"
  if (!cleanPath) {
    cleanPath = "root";
  }

  // Add method as filename
  return `${cleanPath}/${method.toLowerCase()}.ts`;
}
function isValidHttpMethod(method: string): boolean {
  const validMethods = [
    "get",
    "post",
    "put",
    "delete",
    "patch",
    "head",
    "options",
  ];
  return validMethods.includes(method.toLowerCase());
}

async function writeTemplatesToDisk(
  apiName: string,
  templates: Template[],
): Promise<void> {
  const templatesDir = `.rekku/apis/${apiName}/templates`;

  // Create templates directory
  await Bun.write(Bun.file(`${templatesDir}/.gitkeep`), "");

  // Write each template
  for (const template of templates) {
    const filePath = `${templatesDir}/${template.filename}`;
    await Bun.write(Bun.file(filePath), template.content);
  }
}
