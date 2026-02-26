import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import numpy as np
from plotly.subplots import make_subplots
from scipy import stats
import functools
from utils.llm_input_validation import validate_and_fix_params
import logging


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- THEME CONSTANTS (Matching Main App Dashboard) ---
THEME = {
    'paper_bgcolor': 'rgba(0,0,0,0)',
    'plot_bgcolor': 'rgba(0,0,0,0)',
    'title_color': '#f8fafc',
    'label_color': '#94a3b8',
    'grid_color': 'rgba(255,255,255,0.05)',
    'primary': '#818cf8',       # Indigo 400
    'primary_fill': 'rgba(129, 140, 248, 0.1)',
    'secondary': '#c084fc',     # Purple 400
    'font_family': 'Outfit, sans-serif'
}

CATEGORY_COLORS = {
    'Housing and Utilities': '#818cf8', # Indigo-400
    'Food': '#a78bfa',                 # Violet-400
    'Transportation': '#6366f1',       # Indigo-500
    'Fitness': '#c084fc',              # Purple-400
    'Souvenirs/Gifts/Treats': '#4f46e5',# Indigo-600
    'Household and Clothing': '#8b5cf6',# Violet-500
    'Entertainment': '#7c3aed',        # Violet-600
    'Miscellaneous': '#94a3b8',        # Slate-400
    'Education': '#4338ca',            # Indigo-700
    'Electronics and Furniture': '#6d28d9', # Violet-700
}

# Mapping specific keywords to broad groups (from categoryMapping.js)
CATEGORY_MAPPINGS = {
    'grocery': 'Food', 'snacks': 'Food', 'cafe': 'Food', 'coffee': 'Food', 'café': 'Food',
    'bento': 'Food', 'beverage': 'Food', 'combini meal': 'Food', 'dining': 'Food',
    'housing': 'Housing and Utilities', 'internet bill': 'Housing and Utilities',
    'electricity bill': 'Housing and Utilities', 'gas bill': 'Housing and Utilities',
    'water & sewage bill': 'Housing and Utilities', 'phone bill': 'Housing and Utilities',
    'clothing': 'Household and Clothing', 'household': 'Household and Clothing',
    'supplements': 'Fitness', 'shoes': 'Fitness', 'sports event': 'Fitness',
    'gym': 'Fitness', 'commute': 'Transportation', 'ride share': 'Transportation',
    'bus': 'Transportation', 'shinkansen': 'Transportation', 'taxi': 'Transportation',
    'souvenirs': 'Souvenirs/Gifts/Treats', 'treat': 'Souvenirs/Gifts/Treats',
    'gift': 'Souvenirs/Gifts/Treats', 'entertainment': 'Entertainment',
    'nomikai': 'Entertainment', 'education': 'Education'
}

def get_shared_layout(title_text):
    return dict(
        title=dict(
            text=title_text,
            font=dict(color=THEME['title_color'], size=20, family=THEME['font_family']),
            x=0,
            xanchor='left'
        ),
        paper_bgcolor=THEME['paper_bgcolor'],
        plot_bgcolor=THEME['plot_bgcolor'],
        xaxis=dict(
            showgrid=False,
            color=THEME['label_color'],
            tickfont=dict(family=THEME['font_family']),
            title=dict(font=dict(family=THEME['font_family']))
        ),
        yaxis=dict(
            showgrid=True,
            gridcolor=THEME['grid_color'],
            color=THEME['label_color'],
            tickfont=dict(family=THEME['font_family']),
            title=dict(font=dict(family=THEME['font_family']))
        ),
        legend=dict(
            orientation='h',
            y=-0.2,
            x=0.5,
            xanchor='center',
            font=dict(color=THEME['label_color'], family=THEME['font_family'], size=10)
        ),
        font=dict(color=THEME['label_color'], family=THEME['font_family']),
        margin=dict(t=60, b=80, l=50, r=20),
        autosize=True
    )

def generate_subcategory_colors(labels, base_color=None):
    """
    Generate visually distinct colors for subcategories.
    Uses a color palette that varies in hue, saturation, and lightness.
    """
    # Diverse color palette (avoiding similar blues/purples)
    distinct_colors = [
        '#818cf8',  # Indigo-400
        '#f472b6',  # Pink-400
        '#fb923c',  # Orange-400
        '#34d399',  # Emerald-400
        '#60a5fa',  # Blue-400
        '#a78bfa',  # Violet-400
        '#fbbf24',  # Amber-400
        '#2dd4bf',  # Teal-400
        '#c084fc',  # Purple-400
        '#f87171',  # Red-400
        '#4ade80',  # Green-400
        '#38bdf8',  # Sky-400
    ]
    
    # Return colors cycling through the palette
    return [distinct_colors[i % len(distinct_colors)] for i in range(len(labels))]

