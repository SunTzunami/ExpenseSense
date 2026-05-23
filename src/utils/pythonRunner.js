

/**
 * Get metadata for the LLM prompt.
 * Includes column names, data types, unique categories, and category mapping.
 */
export function getPromptMetadata(data) {
    if (!data || data.length === 0) return {
        columns: [],
        columnTypes: {},
        uniqueCategories: [],
        uniqueNewCategories: [],
        categoryMapping: {}
    };

    const columns = Object.keys(data[0]);

    const columnTypes = {};
    columns.forEach(col => {
        const sample = data.find(row => row[col] != null)?.[col];
        if (sample instanceof Date || (typeof sample === 'string' && !isNaN(Date.parse(sample)) && sample.includes('-'))) {
            columnTypes[col] = 'datetime';
        } else if (typeof sample === 'number') {
            columnTypes[col] = 'float';
        } else if (typeof sample === 'boolean') {
            columnTypes[col] = 'boolean';
        } else {
            columnTypes[col] = 'string';
        }
    });

    const normalizeUnique = (arr) => {
        const seen = new Set();
        return arr.filter(v => {
            if (!v) return false;
            const lower = String(v).toLowerCase();
            if (seen.has(lower)) return false;
            seen.add(lower);
            return true;
        }).sort();
    };

    const uniqueCategories = normalizeUnique(data.map(d => d.Category || d.category));
    const uniqueNewCategories = normalizeUnique(data.map(d => d.NewCategory || d['major category'] || d.major_category));

    const categoryMapping = {};
    const seenMapping = new Set();
    data.forEach(row => {
        const cat = row.Category || row.category;
        const newCat = row.NewCategory || row['major category'] || row.major_category;
        if (cat && newCat) {
            const lowerOrig = String(cat).toLowerCase();
            if (!seenMapping.has(lowerOrig)) {
                categoryMapping[cat] = newCat;
                seenMapping.add(lowerOrig);
            }
        }
    });

    return {
        columns,
        columnTypes,
        uniqueCategories,
        uniqueNewCategories,
        categoryMapping
    };
}

/**
 * Enhanced System Prompt for Python Analysis - Optimized for small local LLMs (<4B params).
 */
export const PYTHON_ANALYSIS_PROMPT = `You are analyzing expense data in a pandas DataFrame called \`df\`.

{{metadata}}
CURRENT DATE: {{current_date}} (remember this in case user asks questions like "this month", "last month", "past 6 months", etc.)

USER QUESTION: "{{prompt}}"

RULES:
1. DO NOT create df. It already exists with all the data.
2. DO NOT import pandas, numpy, or io. They are pre-imported as pd, np.
3. Use parentheses for filtering: df[(df['col'] == val) & (df['col2'] == val2)]
4. For text search use: df['col'].str.contains('text', case=False, na=False)

SEARCH LOGIC (CRITICAL):
- If query term is in MAPPED CATEGORIES list → filter by major category column
- If query term is in ORIGINAL CATEGORIES list → filter by category column  
- If query term is NOT in any category list → search in 'remarks' column

OUTPUT:
- Store text/number answer in \`result\` variable
- Store Plotly figure in \`fig\` variable (only if visualization adds value)
- Output ONLY Python code. No explanations.

EXAMPLES:
# Q: "Total spent on Food?" (Food is in MAPPED CATEGORIES)
result = df[df['major category'].str.lower() == 'food']['Expense'].sum()

# Q: "How much on snacks?" (snacks is in ORIGINAL CATEGORIES)
result = df[df['category'] == 'snacks']['Expense'].sum()

# Q: "How much on starbucks?" (starbucks is NOT in any category, search remarks)
result = df[df['remarks'].str.contains('starbucks', case=False, na=False)]['Expense'].sum()

# Q: "Snacks in 2025"
result = df[(df['Date'].dt.year == 2025) & (df['category'] == 'snacks')]['Expense'].sum()
`;

