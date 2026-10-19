import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const PASS = process.env.ADMIN_PASSWORD || 'bos727';
const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const ANON = process.env.SUPABASE_ANON_KEY; // opsional, dipakai untuk upload video
const sb = URL_ && KEY ? createClient(URL_, KEY, { auth: { persistSession: false } }) : null;
const BUCKET = 'portfolio';
const json = (d, s = 200) => Response.json(d, { status: s });
const isAdmin = (req) => req.headers.get('x-admin-password') === PASS;

export async function GET(req, { params }) {
  if (params.action === 'messages') {
    if (!isAdmin(req)) return json({ error: 'Password salah' }, 401);
    if (!sb) return json({ messages: [] });
    const { data } = await sb.from('messages').select('*').order('created_at', { ascending: false }).limit(100);
    return json({ messages: data || [] });
  }

  if (params.action !== 'data') return json({ error: 'not found' }, 404);
  if (!sb) return json({ configured: false });
  const { data } = await sb.from('site').select('data').eq('id', 1).maybeSingle();
  const { data: rows } = await sb.from('likes').select('work_id,count');
  const likes = Object.fromEntries((rows || []).map((r) => [r.work_id, r.count]));
  return json({ configured: true, data: data?.data || null, likes });
}

export async function POST(req, { params }) {
  const a = params.action;

  if (a === 'like') {
    if (!sb) return json({ configured: false });
    const { id } = await req.json();
    const { data } = await sb.rpc('like_work', { wid: String(id) });
    return json({ count: data });
  }

  if (a === 'message') {
    if (!sb && !WEBHOOK) return json({ configured: false });
    const b = await req.json();
    if (b.website) return json({ ok: true }); // jebakan bot
    const name = String(b.name || '').trim().slice(0, 80);
    const contact = String(b.contact || '').trim().slice(0, 120);
    const message = String(b.message || '').trim().slice(0, 2000);
    if (!name || message.length < 5) return json({ error: 'Isi nama dan pesan (minimal 5 huruf).' }, 400);
    let sent = false;
    if (sb) {
      const { error } = await sb.from('messages').insert({ name, email: contact, message });
      sent = !error;
    }
    if (WEBHOOK) {
      try {
        const r = await fetch(WEBHOOK, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            content: `**Pesan baru dari ${name}**\nKontak: ${contact || '-'}\n\n${message}`.slice(0, 1900),
            allowed_mentions: { parse: [] }
          })
        });
        sent = sent || r.ok;
      } catch {}
    }
    return sent ? json({ ok: true }) : json({ error: 'Pesan gagal dikirim. Coba lagi nanti.' }, 500);
  }

  // Semua aksi di bawah ini khusus admin
  if (!isAdmin(req)) return json({ error: 'Password salah' }, 401);
  if (a === 'auth') return json({ ok: true });
  if (!sb) return json({ configured: false });

  if (a === 'signed-upload') {
    const { ext } = await req.json();
    const e = ext === 'webm' ? 'webm' : 'mp4';
    const name = `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${e}`;
    const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(name);
    if (error) return json({ error: error.message }, 500);
    return json({
      signedUrl: data.signedUrl,
      publicUrl: sb.storage.from(BUCKET).getPublicUrl(name).data.publicUrl,
      anonKey: ANON || null
    });
  }

  if (a === 'delmsg') {
    const { id } = await req.json();
    await sb.from('messages').delete().eq('id', id);
    return json({ ok: true });
  }

  if (a === 'save') {
    const body = await req.json();
    const { error } = await sb.from('site').upsert({ id: 1, data: body });
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }

  if (a === 'upload') {
    const file = (await req.formData()).get('file');
    const ext = file.type === 'image/gif' ? 'gif' : 'jpg';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error } = await sb.storage.from(BUCKET).upload(name, buf, { contentType: file.type || 'image/jpeg' });
    if (error) return json({ error: error.message }, 500);
    return json({ url: sb.storage.from(BUCKET).getPublicUrl(name).data.publicUrl });
  }

  return json({ error: 'not found' }, 404);
}