def auto_validate(func):
    """
    Decorator that intercepts tool calls, validates parameters against the dataframe,
    fixes common LLM mistakes (wrong column, casing), and appends warnings to the result.
    """
    @functools.wraps(func)
    def wrapper(df, *args, **kwargs):
        # 1. Run the validation logic
        cleaned_params, warning = validate_and_fix_params(kwargs, df)
        
        # 2. Call the original function with the CLEANED parameters
        # We pass *args just in case, but usually tools use kwargs
        fig, msg = func(df, *args, **cleaned_params)
        
        # 3. If we fixed something, prepend the warning to the message
        logger.info(warning)
        # if warning:
        #     msg = f"⚠️ [Auto-Fix]: {warning}\n\n{msg}"
            
        return fig, msg
    return wrapper

@auto_validate
def plot_time_series(df, category=None, major_category=None, remarks=None, year=None, month=None, 
                     start_year=None, end_year=None, months=None, title=None):
    """
    Shows spending trends over time with IMPROVED VISUALIZATION:
    - Automatic grouping based on data density (daily/weekly/monthly)
    - Bar chart for discrete transactions, line for aggregated data
    - Clearer moving average with better contrast
    - Summary statistics box on the chart
    
    Time filters (use ONE):
    - year + month: specific month (e.g., year=2024, month=12 for Dec 2024)
    - year: entire year
    - start_year + end_year: year range
    - months: last X months from today
    
    Category filters (use ONE):
    - category: specific category (e.g., 'futsal game') OR broad category (e.g., 'Food')
    """
    data = df.copy()
    if 'Date' in data.columns:
        data['Date'] = pd.to_datetime(data['Date'])
    
    # Time filtering
    if year and month:
        data = data[(data['Date'].dt.year == int(year)) & (data['Date'].dt.month == int(month))]
    elif year:
        data = data[data['Date'].dt.year == int(year)]
    elif start_year and end_year:
        data = data[(data['Date'].dt.year >= int(start_year)) & (data['Date'].dt.year <= int(end_year))]
    elif months:
        cutoff = pd.Timestamp.now() - pd.DateOffset(months=int(months))
        data = data[data['Date'] >= cutoff]
    
    # Category filtering
    if category:
        data = data[data['category'].str.lower() == category.lower()]
        label = category
    elif major_category:
        data = data[data['major category'].str.lower() == major_category.lower()]
        label = major_category
    elif remarks:
        # enable partial matching (e.g. "Starbucks" matches "Starbucks Coffee")
        data = data[data['remarks'].str.contains(remarks, case=False, na=False)]
        label = f"'{remarks}'"
    else:
        label = 'Total'
    
    if data.empty:
        return None, f"No spending data found for {label} in the specified period."
    
    data = data.sort_values('Date')
    
    # IMPROVED: Decide visualization strategy based on data characteristics
    date_range_days = (data['Date'].max() - data['Date'].min()).days
    num_transactions = len(data)
    
    # Calculate key statistics
    total_spent = data['Expense'].sum()
    avg_transaction = data['Expense'].mean()
    max_transaction = data['Expense'].max()
    
    fig = go.Figure()
    
    # Strategy 1: Few transactions over long period (< 100 transactions) -> Bar chart
    if num_transactions < 100:
        fig.add_trace(go.Bar(
            x=data['Date'],
            y=data['Expense'],
            name='Transaction',
            marker=dict(
                color=THEME['primary'],
                line=dict(color=THEME['primary'], width=0)
            ),
            cliponaxis=False,
            hovertemplate='<b>%{x|%Y-%m-%d}</b><br>¥%{y:,.0f}<extra></extra>'
        ))
        
        # Add headroom for labels
        fig.update_yaxes(range=[0, max_transaction * 1.15], tickprefix='¥')
        
        # Add average line - manual horizontal line instead of add_hline
        fig.add_shape(
            type='line',
            x0=data['Date'].min(),
            x1=data['Date'].max(),
            y0=avg_transaction,
            y1=avg_transaction,
            line=dict(color=THEME['secondary'], dash='dash', width=2)
        )
        
    # Strategy 2: Many transactions -> Weekly aggregation with line + area
    elif date_range_days > 90:  # More than 3 months
        # Aggregate by week
        data['Week'] = data['Date'].dt.to_period('W').apply(lambda r: r.start_time)
        weekly = data.groupby('Week')['Expense'].agg(['sum', 'count']).reset_index()
        weekly['Week'] = pd.to_datetime(weekly['Week'])
        
        # Main line with area fill
        fig.add_trace(go.Scatter(
            x=weekly['Week'],
            y=weekly['sum'],
            mode='lines',
            name='Weekly Total',
            line=dict(color=THEME['primary'], width=3),
            fill='tozeroy',
            fillcolor=THEME['primary_fill'],
            customdata=weekly['count'],
            hovertemplate='<b>Week of %{x|%Y-%m-%d}</b><br>Total: ¥%{y:,.0f}<br>Count: %{customdata}<extra></extra>'
        ))
        
        # 4-week moving average for trend
        if len(weekly) >= 4:
            weekly['MA4'] = weekly['sum'].rolling(window=4, min_periods=1).mean()
            fig.add_trace(go.Scatter(
                x=weekly['Week'],
                y=weekly['MA4'],
                mode='lines',
                name='4-Week Trend',
                line=dict(color=THEME['secondary'], width=2, dash='dot'),
                hovertemplate='<b>%{x|%Y-%m-%d}</b><br>Trend: ¥%{y:,.0f}<extra></extra>'
            ))
        
    # Strategy 3: Medium-term data (1-3 months) -> Daily with smoothing
    else:
        # Aggregate by day (in case multiple transactions per day)
        daily = data.groupby(data['Date'].dt.date)['Expense'].agg(['sum', 'count']).reset_index()
        daily.columns = ['Date', 'Expense', 'count']
        
        # Line with markers for actual data points
        fig.add_trace(go.Scatter(
            x=daily['Date'],
            y=daily['Expense'],
            mode='lines+markers',
            name='Daily Total',
            line=dict(color=THEME['primary'], width=2),
            marker=dict(size=6, color=THEME['primary']),
            fill='tozeroy',
            fillcolor=THEME['primary_fill'],
            customdata=daily['count'],
            hovertemplate='<b>%{x|%Y-%m-%d}</b><br>¥%{y:,.0f}<br>Count: %{customdata}<extra></extra>'
        ))
        
        # 7-day moving average
        if len(daily) >= 7:
            daily['MA7'] = daily['Expense'].rolling(window=7, min_periods=1).mean()
            fig.add_trace(go.Scatter(
                x=daily['Date'],
                y=daily['MA7'],
                mode='lines',
                name='7-Day Average',
                line=dict(color=THEME['secondary'], width=2, dash='dash'),
                hovertemplate='<b>%{x|%Y-%m-%d}</b><br>Avg: ¥%{y:,.0f}<extra></extra>'
            ))
    
    fig.update_layout(
        **get_shared_layout(title or f"{label} Spending Over Time"),
        xaxis_title="Date",
        yaxis_title="Amount (¥)",
        hovermode='x unified',
        showlegend=True
    )
    fig.update_yaxes(tickprefix='¥')
    
    msg = f"Time-series for {label}: ¥{total_spent:,.0f} (n={num_transactions}) | " \
          f"Avg: ¥{avg_transaction:,.0f} | Max: ¥{max_transaction:,.0f}"
    
    return fig, msg

