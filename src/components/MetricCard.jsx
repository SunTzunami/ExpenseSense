
import React from 'react';
import { motion } from 'framer-motion';

const MetricCard = ({ title, value, subtext, icon: Icon, color, currency = 'JPY' }) => {

    const formatCurrency = (val) => {
        if (typeof val !== 'number') return val;

        const locales = {
            'JPY': 'ja-JP',
            'INR': 'en-IN'
        };

        try {
            return new Intl.NumberFormat(locales[currency] || 'en-US', {
                style: 'currency',
                currency: currency,
                maximumFractionDigits: 0
            }).format(val);
        } catch (e) {
            // Fallback
            const symbols = { 'JPY': '¥', 'INR': '₹' };
            return `${symbols[currency] || currency} ${val.toLocaleString()}`;
        }
    };

    const getColorClasses = (clr) => {
        switch (clr) {
            case 'blue': return 'bg-indigo-500 text-indigo-400';
            case 'indigo': return 'bg-indigo-600 text-indigo-400';
            case 'pink': return 'bg-purple-500 text-purple-400';
            case 'red': return 'bg-purple-600 text-purple-400';
            case 'purple': return 'bg-violet-500 text-violet-400';
            default: return 'bg-indigo-500 text-indigo-400';
        }
    };

    const getGlowClass = (clr) => {
        switch (clr) {
            case 'blue': return 'bg-indigo-500';
            case 'indigo': return 'bg-indigo-600';
            case 'pink': return 'bg-purple-500';
            case 'red': return 'bg-purple-600';
            case 'purple': return 'bg-violet-500';
            default: return 'bg-indigo-500';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-6 flex flex-col justify-between relative overflow-hidden group"
        >
            <div className="flex items-start gap-4 z-10">
                <div className={`p-3 rounded-xl bg-opacity-20 flex-shrink-0 ${getColorClasses(color)}`}>
                    {Icon && <Icon size={24} />}
                </div>
                <div className="flex-1">
                    <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider">{title}</h3>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-white tracking-tight">
                            {formatCurrency(value)}
                        </span>
                    </div>
                </div>
            </div>

            {subtext && (
                <p className="mt-4 text-xs text-gray-400 z-10">
                    {subtext}
                </p>
            )}

            {/* Ambient background glow */}
            <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-3xl opacity-20 ${getGlowClass(color)} group-hover:opacity-40 transition-opacity duration-500`} />
        </motion.div>
    );
};

export default MetricCard;
