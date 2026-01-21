
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Try to find service role key in env, otherwise fallback to anon
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

console.log('Using key type:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON');

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCreditCards() {
    console.log('\n--- CREDIT CARDS ---');
    const { data: cards, error: cardsError } = await supabase
        .from('credit_cards')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (cardsError) console.error('Error fetching cards:', cardsError);
    else console.table(cards);

    console.log('\n--- RECENT MOVEMENTS ---');
    const { data: movements, error: movError } = await supabase
        .from('movements')
        .select('id, description, amount, type, date, due_date, card_id, is_paid')
        .order('created_at', { ascending: false })
        .limit(5);

    if (movError) console.error('Error fetching movements:', movError);
    else console.table(movements);
}

checkCreditCards();