@auto_validate
def plot_distribution(df, year=None, month=None, major_category=None, category=None, remarks=None, title=None):
    """
    Shows spending distribution with IMPROVED VISUALIZATION:
    - Clearer labels with absolute values
    - Better handling of small categories
    - Summary statistics in center of donut
    
    If category is specified: 
      - If it's a major category: shows sub-categories within it
      - If it's a specific category: shows breakdown by remarks/transactions
    If remarks is specified: shows breakdown by category for transactions matching those remarks
    Otherwise: shows distribution across all major categories
    
    Time filters:
    - year + month: specific month
    - year: entire year
    - (none): all time
    """
    data = df.copy()
    data['Date'] = pd.to_datetime(data['Date'])
    
    # Time filtering
    if year and month:
        data = data[(data['Date'].dt.year == int(year)) & (data['Date'].dt.month == int(month))]
        time_label = f"{year}-{month:02d}"
    elif year:
        data = data[data['Date'].dt.year == int(year)]
        time_label = str(year)
    else:
        time_label = "All Time"
    
    # Category filtering and determine grouping logic
    if remarks:
        # Filter by remarks and show category distribution
        data = data[data['remarks'].str.contains(remarks, case=False, na=False)]
        group_by = 'category'
        default_title = f"Categories for '{remarks}' - {time_label}"
        filter_label = f"remarks containing '{remarks}'"
    elif category:
        # Filter by specific category and show breakdown by remarks or subcategory
        data = data[data['category'].str.lower() == category.lower()]
        # For specific categories, show individual transaction remarks if available
        # Otherwise fall back to just showing the category itself
        if data['remarks'].notna().any():
            group_by = 'remarks'
            default_title = f"{category} Transactions - {time_label}"
        else:
            group_by = 'category'
            default_title = f"{category} Breakdown - {time_label}"
        filter_label = f"category '{category}'"
    elif major_category:
        # Filter by major category and show sub-categories
        data = data[data['major category'].str.lower() == major_category.lower()]
        group_by = 'category'
        default_title = f"{major_category} Breakdown - {time_label}"
        filter_label = f"major category '{major_category}'"
    else:
        # No filter: show all major categories
        group_by = 'major category'
        default_title = f"Spending Distribution - {time_label}"
        filter_label = "all expenses"
    
    if data.empty:
        return None, f"No data found for {filter_label} in {time_label}."
    
    # Group and sort
    grouped = data.groupby(group_by)['Expense'].sum().reset_index()
    grouped = grouped.sort_values('Expense', ascending=False)
    
    # IMPROVED: Combine small categories into "Others"
    total = grouped['Expense'].sum()
    threshold = total * 0.03  # Categories less than 3% go into "Others"
    
    if group_by == 'remarks' and len(grouped) > 10:
        # For remarks, limit to top 10
        top_items = grouped.head(10)
        others_sum = grouped.tail(len(grouped) - 10)['Expense'].sum()
        if others_sum > 0:
            others_row = pd.DataFrame({group_by: ['Others'], 'Expense': [others_sum]})
            grouped = pd.concat([top_items, others_row], ignore_index=True)
        else:
            grouped = top_items
    elif len(grouped) > 12:
        # For categories, group small ones into "Others"
        main_items = grouped[grouped['Expense'] >= threshold]
        small_items = grouped[grouped['Expense'] < threshold]
        if len(small_items) > 0:
            others_sum = small_items['Expense'].sum()
            others_row = pd.DataFrame({group_by: ['Others'], 'Expense': [others_sum]})
            grouped = pd.concat([main_items, others_row], ignore_index=True)
    
    # Calculate percentages
    grouped['Percentage'] = (grouped['Expense'] / total * 100).round(1)
    
    # IMPROVED: Custom text showing both label and amount
    custom_text = [f"{row[group_by]}<br>¥{row['Expense']:,.0f}" 
                   for _, row in grouped.iterrows()]
    
    # Determine colors: use major category colors for major categories, 
    # generate distinct colors for subcategories/remarks
    if group_by == 'major category':
        # Use defined major category colors
        slice_colors = [CATEGORY_COLORS.get(label, THEME['primary']) for label in grouped[group_by]]
    else:
        # Generate distinct colors for subcategories or remarks
        slice_colors = generate_subcategory_colors(grouped[group_by].tolist())
    
    fig = go.Figure(data=[go.Pie(
        labels=grouped[group_by],
        values=grouped['Expense'],
        text=custom_text,
        textposition='inside',
        textinfo='percent',  # Show only percentage inside
        insidetextorientation='radial',
        hovertemplate='<b>%{label}</b><br>¥%{value:,.0f} (%{percent})<extra></extra>',
        hole=0.5,  # Larger hole for donut chart
        marker=dict(
            colors=slice_colors,
            line=dict(color='rgba(15, 23, 42, 0.9)', width=2)
        ),
        sort=False  # Keep our sort order
    )])
    
    # Get base layout and override legend settings
    layout = get_shared_layout(title or default_title)
    layout['legend'] = dict(
        orientation='v',
        y=0.5,
        x=1.05,
        xanchor='left',
        font=dict(color=THEME['label_color'], family=THEME['font_family'], size=11)
    )
    layout['margin'] = dict(t=80, b=80, l=50, r=100)
    
    fig.update_layout(**layout, showlegend=True)
    
    # Add a slight pull to the largest slice if it's significant
    if not grouped.empty and grouped.iloc[0]['Percentage'] > 30:
        pulls = [0.05 if i == 0 else 0 for i in range(len(grouped))]
        fig.update_traces(pull=pulls)
    
    msg = f"Distribution for {filter_label}: ¥{total:,.0f} (n={len(data)} across {len(grouped)} items)"
    
    return fig, msg

