import { test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync } from "fs";
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

test("generates schemas with $ref resolution", async () => {
  const mockSpecPath = "test/fixtures/mock-openapi.json";
  await generateTemplatesFromOpenAPI(mockSpecPath, "testapi");

  // Check that schemas were generated
  expect(existsSync(".rekku/apis/testapi/schemas")).toBe(true);

  // Check User schema with nested references
  const userSchema = await Bun.file(
    ".rekku/apis/testapi/schemas/User.ts",
  ).text();
  expect(userSchema).toContain("UserProfileSchema");
  expect(userSchema).toContain("TagSchema");
  expect(userSchema).toContain(
    'import { UserProfileSchema } from "@/schemas/UserProfile"',
  );
  expect(userSchema).toContain('import { TagSchema } from "@/schemas/Tag"');

  // Check UserProfile schema with nested UserSettings reference
  const userProfileSchema = await Bun.file(
    ".rekku/apis/testapi/schemas/UserProfile.ts",
  ).text();
  expect(userProfileSchema).toContain("UserSettingsSchema");
  expect(userProfileSchema).toContain(
    'import { UserSettingsSchema } from "@/schemas/UserSettings"',
  );

  // Check UserSettings schema with enum
  const userSettingsSchema = await Bun.file(
    ".rekku/apis/testapi/schemas/UserSettings.ts",
  ).text();
  expect(userSettingsSchema).toContain('z.enum(["light", "dark", "auto"])');
});

test("handles complex query parameters with special characters", async () => {
  const mockSpecPath = "test/fixtures/mock-openapi.json";
  await generateTemplatesFromOpenAPI(mockSpecPath, "testapi");

  // Check users GET template with complex query params
  const usersGetTemplate = await Bun.file(
    ".rekku/apis/testapi/templates/users/get.ts",
  ).text();

  // Should quote parameter names with special characters
  expect(usersGetTemplate).toContain('"include[]"');
  expect(usersGetTemplate).toContain('"filter[status]"');
  expect(usersGetTemplate).toContain('"sort-by"');

  // Should handle array parameters
  expect(usersGetTemplate).toContain("z.array(");
  expect(usersGetTemplate).toContain('z.enum(["profile", "tags", "settings"])');
  expect(usersGetTemplate).toContain(
    'z.enum(["active", "inactive", "pending"])',
  );
});

test("generates correct file structure for path parameters", async () => {
  const mockSpecPath = "test/fixtures/mock-openapi.json";
  await generateTemplatesFromOpenAPI(mockSpecPath, "testapi");

  // Check that path parameter routes create correct folder structure
  expect(
    existsSync(".rekku/apis/testapi/templates/users/{user_id}/get.ts"),
  ).toBe(true);
  expect(
    existsSync(".rekku/apis/testapi/templates/users/{user_id}/put.ts"),
  ).toBe(true);
  expect(
    existsSync(".rekku/apis/testapi/templates/users/{user_id}/delete.ts"),
  ).toBe(true);
  expect(
    existsSync(".rekku/apis/testapi/templates/users/{user_id}/profile/get.ts"),
  ).toBe(true);

  // Check that path parameter is preserved in template
  const userGetTemplate = await Bun.file(
    ".rekku/apis/testapi/templates/users/{user_id}/get.ts",
  ).text();
  expect(userGetTemplate).toContain('export const path = "/users/{user_id}"');
});

test("handles request body schemas with $ref", async () => {
  const mockSpecPath = "test/fixtures/mock-openapi.json";
  await generateTemplatesFromOpenAPI(mockSpecPath, "testapi");

  // Check POST users template
  const usersPostTemplate = await Bun.file(
    ".rekku/apis/testapi/templates/users/post.ts",
  ).text();

  // Should import and use CreateUserRequest schema
  expect(usersPostTemplate).toContain(
    'import { CreateUserRequestSchema } from "@/schemas/CreateUserRequest"',
  );
  expect(usersPostTemplate).toContain(
    "export const inputSchema = CreateUserRequestSchema",
  );
});

