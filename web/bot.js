/**
 * Calls the given Gemini model with the given image and/or text
 * parts, streaming output (as a generator function).
 */
export async function* streamGemini({
  model = 'gemini-pro', // use 'gemini-pro' for text -> text
  contents = [],
} = {}) {
  try {
    // Send the prompt to the Python backend
    let response = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, contents }),
    });

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    yield* streamResponseChunks(response);
  } catch (error) {
    console.error('Error in streamGemini:', error);
    throw error;
  }
}

/**
 * A helper that streams text output chunks from a fetch() response.
 */
async function* streamResponseChunks(response) {
  let buffer = '';
  const CHUNK_SEPARATOR = '\n\n';

  let processBuffer = async function* (streamDone = false) {
    while (true) {
      let flush = false;
      let chunkSeparatorIndex = buffer.indexOf(CHUNK_SEPARATOR);
      if (streamDone && chunkSeparatorIndex < 0) {
        flush = true;
        chunkSeparatorIndex = buffer.length;
      }
      if (chunkSeparatorIndex < 0) {
        break;
      }

      let chunk = buffer.substring(0, chunkSeparatorIndex);
      buffer = buffer.substring(chunkSeparatorIndex + CHUNK_SEPARATOR.length);
      chunk = chunk.replace(/^data:\s*/, '').trim();
      if (!chunk) {
        if (flush) break;
        continue;
      }

      try {
        let { error, text } = JSON.parse(chunk);
        if (error) {
          console.error('Error in chunk:', error);
          throw new Error(error.message || JSON.stringify(error));
        }
        yield text;
      } catch (e) {
        console.error('Error parsing chunk:', e);
        throw new Error('Failed to parse response chunk.');
      }

      if (flush) break;
    }
  };

  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += new TextDecoder().decode(value);
      yield* processBuffer();
    }
  } finally {
    reader.releaseLock();
  }

  yield* processBuffer(true);
}
