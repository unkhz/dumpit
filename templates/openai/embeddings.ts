import { z } from "zod";

export const schema = z.object({
  model: z.string().default("text-embedding-ada-002"),
  input: z.union([z.string(), z.array(z.string())]),
  user: z.string().optional(),
  encoding_format: z.enum(["float", "base64"]).optional(),
  dimensions: z.number().positive().optional(),
});

export type EmbeddingData = z.infer<typeof schema>;

export const path = "embeddings";

export function render(data: Partial<EmbeddingData>): EmbeddingData {
  return schema.parse(data);
}
