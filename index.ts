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
  console.log(
    "  dump <url>              Make HTTP request and dump response to stdout",
  );
  console.log("  api create <name> <url> Create API from OpenAPI schema");
  console.log("");
  console.log("Options for dump command:");
  console.log(
    "  --method <METHOD>                HTTP method (GET, POST, etc.)",
  );
  console.log("  --json <JSON_STRING>             Send JSON body");
  console.log("  --text <TEXT_STRING>             Send text body");
  console.log("  --template/-t <TEMPLATE_PATH>    Use template file");
  console.log(
    "  --api/-a <API_NAME>              Use API template (requires --template/-t)",
  );
  console.log("  --template-data/-d <JSON_DATA>   Data for template rendering");
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
    switch (args.command) {
      case "dump":
        await handleDumpCommand(args);
        break;
      case "api":
        await handleApiCommand(args);
        break;
      default:
        throw new Error(`Unknown command: ${args.command}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Invalid arguments:", error.flatten());
      console.error(
        "Usage: rekku dump <url> [--json <string> | --text <string> | --template/-t <path> [--template-data/-d <json>]]",
      );
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
    );

    // Use template's method and path
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

    // Append template path to URL
    if (templateResult.path) {
      // Clean up slashes: remove trailing slashes from base, leading slashes from path
      const baseUrl = args.url.replace(/\/+$/, "");
      const path = templateResult.path.replace(/^\/+/, "");
      finalUrl = `${baseUrl}/${path}`;
    }

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
    // Create the base directory
    await Bun.write(Bun.file(`${apiPath}/.gitkeep`), "");
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
