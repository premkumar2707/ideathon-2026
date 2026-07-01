const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('teams').select('*').limit(1);
  if (error) {
    console.error('Error fetching teams:', error);
  } else {
    console.log('Teams row:', data);
  }
}
check();
