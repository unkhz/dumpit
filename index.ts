

import { z } from "zod";
import { parseArgs } from "./lib/args";
import { request, type RequestOptions } from "./lib/request";
import { dumpStreamToStdout } from "./lib/dump";

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));

    const requestOptions: RequestOptions = {
      method: args.method,
    };

    if (args.body) {
      requestOptions.body = args.body;
    }

    if (args.contentType) {
      requestOptions.headers = { "Content-Type": args.contentType };
    }

    const responseStream = await request(args.url, requestOptions);
    await dumpStreamToStdout(responseStream);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Invalid arguments:", error.flatten());
      console.error("Usage: dumpit <url> [--json <string> | --text <string>]");
    } else {
      console.error("An unexpected error occurred:", error);
    }
    process.exit(1);
  }
}

main();
