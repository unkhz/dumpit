# dumpit

A command-line tool for making HTTP requests and dumping the response body to stdout.

## Installation

```bash
npm install -g dumpit
```

## Usage

```bash
dumpit <URL> [--method <METHOD>] [--json <string> | --text <string>]
```

- `<URL>`: The URL to make the request to.
- `--method <METHOD>`: (Optional) The HTTP method (e.g., `GET`, `POST`, `PUT`, `DELETE`). If not provided, `POST` is inferred if `--json` or `--text` is used, otherwise `GET`.
- `--json <STRING_BODY>`: (Optional) A JSON string to be sent as the request body. Sets `Content-Type` to `application/json`.
- `--text <STRING_BODY>`: (Optional) A plain text string to be sent as the request body. Sets `Content-Type` to `text/plain`.

## Development Scripts

- `bun run typecheck`: Checks for TypeScript type errors.
- `bun run build`: Builds the project into the `dist/` folder using `bun --compile`.
