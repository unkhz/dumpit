# rekku

A command-line HTTP client that generates type-safe API templates from OpenAPI specifications. Think of it as what Postman should have been - a reusable, scriptable, and type-safe way to test and interact with APIs.

## Quick Start

### Installation

```bash
# Use directly with bunx (recommended)
bunx rekku get https://api.github.com/users/octocat

# Or install globally
bun install -g rekku
```

### Basic Usage

Simple HTTP requests with intuitive method-based commands:

```bash
# GET request
bunx rekku get https://api.github.com/users/octocat

# POST with JSON data
bunx rekku post https://api.example.com/users --json '{"name": "John", "email": "john@example.com"}'

# PUT with text data
bunx rekku put https://api.example.com/users/123 --text "Updated content"

# DELETE request
bunx rekku delete https://api.example.com/users/123
```

## Setting Up API Testing in Your Project

### 1. Generate API Templates

Create type-safe templates from your API's OpenAPI specification:

```bash
# In your project directory
bunx rekku api create myapi https://api.example.com/openapi.json

# Or from a local file
bunx rekku api create myapi ./docs/openapi.yaml
```

This creates a `.rekku/` directory in your project with generated TypeScript templates.

### 2. Use Type-Safe API Templates

Once generated, use the templates for type-safe API calls:

```bash
# Use generated templates with validation
bunx rekku post https://api.example.com -a myapi -t users/post -d '{
  "name": "John Doe",
  "email": "john@example.com"
}'

# Templates provide automatic validation and path resolution
bunx rekku get https://api.example.com -a myapi -t users/123/get
```

### 3. Project Structure

After running `rekku api create`, your project will have:

```
your-project/
├── .rekku/
│   └── apis/
│       └── myapi/
│           ├── schemas/          # Generated Zod schemas
│           ├── templates/        # API endpoint templates
│           └── tsconfig.json     # TypeScript configuration
├── package.json
└── ...
```

**Note**: Add `.rekku/` to your `.gitignore` if you prefer to regenerate templates, or commit it to share templates with your team.

## Use Cases

### API Development & Testing

```bash
# Test your API during development
bunx rekku post http://localhost:3000 -a myapi -t auth/login -d '{"email": "test@example.com", "password": "secret"}'

# Validate request/response schemas
bunx rekku get http://localhost:3000 -a myapi -t users/get
```

### Integration Testing

```bash
# Create test scripts using rekku
#!/bin/bash
echo "Testing user creation..."
bunx rekku post $API_BASE_URL -a myapi -t users/post -d '{"name": "Test User", "email": "test@example.com"}'

echo "Testing user retrieval..."
bunx rekku get $API_BASE_URL -a myapi -t users/1/get
```

### Third-Party API Integration

```bash
# Generate templates for external APIs
bunx rekku api create github https://api.github.com/openapi.json
bunx rekku api create stripe https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json

# Use them in your workflow
bunx rekku get https://api.github.com -a github -t repos/owner/repo/get
```

## Command Reference

### HTTP Methods

```bash
bunx rekku get <URL>                    # GET request
bunx rekku post <URL> [options]         # POST request
bunx rekku put <URL> [options]          # PUT request
bunx rekku delete <URL>                 # DELETE request
bunx rekku patch <URL> [options]        # PATCH request
bunx rekku head <URL>                   # HEAD request
bunx rekku options <URL>                # OPTIONS request
```

### API Management

```bash
bunx rekku api create <name> <spec>     # Generate API templates from OpenAPI spec
```

### Options

```bash
--json <JSON_STRING>                    # Send JSON body
--text <TEXT_STRING>                    # Send text body
--api/-a <API_NAME>                     # Use generated API templates
--template/-t <TEMPLATE_PATH>           # Specify template path
--template-data/-d <JSON_DATA>          # Data for template rendering
```

## How It Works

### Generated Templates

Each API endpoint becomes a TypeScript template with:

- **Type-safe schemas**: Zod validation for requests and responses
- **Automatic path resolution**: No need to remember endpoint URLs
- **IntelliSense support**: Auto-completion in your editor
- **Runtime validation**: Catch errors before making requests

### Template Structure

```
.rekku/apis/myapi/
├── schemas/              # Shared Zod schemas
│   ├── User.ts
│   └── CreateUserRequest.ts
├── templates/            # Endpoint templates
│   ├── users/
│   │   ├── get.ts       # GET /users
│   │   ├── post.ts      # POST /users
│   │   └── {id}/
│   │       ├── get.ts   # GET /users/{id}
│   │       └── put.ts   # PUT /users/{id}
└── tsconfig.json        # TypeScript configuration
```

## Why rekku?

### vs. Postman

- **Scriptable**: Use in CI/CD, scripts, and automation
- **Version controlled**: Templates live in your repo
- **Type-safe**: Catch errors before making requests
- **No GUI required**: Perfect for terminal workflows

### vs. curl

- **Type safety**: Automatic validation of requests/responses
- **Reusable**: Generate templates once, use everywhere
- **Less error-prone**: No manual URL construction or JSON formatting
- **Better DX**: IntelliSense and auto-completion

### vs. HTTP files

- **Dynamic**: Generate from OpenAPI specs automatically
- **Validated**: Runtime schema validation
- **Portable**: Works across different editors and environments

## Requirements

- [Bun](https://bun.sh/) runtime
- [TypeScript](https://www.typescriptlang.org/) (peer dependency)
- [Prettier](https://prettier.io/) (peer dependency, optional for code formatting)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `bun run typecheck` and `bun run format`
5. Submit a pull request

## License

MIT
