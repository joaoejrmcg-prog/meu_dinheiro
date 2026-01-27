
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Mock function to simulate the logic we just implemented (since we can't easily call the server action from here without mocking cookies)
// We will basically replicate the logic here to verify it works against the DB, 
// OR we can try to invoke the action if we can mock the context, but that's hard.
// BETTER APPROACH: We will manually create a test scenario in DB, run the logic (by copying it here), and verify.
// Wait, I can't call the server action directly because of `cookies()`.
// So I will verify the LOGIC itself by running a script that does the same thing, 
// ensuring my understanding of the date math is correct.

function calculateCardDueDate(purchaseDate: Date, closingDay: number, dueDay: number): Date {
    const pDay = purchaseDate.getDate();
    const pMonth = purchaseDate.getMonth();
    const pYear = purchaseDate.getFullYear();

    let invoiceMonth = pMonth;
    let invoiceYear = pYear;

    if (pDay > closingDay) {
        invoiceMonth++;
        if (invoiceMonth > 11) {
            invoiceMonth = 0;
            invoiceYear++;
        }
    }

    let dueMonth = invoiceMonth;
    let dueYear = invoiceYear;

    if (dueDay <= closingDay) {
        dueMonth++;
        if (dueMonth > 11) {
            dueMonth = 0;
            dueYear++;
        }
    }

    let dueDate = new Date(dueYear, dueMonth, dueDay);

    if (dueDate.getMonth() !== dueMonth) {
        dueDate = new Date(dueYear, dueMonth + 1, 0);
    }

    return dueDate;
}

async function testLogic() {
    console.log('--- Testing Date Logic ---');

    // Case 1: Standard
    // Closing 10, Due 17. Purchase 05/01. -> Due 17/01
    let d1 = calculateCardDueDate(new Date(2026, 0, 5), 10, 17);
    console.log('Case 1 (05/01, C:10, D:17) ->', d1.toISOString().split('T')[0], d1.getDate() === 17 ? '✅' : '❌');

    // Case 2: Purchase after closing
    // Closing 10, Due 17. Purchase 15/01. -> Due 17/02
    let d2 = calculateCardDueDate(new Date(2026, 0, 15), 10, 17);
    console.log('Case 2 (15/01, C:10, D:17) ->', d2.toISOString().split('T')[0], d2.getMonth() === 1 ? '✅' : '❌');

    // Case 3: Due day before closing (next month)
    // Closing 25, Due 05. Purchase 20/01. -> Due 05/02
    let d3 = calculateCardDueDate(new Date(2026, 0, 20), 25, 5);
    console.log('Case 3 (20/01, C:25, D:05) ->', d3.toISOString().split('T')[0], d3.getMonth() === 1 && d3.getDate() === 5 ? '✅' : '❌');

    // Case 4: Due day before closing, purchase after closing
    // Closing 25, Due 05. Purchase 26/01. -> Due 05/03
    let d4 = calculateCardDueDate(new Date(2026, 0, 26), 25, 5);
    console.log('Case 4 (26/01, C:25, D:05) ->', d4.toISOString().split('T')[0], d4.getMonth() === 2 && d4.getDate() === 5 ? '✅' : '❌');

    // Case 5: Feb leap year check (just to be sure)
    // Closing 28, Due 2. Purchase 29/01. -> Due 02/03
    let d5 = calculateCardDueDate(new Date(2026, 0, 29), 28, 2);
    console.log('Case 5 (29/01, C:28, D:02) ->', d5.toISOString().split('T')[0], d5.getMonth() === 2 ? '✅' : '❌');
}

testLogic();
