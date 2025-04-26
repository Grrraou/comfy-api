const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

// Configuration
const config = {
    comfyuiUrl: process.env.COMFYUI_URL || 'http://host.docker.internal:8188',
    apiEndpoint: '/api'
};

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'public', 'images');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: function (req, file, cb) {
        // Accept images only
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Create necessary directories
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

// Add new route for background removal page
app.get('/remove-background', async (req, res) => {
    try {
        const models = await getAvailableModels();
        res.render('remove-background', { 
            title: 'Remove Background - ComfyUI Image Generator',
            models: models,
            formData: {}
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error loading models');
    }
});

// Function to execute the background removal workflow
async function executeWorkflow(workflow) {
    try {
        console.log('Sending workflow to ComfyUI:', JSON.stringify(workflow, null, 2));
        
        // First, queue the prompt
        const queueResponse = await axios.post(`${config.comfyuiUrl}/prompt`, workflow);
        console.log('Queue response:', queueResponse.data);
        
        const promptId = queueResponse.data.prompt_id;

        // Poll for completion
        while (true) {
            const historyResponse = await axios.get(`${config.comfyuiUrl}/history/${promptId}`);
            console.log('History response:', historyResponse.data);
            
            if (historyResponse.data[promptId]) {
                const outputs = historyResponse.data[promptId].outputs;
                for (const nodeId in outputs) {
                    const nodeOutput = outputs[nodeId];
                    if (nodeOutput.images && nodeOutput.images.length > 0) {
                        // Get the image data
                        const imageResponse = await axios.get(`${config.comfyuiUrl}/view?filename=${nodeOutput.images[0].filename}`, {
                            responseType: 'arraybuffer'
                        });
                        
                        // Save the image to public/images
                        const imageBuffer = Buffer.from(imageResponse.data);
                        const outputPath = path.join(__dirname, 'public', 'images', nodeOutput.images[0].filename);
                        
                        // Ensure the directory exists
                        if (!fs.existsSync(path.join(__dirname, 'public', 'images'))) {
                            fs.mkdirSync(path.join(__dirname, 'public', 'images'), { recursive: true });
                        }
                        
                        fs.writeFileSync(outputPath, imageBuffer);
                        return nodeOutput.images[0].filename;
                    }
                }
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } catch (error) {
        console.error('Error executing workflow:', error.response?.data || error.message);
        throw error;
    }
}

// Add new API endpoint for background removal
app.post('/api/remove-background', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        // Create form-data instance
        const FormData = require('form-data');
        const form = new FormData();
        
        // Append the file to form-data
        form.append('image', fs.createReadStream(req.file.path), {
            filename: 'upload.png',
            contentType: 'image/png'
        });

        // Upload the image to ComfyUI
        const uploadResponse = await axios.post(`${config.comfyuiUrl}/upload/image`, form, {
            headers: {
                ...form.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        const uploadedImageName = uploadResponse.data.name;
        console.log('Image uploaded to ComfyUI:', uploadedImageName);

        // Create the complete workflow JSON
        const workflow = {
            "prompt": {
                "2": {
                    "inputs": {
                        "image": uploadedImageName
                    },
                    "class_type": "LoadImage"
                },
                "8": {
                    "inputs": {
                        "image": ["2", 0],
                        "torchscript_jit": "default"
                    },
                    "class_type": "InspyrenetRembg"
                },
                "4": {
                    "inputs": {
                        "images": ["8", 0],
                        "filename_prefix": "rembg_"
                    },
                    "class_type": "SaveImage"
                }
            },
            "last_node_id": 8,
            "last_link_id": 2,
            "nodes": [
                {
                    "id": 2,
                    "type": "LoadImage",
                    "pos": [895.6087646484375, 1138.700439453125],
                    "size": [315, 314],
                    "flags": {},
                    "order": 0,
                    "mode": 0,
                    "inputs": [],
                    "outputs": [
                        {"name": "IMAGE", "type": "IMAGE", "links": [1], "slot_index": 0},
                        {"name": "MASK", "type": "MASK", "links": null}
                    ],
                    "properties": {"Node name for S&R": "LoadImage"},
                    "widgets_values": [uploadedImageName, "image"]
                },
                {
                    "id": 8,
                    "type": "InspyrenetRembg",
                    "pos": [1311.2823486328125, 1758.5572509765625],
                    "size": [315, 78],
                    "flags": {},
                    "order": 1,
                    "mode": 0,
                    "inputs": [{"name": "image", "type": "IMAGE", "link": 1}],
                    "outputs": [
                        {"name": "IMAGE", "type": "IMAGE", "links": [2], "slot_index": 0},
                        {"name": "MASK", "type": "MASK", "links": null}
                    ],
                    "properties": {"Node name for S&R": "InspyrenetRembg"},
                    "widgets_values": ["default"]
                },
                {
                    "id": 4,
                    "type": "SaveImage",
                    "pos": [1697.189453125, 1778.6168212890625],
                    "size": [315, 270],
                    "flags": {},
                    "order": 2,
                    "mode": 0,
                    "inputs": [{"name": "images", "type": "IMAGE", "link": 2}],
                    "outputs": [],
                    "properties": {},
                    "widgets_values": ["rembg_"]
                }
            ],
            "links": [
                [1, 2, 0, 8, 0, "IMAGE"],
                [2, 8, 0, 4, 0, "IMAGE"]
            ],
            "groups": [],
            "config": {},
            "extra": {
                "ds": {
                    "scale": 0.8954302432552457,
                    "offset": [-504.9662001090475, -966.2704943581302]
                },
                "node_versions": {
                    "comfy-core": "v0.3.10",
                    "comfyui-inspyrenet-rembg": "87ac452ef1182e8f35f59b04010158d74dcefd06"
                }
            },
            "version": 0.4
        };

        // Execute the workflow
        const resultFilename = await executeWorkflow(workflow);
        const processedImagePath = `/images/${resultFilename}`;

        // Clean up the uploaded file
        fs.unlinkSync(req.file.path);

        res.json({
            success: true,
            originalImagePath: `/images/${path.basename(req.file.path)}`,
            processedImagePath: processedImagePath
        });
    } catch (error) {
        console.error('Error processing image:', error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data || error.message });
    }
});

app.listen(port, () => {
    console.log(`Web UI server running at http://localhost:${port}`);
}); 