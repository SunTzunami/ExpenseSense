

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

let pyodide = null;

/**
 * Initialize Pyodide and load pandas/numpy
 */
export async function initPyodide() {
    if (pyodide) return pyodide;

    // @ts-ignore
    pyodide = await loadPyodide();

    // Load packages
    await pyodide.loadPackage(['pandas', 'numpy', 'micropip']);
    const micropip = pyodide.pyimport("micropip");
    await micropip.install('plotly');

    return pyodide;
}

/**
 * Run Python code against a dataset. 
 * First attempts to use the FastAPI backend, falls back to Pyodide if unavailable.
 */
export async function runPython(code, data, optionsArg = {}) {
    const { prompt, metadata, currency, model, routerModel, chatModel, options } = optionsArg;

    // 1. Try FastAPI Backend
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
                router_provider: optionsArg.routerProvider || 'ollama',
                specialist_provider: optionsArg.specialistProvider || 'ollama',
                summarizer_provider: optionsArg.summarizerProvider || 'ollama',
                options
            })
        });

        if (response.ok) {
            const result = await response.json();
            return {
                result: result.result,
                fig: result.fig,
                code: result.code,
                backend: true
            };
        }
    } catch (e) {
        console.warn("FastAPI backend not available, falling back to Pyodide:", e);
    }

    // 2. Fallback to Pyodide (Browser)
    const instance = await initPyodide();
    const csvContent = arrayToCsv(data);
    instance.globals.set("csv_content", csvContent);

    const wrapperCode = `
import pandas as pd
import numpy as np
import io
import json

// Load data
df = pd.read_csv(io.StringIO(csv_content))
if 'Date' in df.columns:
    df['Date'] = pd.to_datetime(df['Date']).dt.tz_localize(None)

# Standardize columns for Finetuned Model (major category, category)
if 'NewCategory' in df.columns:
    df['major category'] = df['NewCategory']
if 'Category' in df.columns:
    df['category'] = df['Category'].astype(str).str.lower().str.strip()
else:
    if 'category' not in df.columns: df['category'] = ''
    if 'major category' not in df.columns: df['major category'] = ''

// Analysis Tools Library
def plot_time_series(df, category=None, major_category=None, year=None, start_year=None, end_year=None, months=None, title=None):
    data = df.copy()
    if 'Date' in data.columns:
        data['Date'] = pd.to_datetime(data['Date'])
    
    if year:
        data = data[data['Date'].dt.year == int(year)]
    elif start_year and end_year:
        data = data[(data['Date'].dt.year >= int(start_year)) & (data['Date'].dt.year <= int(end_year))]
    
    if category and major_category:
        cat_f = data[data['category'].str.lower() == category.lower()]
        data = cat_f if not cat_f.empty else data[data['major category'].str.lower() == major_category.lower()]
    elif category: data = data[data['category'].str.lower() == category.lower()]
    elif major_category: data = data[data['major category'].str.lower() == major_category.lower()]
    
    if months:
        cutoff = pd.Timestamp.now() - pd.DateOffset(months=int(months))
        data = data[data['Date'] >= cutoff]
    
    if data.empty: return None, "No data found for this period."
    data = data.sort_values('Date')
    
    label = f"{category or major_category or 'Total'}"
    use_bars = len(data) <= 20
    fig = go.Figure()
    
    if use_bars:
        fig.add_trace(go.Bar(x=data['Date'], y=data['Expense'], name='Expenses', marker=dict(color='#3b82f6')))
    else:
        fig.add_trace(go.Scatter(x=data['Date'], y=data['Expense'], mode='lines+markers', name='Daily', line=dict(color='#3b82f6')))
        if len(data) > 7:
            data['MA7'] = data['Expense'].rolling(window=7, min_periods=1).mean()
            fig.add_trace(go.Scatter(x=data['Date'], y=data['MA7'], name='7-Day Avg', line=dict(color='#f59e0b', dash='dash')))
            
    fig.update_layout(title=title or f"{label} Over Time", template='plotly_white')
    return fig, f"Generated {'bar chart' if use_bars else 'plot'} for {label}"

def plot_pie_chart(df, year=None, major_category=None, category=None, title=None):
    data = df.copy()
    if year: data = data[pd.to_datetime(data['Date']).dt.year == int(year)]
    if major_category:
        data = data[data['major category'].str.lower() == major_category.lower()]
        names = 'category'
    elif category:
        data = data[data['category'].str.lower() == category.lower()]
        names = 'category'
    else:
        names = 'major category'
    if data.empty: return None, "No data found."
    
    grouped = data.groupby(names)['Expense'].sum().reset_index()
    fig = go.Figure(data=[go.Pie(labels=grouped[names], values=grouped['Expense'], textinfo='label+percent')])
    fig.update_layout(title=title or "Expense Breakdown", template='plotly_white')
    return fig, "Pie chart generated"

def plot_comparison(df, category=None, major_category=None, y1=None, y2=None, title=None):
    data = df.copy()
    data['Year'] = pd.to_datetime(data['Date']).dt.year.astype(str)
    filtered = data[data['Year'].isin([str(y1), str(y2)])]
    if category: filtered = filtered[filtered['category'].str.lower() == category.lower()]
    elif major_category: filtered = filtered[filtered['major category'].str.lower() == major_category.lower()]
    if filtered.empty: return None, "No data to compare."
    
    fig = go.Figure()
    for year in [str(y1), str(y2)]:
        fig.add_trace(go.Box(y=filtered[filtered['Year'] == year]['Expense'], name=year))
    fig.update_layout(title=title or "Comparison", template='plotly_white')
    return fig, f"Comparison generated for {y1} vs {y2}"

def calculate_sum(df, category=None, major_category=None, year=None, remarks=None):
    data = df.copy()
    if year: data = data[pd.to_datetime(data['Date']).dt.year == int(year)]
    if category: data = data[data['category'].str.lower() == category.lower()]
    elif major_category: data = data[data['major category'].str.lower() == major_category.lower()]
    if remarks: data = data[data['remarks'].str.contains(remarks, case=False, na=False)]
    if data.empty: return None, "No transactions found."
    return None, f"Total: ¥{round(data['Expense'].sum(), 2):,} ({len(data)} txns)"

def calculate_average(df, category=None, major_category=None, year=None, remarks=None):
    data = df.copy()
    if year: data = data[pd.to_datetime(data['Date']).dt.year == int(year)]
    if category: data = data[data['category'].str.lower() == category.lower()]
    elif major_category: data = data[data['major category'].str.lower() == major_category.lower()]
    if remarks: data = data[data['remarks'].str.contains(remarks, case=False, na=False)]
    if data.empty: return None, "No data found."
    return None, f"Average: ¥{round(data['Expense'].mean(), 2):,} (Median: ¥{round(data['Expense'].median(), 2):,})"

def run_significance_test(df, category=None, major_category=None, y1=None, y2=None):
    from scipy import stats
    data = df.copy()
    data['Year'] = pd.to_datetime(data['Date']).dt.year
    def get_s(yr):
        d = data[data['Year'] == int(yr)]
        if category: d = d[d['category'].str.lower() == category.lower()]
        elif major_category: d = d[d['major category'].str.lower() == major_category.lower()]
        return d['Expense']
    s1, s2 = get_s(y1), get_s(y2)
    if len(s1) < 2 or len(s2) < 2: return None, "Insufficient data."
    t, p = stats.ttest_ind(s1, s2, equal_var=False, nan_policy='omit')
    diff = "significant" if p < 0.05 else "not significant"
    return None, f"{y1} Avg: ¥{round(s1.mean(), 2):,}, {y2} Avg: ¥{round(s2.mean(), 2):,}. Difference is {diff} (p={round(p, 4)})"

exec_scope = {
    "df": df, "pd": pd, "np": np, "px": __import__('plotly.express'),
    "plot_time_series": plot_time_series, "plot_pie_chart": plot_pie_chart,
    "plot_comparison": plot_comparison, "plot_stacked_bar": plot_stacked_bar,
    "calculate_sum": calculate_sum, "calculate_average": calculate_average,
    "run_significance_test": run_significance_test
}
result = None
fig = None

try:
    exec("""${code.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}""", {}, exec_scope)
    
    if 'result' in exec_scope: result = exec_scope['result']
    if 'fig' in exec_scope:
        fig_obj = exec_scope['fig']
        fig = fig_obj.to_json() if hasattr(fig_obj, 'to_json') else str(fig_obj)
except Exception as e:
    result = f"Error: {str(e)}"

final_output = json.dumps({"result": str(result) if result is not None else None, "fig": fig})
final_output
`;

    const outputJson = await instance.runPythonAsync(wrapperCode);
    return { ...JSON.parse(outputJson), backend: false };
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
                router_provider: optionsArg.routerProvider || 'ollama',
                specialist_provider: optionsArg.specialistProvider || 'ollama',
                summarizer_provider: optionsArg.summarizerProvider || 'ollama',
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
                backend: true
            };
        }

        throw new Error('Stream ended without result');

    } catch (e) {
        console.warn("Streaming endpoint failed, falling back to regular runPython:", e);
        // Fallback to non-streaming
        return runPython(code, data, optionsArg);
    }
}

/**
 * Simple JS array to CSV converter
 */
function arrayToCsv(data) {
    if (!data || data.length === 0) return "";
    const headers = Object.keys(data[0]);
    const rows = data.map(obj =>
        headers.map(header => {
            let val = obj[header];
            if (val instanceof Date) val = val.toISOString();
            if (typeof val === 'string') {
                val = `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        }).join(',')
    );
    return [headers.join(','), ...rows].join('\n');
}
