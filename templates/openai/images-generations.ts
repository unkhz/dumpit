import { z } from "zod";

export const schema = z.object({
  model: z.string().default("dall-e-3"),
  prompt: z.string(),
  n: z.number().min(1).max(10).optional(),
  quality: z.enum(["standard", "hd"]).optional(),
  response_format: z.enum(["url", "b64_json"]).optional(),
  size: z
    .enum(["256x256", "512x512", "1024x1024", "1792x1024", "1024x1792"])
    .optional(),
  style: z.enum(["vivid", "natural"]).optional(),
  user: z.string().optional(),
});

export type ImageGenerationData = z.infer<typeof schema>;

export const path = "images/generations";

export function render(
  data: Partial<ImageGenerationData>,
): ImageGenerationData {
  return schema.parse(data);
}
