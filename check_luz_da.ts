import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkLuzDA() {
  const { data, error } = await supabase
    .from('recurrences')
    .select(`
      *,
      accounts(name),
      credit_cards(name)
    `)
    .ilike('description', '%luz%')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n=== ÚLTIMA RECORRÊNCIA DE LUZ ===');
  console.log('Description:', data[0].description);
  console.log('Due Day:', data[0].due_day);
  console.log('is_auto_debit:', data[0].is_auto_debit);
  console.log('account_id:', data[0].account_id);
  console.log('Account name:', data[0].accounts?.name || 'null');
  console.log('Card name:', data[0].credit_cards?.name || 'null');
  console.log('\nFull data:', JSON.stringify(data[0], null, 2));
}

checkLuzDA();
