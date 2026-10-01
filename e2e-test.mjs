import https from 'node:https';

const URL = 'https://jczywrfpgmgsarwpotlp.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjenl3cmZwZ21nc2Fyd3BvdGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjIwODUsImV4cCI6MjEwNjIzODA4NX0.ZWKX0WWGfuf_TlONDqm0XXjaFTa3OzJHWLUtaZ8Pa00';
const ts = Date.now();
const testEmail = `e2e-${ts}@test.com`;
const testPass = 'Str0ngP@ss2026!';

async function api(path, opts = {}) {
  const url = `${URL}${path}`;
  const headers = { apikey: KEY, 'Content-Type': 'application/json', ...opts.headers };
  const res = await fetch(url, { ...opts, headers });
  const body = await res.json();
  return { status: res.status, ok: res.ok, body };
}

async function main() {
  console.log('=== 1. HEALTH CHECK ===');
  const h = await api('/auth/v1/health');
  console.log('Status:', h.status, h.ok ? 'OK' : 'FAIL');

  console.log('\n=== 2. SIGNUP ===');
  const su = await api('/auth/v1/signup', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KEY },
    body: JSON.stringify({ email: testEmail, password: testPass, data: { full_name: 'Test User' } }),
  });
  console.log('Status:', su.status, su.ok ? 'OK' : 'FAIL');
  console.log('User ID:', su.body.user?.id || 'NONE');
  console.log('Has token:', !!su.body.access_token);
  const token = su.body.access_token;
  const userId = su.body.user?.id;
  if (!token || !userId) { console.log('FAILED - stopping'); return; }

  console.log('\n=== 3. CREATE ORGANIZATION ===');
  const org = await api('/rest/v1/organizations', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, Prefer: 'return=representation' },
    body: JSON.stringify({ name: "Test User's Organization", industry: 'General' }),
  });
  console.log('Status:', org.status, org.ok ? 'OK' : 'FAIL');
  if (!org.ok) { console.log('Error:', JSON.stringify(org.body).slice(0, 300)); return; }
  const orgId = org.body[0]?.id;
  console.log('Org ID:', orgId);

  console.log('\n=== 4. ADD USER AS ORG MEMBER ===');
  const mem = await api('/rest/v1/org_members', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, Prefer: 'return=representation' },
    body: JSON.stringify({ organization_id: orgId, user_id: userId, role: 'owner' }),
  });
  console.log('Status:', mem.status, mem.ok ? 'OK' : 'FAIL');
  if (!mem.ok) { console.log('Error:', JSON.stringify(mem.body).slice(0, 300)); return; }
  console.log('Member ID:', mem.body[0]?.id);

  console.log('\n=== 5. VERIFY ORG QUERY (inner join like AuthContext) ===');
  const oq = await api(`/rest/v1/organizations?select=*,org_members!inner(role,user_id,organization_id,id,created_at)&org_members.user_id=eq.${userId}`, {
    headers: { Authorization: 'Bearer ' + token },
  });
  console.log('Status:', oq.status, oq.ok ? 'OK' : 'FAIL');
  if (oq.ok) console.log('Orgs found:', oq.body.length, '| Name:', oq.body[0]?.name);
  else console.log('Error:', JSON.stringify(oq.body).slice(0, 200));

  console.log('\n=== 6. SIGN IN ===');
  const si = await api('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: testPass }),
  });
  console.log('Status:', si.status, si.ok ? 'OK' : 'FAIL');
  console.log('Has token:', !!si.body.access_token);

  console.log('\n=== 7. DUPLICATE SIGNUP ===');
  const dup = await api('/auth/v1/signup', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KEY },
    body: JSON.stringify({ email: testEmail, password: testPass }),
  });
  console.log('Status:', dup.status);
  console.log('Response:', (dup.body.msg || dup.body.message || JSON.stringify(dup.body)).slice(0, 200));

  console.log('\n=== ALL TESTS COMPLETE ===');
}

main().catch(e => console.log('FATAL:', e.message));
