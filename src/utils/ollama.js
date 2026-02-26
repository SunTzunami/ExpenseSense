
const OLLAMA_BASE_URL = 'http://localhost:11434/api';

/**
 * Check if Ollama is running and accessible.
 * @returns {Promise<boolean>}
 */
export async function checkOllamaConnection() {
    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/tags`);
        return response.ok;
    } catch (error) {
        console.warn('Ollama connection check failed:', error);
        return false;
    }
}

/**
 * List available Ollama models.
 * @returns {Promise<string[]>} List of model names.
 */
export async function listModels() {
    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/tags`);
        if (!response.ok) throw new Error('Failed to fetch models');
        const data = await response.json();
        return data.models.map(model => model.name);
    } catch (error) {
        console.error('Error fetching Ollama models:', error);
        return [];
    }
}

/**
 * Send a chat request to Ollama.
 * @param {string} model - The model to use.
 * @param {Array} messages - History of messages [{role: 'user', content: '...'}].
 * @param {boolean} stream - Whether to stream the response (default true).
 * @param {Function} onChunk - Callback for streaming chunks.
 * @param {Object} options - Additional options (temperature, top_p, etc).
 * @returns {Promise<Object>} The final response object.
 */
export async function chatWithOllama(model, messages, stream = true, onChunk = null, options = {}) {
    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages,
                stream,
                options
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }

        if (stream && onChunk) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let finalContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                // Ollama sends multiple JSON objects in one chunk sometimes
                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    try {
                        const json = JSON.parse(line);
                        if (json.done) {
                            return { role: 'assistant', content: finalContent };
                        }
                        if (json.message && json.message.content) {
                            const content = json.message.content;
                            finalContent += content;
                            onChunk(content);
                        }
                    } catch (e) {
                        console.warn('Error parsing JSON chunk from Ollama:', e);
                    }
                }
            }
            return { role: 'assistant', content: finalContent };
        } else {
            const data = await response.json();
            return data.message;
        }

    } catch (error) {
        console.error('Error in chatWithOllama:', error);
        throw error;
    }
}
