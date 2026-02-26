import React from 'react';
import Plot from 'react-plotly.js';
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';

const WeekdayPattern = React.memo(({ data }) => {
    // Aggregate by day of week
    const weekdayTotals = {
        'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0,
        'Friday': 0, 'Saturday': 0, 'Sunday': 0
    };

    const weekdayCounts = {
        'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0,
        'Friday': 0, 'Saturday': 0, 'Sunday': 0
    };

    if (!data || data.length === 0) {
        return <div className="w-full h-full min-h-[350px] flex items-center justify-center text-slate-500">No weekday data available</div>;
    }

    data.forEach(row => {
        if (!row.Date || isNaN(row.Date.getTime())) return;
        const day = format(row.Date, 'EEEE');
        weekdayTotals[day] += row.Expense;
        weekdayCounts[day] += 1;
    });

    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const averages = weekdays.map(day => weekdayTotals[day] / (weekdayCounts[day] || 1));

    return (
        <div className="w-full h-[400px] min-h-[350px]">
            <Plot
                data={[
                    {
                        x: weekdays,
                        y: averages,
                        type: 'bar',
                        marker: {
                            color: averages,
                            colorscale: [
                                [0, 'rgba(255, 255, 255, 0.05)'],
                                [1, 'rgba(124, 58, 237, 1)']
                            ],
                            opacity: averages.map(val => {
                                const maxVal = Math.max(...averages);
                                const intensity = maxVal > 0 ? val / maxVal : 0;
                                return 0.15 + intensity * 0.85;
                            }),
                            line: { color: 'rgba(255,255,255,0.1)', width: 1 },
                            showscale: false
                        },
                        hovertemplate: '<b>%{x}</b><br>Avg: ¥%{y:,.0f}<extra></extra>',
                    },
                ]}
                layout={{
                    title: {
                        text: 'Average Spending by Day of Week',
                        font: { color: '#f8fafc', size: 18, family: 'Outfit' }
                    },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    xaxis: {
                        showgrid: false,
                        color: '#94a3b8',
                        tickfont: { family: 'Outfit' }
                    },
                    yaxis: {
                        showgrid: true,
                        gridcolor: 'rgba(255,255,255,0.05)',
                        color: '#94a3b8',
                        tickprefix: '¥',
                        tickfont: { family: 'Outfit' }
                    },
                    margin: { t: 50, b: 50, l: 60, r: 20 },
                    autosize: true,
                }}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: false }}
            />
        </div>
    );
});

export default WeekdayPattern;
