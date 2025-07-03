import { test, expect, beforeEach, afterEach } from "bun:test";
import { generateTemplatesFromOpenAPI } from "../lib/api-modules/openapi";
import { cleanupTestArtifacts } from "./setup";

// Override global fetch for testing
const originalFetch = global.fetch;
beforeEach(() => {
  (global as any).fetch = async (url: string | URL) => {
    const urlStr = url.toString();
    if (urlStr.includes("mock-openapi.json")) {
      const mockSpec = await Bun.file("test/fixtures/mock-openapi.json").text();
      return new Response(mockSpec, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`Unexpected URL: ${urlStr}`);
  };
});

afterEach(() => {
  global.fetch = originalFetch;
  cleanupTestArtifacts();
});

test("generates expected file structure", async () => {
  const mockSpecPath = "test/fixtures/mock-openapi.json";
  await generateTemplatesFromOpenAPI(mockSpecPath, "testapi");

  // Test directory structure
  const { readdirSync, statSync } = require("fs");

  function getDirectoryStructure(dirPath: string, basePath = ""): any {
    const items = readdirSync(dirPath);
    const structure: any = {};

    for (const item of items) {
      const fullPath = `${dirPath}/${item}`;
      const relativePath = basePath ? `${basePath}/${item}` : item;

      if (statSync(fullPath).isDirectory()) {
        structure[item] = getDirectoryStructure(fullPath, relativePath);
      } else {
        structure[item] = "file";
      }
    }

    return structure;
  }

  const structure = getDirectoryStructure(".rekku/apis/testapi");

  // Snapshot the directory structure
  expect(structure).toEqual({
    schemas: {
      "CreateUserRequest.ts": "file",
      "SearchResponse.ts": "file",
      "Tag.ts": "file",
      "User.ts": "file",
      "UserProfile.ts": "file",
      "UserSettings.ts": "file",
      ".gitkeep": "file",
    },
    templates: {
      search: {
        "get.ts": "file",
        ".gitkeep": "file",
      },
      users: {
        "get.ts": "file",
        "post.ts": "file",
        "{user_id}": {
          "delete.ts": "file",
          "get.ts": "file",
          "put.ts": "file",
          profile: {
            "get.ts": "file",
            ".gitkeep": "file",
          },
          ".gitkeep": "file",
        },
        ".gitkeep": "file",
      },
      ".gitkeep": "file",
    },
    "tsconfig.json": "file",
  });
});

test("generates expected schema content", async () => {
  const mockSpecPath = "test/fixtures/mock-openapi.json";
  await generateTemplatesFromOpenAPI(mockSpecPath, "testapi");

  // Test User schema content
  const userSchema = await Bun.file(
    ".rekku/apis/testapi/schemas/User.ts",
  ).text();

  // Normalize whitespace for comparison
  const normalizedUserSchema = userSchema.replace(/\s+/g, " ").trim();

  expect(normalizedUserSchema).toContain('import { z } from "zod"');
  expect(normalizedUserSchema).toContain(
    'import { UserProfileSchema } from "@/schemas/UserProfile"',
  );
  expect(normalizedUserSchema).toContain(
    'import { TagSchema } from "@/schemas/Tag"',
  );
  expect(normalizedUserSchema).toContain(
    "export const UserSchema = z.object({",
  );
  expect(normalizedUserSchema).toContain("id: z.string()");
  expect(normalizedUserSchema).toContain("name: z.string()");
  expect(normalizedUserSchema).toContain("email: z.string().optional()");
  expect(normalizedUserSchema).toContain(
    "profile: UserProfileSchema.optional()",
  );
  expect(normalizedUserSchema).toContain("tags: z.array(TagSchema).optional()");
  expect(normalizedUserSchema).toContain(
    "export type User = z.infer<typeof UserSchema>",
  );
});

test("generates expected template content", async () => {
  const mockSpecPath = "test/fixtures/mock-openapi.json";
  await generateTemplatesFromOpenAPI(mockSpecPath, "testapi");

  // Test users GET template content
  const usersGetTemplate = await Bun.file(
    ".rekku/apis/testapi/templates/users/get.ts",
  ).text();

  // Normalize whitespace for comparison
  const normalizedTemplate = usersGetTemplate.replace(/\s+/g, " ").trim();

  expect(normalizedTemplate).toContain('import { z } from "zod"');
  expect(normalizedTemplate).toContain(
    'import { SearchResponseSchema } from "@/schemas/SearchResponse"',
  );
  expect(normalizedTemplate).toContain("export const inputSchema = z.never()");
  expect(normalizedTemplate).toContain("export const querySchema = z.object({");
  expect(normalizedTemplate).toContain(
    '"include[]": z.array(z.enum(["profile", "tags", "settings"])).optional()',
  );
  expect(normalizedTemplate).toContain(
    '"filter[status]": z.enum(["active", "inactive", "pending"]).optional()',
  );
  expect(normalizedTemplate).toContain(
    '"sort-by": z.enum(["name", "created_at", "updated_at"]).optional()',
  );
  expect(normalizedTemplate).toContain(
    "export const outputSchema = SearchResponseSchema",
  );
  expect(normalizedTemplate).toContain('export const method = "GET"');
  expect(normalizedTemplate).toContain('export const path = "/users"');
  expect(normalizedTemplate).toContain("export function render(");
});
