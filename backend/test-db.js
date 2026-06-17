import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data } = await supabase.from('whatsapp_sessoes').select('*').limit(1);
  console.log(JSON.stringify(data, null, 2));
}

test();
