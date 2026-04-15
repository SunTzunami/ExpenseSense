const BACKEND_URL = 'http://localhost:8000';

/**
 * List available LlamaCpp models from the backend.
 * @returns {Promise<string[]>} List of model names.
 */
export async function listLlamaCppModels() {
    try {
        const response = await fetch(`${BACKEND_URL}/models/llamacpp`);
        if (!response.ok) throw new Error('Failed to fetch LlamaCpp models');
        const data = await response.json();
        return data.models;
    } catch (error) {
        console.error('Error fetching LlamaCpp models:', error);
        return [];
    }
}


