require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { ClerkExpressRequireAuth, ClerkExpressWithAuth } = require('@clerk/clerk-sdk-node');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Clerk
const clerk = require('@clerk/clerk-sdk-node');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Set global variables for templates
app.use((req, res, next) => {
    res.locals.clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY;
    res.locals.appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
    next();
});

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

// Authentication Routes
app.get('/testing/signin', (req, res) => {
    const signinPage = htmlContent.signin.replace(
        '{{CLERK_PUBLISHABLE_KEY}}',
        process.env.CLERK_PUBLISHABLE_KEY || 'pk_test_missing'
    );
    res.send(signinPage);
});

app.get('/testing/signup', (req, res) => {
    const signupPage = htmlContent.signup.replace(
        '{{CLERK_PUBLISHABLE_KEY}}',
        process.env.CLERK_PUBLISHABLE_KEY || 'pk_test_missing'
    );
    res.send(signupPage);
});

// Protected Dashboard Route
app.get('/testing/dashboard', ClerkExpressRequireAuth(), (req, res) => {
    const userId = req.auth.userId;
    const user = req.auth.user;
    
    let dashboardPage = htmlContent.dashboard;
    dashboardPage = dashboardPage.replace(/{{USER_ID}}/g, userId);
    dashboardPage = dashboardPage.replace(/{{USER_EMAIL}}/g, user.primaryEmailAddress.emailAddress);
    dashboardPage = dashboardPage.replace(/{{USER_NAME}}/g, user.firstName || user.username || 'User');
    
    res.send(dashboardPage);
});

// Clerk webhooks and API endpoints
app.post('/api/clerk/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const svixId = req.headers['svix-id'];
    const svixTimestamp = req.headers['svix-timestamp'];
    const svixSignature = req.headers['svix-signature'];
    
    if (!svixId || !svixTimestamp || !svixSignature) {
        return res.status(400).json({ error: 'Missing Svix headers' });
    }
    
    // Verify webhook signature (implement proper verification in production)
    console.log('📥 Clerk webhook received:', req.body.toString());
    
    res.json({ received: true });
});

// API endpoints with auth
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
            createdAt: user.createdAt
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

app.get('/api/user/subscription', ClerkExpressRequireAuth(), (req, res) => {
    // This would connect to your subscription service
    const mockSubscription = {
        plan: 'Silver',
        status: 'active',
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        features: ['premium_ui', 'basic_bot', '5_music']
    };
    res.json(mockSubscription);
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'rumora-website',
        clerk: process.env.CLERK_PUBLISHABLE_KEY ? 'configured' : 'not-configured',
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
    ║   ✨ RUMORA MAGICAL WEBSITE WITH CLERK AUTH ✨         ║
    ║                                                        ║
    ╠════════════════════════════════════════════════════════╣
    ║                                                        ║
    ║   🌐 Website:    http://rumora.frii.site/testing       ║
    ║   🔐 Sign In:    http://localhost:${PORT}/testing/signin  ║
    ║   📝 Sign Up:    http://localhost:${PORT}/testing/signup  ║
    ║   📊 Dashboard:  http://localhost:${PORT}/testing/dashboard║
    ║   📈 Health:     http://localhost:${PORT}/health         ║
    ║                                                        ║
    ║   Clerk Status:  ${process.env.CLERK_PUBLISHABLE_KEY ? '✅ Configured' : '❌ Not Configured'}  ║
    ║                                                        ║
    ╚════════════════════════════════════════════════════════╝
    `);
});
