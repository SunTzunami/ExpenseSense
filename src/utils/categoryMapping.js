import categoriesData from './categories.json';

export const CATEGORY_COLORS = categoriesData.CATEGORY_COLORS;
export const CATEGORY_MAPPING = categoriesData.CATEGORY_MAPPING;
export const MAJOR_CATEGORIES = Object.keys(CATEGORY_COLORS);

export function getDashboardCategory(rawCategory) {
    if (!rawCategory) return 'Miscellaneous';

    const normalized = rawCategory.trim().toLowerCase();

    return CATEGORY_MAPPING[normalized] || 'Miscellaneous';
}
