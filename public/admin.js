const API_URL = '/api';
let quill;
let currentPostId = null;

// Init
document.addEventListener('DOMContentLoaded', () => {
    // Check auth
    const token = localStorage.getItem('token');
    if (token) {
        showDashboard();
    }

    // Init Quill
    quill = new Quill('#quill-editor', {
        theme: 'snow',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline'],
                ['link', 'image', 'video'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                ['clean']
            ]
        }
    });
});

// Auth
async function handleLogin() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            body: JSON.stringify({ username: u, password: p }),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();

        if (data.success) {
            localStorage.setItem('token', data.token);
            showDashboard();
        } else {
            document.getElementById('login-error').style.display = 'block';
        }
    } catch (e) {
        alert('Login Error');
    }
}

function logout() {
    localStorage.removeItem('token');
    location.reload();
}

function showDashboard() {
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'block';
    loadPosts();
}

// Tabs
function switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');

    document.getElementById('tab-posts').style.display = 'none';
    document.getElementById('tab-db').style.display = 'none';
    document.getElementById('tab-settings').style.display = 'none';
    document.getElementById('editor-wrapper').style.display = 'none';

    document.getElementById(`tab-${tab}`).style.display = 'block';

    if (tab === 'posts') loadPosts();
}

// Posts
async function loadPosts() {
    const res = await fetch(`${API_URL}/posts`);
    const posts = await res.json();
    const list = document.getElementById('posts-list');
    list.innerHTML = '';

    posts.forEach(post => {
        const item = document.createElement('div');
        item.style.padding = '1rem';
        item.style.borderBottom = '1px solid var(--border-color)';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';

        item.innerHTML = `
            <div>
                <strong>${post.title}</strong>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${new Date(post.created_at).toLocaleDateString()}</div>
            </div>
            <div>
                <button class="btn-sm btn-danger" onclick="deletePost(${post.id})">Delete</button>
            </div>
        `;
        list.appendChild(item);
    });
}

function showEditor() {
    document.getElementById('tab-posts').style.display = 'none';
    document.getElementById('editor-wrapper').style.display = 'block';
    // Reset fields
    document.getElementById('post-title').value = '';
    document.getElementById('post-slug').value = '';
    quill.root.innerHTML = '';
}

function hideEditor() {
    document.getElementById('editor-wrapper').style.display = 'none';
    document.getElementById('tab-posts').style.display = 'block';
}

function toggleHtmlMode() {
    const isHtml = document.getElementById('html-toggle').checked;
    const quillContainer = document.querySelector('.ql-container');
    const quillToolbar = document.querySelector('.ql-toolbar');
    const htmlEditor = document.getElementById('html-editor');

    if (isHtml) {
        htmlEditor.value = quill.root.innerHTML;
        htmlEditor.style.display = 'block';
        quillContainer.style.display = 'none';
        quillToolbar.style.display = 'none';
    } else {
        quill.root.innerHTML = htmlEditor.value;
        htmlEditor.style.display = 'none';
        quillContainer.style.display = 'block';
        quillToolbar.style.display = 'block';
    }
}

async function savePost() {
    const title = document.getElementById('post-title').value;
    const slug = document.getElementById('post-slug').value;
    const content = document.getElementById('html-toggle').checked
        ? document.getElementById('html-editor').value
        : quill.root.innerHTML;

    const token = localStorage.getItem('token');

    const res = await fetch(`${API_URL}/posts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, slug, content })
    });

    const data = await res.json();
    if (data.success) {
        alert('Published!');
        hideEditor();
        loadPosts();
    } else {
        alert('Error: ' + data.error);
    }
}

async function deletePost(id) {
    if (!confirm('Delete this post?')) return;
    const token = localStorage.getItem('token');
    await fetch(`${API_URL}/posts/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    loadPosts();
}

// DB
async function runQuery() {
    const query = document.getElementById('sql-query').value;
    const token = localStorage.getItem('token');

    try {
        const res = await fetch(`${API_URL}/db/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ query })
        });
        const data = await res.json();

        const container = document.getElementById('query-result');
        if (data.results && data.results.length > 0) {
            const cols = Object.keys(data.results[0]);
            let html = '<table><thead><tr>';
            cols.forEach(c => html += `<th>${c}</th>`);
            html += '</tr></thead><tbody>';

            data.results.forEach(row => {
                html += '<tr>';
                cols.forEach(c => html += `<td>${row[c]}</td>`);
                html += '</tr>';
            });
            html += '</tbody></table>';
            container.innerHTML = html;
        } else {
            container.innerHTML = '<p>No results or error</p>';
            if (data.error) container.innerHTML = `<p style="color:red">${data.error}</p>`;
        }
    } catch (e) {
        alert(e.message);
    }
}
