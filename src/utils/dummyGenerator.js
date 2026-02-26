
import { addDays } from 'date-fns';

/**
 * Generates dummy expense data for demonstration purposes.
 * Spans the current year.
 */
export const generateDummyData = () => {
    const data = [];
    const categories = [
        'Food', 'Housing and Utilities', 'Transportation', 'Entertainment',
        'Household and Clothing', 'Fitness', 'Education', 'Miscellaneous'
    ];

    const descriptions = {
        'Food': ['Starbucks', 'Grocery Store', 'Uber Eats', 'Restaurant', 'Cafe'],
        'Housing and Utilities': ['Rent', 'Electric Bill', 'Internet', 'Gas Bill'],
        'Transportation': ['Uber', 'Subway Pass', 'Gas Station', 'Taxi'],
        'Entertainment': ['Netflix', 'Cinema', 'Spotify', 'Concert Ticket', 'Game'],
        'Household and Clothing': ['Uniqlo', 'IKEA', 'Amazon', 'Zara'],
        'Fitness': ['Gym Membership', 'Protein Powder', 'Yoga Class'],
        'Education': ['Bookstore', 'Online Course', 'Stationery'],
        'Miscellaneous': ['Pharmacy', 'Gift', 'Convenience Store']
    };

    const currentDate = new Date();
    const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
    const endOfYear = new Date(currentDate.getFullYear(), 11, 31);

    // Generate ~300 transactions scattered through the year
    const numTransactions = 300;

    for (let i = 0; i < numTransactions; i++) {
        // Random date within the year
        const randomTime = startOfYear.getTime() + Math.random() * (endOfYear.getTime() - startOfYear.getTime());
        const date = new Date(randomTime);

        // Pick random category and description
        const category = categories[Math.floor(Math.random() * categories.length)];
        const descList = descriptions[category];
        const description = descList[Math.floor(Math.random() * descList.length)];

        // Random amount (skewed towards smaller amounts)
        let amount;
        if (category === 'Housing and Utilities' && description === 'Rent') {
            amount = 1200 + Math.random() * 100; // Rent is high
        } else {
            amount = 10 + Math.random() * 100; // General expenses
        }

        // Occasional outlier/high expense
        if (Math.random() > 0.95) {
            amount *= 3;
        }

        data.push({
            Date: date,
            Description: description,
            Expense: parseFloat(amount.toFixed(2)),
            Category: category,
            NewCategory: category, // Mapping logic usually handles this, but for dummy we just keep it same
            Onetime: Math.random() > 0.9,
            'for others': Math.random() > 0.95
        });
    }

    // Ensure sorting
    return data.sort((a, b) => a.Date - b.Date);
};