@auto_validate
def plot_comparison_bars(df, category=None, major_category=None, remarks=None, 
                         y1=None, m1=None, d1=None, y2=None, m2=None, d2=None, 
                         show_avg=True, title=None):
    """
    Compares spending between two periods with IMPROVED VISUALIZATION:
    - Percentage change indicators
    - Color-coded bars (green for decrease, red for increase)
    - Better spacing and readability
    - Summary comparison metrics
    - **ALWAYS displays the chronologically earlier period first**
    
    Can compare:
    - Two years: y1=2024, y2=2025
    - Two months: y1=2024, m1=12, y2=2025, m2=12 (Dec 2024 vs Dec 2025)
    - Two specific dates: y1=2024, m1=7, d1=21, y2=2025, m2=7, d2=21 (21 July 2024 vs 21 July 2025)
    
    If category specified: shows breakdown within that category (or subcategories of a major category)
    Otherwise: shows breakdown by major categories
    
    NOTE: Regardless of parameter order, the earlier period is always shown first
    """
    data = df.copy()
    data['Date'] = pd.to_datetime(data['Date'])
    
    # Determine comparison type and ensure chronological order
    if d1 and d2:
        # Specific date comparison
        date1 = pd.Timestamp(year=int(y1), month=int(m1), day=int(d1))
        date2 = pd.Timestamp(year=int(y2), month=int(m2), day=int(d2))
        data1 = data[data['Date'].dt.date == date1.date()]
        data2 = data[data['Date'].dt.date == date2.date()]
        period1 = date1.strftime('%Y-%m-%d')
        period2 = date2.strftime('%Y-%m-%d')
        
        # Swap if date2 is earlier than date1
        if date2 < date1:
            data1, data2 = data2, data1
            period1, period2 = period2, period1
            
    elif m1 and m2:
        # Month comparison
        date1 = pd.Timestamp(year=int(y1), month=int(m1), day=1)
        date2 = pd.Timestamp(year=int(y2), month=int(m2), day=1)
        data1 = data[(data['Date'].dt.year == int(y1)) & (data['Date'].dt.month == int(m1))]
        data2 = data[(data['Date'].dt.year == int(y2)) & (data['Date'].dt.month == int(m2))]
        period1 = f"{y1}-{m1:02d}"
        period2 = f"{y2}-{m2:02d}"
        
        # Swap if date2 is earlier than date1
        if date2 < date1:
            data1, data2 = data2, data1
            period1, period2 = period2, period1
            
    else:
        # Year comparison
        data1 = data[data['Date'].dt.year == int(y1)]
        data2 = data[data['Date'].dt.year == int(y2)]
        period1 = str(y1)
        period2 = str(y2)
        
        # Swap if y2 is earlier than y1
        if int(y2) < int(y1):
            data1, data2 = data2, data1
            period1, period2 = period2, period1

    
    # Category filtering
    if category:
        data1 = data1[data1['category'].str.lower() == category.lower()]
        data2 = data2[data2['category'].str.lower() == category.lower()]
        group_by = 'category'
        label = category
    elif major_category:
        data1 = data1[data1['major category'].str.lower() == major_category.lower()]
        data2 = data2[data2['major category'].str.lower() == major_category.lower()]
        group_by = 'category'
        label = major_category
    elif remarks:
        data1 = data1[data1['remarks'].str.contains(remarks, case=False, na=False)]
        data2 = data2[data2['remarks'].str.contains(remarks, case=False, na=False)]
        group_by = 'remarks'
        label = f"'{remarks}'"
    else:
        group_by = 'major category'
        label = 'All Categories'
    
    if data1.empty or data2.empty:
        return None, f"Insufficient data to compare {period1} and {period2}."
    
    # Aggregate data
    if show_avg:
        stats1 = data1.groupby(group_by)['Expense'].agg(['sum', 'mean', 'count'])
        stats2 = data2.groupby(group_by)['Expense'].agg(['sum', 'mean', 'count'])
        
        sum1, avg1, count1 = stats1['sum'], stats1['mean'], stats1['count']
        sum2, avg2, count2 = stats2['sum'], stats2['mean'], stats2['count']
    else:
        stats1 = data1.groupby(group_by)['Expense'].agg(['sum', 'count'])
        stats2 = data2.groupby(group_by)['Expense'].agg(['sum', 'count'])
        sum1, count1 = stats1['sum'], stats1['count']
        sum2, count2 = stats2['sum'], stats2['count']
    
    # Combine and fill missing categories
    all_cats = sorted(set(sum1.index) | set(sum2.index))
    
    if show_avg:
        max_total = max(sum1.max() if not sum1.empty else 0, sum2.max() if not sum2.empty else 0)
        max_avg = max(avg1.max() if not avg1.empty else 0, avg2.max() if not avg2.empty else 0)
        
        fig = make_subplots(
            rows=2, cols=1, 
            shared_xaxes=False,  # Changed from True to False to show categories on both plots
            vertical_spacing=0.15,
            subplot_titles=('Total Amount (¥)', 'Avg per Transaction (¥)')
        )
        
        # Row 1: Totals
        fig.add_trace(go.Bar(
            name=f"{period1} Total",
            x=all_cats,
            y=[sum1.get(c, 0) for c in all_cats],
            text=[f'¥{sum1.get(c, 0):,.0f}' for c in all_cats],
            textposition='outside',
            marker_color=THEME['primary'],
            legendgroup='group1',
            cliponaxis=False,
            customdata=[count1.get(c, 0) for c in all_cats],
            hovertemplate='<b>%{x}</b><br>'+period1+' Total: ¥%{y:,.0f}<br>Count: %{customdata}<extra></extra>'
        ), row=1, col=1)
        
        fig.add_trace(go.Bar(
            name=f"{period2} Total",
            x=all_cats,
            y=[sum2.get(c, 0) for c in all_cats],
            text=[f'¥{sum2.get(c, 0):,.0f}' for c in all_cats],
            textposition='outside',
            marker_color=THEME['secondary'],
            legendgroup='group2',
            cliponaxis=False,
            customdata=[count2.get(c, 0) for c in all_cats],
            hovertemplate='<b>%{x}</b><br>'+period2+' Total: ¥%{y:,.0f}<br>Count: %{customdata}<extra></extra>'
        ), row=1, col=1)
        
        # Row 2: Averages
        fig.add_trace(go.Bar(
            name=f"{period1} Avg",
            x=all_cats,
            y=[avg1.get(c, 0) for c in all_cats],
            text=[f'¥{avg1.get(c, 0):,.0f}' for c in all_cats],
            textposition='outside',
            marker_color=THEME['primary'],
            legendgroup='group1',
            showlegend=False,
            cliponaxis=False,
            customdata=[count1.get(c, 0) for c in all_cats],
            hovertemplate='<b>%{x}</b><br>'+period1+' Avg: ¥%{y:,.0f}<br>Count: %{customdata}<extra></extra>'
        ), row=2, col=1)
        
        fig.add_trace(go.Bar(
            name=f"{period2} Avg",
            x=all_cats,
            y=[avg2.get(c, 0) for c in all_cats],
            text=[f'¥{avg2.get(c, 0):,.0f}' for c in all_cats],
            textposition='outside',
            marker_color=THEME['secondary'],
            legendgroup='group2',
            showlegend=False,
            cliponaxis=False,
            customdata=[count2.get(c, 0) for c in all_cats],
            hovertemplate='<b>%{x}</b><br>'+period2+' Avg: ¥%{y:,.0f}<br>Count: %{customdata}<extra></extra>'
        ), row=2, col=1)
        
        fig.update_yaxes(range=[0, max_total * 1.35], tickprefix='¥', row=1, col=1)
        fig.update_yaxes(range=[0, max_avg * 1.35], tickprefix='¥', row=2, col=1)
        fig.update_xaxes(title_text="Category", row=1, col=1)
        fig.update_xaxes(title_text="Category", row=2, col=1)
        
        fig.update_layout(height=650)
    else:
        max_val = max(sum1.max() if not sum1.empty else 0, sum2.max() if not sum2.empty else 0)
        fig = go.Figure()
        
        fig.add_trace(go.Bar(
            name=period1,
            x=all_cats,
            y=[sum1.get(c, 0) for c in all_cats],
            text=[f'¥{sum1.get(c, 0):,.0f}' for c in all_cats],
            textposition='outside',
            textfont=dict(size=10),
            marker_color=THEME['primary'],
            cliponaxis=False,
            customdata=[count1.get(c, 0) for c in all_cats],
            hovertemplate='<b>%{x}</b><br>'+period1+': ¥%{y:,.0f}<br>Count: %{customdata}<extra></extra>'
        ))
        
        fig.add_trace(go.Bar(
            name=period2,
            x=all_cats,
            y=[sum2.get(c, 0) for c in all_cats],
            text=[f'¥{sum2.get(c, 0):,.0f}' for c in all_cats],
            textposition='outside',
            textfont=dict(size=10),
            marker_color=THEME['secondary'],
            cliponaxis=False,
            customdata=[count2.get(c, 0) for c in all_cats],
            hovertemplate='<b>%{x}</b><br>'+period2+': ¥%{y:,.0f}<br>Count: %{customdata}<extra></extra>'
        ))
        fig.update_yaxes(range=[0, max_val * 1.25], tickprefix='¥')
    
    fig.update_layout(
        **get_shared_layout(title or f"{label}: {period1} vs {period2}"),
        xaxis_title="Category" if not show_avg else None,
        yaxis_title="Amount (¥)",
        barmode='group',
        bargap=0.25,
        bargroupgap=0.1,
        uniformtext_mode='hide',
        uniformtext_minsize=9
    )
    
    if show_avg:
        # Update subplot titles font and position
        for i in fig['layout']['annotations']:
            i['font'] = dict(size=15, color=THEME['title_color'], family=THEME['font_family'])
            i['y'] = i['y'] + 0.02 # Slightly nudge up

    # Calculate overall totals and change
    total1 = sum1.sum()
    total2 = sum2.sum()

    if total1 > 0:
        change_pct = ((total2 - total1) / total1) * 100
    else:
        change_pct = 100 if total2 > 0 else 0

    change_direction = (
        "increase" if change_pct > 0
        else "decrease" if change_pct < 0
        else "no change"
    )

    
    msg = f"Comparison: {period1} (¥{total1:,.0f}) vs {period2} (¥{total2:,.0f}) | " \
          f"Change: {abs(change_pct):.1f}% {change_direction}"
    
    return fig, msg

