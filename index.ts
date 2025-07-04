import { z } from "zod";
import { parseArgs } from "./lib/args";
import { request, type RequestOptions } from "./lib/request";
import { dumpStreamToStdout } from "./lib/dump";
import { renderTemplate } from "./lib/template";
import { generateTemplatesFromOpenAPI } from "./lib/api-modules/openapi";

function showUsage() {
  console.log("Usage: rekku <command> [options...]");
  console.log("");
  console.log("Commands:");
  console.log("  get <url>               Make GET request");
  console.log("  post <url>              Make POST request");
  console.log("  put <url>               Make PUT request");
  console.log("  delete <url>            Make DELETE request");
  console.log("  patch <url>             Make PATCH request");
  console.log("  head <url>              Make HEAD request");
  console.log("  options <url>           Make OPTIONS request");
  console.log("  dump <url>              Make HTTP request (legacy)");
  console.log("  api create <name> <url> Create API from OpenAPI schema");
  console.log("");
  console.log("Options for HTTP commands:");
  console.log("  --json <JSON_STRING>             Send JSON body");
  console.log("  --text <TEXT_STRING>             Send text body");
  console.log("  --template/-t <TEMPLATE_PATH>    Use template file");
  console.log(
    "  --api/-a <API_NAME>              Use API template (requires --template/-t)",
  );
  console.log("  --template-data/-d <JSON_DATA>   Data for template rendering");
  console.log("");
  console.log("Examples:");
  console.log("  rekku get https://api.example.com/users");
  console.log(
    '  rekku post https://api.example.com/users --json \'{"name": "John"}\'',
  );
  console.log(
    '  rekku post https://localhost:1234/v1 -a openai -t chat/completions -d \'{"messages": [{"role": "user", "content": "Hello!"}], "model": "gpt-4"}\'',
  );
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));

    // Check if we should show usage
    if ((args as any)._showUsage) {
      showUsage();
      return;
    }

    // Handle different commands
    const httpMethods = [
      "get",
      "post",
      "put",
      "delete",
      "patch",
      "head",
      "options",
    ];

    if (args.command === "dump" || httpMethods.includes(args.command)) {
      await handleDumpCommand(args);
    } else if (args.command === "api") {
      await handleApiCommand(args);
    } else {
      throw new Error(`Unknown command: ${args.command}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Invalid arguments:", error.flatten());
    } else {
      console.error("An unexpected error occurred:", error);
    }
    process.exit(1);
  }
}

async function handleDumpCommand(args: any) {
  const requestOptions: RequestOptions = {
    method: args.method,
  };

  let finalUrl = args.url;

  if (args.template) {
    const templateResult = await renderTemplate(
      args.template,
      args.templateData,
      args.url,
    );

    // Use template's method
    requestOptions.method = templateResult.method as
      | "GET"
      | "POST"
      | "PUT"
      | "DELETE"
      | "PATCH"
      | "HEAD"
      | "OPTIONS";

    // Set request body from template input
    if (templateResult.input && Object.keys(templateResult.input).length > 0) {
      requestOptions.body = JSON.stringify(templateResult.input);
      requestOptions.headers = { "Content-Type": "application/json" };
    }

    // Use the URL from template (already includes baseUrl + resolved path)
    finalUrl = templateResult.url;

    // Add query parameters from template
    if (templateResult.query && Object.keys(templateResult.query).length > 0) {
      const url = new URL(finalUrl);
      Object.entries(templateResult.query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
      finalUrl = url.toString();
    }
  } else if (args.body) {
    requestOptions.body = args.body;
  }

  if (args.contentType) {
    requestOptions.headers = { "Content-Type": args.contentType };
  }
  const responseStream = await request(finalUrl, requestOptions);
  await dumpStreamToStdout(responseStream);
}

async function handleApiCommand(args: any) {
  switch (args.subcommand) {
    case "create":
      await createApiFromOpenAPI(args.name, args.url);
      break;
    default:
      throw new Error(`Unknown API subcommand: ${args.subcommand}`);
  }
}

async function createApiFromOpenAPI(name: string, url: string) {
  const apiPath = `.rekku/apis/${name}`;

  try {
    console.log(`Created API folder: ${apiPath}`);

    // Generate templates from OpenAPI schema
    console.log(`Generating templates from OpenAPI schema: ${url}`);
    await generateTemplatesFromOpenAPI(url, name);
  } catch (error) {
    console.error(`Failed to create API from OpenAPI schema: ${error}`);
    process.exit(1);
  }
}
main();
