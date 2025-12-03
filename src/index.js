require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper function to inject Clerk key
function injectClerkKey(html, clerkKey) {
    if (!clerkKey || clerkKey === 'pk_test_missing_key') {
        clerkKey = 'pk_test_dummy_key_for_testing_only';
    }
    return html
        .replace(/{{CLERK_PUBLISHABLE_KEY}}/g, clerkKey)
        .replace(/CLERK_PUBLISHABLE_KEY/g, clerkKey);
}

// Read HTML files with caching
let htmlCache = {};
function loadHtmlFile(filename) {
    if (htmlCache[filename]) {
        return htmlCache[filename];
    }
    
    try {
        const filePath = path.join(__dirname, 'public', filename);
        const content = fs.readFileSync(filePath, 'utf8');
        htmlCache[filename] = content;
        return content;
    } catch (err) {
        console.error(`Error loading ${filename}:`, err.message);
        return `<h1>Page Error</h1><p>Could not load ${filename}</p>`;
    }
}

// Routes
app.get('/testing', (req, res) => {
    const html = loadHtmlFile('index.html');
    res.send(html);
});

app.get('/testing/tos', (req, res) => {
    const html = loadHtmlFile('tos.html');
    res.send(html);
});

app.get('/testing/privacy', (req, res) => {
    const html = loadHtmlFile('privacy.html');
    res.send(html);
});

// Clerk webhook handler
app.post('/api/auth/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const svixId = req.headers['svix-id'];
    const svixTimestamp = req.headers['svix-timestamp'];
    const svixSignature = req.headers['svix-signature'];
    
    console.log('📥 Clerk webhook received:', svixId);
    
    // In production, verify the signature using Clerk SDK
    // For now, just acknowledge receipt
    res.json({ received: true });
});

// Clerk auth callback handler
app.get('/api/auth/callback', (req, res) => {
    console.log('🔐 Clerk auth callback received');
    res.redirect('/testing/dashboard');
});

app.get('/testing/signin', (req, res) => {
    const html = loadHtmlFile('signin.html');
    const clerkKey = process.env.CLERK_PUBLISHABLE_KEY || 'pk_test_dummy_key';
    const processedHtml = injectClerkKey(html, clerkKey);
    res.send(processedHtml);
});

app.get('/testing/signup', (req, res) => {
    const html = loadHtmlFile('signup.html');
    const clerkKey = process.env.CLERK_PUBLISHABLE_KEY || 'pk_test_dummy_key';
    const processedHtml = injectClerkKey(html, clerkKey);
    res.send(processedHtml);
});

// Dashboard route
app.get('/testing/dashboard', (req, res) => {
    let html = loadHtmlFile('dashboard.html');
    
    // Demo user data
    const userData = {
        id: 'user_' + Date.now(),
        email: 'demo@rumora.com',
        name: 'Magical User',
        plan: 'Silver Plan',
        capeCount: '3',
        joinDate: new Date().toISOString().split('T')[0]
    };
    
    // Replace placeholders
    html = html.replace(/{{USER_ID}}/g, userData.id);
    html = html.replace(/{{USER_EMAIL}}/g, userData.email);
    html = html.replace(/{{USER_NAME}}/g, userData.name);
    html = html.replace(/{{USER_PLAN}}/g, userData.plan);
    html = html.replace(/{{CAPE_COUNT}}/g, userData.capeCount);
    html = html.replace(/{{JOIN_DATE}}/g, userData.joinDate);
    
    // Inject Clerk key for dashboard if needed
    const clerkKey = process.env.CLERK_PUBLISHABLE_KEY || 'pk_test_dummy_key';
    html = injectClerkKey(html, clerkKey);
    
    res.send(html);
});

// Health check
app.get('/health', (req, res) => {
    const clerkKey = process.env.CLERK_PUBLISHABLE_KEY;
    res.json({
        status: 'healthy',
        service: 'rumora-website',
        clerk_configured: !!clerkKey && clerkKey !== 'pk_test_dummy_key',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});

// Clerk status endpoint
app.get('/api/clerk-status', (req, res) => {
    const clerkKey = process.env.CLERK_PUBLISHABLE_KEY;
    res.json({
        configured: !!clerkKey && clerkKey !== 'pk_test_dummy_key',
        key_exists: !!clerkKey,
        key_preview: clerkKey ? clerkKey.substring(0, 20) + '...' : 'none',
        environment: process.env.NODE_ENV
    });
});

// Root redirect
app.get('/', (req, res) => {
    res.redirect('/testing');
});

// 404 handler
app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>404 - Rumora</title>
            <style>
                body { background: #0f0b1f; color: white; font-family: 'Montserrat', sans-serif; 
                       display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; text-align: center; }
                .container { padding: 3rem; max-width: 600px; }
                h1 { font-size: 5rem; color: #9d4edd; margin: 0; }
                p { font-size: 1.2rem; margin: 2rem 0; color: #cccccc; }
                .magic-button { display: inline-block; background: linear-gradient(90deg, #6a0dad, #9d4edd); 
                               color: white; padding: 15px 30px; border-radius: 50px; text-decoration: none; 
                               font-weight: 600; transition: all 0.3s; }
                .magic-button:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(106, 13, 173, 0.6); }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>404</h1>
                <p>The magical page you're looking for has vanished!</p>
                <a href="/testing" class="magic-button">Back to Rumora</a>
            </div>
        </body>
        </html>
    `);
});

// Start server
app.listen(PORT, () => {
    const clerkKey = process.env.CLERK_PUBLISHABLE_KEY;
    console.log(`
    ╔══════════════════════════════════════════════════════════════════╗
    ║                                                                  ║
    ║   ✨ RUMORA MAGICAL WEBSITE ✨                                   ║
    ║                                                                  ║
    ╠══════════════════════════════════════════════════════════════════╣
    ║                                                                  ║
    ║   🌐 Website:     http://localhost:${PORT}/testing                ║
    ║   🔐 Sign In:     http://localhost:${PORT}/testing/signin          ║
    ║   📝 Sign Up:     http://localhost:${PORT}/testing/signup          ║
    ║   📊 Dashboard:   http://localhost:${PORT}/testing/dashboard      ║
    ║   📈 Health:      http://localhost:${PORT}/health                 ║
    ║   🔧 Clerk Check: http://localhost:${PORT}/api/clerk-status       ║
    ║                                                                  ║
    ║   Clerk Status:   ${clerkKey ? '✅ Key Found' : '⚠️  No Key'}        ║
    ║                                                                  ║
    ║   Server running on port ${PORT}                                   ║
    ║                                                                  ║
    ╚══════════════════════════════════════════════════════════════════╝
    `);
    
    if (!clerkKey || clerkKey === 'pk_test_dummy_key') {
        console.log('\n⚠️  WARNING: Clerk publishable key not configured!');
        console.log('👉 Get one from: https://dashboard.clerk.com');
        console.log('👉 Add to .env: CLERK_PUBLISHABLE_KEY=pk_test_your_key_here\n');
    }
});
