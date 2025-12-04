require('dotenv').config();
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'rumora-magical-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true
    }
}));

// Discord OAuth configuration
const DISCORD_CONFIG = {
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    redirectUri: process.env.DISCORD_REDIRECT_URI || `${process.env.APP_URL}/auth/discord/callback`,
    authUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    apiUrl: 'https://discord.com/api/v10'
};

// Admin users (from env or default)
const ADMIN_IDS = process.env.ADMIN_DISCORD_IDS ? 
    process.env.ADMIN_DISCORD_IDS.split(',').map(id => id.trim()) : [];

console.log('=== DISCORD AUTH CONFIG ===');
console.log('Client ID:', DISCORD_CONFIG.clientId ? '✅ Set' : '❌ Missing');
console.log('Redirect URI:', DISCORD_CONFIG.redirectUri);
console.log('Admin IDs:', ADMIN_IDS.length ? ADMIN_IDS : 'None');
console.log('===========================');

// User database (in production, use a real database)
const users = new Map(); // userId -> userData
const sessions = new Map(); // sessionId -> userId

// Middleware to check authentication
function requireAuth(req, res, next) {
    if (req.session.userId && users.has(req.session.userId)) {
        req.user = users.get(req.session.userId);
        return next();
    }
    res.redirect('/testing/signin');
}

function optionalAuth(req, res, next) {
    if (req.session.userId && users.has(req.session.userId)) {
        req.user = users.get(req.session.userId);
    }
    next();
}

// Helper to load HTML files
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
app.get('/testing', optionalAuth, (req, res) => {
    let html = loadHtml('index.html');
    
    // Inject user data if logged in
    if (req.user) {
        html = html.replace('{{USER_NAME}}', req.user.username || 'User');
        html = html.replace('{{USER_AVATAR}}', req.user.avatarUrl || '');
    } else {
        html = html.replace('{{USER_NAME}}', 'Guest');
        html = html.replace('{{USER_AVATAR}}', '');
    }
    
    res.send(html);
});

app.get('/testing/tos', (req, res) => {
    res.send(loadHtml('tos.html'));
});

app.get('/testing/privacy', (req, res) => {
    res.send(loadHtml('privacy.html'));
});

// Authentication Pages
app.get('/testing/signin', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/testing/dashboard');
    }
    
    const discordAuthUrl = `${DISCORD_CONFIG.authUrl}?` + new URLSearchParams({
        client_id: DISCORD_CONFIG.clientId,
        redirect_uri: DISCORD_CONFIG.redirectUri,
        response_type: 'code',
        scope: 'identify email',
        prompt: 'consent'
    }).toString();
    
    let html = loadHtml('signin.html');
    html = html.replace('{{DISCORD_AUTH_URL}}', discordAuthUrl);
    res.send(html);
});

app.get('/testing/signup', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/testing/dashboard');
    }
    
    const discordAuthUrl = `${DISCORD_CONFIG.authUrl}?` + new URLSearchParams({
        client_id: DISCORD_CONFIG.clientId,
        redirect_uri: DISCORD_CONFIG.redirectUri,
        response_type: 'code',
        scope: 'identify email',
        prompt: 'consent'
    }).toString();
    
    let html = loadHtml('signup.html');
    html = html.replace('{{DISCORD_AUTH_URL}}', discordAuthUrl);
    res.send(html);
});

// Discord OAuth Flow
app.get('/auth/discord', (req, res) => {
    const discordAuthUrl = `${DISCORD_CONFIG.authUrl}?` + new URLSearchParams({
        client_id: DISCORD_CONFIG.clientId,
        redirect_uri: DISCORD_CONFIG.redirectUri,
        response_type: 'code',
        scope: 'identify email',
        prompt: 'consent'
    }).toString();
    
    res.redirect(discordAuthUrl);
});

