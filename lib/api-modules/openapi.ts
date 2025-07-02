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

interface Template {
  filename: string;
  content: string;
}

interface SchemaResult {
  schema: string;
  imports: string[];
}

export async function generateTemplatesFromOpenAPI(
  url: string,
  apiName: string,
): Promise<void> {
  try {
    // Fetch OpenAPI spec
    const spec = await fetchOpenAPISpec(url);

    // Create tsconfig.json for path mapping
    await createTsConfig(apiName);

    // Extract and write schemas first
    const schemas = await extractAndWriteSchemas(apiName, spec);

    // Generate templates for each operation
    const templates = generateTemplates(spec, schemas);

    // Write templates to disk
    await writeTemplatesToDisk(apiName, templates);

    console.log(
      `Generated ${templates.length} templates and ${Object.keys(schemas).length} schemas for API: ${apiName}`,
    );
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

async function createTsConfig(apiName: string): Promise<void> {
  const apiDir = `.rekku/apis/${apiName}`;
  const tsconfigPath = `${apiDir}/tsconfig.json`;

  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      allowImportingTsExtensions: true,
      noEmit: true,
      strict: true,
      baseUrl: ".",
      paths: {
        "@/schemas/*": ["./schemas/*"],
      },
    },
    include: ["**/*"],
    exclude: ["node_modules"],
  };

  await Bun.write(Bun.file(tsconfigPath), JSON.stringify(tsconfig, null, 2));
}

async function extractAndWriteSchemas(
  apiName: string,
  spec: OpenAPISpec,
): Promise<Record<string, string>> {
  const schemas: Record<string, string> = {};

  if (!spec.components?.schemas) {
    return schemas;
  }

  const schemasDir = `.rekku/apis/${apiName}/schemas`;

  // Create schemas directory
  await Bun.write(Bun.file(`${schemasDir}/.gitkeep`), "");

  // Process each schema
  for (const [schemaName, schemaDefinition] of Object.entries(
    spec.components.schemas,
  )) {
    const referencedSchemas = new Set<string>();
    const zodSchema = convertJsonSchemaToZod(
      schemaDefinition,
      referencedSchemas,
    );
    const filename = `${schemaName}.ts`;
    const filePath = `${schemasDir}/${filename}`;

    // Generate imports for referenced schemas
    const imports = Array.from(referencedSchemas)
      .filter((ref) => ref !== schemaName) // Don't import self
      .map((ref) => `import { ${ref}Schema } from "@/schemas/${ref}";`)
      .join("\n");

    const content = `import { z } from "zod";
${imports ? imports + "\n" : ""}
export const ${schemaName}Schema = ${zodSchema};

export type ${schemaName} = z.infer<typeof ${schemaName}Schema>;
`;

    await Bun.write(Bun.file(filePath), content);
    schemas[schemaName] = `${schemaName}Schema`;
  }

  return schemas;
}

function convertJsonSchemaToZod(
  schema: any,
  collectedRefs?: Set<string>,
): string {
  // Simple JSON Schema to Zod conversion
  if (!schema || typeof schema !== "object") {
    return "z.any()";
  }

  if (schema.$ref) {
    // Handle references - extract schema name from $ref
    const refParts = schema.$ref.split("/");
    const schemaName = refParts[refParts.length - 1];
    if (collectedRefs) {
      collectedRefs.add(schemaName);
    }
    return `${schemaName}Schema`;
  }

  switch (schema.type) {
    case "string":
      if (schema.enum) {
        const enumValues = schema.enum.map((v: string) => `"${v}"`).join(", ");
        return `z.enum([${enumValues}])`;
      }
      return "z.string()";

    case "number":
    case "integer":
      return "z.number()";

    case "boolean":
      return "z.boolean()";

    case "array":
      if (schema.items) {
        const itemSchema = convertJsonSchemaToZod(schema.items, collectedRefs);
        return `z.array(${itemSchema})`;
      }
      return "z.array(z.any())";

    case "object":
      if (schema.properties) {
        const properties = Object.entries(schema.properties)
          .map(([key, value]: [string, any]) => {
            const propSchema = convertJsonSchemaToZod(value, collectedRefs);
            const isRequired = schema.required?.includes(key);
            return `${key}: ${propSchema}${isRequired ? "" : ".optional()"}`;
          })
          .join(", ");
        return `z.object({ ${properties} })`;
      }
      return "z.object({})";

    default:
      return "z.any()";
  }
}

function generateTemplates(
  spec: OpenAPISpec,
  schemas: Record<string, string>,
): Template[] {
  const templates: Template[] = [];

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!isValidHttpMethod(method)) continue;

      const template = generateTemplate(
        path,
        method.toUpperCase(),
        operation,
        spec,
        schemas,
      );
      templates.push(template);
    }
  }

  return templates;
}

