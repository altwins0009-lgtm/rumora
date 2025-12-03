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

// Read HTML files
const htmlFiles = {
    index: path.join(__dirname, 'public', 'index.html'),
    tos: path.join(__dirname, 'public', 'tos.html'),
    privacy: path.join(__dirname, 'public', 'privacy.html'),
    signin: path.join(__dirname, 'public', 'signin.html'),
    signup: path.join(__dirname, 'public', 'signup.html'),
    dashboard: path.join(__dirname, 'public', 'dashboard.html')
};

const htmlContent = {};
Object.keys(htmlFiles).forEach(key => {
    try {
        htmlContent[key] = fs.readFileSync(htmlFiles[key], 'utf8');
        console.log(`✅ Loaded: ${key}.html`);
    } catch (err) {
        console.log(`⚠️  Could not load ${key}.html: ${err.message}`);
        htmlContent[key] = `<h1>Page not found</h1><p>The ${key} page is not available.</p>`;
    }
});

// Helper function to inject Clerk key
function injectClerkKey(html) {
    const clerkKey = process.env.CLERK_PUBLISHABLE_KEY || 'pk_test_missing_key';
    return html.replace(/{{CLERK_PUBLISHABLE_KEY}}/g, clerkKey);
}

// Public Routes
app.get('/testing', (req, res) => {
    res.send(htmlContent.index);
});

app.get('/testing/tos', (req, res) => {
    res.send(htmlContent.tos);
});

app.get('/testing/privacy', (req, res) => {
    res.send(htmlContent.privacy);
});

app.get('/testing/signin', (req, res) => {
    res.send(injectClerkKey(htmlContent.signin));
});

app.get('/testing/signup', (req, res) => {
    res.send(injectClerkKey(htmlContent.signup));
});

// Dashboard route (simplified - no auth required for demo)
app.get('/testing/dashboard', (req, res) => {
    let dashboardHtml = htmlContent.dashboard;
    dashboardHtml = dashboardHtml.replace(/{{USER_ID}}/g, 'demo-user-123');
    dashboardHtml = dashboardHtml.replace(/{{USER_EMAIL}}/g, 'user@example.com');
    dashboardHtml = dashboardHtml.replace(/{{USER_NAME}}/g, 'Magical User');
    res.send(dashboardHtml);
});

// Simulated API endpoints
app.get('/api/user/profile', (req, res) => {
    res.json({
        id: 'demo-user-123',
        email: 'user@example.com',
        username: 'magical_user',
        plan: 'Silver',
        capeCount: 3,
        joined: '2023-12-01'
    });
});

app.get('/api/plans', (req, res) => {
    res.json([
        {
            name: "Silver Plan",
            price: "$9.99/month",
            badge: "Most Popular"
        },
        {
            name: "Gold Plan", 
            price: "$19.99/month"
        },
        {
            name: "Platinum Plan",
            price: "$29.99/month"
        }
    ]);
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'rumora-website',
        version: '1.0.0',
        timestamp: new Date().toISOString()
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
    console.log(`
    ╔════════════════════════════════════════════════════════╗
    ║                                                        ║
    ║   ✨ RUMORA MAGICAL WEBSITE ✨                         ║
    ║                                                        ║
    ╠════════════════════════════════════════════════════════╣
    ║                                                        ║
    ║   🌐 Website:    http://localhost:${PORT}/testing        ║
    ║   🔐 Sign In:    http://localhost:${PORT}/testing/signin  ║
    ║   📝 Sign Up:    http://localhost:${PORT}/testing/signup  ║
    ║   📊 Dashboard:  http://localhost:${PORT}/testing/dashboard║
    ║   📈 Health:     http://localhost:${PORT}/health         ║
    ║                                                        ║
    ║   Server running on port ${PORT}                         ║
    ║                                                        ║
    ╚════════════════════════════════════════════════════════╝
    `);
});
