// Test setup file
import { beforeEach, afterEach } from "bun:test";
import { rmSync, existsSync } from "fs";

// Clean up test artifacts before and after each test
beforeEach(() => {
  cleanupTestArtifacts();
});

afterEach(() => {
  cleanupTestArtifacts();
});

function cleanupTestArtifacts() {
  const testDirs = [".rekku", "test/.rekku", "test/fixtures/.rekku"];

  for (const dir of testDirs) {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}

export { cleanupTestArtifacts };
