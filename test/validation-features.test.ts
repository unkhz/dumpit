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

test("generates enhanced validation features", async () => {
  const mockSpecPath = "test/fixtures/mock-openapi.json";
  await generateTemplatesFromOpenAPI(mockSpecPath, "testapi");

  // Check that ValidationTestSchema was generated
  expect(
    existsSync(".rekku/apis/testapi/schemas/ValidationTestSchema.ts"),
  ).toBe(true);

  const validationSchema = await Bun.file(
    ".rekku/apis/testapi/schemas/ValidationTestSchema.ts",
  ).text();

  // Test string format validation
  expect(validationSchema).toContain(".email()");
  expect(validationSchema).toContain(".datetime()");
  expect(validationSchema).toContain(".date()");
  expect(validationSchema).toContain(".url()");
  expect(validationSchema).toContain(".uuid()");

  // Test string constraints
  expect(validationSchema).toContain(".min(3)");
  expect(validationSchema).toContain(".max(50)");
  expect(validationSchema).toContain(".regex(new RegExp(");

  // Test number constraints
  expect(validationSchema).toContain(".gte(0)");
  expect(validationSchema).toContain(".lte(1000)");
  expect(validationSchema).toContain(".int()");
  expect(validationSchema).toContain("val % 0.1 === 0");

  // Test array constraints
  expect(validationSchema).toContain(".min(1)");
  expect(validationSchema).toContain(".max(5)");
  expect(validationSchema).toContain("Array items must be unique");

  // Test nullable types
  expect(validationSchema).toContain(".nullable()");

  // Test union types
  expect(validationSchema).toContain("z.union([");

  // Test enum validation
  expect(validationSchema).toContain(
    'z.enum(["option1", "option2", "option3"])',
  );

  // Test object additional properties
  expect(validationSchema).toContain(".strict()");
  expect(validationSchema).toContain(".passthrough()");
  expect(validationSchema).toContain(".catchall(");
});

test("generates enhanced User schema with new validation features", async () => {
  const mockSpecPath = "test/fixtures/mock-openapi.json";
  await generateTemplatesFromOpenAPI(mockSpecPath, "testapi");

  const userSchema = await Bun.file(
    ".rekku/apis/testapi/schemas/User.ts",
  ).text();

  // Test enhanced User schema features
  expect(userSchema).toContain("z.string().uuid()"); // id field
  expect(userSchema).toContain("z.string().min(1).max(100)"); // name field
  expect(userSchema).toContain("z.string().email()"); // email field
  expect(userSchema).toContain("z.string().regex(new RegExp("); // phone field
  expect(userSchema).toContain("z.number().int().gte(0).lte(150)"); // age field
  expect(userSchema).toContain("val % 0.5 === 0"); // score field
  expect(userSchema).toContain("z.union(["); // status field (oneOf)
  expect(userSchema).toContain("Array items must be unique"); // tags array
  expect(userSchema).toContain("z.string().datetime()"); // created_at
  expect(userSchema).toContain("z.string().date()"); // birth_date
  expect(userSchema).toContain("z.string().url()"); // website
});

test("generates validation-test endpoint template", async () => {
  const mockSpecPath = "test/fixtures/mock-openapi.json";
  await generateTemplatesFromOpenAPI(mockSpecPath, "testapi");

  // Check that validation-test template was generated
  expect(
    existsSync(".rekku/apis/testapi/templates/validation-test/post.ts"),
  ).toBe(true);

  const template = await Bun.file(
    ".rekku/apis/testapi/templates/validation-test/post.ts",
  ).text();

  expect(template).toContain("ValidationTestSchemaSchema");
  expect(template).toContain(
    'import { ValidationTestSchemaSchema } from "@/schemas/ValidationTestSchema"',
  );
  expect(template).toContain('export const path = "/validation-test"');
  expect(template).toContain('export const method = "POST"');
});
