export async function dumpStreamToStdout(
  stream: ReadableStream<Uint8Array>,
): Promise<void> {
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    process.stdout.write(value);
  }
}