app.get('/auth/discord/callback', async (req, res) => {
    try {
        const { code } = req.query;
        
        if (!code) {
            throw new Error('No authorization code provided');
        }
        
        // Exchange code for access token
        const tokenResponse = await axios.post(DISCORD_CONFIG.tokenUrl, new URLSearchParams({
            client_id: DISCORD_CONFIG.clientId,
            client_secret: DISCORD_CONFIG.clientSecret,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: DISCORD_CONFIG.redirectUri
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        const { access_token, token_type } = tokenResponse.data;
        
        // Get user info from Discord
        const userResponse = await axios.get(`${DISCORD_CONFIG.apiUrl}/users/@me`, {
            headers: {
                Authorization: `${token_type} ${access_token}`
            }
        });
        
        const discordUser = userResponse.data;
        
        // Create or update user in our database
        const userId = discordUser.id;
        const userData = {
            id: userId,
            discordId: userId,
            username: discordUser.username,
            discriminator: discordUser.discriminator,
            globalName: discordUser.global_name,
            avatar: discordUser.avatar,
            avatarUrl: discordUser.avatar ? 
                `https://cdn.discordapp.com/avatars/${userId}/${discordUser.avatar}.png` :
                `https://cdn.discordapp.com/embed/avatars/${discordUser.discriminator % 5}.png`,
            email: discordUser.email,
            verified: discordUser.verified,
            locale: discordUser.locale,
            isAdmin: ADMIN_IDS.includes(userId),
            plan: 'Silver', // Default plan
            capeCount: 1, // Free cape
            freeCape: true,
            trialEnds: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7-day trial
            joinDate: new Date().toISOString(),
            lastLogin: new Date().toISOString()
        };
        
        // Store user
        users.set(userId, userData);
        
        // Create session
        req.session.userId = userId;
        req.session.save();
        
        console.log(`✅ User logged in: ${discordUser.username}#${discordUser.discriminator} (${userId})`);
        
        // Redirect to dashboard
        res.redirect('/testing/dashboard');
        
    } catch (error) {
        console.error('Discord OAuth error:', error.response?.data || error.message);
        res.redirect('/testing/signin?error=auth_failed');
    }
});

// Logout
app.get('/auth/logout', (req, res) => {
    if (req.session.userId) {
        console.log(`👋 User logged out: ${req.session.userId}`);
    }
    
    req.session.destroy();
    res.redirect('/testing');
});

// Protected Dashboard
app.get('/testing/dashboard', requireAuth, (req, res) => {
    let html = loadHtml('dashboard.html');
    
    // Inject user data
    const user = req.user;
    html = html.replace(/{{USER_ID}}/g, user.id);
    html = html.replace(/{{USER_NAME}}/g, user.globalName || user.username);
    html = html.replace(/{{USERNAME}}/g, user.username);
    html = html.replace(/{{DISCRIMINATOR}}/g, user.discriminator);
    html = html.replace(/{{USER_AVATAR}}/g, user.avatarUrl);
    html = html.replace(/{{USER_EMAIL}}/g, user.email || 'Not provided');
    html = html.replace(/{{USER_PLAN}}/g, user.plan);
    html = html.replace(/{{CAPE_COUNT}}/g, user.capeCount);
    html = html.replace(/{{FREE_CAPE}}/g, user.freeCape ? 'Yes' : 'No');
    html = html.replace(/{{TRIAL_ENDS}}/g, new Date(user.trialEnds).toLocaleDateString());
    html = html.replace(/{{JOIN_DATE}}/g, new Date(user.joinDate).toLocaleDateString());
    html = html.replace(/{{IS_ADMIN}}/g, user.isAdmin ? 'Yes' : 'No');
    
    res.send(html);
});

// API Endpoints
app.get('/api/user/profile', requireAuth, (req, res) => {
    res.json(req.user);
});

app.get('/api/user/capes', requireAuth, (req, res) => {
    // Mock cape data
    const capes = [
        {
            id: 'cape_1',
            name: 'Starter Magical Cape',
            description: 'Your free magical cape for joining Rumora',
            image: 'https://via.placeholder.com/200x300/9d4edd/ffffff?text=Magic+Cape',
            obtained: req.user.joinDate,
            isEquipped: true
        }
    ];
    
    res.json({ capes });
});

app.post('/api/user/claim-cape', requireAuth, (req, res) => {
    const user = req.user;
    
    if (user.freeCape) {
        user.capeCount += 1;
        user.freeCape = false;
        users.set(user.id, user);
        
        res.json({
            success: true,
            message: '🎉 Magical cape claimed!',
            capeCount: user.capeCount
        });
    } else {
        res.status(400).json({
            success: false,
            message: 'You have already claimed your free cape'
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'rumora',
        users: users.size,
        environment: process.env.NODE_ENV,
        discord: {
            clientId: DISCORD_CONFIG.clientId ? '✅ Configured' : '❌ Missing',
            redirectUri: DISCORD_CONFIG.redirectUri
        },
        timestamp: new Date().toISOString()
    });
});

// Root redirect
app.get('/', (req, res) => {
    res.redirect('/testing');
});

// 404 handler
app.use((req, res) => {
    res.status(404).send(loadHtml('404.html') || `
        <!DOCTYPE html>
        <html>
        <head><title>404 - Rumora</title><style>body{background:#0f0b1f;color:white;font-family:sans-serif;padding:40px;text-align:center;}</style></head>
        <body><h1>404 - Magical Page Not Found</h1><p><a href="/testing" style="color:#9d4edd;">Return to Rumora</a></p></body>
        </html>
    `);
});

// Start server
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════════════════════════════════════════╗
    ║                                                                          ║
    ║   ✨ RUMORA - DISCORD AUTH SYSTEM ✨                                     ║
    ║                                                                          ║
    ╠══════════════════════════════════════════════════════════════════════════╣
    ║                                                                          ║
    ║   🌐 Main Site:     ${process.env.APP_URL}/testing                      ║
    ║   🔐 Sign In:       ${process.env.APP_URL}/testing/signin                ║
    ║   📝 Sign Up:       ${process.env.APP_URL}/testing/signup                ║
    ║   📊 Dashboard:     ${process.env.APP_URL}/testing/dashboard            ║
    ║   📈 Health:        ${process.env.APP_URL}/health                       ║
    ║   🎮 Discord Auth:  ${process.env.APP_URL}/auth/discord                  ║
    ║                                                                          ║
    ║   🚀 Server running on port ${PORT}                                      ║
    ║   📡 Environment: ${process.env.NODE_ENV}                                ║
    ║                                                                          ║
    ╚══════════════════════════════════════════════════════════════════════════╝
    `);
    
    if (!DISCORD_CONFIG.clientId || !DISCORD_CONFIG.clientSecret) {
        console.log('\n⚠️  WARNING: Discord OAuth not configured!');
        console.log('👉 Create Discord application: https://discord.com/developers/applications');
        console.log('👉 Add to .env:');
        console.log('   DISCORD_CLIENT_ID=your_client_id_here');
        console.log('   DISCORD_CLIENT_SECRET=your_client_secret_here\n');
    }
});