/**
 * Run Python code against a dataset via the FastAPI backend.
 */
export async function runPython(code, data, optionsArg = {}) {
    const { prompt, metadata, currency, model, routerModel, chatModel, options } = optionsArg;

    try {
        const response = await fetch('http://localhost:8000/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data,
                prompt,
                metadata,
                currency,
                model,
                router_model: routerModel,
                chat_model: chatModel,
                router_provider: optionsArg.routerProvider || 'llamacpp',
                specialist_provider: optionsArg.specialistProvider || 'llamacpp',
                summarizer_provider: optionsArg.summarizerProvider || 'llamacpp',
                options
            })
        });

        if (response.ok) {
            const result = await response.json();
            return {
                result: result.result,
                fig: result.fig,
                code: result.code,
                router_output: result.router_output || null,
                tool_name: result.tool_name || null,
                backend: true
            };
        } else {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || `Server error: ${response.statusText}`);
        }
    } catch (e) {
        console.error("FastAPI backend connection error in runPython:", e);
        throw new Error(`Could not connect to the local ExpenseSense backend server. Please verify that the FastAPI server is running on http://localhost:8000. Detail: ${e.message}`);
    }
}

/**
 * Run analysis with SSE streaming for status updates.
 * @param {null} code - Unused, kept for API compat.
 * @param {Array} data - The expense data array.
 * @param {Object} optionsArg - Options including prompt, metadata, model, etc.
 * @param {Function} onStatus - Callback receiving {stage, message, model?, tool?} for each stage.
 * @returns {Promise<Object>} Same shape as runPython: {result, fig, code, backend}.
 */
export async function runPythonStream(code, data, optionsArg = {}, onStatus = null) {
    const { prompt, metadata, currency, model, routerModel, chatModel, options } = optionsArg;

    try {
        const response = await fetch('http://localhost:8000/analyze_stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data,
                prompt,
                metadata,
                currency,
                model,
                router_model: routerModel,
                chat_model: chatModel,
                router_provider: optionsArg.routerProvider || 'llamacpp',
                specialist_provider: optionsArg.specialistProvider || 'llamacpp',
                summarizer_provider: optionsArg.summarizerProvider || 'llamacpp',
                options
            })
        });

        if (!response.ok) {
            throw new Error(`Stream endpoint returned ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalResult = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Parse SSE events from buffer
            const parts = buffer.split('\n\n');
            // Keep the last (potentially incomplete) part in the buffer
            buffer = parts.pop() || '';

            for (const part of parts) {
                if (!part.trim()) continue;
                const lines = part.split('\n');
                let eventType = '';
                let eventData = '';

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        eventType = line.slice(7).trim();
                    } else if (line.startsWith('data: ')) {
                        eventData = line.slice(6);
                    }
                }

                if (!eventType || !eventData) continue;

                try {
                    const parsed = JSON.parse(eventData);

                    if (eventType === 'status' && onStatus) {
                        onStatus(parsed);
                    } else if (eventType === 'result') {
                        finalResult = parsed;
                    } else if (eventType === 'error') {
                        throw new Error(parsed.error || 'Analysis failed');
                    }
                } catch (parseErr) {
                    if (parseErr.message && !parseErr.message.includes('JSON')) {
                        throw parseErr; // Re-throw non-parse errors (like our error event)
                    }
                    console.warn('Failed to parse SSE event data:', parseErr);
                }
            }
        }

        if (finalResult) {
            return {
                result: finalResult.result,
                fig: finalResult.fig,
                code: finalResult.code,
                router_output: finalResult.router_output || null,
                tool_name: finalResult.tool_name || null,
                validation_fixes: finalResult.validation_fixes || null,
                backend: true
            };
        }

        throw new Error('Stream ended without result');

    } catch (e) {
        console.error("Streaming analysis failed:", e);
        throw new Error(`Could not connect to the local ExpenseSense backend server. Please verify that the FastAPI server is running on http://localhost:8000. Detail: ${e.message}`);
    }
}
