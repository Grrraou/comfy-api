const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const app = express();
const port = process.env.PORT || 3000;

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Create necessary directories
const fs = require('fs');
if (!fs.existsSync('public/images')) {
    fs.mkdirSync('public/images', { recursive: true });
}
if (!fs.existsSync('views')) {
    fs.mkdirSync('views');
}

// Home page
app.get('/', (req, res) => {
    res.render('index', { 
        title: 'ComfyUI Image Generator',
        imagePath: null,
        error: null
    });
});

// Generate image endpoint
app.post('/generate', (req, res) => {
    const { prompt, negative, model } = req.body;
    
    if (!prompt) {
        return res.render('index', {
            title: 'ComfyUI Image Generator',
            imagePath: null,
            error: 'Prompt is required'
        });
    }

    // Call the generate-image.js script directly
    const command = `node generate-image.js "${prompt}" "${negative || ''}" "${model || ''}"`;
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return res.render('index', {
                title: 'ComfyUI Image Generator',
                imagePath: null,
                error: 'Failed to generate image'
            });
        }
        
        // Assuming the image is saved in public/images/generated.png
        const imagePath = '/images/generated.png';
        res.render('index', {
            title: 'ComfyUI Image Generator',
            imagePath,
            error: null
        });
    });
});

app.listen(port, () => {
    console.log(`Web UI server running at http://localhost:${port}`);
}); 