function generateTemplate(
  path: string,
  method: string,
  operation: OpenAPIOperation,
  spec: OpenAPISpec,
  schemas: Record<string, string>,
): Template {
  // Create folder structure based on path and use method as filename
  const filename = generateFilePath(path, method);

  // Generate input schema (request body)
  const inputSchemaResult = generateInputSchema(operation, schemas);

  // Generate query schema (query parameters)
  const querySchemaResult = generateQuerySchema(operation);

  // Generate output schema (response)
  const outputSchemaResult = generateOutputSchema(operation, schemas);

  // Collect all imports
  const allImports = [
    ...inputSchemaResult.imports,
    ...querySchemaResult.imports,
    ...outputSchemaResult.imports,
  ].filter((imp, index, arr) => arr.indexOf(imp) === index); // Remove duplicates

  const content = `import { z } from "zod";
${allImports.length > 0 ? allImports.join("\n") + "\n" : ""}
export const inputSchema = ${inputSchemaResult.schema};

export const querySchema = ${querySchemaResult.schema};

export const outputSchema = ${outputSchemaResult.schema};

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

function generateInputSchema(
  operation: OpenAPIOperation,
  schemas: Record<string, string>,
): SchemaResult {
  // Get request body schema
  const requestBody = operation.requestBody;
  if (!requestBody || !requestBody.content) {
    return { schema: "z.never()", imports: [] };
  }

  // Try to get JSON content first, then any other content type
  const contentTypes = Object.keys(requestBody.content);
  const jsonContent = requestBody.content["application/json"];
  const content = jsonContent || requestBody.content[contentTypes[0]!];

  if (!content || !content.schema) {
    return { schema: "z.never()", imports: [] };
  }

  return convertSchemaWithImports(content.schema, schemas);
}

function generateQuerySchema(operation: OpenAPIOperation): SchemaResult {
  const queryParams =
    operation.parameters?.filter((p) => p.in === "query") || [];

  if (queryParams.length === 0) {
    return { schema: "z.object({})", imports: [] };
  }

  // Create a simple object schema for query parameters
  const schemaFields = queryParams
    .map((param) => {
      const isRequired = param.required || false;
      const paramSchema = convertJsonSchemaToZod(param.schema);
      return `${param.name}: ${paramSchema}${isRequired ? "" : ".optional()"}`;
    })
    .join(", ");

  return { schema: `z.object({ ${schemaFields} })`, imports: [] };
}

function generateOutputSchema(
  operation: OpenAPIOperation,
  schemas: Record<string, string>,
): SchemaResult {
  // Get successful response schema (200, 201, etc.)
  const successResponse =
    operation.responses["200"] ||
    operation.responses["201"] ||
    operation.responses["202"] ||
    Object.values(operation.responses).find((r) =>
      r.description?.toLowerCase().includes("success"),
    );

  if (!successResponse || !successResponse.content) {
    return { schema: "z.never()", imports: [] };
  }

  // Try to get JSON content first, then any other content type
  const contentTypes = Object.keys(successResponse.content);
  const jsonContent = successResponse.content["application/json"];
  const content = jsonContent || successResponse.content[contentTypes[0]!];

  if (!content || !content.schema) {
    return { schema: "z.never()", imports: [] };
  }

  return convertSchemaWithImports(content.schema, schemas);
}

function convertSchemaWithImports(
  schema: any,
  schemas: Record<string, string>,
): SchemaResult {
  const imports: string[] = [];

  if (schema.$ref) {
    // Handle references - extract schema name from $ref
    const refParts = schema.$ref.split("/");
    const schemaName = refParts[refParts.length - 1];

    if (schemas[schemaName]) {
      imports.push(
        `import { ${schemaName}Schema } from "@/schemas/${schemaName}";`,
      );
      return { schema: `${schemaName}Schema`, imports };
    }
  }

  const referencedSchemas = new Set<string>();
  const zodSchema = convertJsonSchemaToZod(schema, referencedSchemas);

  // Add imports for any referenced schemas found during conversion
  for (const refSchema of referencedSchemas) {
    if (schemas[refSchema]) {
      imports.push(
        `import { ${refSchema}Schema } from "@/schemas/${refSchema}";`,
      );
    }
  }

  return { schema: zodSchema, imports };
}

function generateFilePath(path: string, method: string): string {
  // Convert API path to folder structure
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

    // Create directory structure if it doesn't exist
    const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));
    await Bun.write(Bun.file(`${dirPath}/.gitkeep`), "");

    await Bun.write(Bun.file(filePath), template.content);
  }
}
