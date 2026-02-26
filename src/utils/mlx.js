const BACKEND_URL = 'http://localhost:8000';

/**
 * List available MLX models from the backend.
 * @returns {Promise<string[]>} List of model names.
 */
export async function listMLXModels() {
    try {
        const response = await fetch(`${BACKEND_URL}/models/mlx`);
        if (!response.ok) throw new Error('Failed to fetch MLX models');
        const data = await response.json();
        return data.models;
    } catch (error) {
        console.error('Error fetching MLX models:', error);
        return [];
    }
}

/**
 * List available Ollama models via the backend helper.
 * @returns {Promise<string[]>} List of model names.
 */
export async function listOllamaModelsFromBackend() {
    try {
        const response = await fetch(`${BACKEND_URL}/models/ollama`);
        if (!response.ok) throw new Error('Failed to fetch Ollama models');
        const data = await response.json();
        return data.models;
    } catch (error) {
        console.error('Error fetching Ollama models:', error);
        return [];
    }
}
