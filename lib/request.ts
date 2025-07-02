import { z } from "zod";

// Define a schema for the request options
const RequestOptionsSchema = z.object({
  method: z
    .enum(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
    .optional(),
  headers: z.record(z.string()).optional(),
  body: z
    .union([
      z.string(),
      z.instanceof(ReadableStream),
      z.instanceof(Blob),
      z.instanceof(ArrayBuffer),
      z.instanceof(FormData),
      z.instanceof(URLSearchParams),
    ])
    .optional(),
  // Add other fetch options as needed
});

export type RequestOptions = z.infer<typeof RequestOptionsSchema>;

export async function request(
  url: string,
  options?: RequestOptions
): Promise<ReadableStream<Uint8Array>> {
  const validatedOptions = RequestOptionsSchema.parse(options);

  const response = await fetch(url, validatedOptions);

  if (!response.ok) {
    console.error(
      `Error making request to ${url}:`,
      validatedOptions,
      response.status,
      response.statusText
    );
    throw new Error(
      `HTTP error! Status: ${response.status} ${response.statusText}`
    );
  }

  if (!response.body) {
    throw new Error("Response body is null");
  }

  return response.body;
}
