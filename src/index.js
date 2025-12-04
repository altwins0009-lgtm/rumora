require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { ClerkExpressRequireAuth, ClerkExpressWithAuth } = require('@clerk/clerk-sdk-node');

const app = express();
const PORT = process.env.PORT || 10000;

// Initialize Clerk
const clerk = require('@clerk/clerk-sdk-node');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});

// Clerk configuration
const clerkConfig = {
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
    apiUrl: process.env.CLERK_FRONTEND_API
};

console.log('=== CLERK CONFIGURATION ===');
console.log('Mode:', process.env.NODE_ENV);
console.log('Publishable Key:', clerkConfig.publishableKey ? '✅ Set' : '❌ Missing');
console.log('Secret Key:', clerkConfig.secretKey ? '✅ Set' : '❌ Missing');
console.log('Frontend API:', clerkConfig.apiUrl);
console.log('App URL:', process.env.APP_URL);
console.log('===========================');

// Helper to inject Clerk config into HTML
function injectClerkConfig(html) {
    return html
        .replace(/{{CLERK_PUBLISHABLE_KEY}}/g, clerkConfig.publishableKey || '')
        .replace(/{{CLERK_FRONTEND_API}}/g, clerkConfig.apiUrl || '')
        .replace(/{{APP_URL}}/g, process.env.APP_URL || '')
        .replace(/{{NODE_ENV}}/g, process.env.NODE_ENV || 'development');
}

// Load HTML files
function loadHtml(filename) {
    try {
        return fs.readFileSync(path.join(__dirname, 'public', filename), 'utf8');
    } catch (err) {
        console.error(`Error loading ${filename}:`, err.message);
        return '<h1>Page Error</h1><p>Page not found</p>';
    }
}

// ========== ROUTES ==========

// Public Pages
app.get('/testing', (req, res) => {
    res.send(injectClerkConfig(loadHtml('index.html')));
});

app.get('/testing/tos', (req, res) => {
    res.send(loadHtml('tos.html'));
});

app.get('/testing/privacy', (req, res) => {
    res.send(loadHtml('privacy.html'));
});

// Authentication Pages
app.get('/testing/signin', (req, res) => {
    res.send(injectClerkConfig(loadHtml('signin.html')));
});

app.get('/testing/signup', (req, res) => {
    res.send(injectClerkConfig(loadHtml('signup.html')));
});

// Protected Dashboard
app.get('/testing/dashboard', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const user = await clerk.users.getUser(req.auth.userId);
        
        let html = loadHtml('dashboard.html');
        
        // Inject user data
        html = html.replace(/{{USER_ID}}/g, user.id);
        html = html.replace(/{{USER_EMAIL}}/g, user.primaryEmailAddress?.emailAddress || '');
        html = html.replace(/{{USER_NAME}}/g, user.firstName || user.username || 'User');
        html = html.replace(/{{USER_IMAGE}}/g, user.imageUrl || '');
        
        // Inject Clerk config
        html = injectClerkConfig(html);
        
        res.send(html);
    } catch (error) {
        console.error('Dashboard error:', error);
        res.redirect('/testing/signin');
    }
});

// API Endpoints
app.get('/api/user/profile', ClerkExpressWithAuth(), async (req, res) => {
    try {
        const user = await clerk.users.getUser(req.auth.userId);
        res.json({
            id: user.id,
            email: user.primaryEmailAddress?.emailAddress,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            imageUrl: user.imageUrl,
            createdAt: user.createdAt,
            plan: 'Silver', // This would come from your database
            capeCount: 3,
            joinDate: new Date(user.createdAt).toISOString().split('T')[0]
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Clerk webhook for user events
app.post('/api/clerk/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const svixId = req.headers['svix-id'];
    const svixTimestamp = req.headers['svix-timestamp'];
    const svixSignature = req.headers['svix-signature'];
    
    console.log('📥 Clerk webhook received:', svixId);
    
    // Verify webhook signature in production
    // For now, just acknowledge
    res.json({ received: true });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'rumora',
        environment: process.env.NODE_ENV,
        clerk: {
            configured: !!clerkConfig.publishableKey,
            mode: 'satellite',
            frontendApi: clerkConfig.apiUrl
        },
        timestamp: new Date().toISOString()
    });
});

// Clerk config endpoint (for debugging)
app.get('/api/clerk/config', (req, res) => {
    res.json({
        publishableKey: clerkConfig.publishableKey ? clerkConfig.publishableKey.substring(0, 20) + '...' : null,
        frontendApi: clerkConfig.apiUrl,
        appUrl: process.env.APP_URL,
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

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Something went wrong',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════════════════════════════════════════╗
    ║                                                                          ║
    ║   ✨ RUMORA - PRODUCTION MODE ✨                                         ║
    ║   🔗 Satellite Domains Configured                                        ║
    ║                                                                          ║
    ╠══════════════════════════════════════════════════════════════════════════╣
    ║                                                                          ║
    ║   🌐 Main Site:     ${process.env.APP_URL}/testing                      ║
    ║   🔐 Clerk Domain:  ${clerkConfig.apiUrl}                               ║
    ║   📝 Sign Up:       ${process.env.APP_URL}/testing/signup                ║
    ║   🔐 Sign In:       ${process.env.APP_URL}/testing/signin                ║
    ║   📊 Dashboard:     ${process.env.APP_URL}/testing/dashboard            ║
    ║   📈 Health:        ${process.env.APP_URL}/health                       ║
    ║                                                                          ║
    ║   🚀 Server running on port ${PORT}                                      ║
    ║   📡 Environment: ${process.env.NODE_ENV}                                ║
    ║                                                                          ║
    ╚══════════════════════════════════════════════════════════════════════════╝
    `);
});
