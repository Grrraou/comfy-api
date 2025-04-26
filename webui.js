const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Configuration
const config = {
    comfyuiUrl: process.env.COMFYUI_URL || 'http://host.docker.internal:8188',
    apiEndpoint: '/api'
};

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Create necessary directories
const fs = require('fs');
if (!fs.existsSync('public/images')) {
    fs.mkdirSync('public/images', { recursive: true });
}
if (!fs.existsSync('views')) {
    fs.mkdirSync('views');
}

// Get available models
async function getAvailableModels() {
    try {
        const response = await axios.get(`${config.comfyuiUrl}/object_info`);
        const models = [];
        
        // Get the CheckpointLoaderSimple node info
        const checkpointNode = response.data.CheckpointLoaderSimple;
        if (checkpointNode && checkpointNode.input && checkpointNode.input.required) {
            const ckptName = checkpointNode.input.required.ckpt_name;
            if (ckptName && ckptName[0] && ckptName[0].length > 0) {
                // The ckpt_name parameter contains the list of available models
                models.push(...ckptName[0]);
            }
        }
        
        return models;
    } catch (error) {
        console.error('Error fetching models:', error.message);
        return [];
    }
}

// API endpoint for image generation
app.post('/api/generate', express.json(), (req, res) => {
    const { prompt, negative, model, width, height } = req.body;
    
    if (!prompt) {
        console.log('Received request body:', req.body);
        return res.status(400).json({ error: 'Prompt is required' });
    }

    const command = `node generate-image.js "${prompt}" "${negative || ''}" "${model || ''}" "${width || 832}" "${height || 1216}"`;
    console.log('Executing command:', command);
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error('Command execution error:', error);
            console.error('stderr:', stderr);
            console.error('stdout:', stdout);
            return res.status(500).json({ 
                error: 'Failed to generate image',
                details: error.message,
                stderr: stderr,
                stdout: stdout
            });
        }
        
        const imagePath = '/images/generated.png';
        console.log('Image generation completed, path:', imagePath);
        return res.json({ 
            success: true, 
            imagePath,
            formData: { prompt, negative, model, width, height }
        });
    });
});

// Home page
app.get('/', async (req, res) => {
    const models = await getAvailableModels();
    res.render('index', { 
        title: 'ComfyUI Image Generator',
        imagePath: null,
        error: null,
        models: models,
        formData: { prompt: '', negative: '', model: '', width: 832, height: 1216 }
    });
});

// Free Prompt page
app.get('/free-prompt', async (req, res) => {
    const models = await getAvailableModels();
    res.render('free-prompt', { 
        title: 'Free Prompt - ComfyUI Image Generator',
        imagePath: null,
        error: null,
        models: models,
        formData: { prompt: '', negative: '', model: '', width: 832, height: 1216 }
    });
});

// Prompt Builder page
app.get('/prompt-builder', async (req, res) => {
    const models = await getAvailableModels();
    res.render('prompt-builder', { 
        title: 'Character Builder - ComfyUI Image Generator',
        imagePath: null,
        error: null,
        models: models,
        formData: { negative: '', model: '', width: 832, height: 1216 }
    });
});

// Generate image endpoint (legacy, redirects to API)
app.post('/generate', (req, res) => {
    res.redirect('/');
});

// API endpoint to get models
app.get('/api/models', async (req, res) => {
    try {
        const models = await getAvailableModels();
        res.json({ models });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Web UI server running at http://localhost:${port}`);
}); 