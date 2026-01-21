
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

async function checkLastRecurrence() {
    const { data, error } = await supabase
        .from('recurrences')
        .select(`
      id, 
      description, 
      amount, 
      card_id, 
      account_id, 
      next_due_date, 
      created_at,
      credit_cards (name),
      accounts (name)
    `)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        console.error('Error fetching recurrence:', error);
        return;
    }

    console.log('\n--- ÚLTIMA RECORRÊNCIA CRIADA ---');
    console.log(`Descrição: ${data.description}`);
    console.log(`Valor: R$ ${data.amount}`);
    console.log(`Vencimento: ${data.next_due_date}`);
    console.log(`Card ID: ${data.card_id} (${Array.isArray(data.credit_cards) ? data.credit_cards[0]?.name : (data.credit_cards as any)?.name || 'N/A'})`);
    console.log(`Account ID: ${data.account_id} (${Array.isArray(data.accounts) ? data.accounts[0]?.name : (data.accounts as any)?.name || 'N/A'})`);
    console.log('----------------------------------\n');

    if (data.card_id && !data.account_id) {
        console.log('✅ SUCESSO: Vinculado corretamente ao cartão!');
    } else if (!data.card_id && data.account_id) {
        console.log('ℹ️ Vinculado a conta bancária.');
    } else {
        console.log('❌ ERRO: Vinculação incorreta (ambos nulos ou ambos preenchidos).');
    }
}

checkLastRecurrence();
