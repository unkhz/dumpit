import { z } from "zod";
import { parseArgs } from "./lib/args";
import { request, type RequestOptions } from "./lib/request";
import { dumpStreamToStdout } from "./lib/dump";
import { renderTemplate } from "./lib/template";

function showUsage() {
  console.log("Usage: rekku <command> [options...]");
  console.log("");
  console.log("Commands:");
  console.log("  dump <url>    Make HTTP request and dump response to stdout");
  console.log("");
  console.log("Options for dump command:");
  console.log(
    "  --method <METHOD>                HTTP method (GET, POST, etc.)",
  );
  console.log("  --json <JSON_STRING>             Send JSON body");
  console.log("  --text <TEXT_STRING>             Send text body");
  console.log(
    "  --template/-t <TEMPLATE_NAME>    Use template from templates/",
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

async function handleDumpCommand(args: ReturnType<typeof parseArgs>) {
  const requestOptions: RequestOptions = {
    method: args.method,
  };

  let finalUrl = args.url;

  if (args.template) {
    const templateResult = await renderTemplate(
      args.template,
      args.templateData,
    );
    requestOptions.body = templateResult.body;
    requestOptions.headers = { "Content-Type": "application/json" };

    // Append template path to URL if provided
    if (templateResult.path) {
      // Clean up slashes: remove trailing slashes from base, leading slashes from path
      const baseUrl = args.url.replace(/\/+$/, "");
      const path = templateResult.path.replace(/^\/+/, "");
      finalUrl = `${baseUrl}/${path}`;
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

main();
