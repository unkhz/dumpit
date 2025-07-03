// Mock implementation of lib/request.ts for testing
import type { RequestOptions } from "../../lib/request";

export interface MockRequestCall {
  url: string;
  options?: RequestOptions;
}

export class MockRequest {
  private static calls: MockRequestCall[] = [];
  private static responses: Map<string, any> = new Map();

  static reset() {
    this.calls = [];
    this.responses.clear();
  }

  static getCalls(): MockRequestCall[] {
    return [...this.calls];
  }

  static setResponse(url: string, response: any) {
    this.responses.set(url, response);
  }

  static async request(
    url: string,
    options?: RequestOptions,
  ): Promise<ReadableStream> {
    this.calls.push({ url, options });

    const response = this.responses.get(url) || { success: true };
    const responseText = JSON.stringify(response);

    // Create a mock ReadableStream
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(responseText));
        controller.close();
      },
    });

    return stream;
  }
}

// Export the mock function
export const request = MockRequest.request.bind(MockRequest);
