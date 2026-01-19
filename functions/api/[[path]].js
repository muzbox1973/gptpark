import { Hono } from 'hono';

const app = new Hono();

// Login
app.post('/login', async (c) => {
    try {
        const { username, password } = await c.req.json();
        const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ? AND password_hash = ?')
            .bind(username, password)
            .first();

        if (user) {
            return c.json({ success: true, token: 'simple-admin-token' });
        }
        return c.json({ success: false, message: 'Invalid credentials' }, 401);
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

// Get Posts
app.get('/posts', async (c) => {
    try {
        const { results } = await c.env.DB.prepare('SELECT * FROM posts ORDER BY created_at DESC').all();
        return c.json(results);
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
        const finalSlug = slug || title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');

        await c.env.DB.prepare('INSERT INTO posts (title, content, format, slug, published) VALUES (?, ?, ?, ?, ?)')
            .bind(title, content, format || 'html', finalSlug, true)
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

export const onRequest = app.fetch;
