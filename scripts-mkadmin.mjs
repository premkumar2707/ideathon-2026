import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const customFetch = (input, init) => {
  const headers = new Headers(init?.headers);
  if (headers.get('Authorization') === `Bearer ${key}`) {
    headers.delete('Authorization');
  }
  headers.set('apikey', key);
  return fetch(input, { ...init, headers });
};
const sb = createClient(url, key, { global: { fetch: customFetch } });
const NEW_EMAIL = 'admin@admin.com';
const OLD_EMAILS = ['admin@ideathon2026.app', 'admin@admin.com'];
const password = 'Ideathon!2026#Judge';
const { data: list } = await sb.auth.admin.listUsers();
// delete any prior admin accounts so only this one exists
for (const u of list.users) {
  if (OLD_EMAILS.includes(u.email ?? '') && u.email !== NEW_EMAIL) {
    await sb.auth.admin.deleteUser(u.id);
    console.log('deleted old', u.email);
  }
}
const email = NEW_EMAIL;
let user = list.users.find(u => u.email === email);
if (!user) {
  const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) { console.error(error); process.exit(1); }
  user = data.user;
  console.log('created', user.id);
} else {
  const { error } = await sb.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  if (error) { console.error('update failed:', error.message); process.exit(1); }
  console.log('updated', user.id);
}
await sb.from('user_roles').upsert({ user_id: user.id, role: 'admin' }, { onConflict: 'user_id,role' });
console.log('OK');
