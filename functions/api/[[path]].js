import { Hono } from 'hono';

const app = new Hono().basePath('/api');

// Login
app.post('/login', async (c) => {
    try {
        if (!c.env.DB) {
            return c.json({ error: 'Database binding (DB) is missing. Please check Cloudflare Dashboard settings.' }, 500);
        }
        const { username, password } = await c.req.json();
        const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ? AND password_hash = ?')
            .bind(username, password)
            .first();

        if (user) {
            return c.json({ success: true, token: 'simple-admin-token' });
        }
        return c.json({ success: false, message: 'Invalid credentials' }, 401);
    } catch (e) {
        return c.json({ error: e.message, stack: e.stack }, 500);
    }
});

// Get Posts
app.get('/posts', async (c) => {
    try {
        const { results } = await c.env.DB.prepare('SELECT * FROM posts ORDER BY created_at DESC').all();
        return c.json(results || []);
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

// Get Single Post
app.get('/posts/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
        if (!post) return c.json({ error: 'Post not found' }, 404);
        return c.json(post);
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

// Create Post
app.post('/posts', async (c) => {
    try {
        const auth = c.req.header('Authorization');
        if (auth !== 'Bearer simple-admin-token') return c.json({ error: 'Unauthorized' }, 401);

        const { title, content, format, slug } = await c.req.json();
        if (!title || !content) return c.json({ error: 'Title and content are required' }, 400);

        const finalSlug = slug || title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');

        await c.env.DB.prepare('INSERT INTO posts (title, content, format, slug, published) VALUES (?, ?, ?, ?, ?)')
            .bind(title, content, format || 'html', finalSlug, true)
            .run();
        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

// Update Post
app.put('/posts/:id', async (c) => {
    try {
        const auth = c.req.header('Authorization');
        if (auth !== 'Bearer simple-admin-token') return c.json({ error: 'Unauthorized' }, 401);

        const id = c.req.param('id');
        const { title, content, format, slug } = await c.req.json();
        if (!title || !content) return c.json({ error: 'Title and content are required' }, 400);

        const finalSlug = slug || title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');

        await c.env.DB.prepare('UPDATE posts SET title = ?, content = ?, format = ?, slug = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(title, content, format || 'html', finalSlug, id)
            .run();
        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

// Delete Post
app.delete('/posts/:id', async (c) => {
    try {
        const auth = c.req.header('Authorization');
        if (auth !== 'Bearer simple-admin-token') return c.json({ error: 'Unauthorized' }, 401);

        const id = c.req.param('id');
        await c.env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

// DB Query
app.post('/db/query', async (c) => {
    try {
        const auth = c.req.header('Authorization');
        if (auth !== 'Bearer simple-admin-token') return c.json({ error: 'Unauthorized' }, 401);

        const { query } = await c.req.json();
        const { results } = await c.env.DB.prepare(query).all();
        return c.json({ results });
    } catch (e) {
        return c.json({ error: e.message }, 400);
    }
});

// Settings API
app.get('/settings', async (c) => {
    try {
        const { results } = await c.env.DB.prepare('SELECT * FROM settings').all();
        const settings = {};
        results.forEach(row => settings[row.key] = row.value);
        return c.json(settings);
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

app.post('/settings', async (c) => {
    try {
        const auth = c.req.header('Authorization');
        if (auth !== 'Bearer simple-admin-token') return c.json({ error: 'Unauthorized' }, 401);

        const body = await c.req.json();
        for (const [key, value] of Object.entries(body)) {
            await c.env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
                .bind(key, value)
                .run();
        }
        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

export const onRequest = (context) => app.fetch(context.request, context.env, context);