@auto_validate
def calculate_total(df, category=None, major_category=None, year=None, month=None, day=None,
                    start_year=None, end_year=None, remarks=None):
    """
    Calculates total spending with transaction count and average per transaction.
    
    Time filters (use ONE):
    - year + month + day: specific date (e.g., year=2024, month=7, day=21 for July 21, 2024)
    - year + month: specific month
    - year: entire year
    - start_year + end_year: year range
    - (none): all time
    
    Category filters (use ONE):
    - category: specific category OR broad category
    - remarks: search in transaction remarks
    """
    data = df.copy()
    data['Date'] = pd.to_datetime(data['Date'])
    
    # Time filtering
    if year and month and day:
        specific_date = pd.Timestamp(year=int(year), month=int(month), day=int(day))
        data = data[data['Date'].dt.date == specific_date.date()]
        time_label = specific_date.strftime('%Y-%m-%d')
    elif year and month:
        data = data[(data['Date'].dt.year == int(year)) & (data['Date'].dt.month == int(month))]
        time_label = f"{year}-{month:02d}"
    elif year:
        data = data[data['Date'].dt.year == int(year)]
        time_label = str(year)
    elif start_year and end_year:
        data = data[(data['Date'].dt.year >= int(start_year)) & (data['Date'].dt.year <= int(end_year))]
        time_label = f"{start_year}-{end_year}"
    else:
        time_label = "all time"
    
    # Category filtering
    if category:
        data = data[data['category'].str.lower() == category.lower()]
        label = category
    elif major_category:
        data = data[data['major category'].str.lower() == major_category.lower()]
        label = major_category
    elif remarks:
        data = data[data['remarks'].str.contains(remarks, case=False, na=False)]
        label = f"'{remarks}'"
    else:
        label = "Total"
    
    if data.empty:
        return None, f"No transactions found for {label} in {time_label}."
    
    total = data['Expense'].sum()
    count = len(data)
    avg_per_transaction = total / count
    
    msg = f"{label} in {time_label}: ¥{total:,.0f} (n={count}, avg ¥{avg_per_transaction:,.0f})"
    
    return None, msg

