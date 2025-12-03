// src/index.js
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public folder
app.use('/static', express.static(path.join(__dirname, 'public')));

// Serve main website at /testing
app.get('/testing', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint for plans (optional)
app.get('/api/plans', (req, res) => {
    const plans = [
        {
            id: 1,
            name: "Silver Plan",
            price: "$9.99/month",
            features: [
                "Premium UI Designs",
                "Roblox Ranking Bot Basic",
                "5 Bypassed Musics Monthly",
                "Standard Support",
                "Access to Silver Discord"
            ],
            badge: "Most Popular"
        },
        {
            id: 2,
            name: "Gold Plan",
            price: "$19.99/month",
            features: [
                "Everything in Silver",
                "Advanced Roblox Ranking Bot",
                "15 Bypassed Musics Monthly",
                "Priority Support",
                "Exclusive Gold Features",
                "Custom Cape Design"
            ]
        },
        {
            id: 3,
            name: "Platinum Plan",
            price: "$29.99/month",
            features: [
                "Everything in Gold",
                "Unlimited Bypassed Musics",
                "VIP Roblox Ranking Bot",
                "24/7 Dedicated Support",
                "Discord Server Boost",
                "Exclusive Platinum Community",
                "Early Access to All Features"
            ]
        }
    ];
    res.json(plans);
});

// API endpoint for services
app.get('/api/services', (req, res) => {
    const services = [
        {
            id: 1,
            name: "Free Magical Capes",
            description: "Receive an exclusive, magical cape for free when you join Rumora. Customize it with unique patterns and colors to stand out in any virtual world.",
            icon: "fa-rainbow"
        },
        {
            id: 2,
            name: "Roblox Ranking Bots",
            description: "Advanced ranking bots for Roblox games that help you climb leaderboards with magical efficiency. Customizable and undetectable.",
            icon: "fa-robot"
        },
        {
            id: 3,
            name: "Bypassed Musics",
            description: "Access a vast library of bypassed music for platforms like Roblox. Regularly updated with the latest tracks that pass moderation.",
            icon: "fa-music"
        }
    ];
    res.json(services);
});

// Handle form submissions (example)
app.post('/api/signup', (req, res) => {
    // In a real app, you would save to database
    console.log('Signup request received:', req.body);
    res.json({
        success: true,
        message: "Welcome to Rumora! Check your email for verification.",
        redirect: "/testing"
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'rumora-website',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Redirect root to /testing
app.get('/', (req, res) => {
    res.redirect('/testing');
});

// 404 handler
app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>404 - Page Not Found</title>
            <style>
                body {
                    background: #0f0b1f;
                    color: #fff;
                    font-family: 'Montserrat', sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    text-align: center;
                }
                .container {
                    padding: 2rem;
                }
                h1 {
                    font-size: 4rem;
                    color: #9d4edd;
                    margin-bottom: 1rem;
                }
                p {
                    font-size: 1.2rem;
                    margin-bottom: 2rem;
                    color: #cccccc;
                }
                a {
                    color: #c77dff;
                    text-decoration: none;
                    font-weight: bold;
                    padding: 10px 20px;
                    border: 2px solid #c77dff;
                    border-radius: 5px;
                    transition: all 0.3s;
                }
                a:hover {
                    background: #c77dff;
                    color: #0f0b1f;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>404</h1>
                <p>The magical page you're looking for has vanished!</p>
                <a href="/testing">Return to Rumora</a>
            </div>
        </body>
        </html>
    `);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something magical went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`✨ Rumora magical website is running! ✨`);
    console.log(`📍 Local: http://localhost:${PORT}/testing`);
    console.log(`📍 Health: http://localhost:${PORT}/health`);
    console.log(`📍 API Plans: http://localhost:${PORT}/api/plans`);
    console.log(`\n📁 Static files served from: ${path.join(__dirname, 'public')}`);
    console.log(`🚀 Server ready at port ${PORT}`);
});
