
import * as XLSX from 'xlsx';
import { CATEGORY_MAPPING } from './categoryMapping';
import { format, parseISO, isWithinInterval, startOfYear, endOfYear, startOfMonth, endOfMonth, parse } from 'date-fns';

export const processExcelFile = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Parse to JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                    raw: false,
                    dateNF: 'yyyy-mm-dd'
                });

                // Clean and Transform
                const processedData = jsonData
                    .map(row => {
                        // Handle various date formats potentially coming from Excel
                        let dateObj = new Date(row.Date || row.date);
                        if (isNaN(dateObj.getTime())) {
                            // simple fallback if string
                            dateObj = new Date(Date.parse(row.Date || row.date));
                        }

                        // Robust header selection based on uploaded Excel
                        const rawCategory = (row.category || 'Unknown').toString().trim().normalize('NFC');
                        const rawExpense = row.Expense || row.expense || 0;
                        const remarks = row.remarks || '';
                        const onetime = row.onetime || 0;
                        const forOthers = row['for others'] || 0;

                        // Map category (case-insensitive and robust)
                        let newCategory = rawCategory;
                        const lowerRaw = rawCategory.toLowerCase();

                        // Find match in mapping (case-insensitive)
                        const mappingMatch = Object.entries(CATEGORY_MAPPING).find(
                            ([key]) => key.toLowerCase() === lowerRaw
                        );

                        if (mappingMatch) {
                            newCategory = mappingMatch[1];
                        }

                        return {
                            ...row,
                            Date: dateObj,
                            Expense: parseFloat(rawExpense) || 0,
                            remarks: remarks,
                            category: rawCategory,
                            Category: rawCategory, // Keep both for safety
                            NewCategory: newCategory,
                            Onetime: onetime == 1,
                            'for others': forOthers == 1 ? 1 : 0
                        };
                    })
                    .filter(row => {
                        // Stricter filtering for robustness
                        const hasValidDate = row.Date instanceof Date && !isNaN(row.Date.getTime());
                        const hasValidExpense = typeof row.Expense === 'number' && row.Expense > 0;
                        return hasValidDate && hasValidExpense;
                    });

                resolve(processedData);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

export const filterData = (data, filters) => {
    const { type, year, month, date, startDate, endDate, includeRent } = filters;

    let filtered = [...data];

    // 1. Rent Logic
    if (!includeRent) {
        // Filter out specific 'housing' category (rent), but keep utilities
        filtered = filtered.filter(row => row.Category && row.Category.toLowerCase() !== 'housing');
    }

    // 2. Date Filtering
    filtered = filtered.filter(row => {
        const rowDate = row.Date;
        if (type === 'Year') {
            return rowDate.getFullYear() === year;
        } else if (type === 'Month') {
            return rowDate.getFullYear() === year && rowDate.getMonth() === month; // month is 0-indexed
        } else if (type === 'Day') {
            // Compare YYYY-MM-DD strings
            return format(rowDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
        } else if (type === 'Custom Range') {
            return isWithinInterval(rowDate, { start: startDate, end: endDate });
        }
        return true;
    });

    return filtered;
};

export const calculateMetrics = (data) => {
    const total = data.reduce((sum, row) => sum + row.Expense, 0);
    // Simple Approximation for period logic
    if (data.length === 0) return { total: 0, avgMonthly: 0, avgDaily: 0, days: 0 };

    // Sort by date to find range
    const sortedDates = data.map(d => d.Date.getTime()).sort((a, b) => a - b);
    const minDate = new Date(sortedDates[0]);
    const maxDate = new Date(sortedDates[sortedDates.length - 1]);

    // Days diff
    const diffTime = Math.abs(maxDate - minDate);
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const months = Math.max(days / 30, 0.03); // At least ~1 day worth if some data exists

    return {
        total,
        avgMonthly: total / (months || 1),
        avgDaily: total / (days || 1),
        days
    };
};

/**
 * Safely find the minimum value in an array (handles large arrays where spread operator might crash)
 */
export const safeMin = (arr) => {
    if (!arr || arr.length === 0) return null;
    return arr.reduce((min, val) => val < min ? val : min, arr[0]);
};

/**
 * Safely find the maximum value in an array (handles large arrays where spread operator might crash)
 */
export const safeMax = (arr) => {
    if (!arr || arr.length === 0) return null;
    return arr.reduce((max, val) => val > max ? val : max, arr[0]);
};
