import { z } from "zod";
import { parseArgs } from "./lib/args";
import { request, type RequestOptions } from "./lib/request";
import { dumpStreamToStdout } from "./lib/dump";
import { renderTemplate } from "./lib/template";

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));

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
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Invalid arguments:", error.flatten());
      console.error(
        "Usage: rekku <url> [--json <string> | --text <string> | --template <path> [--template-data <json>]]",
      );
    } else {
      console.error("An unexpected error occurred:", error);
    }
    process.exit(1);
  }
}

main();
