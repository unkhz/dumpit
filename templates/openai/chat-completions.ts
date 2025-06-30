import { z } from "zod";

const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]).default("user"),
  content: z.string(),
  name: z.string().optional(),
  tool_calls: z.array(z.any()).optional(),
  tool_call_id: z.string().optional(),
});

const ResponseFormatSchema = z.object({
  type: z.enum(["text", "json_object"]),
});

export const schema = z.object({
  model: z.string().optional(),
  messages: z.array(MessageSchema),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().positive().optional(),
  top_p: z.number().min(0).max(1).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  stream: z.boolean().default(true),
  tools: z.array(z.any()).optional(),
  tool_choice: z.union([z.string(), z.object({})]).optional(),
  user: z.string().optional(),
  response_format: ResponseFormatSchema.optional(),
  seed: z.number().optional(),
});

export type ChatCompletionData = z.infer<typeof schema>;

export const path = "chat/completions";

export function render(data: Partial<ChatCompletionData>): ChatCompletionData {
  return schema.parse(data);
}
