import React from 'react';
import Plot from 'react-plotly.js';
import { getDayOfYear, format } from 'date-fns';

const YearComparison = React.memo(({ data, year1, year2 }) => {
    // Filter and sort data for each year
    const year1Data = data
        .filter(d => d.Date.getFullYear() === year1)
        .sort((a, b) => a.Date - b.Date);

    const year2Data = data
        .filter(d => d.Date.getFullYear() === year2)
        .sort((a, b) => a.Date - b.Date);

    // Calculate cumulative expenses and store formatted dates
    let cumulative1 = 0;
    const year1Cumulative = year1Data.map(d => {
        cumulative1 += d.Expense;
        return {
            dayOfYear: getDayOfYear(d.Date),
            cumulative: cumulative1,
            dateStr: format(d.Date, 'MMM d')
        };
    });

    let cumulative2 = 0;
    const year2Cumulative = year2Data.map(d => {
        cumulative2 += d.Expense;
        return {
            dayOfYear: getDayOfYear(d.Date),
            cumulative: cumulative2,
            dateStr: format(d.Date, 'MMM d')
        };
    });

    // Month tick values (approximate for non-leap year)
    const monthTicks = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return (
        <div className="w-full h-full min-h-[400px]">
            <Plot
                data={[
                    {
                        x: year1Cumulative.map(d => d.dayOfYear),
                        y: year1Cumulative.map(d => d.cumulative),
                        text: year1Cumulative.map(d => d.dateStr),
                        type: 'scatter',
                        mode: 'lines',
                        name: `${year1}`,
                        line: { color: '#818cf8', width: 3 },
                        hovertemplate: '%{text}<br>%{name}: ¥%{y:.2f}M<extra></extra>',
                        fill: 'tozeroy',
                        fillcolor: 'rgba(129, 140, 248, 0.05)'
                    },
                    {
                        x: year2Cumulative.map(d => d.dayOfYear),
                        y: year2Cumulative.map(d => d.cumulative),
                        text: year2Cumulative.map(d => d.dateStr),
                        type: 'scatter',
                        mode: 'lines',
                        name: `${year2}`,
                        line: { color: '#c084fc', width: 3 },
                        hovertemplate: '%{text}<br>%{name}: ¥%{y:.2f}M<extra></extra>',
                    }
                ]}
                layout={{
                    title: {
                        text: `Cumulative Expenses: ${year1} vs ${year2}`,
                        font: { color: '#f8fafc', size: 20, family: 'Outfit, sans-serif' }
                    },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    xaxis: {
                        title: 'Date',
                        showgrid: false,
                        color: '#94a3b8',
                        tickfont: { family: 'Outfit' },
                        tickvals: monthTicks,
                        ticktext: monthLabels,
                        range: [1, 366]
                    },
                    yaxis: {
                        showgrid: true,
                        gridcolor: 'rgba(255,255,255,0.05)',
                        color: '#94a3b8',
                        tickprefix: '¥',
                        tickfont: { family: 'Outfit' }
                    },
                    legend: {
                        orientation: 'h',
                        y: -0.2,
                        x: 0.5,
                        xanchor: 'center',
                        font: { color: '#94a3b8', family: 'Outfit, sans-serif' }
                    },
                    margin: { t: 50, b: 50, l: 60, r: 20 },
                    autosize: true,
                    hovermode: 'x unified'
                }}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: false }}
            />
        </div>
    );
});

export default YearComparison;
