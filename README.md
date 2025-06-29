# dumpit

A command-line tool for making HTTP requests and dumping the response body to stdout.

## Usage

```bash
bun run index.ts <METHOD> <URL> [--json <string> | --text <string>]
```

- `<METHOD>`: The HTTP method (e.g., `GET`, `POST`, `PUT`, `DELETE`).
- `<URL>`: The URL to make the request to.
- `--json <STRING_BODY>`: (Optional) A JSON string to be sent as the request body. Sets `Content-Type` to `application/json`.
- `--text <STRING_BODY>`: (Optional) A plain text string to be sent as the request body. Sets `Content-Type` to `text/plain`.

## Development Scripts

- `bun run typecheck`: Checks for TypeScript type errors.
- `bun run build`: Builds the project into the `dist/` folder using `bun --compile`.
