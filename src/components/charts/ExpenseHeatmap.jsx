import React from 'react';
import Plot from 'react-plotly.js';
import { format } from 'date-fns';

const ExpenseHeatmap = ({ data, quantile = 0.96 }) => {
    // Calculate quantile threshold
    const expenses = data.map(d => d.Expense).sort((a, b) => a - b);
    const thresholdIndex = Math.floor(expenses.length * quantile);
    const threshold = expenses[thresholdIndex] || Math.max(...expenses);

    // Filter outliers
    const filtered = data.filter(d => d.Expense <= threshold);

    // Create matrix: weekday x date
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const matrix = {};
    const dateMap = {}; // Map to store actual dates for each column

    filtered.forEach(row => {
        const weekday = format(row.Date, 'EEEE');
        const dateKey = format(row.Date, 'MM/dd');

        if (!matrix[weekday]) matrix[weekday] = {};
        matrix[weekday][dateKey] = (matrix[weekday][dateKey] || 0) + row.Expense;

        if (!dateMap[dateKey]) {
            dateMap[dateKey] = row.Date;
        }
    });

    // Get all dates sorted
    const allDates = Object.keys(dateMap).sort((a, b) => dateMap[a] - dateMap[b]);

    // Build z-matrix (rows = weekdays, cols = dates)
    const z = weekdays.map(day =>
        allDates.map(date => matrix[day]?.[date] || 0)
    );

    return (
        <div className="w-full h-[500px] min-h-[400px]">
            <Plot
                data={[
                    {
                        z: z,
                        x: allDates,
                        y: weekdays,
                        type: 'heatmap',
                        colorscale: [[0, 'rgba(255,255,255,0.05)'], [1, '#818cf8']],
                        hovertemplate: '%{x}<br>%{y}<br>¥%{z:,.0f}<extra></extra>',
                        showscale: true,
                        colorbar: {
                            title: { text: '¥', side: 'right' },
                            tickprefix: '¥',
                            tickfont: { color: '#94a3b8' },
                            titlefont: { color: '#94a3b8' }
                        }
                    },
                ]}
                layout={{
                    title: {
                        text: 'Expense Heatmap (Weekday vs Date)',
                        font: { color: '#f8fafc', size: 18, family: 'Outfit' }
                    },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    xaxis: {
                        title: { text: 'Date', font: { color: '#94a3b8' } },
                        showgrid: false,
                        color: '#94a3b8',
                        tickfont: { family: 'Outfit', size: 10 },
                        tickangle: -45
                    },
                    yaxis: {
                        title: { text: 'Weekday', font: { color: '#94a3b8' } },
                        showgrid: false,
                        color: '#94a3b8',
                        tickfont: { family: 'Outfit' }
                    },
                    margin: { t: 50, b: 80, l: 80, r: 20 },
                    autosize: true,
                }}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: false }}
            />
        </div>
    );
};

export default ExpenseHeatmap;
