import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSpotify() {
    const { data, error } = await supabase
        .from('recurrences')
        .select(`
      *,
      accounts(name),
      credit_cards(name)
    `)
        .ilike('description', '%spotify%')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('❌ Nenhuma recorrência do Spotify encontrada');
        return;
    }

    console.log('\n=== RECORRÊNCIA DO SPOTIFY ===');
    console.log('Description:', data[0].description);
    console.log('Amount:', data[0].amount);
    console.log('card_id:', data[0].card_id);
    console.log('Card name:', data[0].credit_cards?.name || 'null');
    console.log('account_id:', data[0].account_id);
    console.log('Account name:', data[0].accounts?.name || 'null');
    console.log('\nFull data:', JSON.stringify(data[0], null, 2));
}

checkSpotify();