@auto_validate
def calculate_statistics(df, category=None, major_category=None, remarks=None,
                        y1=None, m1=None, d1=None, y2=None, m2=None, d2=None, compare=False):
    """
    Calculates spending statistics: mean, median, std deviation.
    If compare=True and two periods specified: runs t-test to check if difference is significant.
    
    Single period analysis: provide category + y1 (and optionally m1, d1)
    Comparison: provide y1, y2 (and optionally m1, m2, d1, d2) + set compare=True
    
    For specific date comparison: y1=2024, m1=7, d1=21, y2=2025, m2=7, d2=21, compare=True
    """
    data = df.copy()
    data['Date'] = pd.to_datetime(data['Date'])
    
    if compare and y1 and y2:
        # Comparison mode
        if d1 and d2:
            # Specific date comparison
            date1 = pd.Timestamp(year=int(y1), month=int(m1), day=int(d1))
            date2 = pd.Timestamp(year=int(y2), month=int(m2), day=int(d2))
            data1 = data[data['Date'].dt.date == date1.date()]
            data2 = data[data['Date'].dt.date == date2.date()]
            period1 = date1.strftime('%Y-%m-%d')
            period2 = date2.strftime('%Y-%m-%d')
        elif m1 and m2:
            data1 = data[(data['Date'].dt.year == int(y1)) & (data['Date'].dt.month == int(m1))]
            data2 = data[(data['Date'].dt.year == int(y2)) & (data['Date'].dt.month == int(m2))]
            period1 = f"{y1}-{m1:02d}"
            period2 = f"{y2}-{m2:02d}"
        else:
            data1 = data[data['Date'].dt.year == int(y1)]
            data2 = data[data['Date'].dt.year == int(y2)]
            period1 = str(y1)
            period2 = str(y2)
        
        # Apply category filter
        if category:
            data1 = data1[data1['category'].str.lower() == category.lower()]
            data2 = data2[data2['category'].str.lower() == category.lower()]
            label = category
        elif major_category:
            data1 = data1[data1['major category'].str.lower() == major_category.lower()]
            data2 = data2[data2['major category'].str.lower() == major_category.lower()]
            label = major_category
        elif remarks:
            data1 = data1[data1['remarks'].str.contains(remarks, case=False, na=False)]
            data2 = data2[data2['remarks'].str.contains(remarks, case=False, na=False)]
            label = f"'{remarks}'"
        else:
            label = "Total"
        
        if len(data1) < 2 or len(data2) < 2:
            return None, f"Insufficient data for statistical comparison of {label}."
        
        s1 = data1['Expense']
        s2 = data2['Expense']
        
        # T-test
        t_stat, p_value = stats.ttest_ind(s1, s2, equal_var=False, nan_policy='omit')
        
        # Effect size (Cohen's d)
        pooled_std = np.sqrt(((len(s1)-1)*s1.std()**2 + (len(s2)-1)*s2.std()**2) / (len(s1)+len(s2)-2))
        cohens_d = (s1.mean() - s2.mean()) / pooled_std if pooled_std > 0 else 0
        
        sig = "statistically significant" if p_value < 0.05 else "not statistically significant"
        effect = "large" if abs(cohens_d) > 0.8 else "medium" if abs(cohens_d) > 0.5 else "small"
        
        msg = f"{label} - {period1}: mean ¥{s1.mean():,.0f} (n={len(s1)}), "
        msg += f"{period2}: mean ¥{s2.mean():,.0f} (n={len(s2)}) | "
        msg += f"Difference is {sig} (p={p_value:.4f}), effect size: {effect} (d={cohens_d:.3f})"
        
        return None, msg
    
    else:
        # Single period statistics
        if y1 and m1:
            data = data[(data['Date'].dt.year == int(y1)) & (data['Date'].dt.month == int(m1))]
            time_label = f"{y1}-{m1:02d}"
        elif y1:
            data = data[data['Date'].dt.year == int(y1)]
            time_label = str(y1)
        else:
            time_label = "all time"
        
        if category:
            data = data[data['category'].str.lower() == category.lower()]
            label = category
        elif major_category:
            data = data[data['major category'].str.lower() == major_category.lower()]
            label = major_category
        elif remarks:
            data = data[data['remarks'].str.contains(remarks, case=False, na=False)]
            label = f"'{remarks}'"
        else:
            label = "Total"
        
        if data.empty:
            return None, f"No transactions found for {label} in {time_label}."
        
        mean_val = data['Expense'].mean()
        median_val = data['Expense'].median()
        std_val = data['Expense'].std()
        
        return None, f"{label} in {time_label}: Mean ¥{mean_val:,.0f}, Median ¥{median_val:,.0f}, Std Dev ¥{std_val:,.0f} (n={len(data)})"

