import React, { useState } from 'react';
import { TrendingUp, Calendar, Award, Info, ChevronRight, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

const InsightCards = ({ data, currency = 'JPY' }) => {
    const [showStreakDetails, setShowStreakDetails] = useState(false);
    const [showSplurgeDetails, setShowSplurgeDetails] = useState(false);

    const formatCurrency = (val) => {
        if (val === null || val === undefined || isNaN(val)) return '-';
        if (typeof val !== 'number') return val;

        const locales = { 'JPY': 'ja-JP', 'INR': 'en-IN' };
        try {
            return new Intl.NumberFormat(locales[currency] || 'en-US', {
                style: 'currency',
                currency: currency,
                maximumFractionDigits: 0
            }).format(val);
        } catch (e) {
            const symbols = { 'JPY': '¥', 'INR': '₹' };
            return `${symbols[currency] || currency} ${val.toLocaleString()}`;
        }
    };

    if (!data || data.length === 0) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-5 border-l-4 border-slate-700 text-slate-500 text-sm">No data for insights</div>
                <div className="glass-panel p-5 border-l-4 border-slate-700 text-slate-500 text-sm">No data for insights</div>
                <div className="glass-panel p-5 border-l-4 border-slate-700 text-slate-500 text-sm">No data for insights</div>
            </div>
        );
    }

    // Find top spending day
    const dailyData = {};
    data.forEach(row => {
        if (!row.Date || isNaN(row.Date.getTime())) return;
        const dateKey = format(row.Date, 'yyyy-MM-dd');
        if (!dailyData[dateKey]) {
            dailyData[dateKey] = { total: 0, items: [] };
        }
        dailyData[dateKey].total += row.Expense;
        dailyData[dateKey].items.push(row);
    });

    const topDayEntry = Object.entries(dailyData).sort((a, b) => b[1].total - a[1].total)[0];
    const topDay = topDayEntry ? { date: topDayEntry[0], total: topDayEntry[1].total, items: topDayEntry[1].items } : null;

    // Find longest category streak
    const sortedData = [...data].sort((a, b) => a.Date - b.Date);
    const dailyTopCategory = {};

    sortedData.forEach(row => {
        if (!row.Date || isNaN(row.Date.getTime())) return;
        const dateKey = format(row.Date, 'yyyy-MM-dd');
        if (!dailyTopCategory[dateKey]) {
            dailyTopCategory[dateKey] = {};
        }
        dailyTopCategory[dateKey][row.NewCategory] = (dailyTopCategory[dateKey][row.NewCategory] || 0) + row.Expense;
    });

    let currentStreak = 0;
    let maxStreak = 0;
    let maxStreakCategory = '';
    let streakDays = [];
    let tempStreakDays = [];
    let lastCategory = null;

    Object.keys(dailyTopCategory).sort().forEach(date => {
        const topCat = Object.entries(dailyTopCategory[date]).sort((a, b) => b[1] - a[1])[0]?.[0];
        if (topCat === lastCategory) {
            currentStreak++;
            tempStreakDays.push(date);
        } else {
            if (currentStreak > maxStreak) {
                maxStreak = currentStreak;
                maxStreakCategory = lastCategory;
                streakDays = [...tempStreakDays];
            }
            currentStreak = 1;
            lastCategory = topCat;
            tempStreakDays = [date];
        }
    });

    // Final check for the last streak
    if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
        maxStreakCategory = lastCategory;
        streakDays = [...tempStreakDays];
    }

    // Average expense per category
    const categoryTotals = {};
    const categoryCounts = {};
    data.forEach(row => {
        categoryTotals[row.NewCategory] = (categoryTotals[row.NewCategory] || 0) + row.Expense;
        categoryCounts[row.NewCategory] = (categoryCounts[row.NewCategory] || 0) + 1;
    });

    const avgPerCategory = Object.entries(categoryTotals).map(([cat, total]) => ({
        category: cat,
        avg: total / categoryCounts[cat]
    })).sort((a, b) => b.avg - a.avg)[0];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Biggest Splurge */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel p-5 border-l-4 border-indigo-500 group relative"
            >
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-indigo-500/20 rounded-xl">
                        <TrendingUp className="text-indigo-400" size={24} />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Biggest Splurge</p>
                            <div className="group/tip relative">
                                <Info size={12} className="text-slate-600 hover:text-indigo-400 cursor-help transition-colors" />
                                <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-900 border border-white/10 rounded-lg shadow-xl text-[10px] text-slate-300 hidden group-hover/tip:block z-[100] backdrop-blur-md">
                                    The single highest total amount spent in one calendar day.
                                    <p className="mt-1 text-indigo-400/80 italic font-medium">Helps identify "peak" spending events.</p>
                                    <div className="absolute top-full right-1 w-2 h-2 bg-slate-900 border-r border-b border-white/10 rotate-45 -translate-y-1/2"></div>
                                </div>
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-white tracking-tight">{topDay?.total ? formatCurrency(topDay.total) : '-'}</p>
                        <p className="text-xs text-slate-500 mt-2 flex items-center justify-between">
                            <span className="flex items-center gap-1">
                                <Calendar size={12} /> {topDay?.date && (new Date(topDay.date) instanceof Date && !isNaN(new Date(topDay.date))) ? format(new Date(topDay.date), 'EEEE, MMMM dd, yyyy') : '-'}
                            </span>
                            <button
                                onClick={() => setShowSplurgeDetails(!showSplurgeDetails)}
                                className="text-[10px] font-bold text-indigo-400/70 hover:text-indigo-400 flex items-center gap-1 uppercase tracking-tighter"
                            >
                                {showSplurgeDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                {showSplurgeDetails ? 'Hide' : 'Details'}
                            </button>
                        </p>
                    </div>
                </div>

                <AnimatePresence>
                    {showSplurgeDetails && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-4 pt-4 border-t border-white/5 space-y-2 overflow-hidden"
                        >
                            <p className="text-[10px] text-slate-500 uppercase">Splurge Breakdown</p>
                            <div className="space-y-1 px-1">
                                {topDay?.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-[11px] text-slate-400 bg-white/5 px-2 py-1.5 rounded border border-white/5">
                                        <span className="truncate max-w-[140px]">{item.Remark || item.Description || item.Category}</span>
                                        <span className="font-bold text-white shrink-0 ml-2">{formatCurrency(item.Expense)}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Category Streak */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-panel p-5 border-l-4 border-purple-500 group relative"
            >
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-purple-500/20 rounded-xl">
                        <Award className="text-purple-400" size={24} />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Category Streak</p>
                            <div className="group/tip relative">
                                <Info size={12} className="text-slate-600 hover:text-purple-400 cursor-help transition-colors" />
                                <div className="absolute bottom-full right-0 mb-2 w-56 p-2 bg-slate-900 border border-white/10 rounded-lg shadow-xl text-[10px] text-slate-300 hidden group-hover/tip:block z-[100] backdrop-blur-md">
                                    The longest period where the same category was your #1 spending daily.
                                    <p className="mt-1 text-purple-400/80 italic font-medium">Shows persistent spending habits or "binge" behavior.</p>
                                    <div className="absolute top-full right-1 w-2 h-2 bg-slate-900 border-r border-b border-white/10 rotate-45 -translate-y-1/2"></div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-bold text-white tracking-tight">{maxStreak} days</p>
                            <span className="text-xs text-purple-400/70 font-medium">Record</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 font-medium">{maxStreakCategory || '-'}</p>

                        <button
                            onClick={() => setShowStreakDetails(!showStreakDetails)}
                            className="mt-3 text-[10px] font-bold text-purple-400/70 hover:text-purple-400 flex items-center gap-1 uppercase tracking-tighter"
                        >
                            {showStreakDetails ? <><ChevronDown size={14} /> Hide Dates</> : <><ChevronRight size={14} /> Reveal Dates</>}
                        </button>
                    </div>
                </div>

                <AnimatePresence>
                    {showStreakDetails && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-4 pt-4 border-t border-white/5 space-y-1 overflow-hidden"
                        >
                            <p className="text-[10px] text-slate-500 uppercase mb-2">Streak Window</p>
                            <div className="grid grid-cols-2 gap-1 px-1">
                                {streakDays.map(date => (
                                    <div key={date} className="text-[11px] text-slate-400 bg-white/5 px-2 py-1 rounded">
                                        {format(new Date(date), 'MMM dd')}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Priciest Category */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-panel p-5 border-l-4 border-violet-500 relative group"
            >
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-violet-500/20 rounded-xl">
                        <Calendar className="text-violet-400" size={24} />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Priciest Category</p>
                            <div className="group/tip relative">
                                <Info size={12} className="text-slate-600 hover:text-violet-400 cursor-help transition-colors" />
                                <div className="absolute bottom-full right-0 mb-2 w-56 p-2 bg-slate-900 border border-white/10 rounded-lg shadow-xl text-[10px] text-slate-300 hidden group-hover/tip:block z-[100] backdrop-blur-md">
                                    The category with the highest <strong>average cost per transaction</strong>.
                                    <p className="mt-1 text-violet-400/80 italic font-medium">Identifies where each "swipe" hurts the most.</p>
                                    <div className="absolute top-full right-1 w-2 h-2 bg-slate-900 border-r border-b border-white/10 rotate-45 -translate-y-1/2"></div>
                                </div>
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-white tracking-tight">
                            {avgPerCategory?.avg ? formatCurrency(avgPerCategory.avg) : '-'}
                        </p>
                        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                            {avgPerCategory?.category} <span className="text-[10px] opacity-60">(Average/Tx)</span>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default InsightCards;
