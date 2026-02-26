import React from 'react';
import Plot from 'react-plotly.js';

import { CATEGORY_COLORS } from '../../utils/categoryMapping';

const SunburstChart = React.memo(({ data, currency = 'JPY' }) => {
    if (!data || data.length === 0) {
        return <div className="w-full h-full min-h-[300px] flex items-center justify-center text-slate-400">No data available</div>;
    }

    // Aggregate data with unique IDs
    const aggregated = {};

    data.forEach(row => {
        const parentLabel = row.NewCategory;
        const childLabel = row.category || row.Category;

        const parentId = parentLabel;
        const childId = `${parentLabel}-${childLabel}`;

        // Initialize parent if not exists
        if (!aggregated[parentId]) {
            aggregated[parentId] = {
                id: parentId,
                label: parentLabel,
                parent: '',
                value: 0
            };
        }

        // Initialize child if not exists
        if (!aggregated[childId]) {
            aggregated[childId] = {
                id: childId,
                label: childLabel,
                parent: parentId,
                value: 0
            };
        }

        // Accumulate values
        aggregated[parentId].value += row.Expense;
        aggregated[childId].value += row.Expense;
    });

    const ids = Object.values(aggregated).map(d => d.id);
    const labels = Object.values(aggregated).map(d => d.label);
    const parents = Object.values(aggregated).map(d => d.parent);
    const values = Object.values(aggregated).map(d => d.value);

    // Map colors to labels (using parent logic)
    const markerColors = ids.map((id, idx) => {
        const label = labels[idx];
        // If it's a root/parent category
        if (CATEGORY_COLORS[label] && parents[idx] === '') return CATEGORY_COLORS[label];

        // Inherit from parent
        const parentId = parents[idx];
        // Find parent's label
        const parentObj = aggregated[parentId];
        const parentLabel = parentObj ? parentObj.label : '';

        return CATEGORY_COLORS[parentLabel] || '#818cf8';
    });

    const symbols = { 'JPY': '¥', 'INR': '₹' };
    const symbol = symbols[currency] || currency;

    // Legend labels (roots)
    const rootCategories = Object.values(aggregated).filter(d => d.parent === '');
    const legendLabels = rootCategories.sort((a, b) => b.value - a.value).map(d => d.label);
    const legendColors = legendLabels.map(l => CATEGORY_COLORS[l] || '#818cf8');
    return (
        <div className="w-full h-[550px] min-h-[400px]">
            <Plot
                data={[
                    {
                        type: 'sunburst',
                        ids: ids,
                        labels: labels,
                        parents: parents,
                        values: values,
                        textinfo: 'label+percent parent',
                        hovertemplate: `<b>%{label}</b><br>${symbol}%{value:,.0f}<extra></extra>`,
                        marker: {
                            colors: markerColors,
                            line: { color: 'rgba(15, 23, 42, 0.8)', width: 1.5 }
                        },
                        branchvalues: 'total',
                        insidetextorientation: 'horizontal',
                        showlegend: false // Hide default legend if any
                    },
                    {
                        labels: legendLabels,
                        values: legendLabels.map(() => 0),
                        type: 'pie',
                        marker: { colors: legendColors },
                        showlegend: true,
                        hoverinfo: 'none',
                        textinfo: 'none',
                        domain: { x: [0, 0], y: [0, 0] } // Make visible for legend but hidden in plot
                    }
                ]}
                layout={{
                    title: {
                        text: 'Hierarchical Expense Breakdown',
                        font: { color: '#f8fafc', size: 18, family: 'Outfit' }
                    },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    showlegend: true,
                    legend: {
                        orientation: 'h',
                        y: -0.1,
                        x: 0.5,
                        xanchor: 'center',
                        font: { color: '#94a3b8', size: 10 }
                    },
                    font: { color: '#f8fafc', family: 'Outfit', size: 12 },
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

export default SunburstChart;