@auto_validate
def get_top_expenses(df, n=10, category=None, major_category=None, remarks=None,
                    year=None, month=None, min_amount=None):
    """
    Returns the top N largest expenses with details.
    Useful for finding biggest spending items.
    
    Args:
    - n: number of top expenses to return (default 10)
    - min_amount: only show expenses above this amount
    """
    data = df.copy()
    data['Date'] = pd.to_datetime(data['Date'])
    
    # Time filtering
    if year and month:
        data = data[(data['Date'].dt.year == int(year)) & (data['Date'].dt.month == int(month))]
        time_label = f"{year}-{month:02d}"
    elif year:
        data = data[data['Date'].dt.year == int(year)]
        time_label = str(year)
    else:
        time_label = "all time"
    
    # Category filtering
    if category:
        data = data[data['category'].str.lower() == category.lower()]
        label = category
    elif major_category:
        data = data[data['major category'].str.lower() == major_category.lower()]
        label = major_category
    elif remarks:
        data = data[data['remarks'].str.contains(remarks, case=False, na=False)]
        label = f"'{remarks}'"
    else:
        label = "all expenses"
    
    # Amount filtering
    if min_amount:
        data = data[data['Expense'] >= float(min_amount)]
    
    if data.empty:
        return None, f"No expenses found for {label} in {time_label}."
    
    # Get top N
    top_data = data.nlargest(n, 'Expense')[['Date', 'Expense', 'category', 'remarks']]
    
    msg = f"Top {min(n, len(top_data))} expenses for {label} in {time_label}:\n"
    for idx, row in top_data.iterrows():
        date_str = row['Date'].strftime('%Y-%m-%d')
        remarks_str = f" - {row['rema rks']}" if pd.notna(row['remarks']) else ""
        msg += f"• {date_str}: ¥{row['Expense']:,.0f} ({row['category']}){remarks_str}\n"
    
    return None, msg.strip()