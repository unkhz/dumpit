# rekku

A command-line tool for making HTTP requests with TypeScript-based templates for API calls.

## Usage

### HTTP Method Commands

rekku provides dedicated commands for each HTTP method, making it intuitive and concise:

```bash
bunx rekku get <URL>
bunx rekku post <URL> [--json <JSON> | --text <TEXT>]
bunx rekku put <URL> [--json <JSON> | --text <TEXT>]
bunx rekku delete <URL>
bunx rekku patch <URL> [--json <JSON> | --text <TEXT>]
bunx rekku head <URL>
bunx rekku options <URL>
```

#### Basic Examples

```bash
# GET request
bunx rekku get https://api.example.com/users

# POST with JSON data
bunx rekku post https://api.example.com/users --json '{"name": "John", "email": "john@example.com"}'

# PUT with text data
bunx rekku put https://api.example.com/users/123 --text "Updated content"

# DELETE request
bunx rekku delete https://api.example.com/users/123
```

### API Templates

rekku supports powerful API templates that can be generated from OpenAPI specifications and used with the `--api/-a` flag:

```bash
bunx rekku <method> <BASE_URL> --api <API_NAME> --template <TEMPLATE_PATH> [--template-data <JSON_DATA>]
```

#### API Template Examples

```bash
# OpenAI-compatible chat completion
bunx rekku post http://localhost:1234/v1 -a openai -t chat/completions/post -d '{
  "messages": [{"role": "user", "content": "Hello!"}],
  "model": "gpt-4"
}'

# Using a petstore API template
bunx rekku post http://localhost:8080/api/v3 -a petstore -t user/createWithList/post -d '{
  "users": [{"username": "testuser", "email": "test@example.com"}]
}'
```

### Creating APIs from OpenAPI Specifications

Generate API templates from OpenAPI/Swagger specifications:

```bash
bunx rekku api create <API_NAME> <OPENAPI_URL_OR_FILE>
```

This creates a complete set of TypeScript templates in `.rekku/apis/<API_NAME>/templates/` with:

- Type-safe request/response schemas
- Automatic path and method detection
- Zod validation schemas
- TypeScript intellisense support

#### Examples

```bash
# Create API from OpenAPI URL
bunx rekku api create openai https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml

# Create API from local file
bunx rekku api create myapi ./openapi.json
```

### Legacy Dump Command

The original `dump` command is still supported for backward compatibility:

```bash
bunx rekku dump <URL> [--method <METHOD>] [--json <JSON> | --text <TEXT>]
```

## Templates

Templates are TypeScript files generated from OpenAPI specifications that provide type-safe API interactions. Each template exports:

- `inputSchema`: Zod schema for request body validation
- `querySchema`: Zod schema for query parameters validation
- `outputSchema`: Zod schema for response validation
- `method`: HTTP method for the endpoint
- `path`: API endpoint path to append to the base URL
- `render`: Function that validates and transforms input data

### Template Structure

Templates are organized in `.rekku/apis/<API_NAME>/templates/` with a folder structure that mirrors the API paths:

```
.rekku/apis/openai/templates/
├── chat/completions/post.ts
├── embeddings/post.ts
├── images/generations/post.ts
└── models/get.ts
```

### Generated Template Example

```typescript
import { z } from "zod";

export const inputSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    }),
  ),
  model: z.string(),
  temperature: z.number().optional(),
});

export const querySchema = z.object({});

export const outputSchema = z.any();

export const method = "POST";

export const path = "/chat/completions";

export function render(
  data: Partial<z.infer<typeof inputSchema> & z.infer<typeof querySchema>>,
): {
  input: z.infer<typeof inputSchema>;
  query: z.infer<typeof querySchema>;
} {
  return {
    input: inputSchema.parse(data),
    query: querySchema.parse(data),
  };
}
```

### Available APIs

After generating APIs from OpenAPI specs, you can use them with the `--api/-a` flag. Common examples:

- **OpenAI API**: Chat completions, embeddings, image generation
- **Petstore API**: Pet management, store operations, user management
- **Custom APIs**: Any API with an OpenAPI specification

## Key Features

- **Method-based commands**: Intuitive `get`, `post`, `put`, `delete`, etc. commands
- **OpenAPI integration**: Generate type-safe templates from OpenAPI specifications
- **Type safety**: Full TypeScript support with Zod validation
- **Template system**: Reusable, validated API call templates
- **Auto-completion**: TypeScript intellisense for API schemas
- **Schema validation**: Request/response validation with detailed error messages
- **Flexible data input**: Support for JSON, text, and template-based data
- **Modern CLI**: Built with Bun for fast performance

## Project Structure

```
rekku/
├── lib/
│   ├── api-modules/
│   │   └── openapi.ts          # OpenAPI spec processing
│   ├── args.ts                 # Command-line argument parsing
│   ├── template.ts             # Template loading and rendering
│   ├── request.ts              # HTTP request handling
│   └── dump.ts                 # Response output formatting
├── .rekku/
│   └── apis/
│       ├── openai/             # Generated OpenAI API templates
│       └── petstore/           # Generated Petstore API templates
└── index.ts                    # Main CLI entry point
```

## Development

### Prerequisites

- [Bun](https://bun.sh/) runtime

### Scripts

- `bun run typecheck`: Checks for TypeScript type errors
- `bun run format`: Formats code using Prettier
- `bun run build`: Builds the project into the `dist/` folder using `bun --compile`

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `bun run typecheck` and `bun run format`
5. Submit a pull request
