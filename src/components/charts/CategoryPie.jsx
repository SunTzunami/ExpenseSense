
import React from 'react';
import Plot from 'react-plotly.js';

import { CATEGORY_COLORS } from '../../utils/categoryMapping';

const CategoryPie = React.memo(({ data, currency = 'JPY' }) => {
    if (!data || data.length === 0) {
        return <div className="w-full h-full min-h-[250px] flex items-center justify-center text-slate-500">No data available</div>;
    }

    // Aggregate data by NewCategory
    const aggregated = data.reduce((acc, row) => {
        const cat = row.NewCategory;
        acc[cat] = (acc[cat] || 0) + row.Expense;
        return acc;
    }, {});

    const labels = Object.keys(aggregated);
    const values = Object.values(aggregated);

    const markerColors = labels.map(l => CATEGORY_COLORS[l] || '#818cf8'); // Fallback color

    const symbols = { 'JPY': '¥', 'INR': '₹' };
    const symbol = symbols[currency] || currency;

    return (
        <div className="w-full h-[550px] min-h-[400px]">
            <Plot
                data={[
                    {
                        values: values,
                        labels: labels,
                        type: 'pie',
                        textinfo: 'percent+label',
                        textposition: 'inside', // cleaner look
                        hovertemplate: `<b>%{label}</b><br>${symbol}%{value:,.0f}<extra></extra>`,
                        marker: {
                            colors: markerColors,
                            line: { color: 'rgba(15, 23, 42, 0.8)', width: 1.5 }
                        },
                        hole: 0.4, // Increased hole for more modern donut look
                    },
                ]}
                layout={{
                    title: {
                        text: 'Expense Distribution',
                        font: { color: '#f8fafc', size: 18, family: 'Outfit' }
                    },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    showlegend: true,
                    legend: {
                        orientation: 'h',
                        y: -0.1,
                        x: 0.5,
                        xanchor: 'center',
                        font: { color: '#94a3b8', size: 10 }
                    },
                    font: { color: '#f8fafc', family: 'Outfit' },
                    margin: { t: 60, b: 80, l: 20, r: 20 },
                    autosize: true,
                }}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: false }}
            />
        </div>
    );
});

export default CategoryPie;
