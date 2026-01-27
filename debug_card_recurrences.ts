
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

async function debugCardRecurrences() {
    // 1. Get all cards
    const { data: cards, error: cardError } = await supabase
        .from('credit_cards')
        .select('*');

    if (cardError) {
        console.error('Error fetching cards:', cardError);
        return;
    }

    console.log(`Found ${cards.length} cards.`);

    for (const card of cards) {
        console.log(`\nCard: ${card.name} (Due Day: ${card.due_day}, Closing Day: ${card.closing_day})`);

        // 2. Get recurrences for this card
        const { data: recurrences, error: recError } = await supabase
            .from('recurrences')
            .select('*')
            .eq('card_id', card.id);

        if (recError) {
            console.error(`Error fetching recurrences for card ${card.name}:`, recError);
            continue;
        }

        if (recurrences.length === 0) {
            console.log('  No recurrences linked.');
        } else {
            recurrences.forEach(rec => {
                const recDate = new Date(rec.next_due_date);
                const recDay = recDate.getDate(); // Note: This might be UTC vs Local issue, but usually date string is YYYY-MM-DD
                // Let's just parse the string to be safe
                const dayPart = parseInt(rec.next_due_date.split('-')[2]);

                const match = dayPart === card.due_day ? '✅ MATCHES DUE DAY' : '❌ DIFFERENT DAY';
                console.log(`  - [${rec.next_due_date}] (Day ${dayPart}) ${rec.description} - ${match}`);
            });
        }
    }
}

debugCardRecurrences();