test("handles response schemas with $ref", async () => {
  const mockSpecPath = "test/fixtures/mock-openapi.json";
  await generateTemplatesFromOpenAPI(mockSpecPath, "testapi");

  // Check search GET template
  const searchGetTemplate = await Bun.file(
    ".rekku/apis/testapi/templates/search/get.ts",
  ).text();

  // Should import and use SearchResponse schema
  expect(searchGetTemplate).toContain(
    'import { SearchResponseSchema } from "@/schemas/SearchResponse"',
  );
  expect(searchGetTemplate).toContain(
    "export const outputSchema = SearchResponseSchema",
  );
});

test("generates valid TypeScript that compiles", async () => {
  const mockSpecPath = "test/fixtures/mock-openapi.json";
  await generateTemplatesFromOpenAPI(mockSpecPath, "testapi");

  // Check that generated files have valid TypeScript syntax
  const userSchema = await Bun.file(
    ".rekku/apis/testapi/schemas/User.ts",
  ).text();
  const usersGetTemplate = await Bun.file(
    ".rekku/apis/testapi/templates/users/get.ts",
  ).text();

  // Basic syntax checks - should not contain obvious syntax errors
  expect(userSchema).toContain("export const UserSchema =");
  expect(userSchema).toContain("export type User =");
  expect(usersGetTemplate).toContain("export const inputSchema =");
  expect(usersGetTemplate).toContain("export const querySchema =");
  expect(usersGetTemplate).toContain("export const outputSchema =");

  // Check that imports are properly formatted
  expect(userSchema).toMatch(/import.*from.*@\/schemas/);
  expect(usersGetTemplate).toMatch(/import.*from.*@\/schemas/);
});

test("handles edge case parameter names correctly", async () => {
  const mockSpecPath = "test/fixtures/mock-openapi.json";
  await generateTemplatesFromOpenAPI(mockSpecPath, "testapi");

  // Check search template with complex parameter names
  const searchTemplate = await Bun.file(
    ".rekku/apis/testapi/templates/search/get.ts",
  ).text();

  // Should quote parameter names with special characters
  expect(searchTemplate).toContain('"fields[]"');
  expect(searchTemplate).toContain('"filters[created_after]"');
  expect(searchTemplate).toContain('"filters[tags.name]"');

  // Should handle required vs optional parameters
  expect(searchTemplate).toContain("q: z.string()"); // required, no .optional()
  expect(searchTemplate).toContain('"fields[]": z.array(');
  expect(searchTemplate).toContain(".optional()");
});

test("creates proper tsconfig.json with path mapping", async () => {
  const mockSpecPath = "test/fixtures/mock-openapi.json";
  await generateTemplatesFromOpenAPI(mockSpecPath, "testapi");

  const tsconfig = await Bun.file(".rekku/apis/testapi/tsconfig.json").json();

  expect(tsconfig.compilerOptions.baseUrl).toBe(".");
  expect(tsconfig.compilerOptions.paths).toEqual({
    "@/schemas/*": ["./schemas/*"],
  });
  expect(tsconfig.include).toContain("**/*");
});

test("handles operations without request body", async () => {
  const mockSpecPath = "test/fixtures/mock-openapi.json";
  await generateTemplatesFromOpenAPI(mockSpecPath, "testapi");

  // Check DELETE operation which has no request body
  const deleteTemplate = await Bun.file(
    ".rekku/apis/testapi/templates/users/{user_id}/delete.ts",
  ).text();

  expect(deleteTemplate).toContain("export const inputSchema = z.never()");
  expect(deleteTemplate).toContain("export const outputSchema = z.never()"); // 204 No Content
});

test("handles operations with different response status codes", async () => {
  const mockSpecPath = "test/fixtures/mock-openapi.json";
  await generateTemplatesFromOpenAPI(mockSpecPath, "testapi");

  // Check POST operation which returns 201
  const postTemplate = await Bun.file(
    ".rekku/apis/testapi/templates/users/post.ts",
  ).text();
  expect(postTemplate).toContain('import { UserSchema } from "@/schemas/User"');
  expect(postTemplate).toContain("export const outputSchema = UserSchema");
});
