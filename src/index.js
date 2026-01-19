import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';

const app = new Hono();
const assetManifest = JSON.parse(manifestJSON);

app.use('/*', cors());

// Middleware to serve static assets for non-API routes
app.get('/*', async (c, next) => {
    if (c.req.path.startsWith('/api')) {
        return next();
    }
    try {
        const content = await getAssetFromKV(
            {
                request: c.req.raw,
                waitUntil: c.executionCtx.waitUntil.bind(c.executionCtx),
            },
            {
                ASSET_NAMESPACE: c.env.__STATIC_CONTENT,
                ASSET_MANIFEST: assetManifest,
            }
        );
        return new Response(content.body, content);
    } catch (e) {
        if (e.message.includes("could not find")) {
            // Fallback to index.html for SPA if needed, or 404
            return c.text("Not Found", 404);
        }
        return c.text("Internal Server Error", 500);
    }
});

// --- API Routes ---

// Login
app.post('/api/login', async (c) => {
    const { username, password } = await c.req.json();
    // In production, use bcrypt/argon2 to verify password_hash
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ? AND password_hash = ?').bind(username, password).first();

    if (user) {
        // Simple session - in real app, use signed cookies or JWT
        return c.json({ success: true, token: 'simple-admin-token' });
    }
    return c.json({ success: false, message: 'Invalid credentials' }, 401);
});

// Get Posts
app.get('/api/posts', async (c) => {
    const { results } = await c.env.DB.prepare('SELECT * FROM posts ORDER BY created_at DESC').all();
    return c.json(results);
});

// Create Post (Admin protected)
app.post('/api/posts', async (c) => {
    // Check auth header simply
    const auth = c.req.header('Authorization');
    if (auth !== 'Bearer simple-admin-token') return c.json({ error: 'Unauthorized' }, 401);

    const { title, content, format, slug } = await c.req.json();
    const finalSlug = slug || title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');

    try {
        await c.env.DB.prepare('INSERT INTO posts (title, content, format, slug, published) VALUES (?, ?, ?, ?, ?)')
            .bind(title, content, format || 'html', finalSlug, true)
            .run();
        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

// Delete Post
app.delete('/api/posts/:id', async (c) => {
    const auth = c.req.header('Authorization');
    if (auth !== 'Bearer simple-admin-token') return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
    return c.json({ success: true });
});

// DB Query (Admin only)
app.post('/api/db/query', async (c) => {
    const auth = c.req.header('Authorization');
    if (auth !== 'Bearer simple-admin-token') return c.json({ error: 'Unauthorized' }, 401);

    const { query } = await c.req.json();
    try {
        const { results } = await c.env.DB.prepare(query).all();
        return c.json({ results });
    } catch (e) {
        return c.json({ error: e.message }, 400);
    }
});

export default app;
