# rekku

A command-line tool for making HTTP requests with TypeScript-based templates for API calls.

## Usage

### Basic HTTP Requests

```bash
bunx rekku <URL> [--method <METHOD>] [--json <string> | --text <string>]
```

- `<URL>`: The URL to make the request to.
- `--method <METHOD>`: (Optional) The HTTP method (e.g., `GET`, `POST`, `PUT`, `DELETE`). If not provided, `POST` is inferred if `--json` or `--text` is used, otherwise `GET`.
- `--json <STRING_BODY>`: (Optional) A JSON string to be sent as the request body. Sets `Content-Type` to `application/json`.
- `--text <STRING_BODY>`: (Optional) A plain text string to be sent as the request body. Sets `Content-Type` to `text/plain`.

### Template-Based Requests

```bash
bunx rekku <BASE_URL> --template <TEMPLATE_NAME> --template-data <JSON_DATA>
```

- `--template <TEMPLATE_NAME>` or `-t <TEMPLATE_NAME>`: Use a TypeScript template from the `templates/` directory.
- `--template-data <JSON_DATA>` or `-d <JSON_DATA>`: JSON data to pass to the template for rendering.

The final URL is constructed by appending the template's path to the base URL.

## Templates

Templates are TypeScript files that export:

- `schema`: A Zod schema for validation
- `path`: The API endpoint path to append to the base URL
- `render`: A function that validates and transforms the input data

### Available Templates

#### OpenAI-Compatible APIs

- `openai/chat-completions`: Chat completions API
- `openai/embeddings`: Text embeddings API
- `openai/images-generations`: DALL-E image generation API

### Examples

```bash
# Chat completion with OpenAI-compatible API
bunx rekku http://localhost:1234 -t openai/chat-completions -d '{
  "messages": [{"role": "user", "content": "Hello!"}],
  "model": "gpt-4"
}'

# Generate embeddings
bunx rekku http://localhost:1234 -t openai/embeddings -d '{
  "input": "Hello world",
  "model": "text-embedding-ada-002"
}'

# Generate images
bunx rekku http://localhost:1234 -t openai/images-generations -d '{
  "prompt": "A sunset over mountains",
  "n": 1,
  "size": "1024x1024"
}'
```

### Creating Custom Templates

Create a new TypeScript file in the `templates/` directory:

```typescript
import { z } from "zod";

export const schema = z.object({
  // Define your API schema here
  message: z.string(),
  count: z.number().default(1),
});

export const path = "api/your-endpoint";

export function render(
  data: Partial<z.infer<typeof schema>>,
): z.infer<typeof schema> {
  return schema.parse(data);
}
```

## Development Scripts

- `bun run typecheck`: Checks for TypeScript type errors.
- `bun run format`: Formats code using Prettier.
- `bun run build`: Builds the project into the `dist/` folder using `bun --compile`.
