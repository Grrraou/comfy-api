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
    apiEndpoint: '/api',
    ollamaUrl: process.env.OLLAMA_URL || 'http://host.docker.internal:11434',
    defaultModel: process.env.DEFAULT_MODEL || 'dreamshaper_8.safetensors',
    defaultWidth: process.env.DEFAULT_WIDTH || 1024,
    defaultHeight: process.env.DEFAULT_HEIGHT || 576,
    defaultOllamaModel: process.env.DEFAULT_OLLAMA_MODEL || null // Will be set to first available model
};

// Ensure config directory exists
const configDir = path.join(__dirname, 'config');
if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
}

// Save configuration to file
function saveConfig(newConfig) {
    try {
        const configFile = path.join(configDir, 'config.json');
        // Ensure all required fields are present and valid
        const completeConfig = {
            comfyuiUrl: newConfig.comfyuiUrl || config.comfyuiUrl,
            ollamaUrl: newConfig.ollamaUrl || config.ollamaUrl,
            defaultModel: newConfig.defaultModel || config.defaultModel,
            defaultOllamaModel: newConfig.defaultOllamaModel || config.defaultOllamaModel,
            defaultWidth: parseInt(newConfig.defaultWidth) || config.defaultWidth,
            defaultHeight: parseInt(newConfig.defaultHeight) || config.defaultHeight
        };

        // Write to config file
        fs.writeFileSync(configFile, JSON.stringify(completeConfig, null, 2));
        
        // Update in-memory config
        Object.assign(config, completeConfig);
        
        // Log the saved configuration
        console.log('Configuration saved to:', configFile);
        console.log('Configuration content:', completeConfig);
        
        return true;
    } catch (error) {
        console.error('Error saving config file:', error);
        return false;
    }
}

// Load configuration from file if it exists
try {
    const configFile = path.join(configDir, 'config.json');
    if (fs.existsSync(configFile)) {
        const savedConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        console.log('Loading saved configuration from:', configFile);
        console.log('Configuration content:', savedConfig);
        
        // Update config with saved values
        if (savedConfig.comfyuiUrl) config.comfyuiUrl = savedConfig.comfyuiUrl;
        if (savedConfig.ollamaUrl) config.ollamaUrl = savedConfig.ollamaUrl;
        if (savedConfig.defaultModel) config.defaultModel = savedConfig.defaultModel;
        if (savedConfig.defaultOllamaModel) config.defaultOllamaModel = savedConfig.defaultOllamaModel;
        if (savedConfig.defaultWidth) config.defaultWidth = parseInt(savedConfig.defaultWidth);
        if (savedConfig.defaultHeight) config.defaultHeight = parseInt(savedConfig.defaultHeight);
        
        console.log('Current configuration:', config);
    }
} catch (error) {
    console.error('Error loading config file:', error);
}

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
app.post('/api/generate', express.json(), async (req, res) => {
    try {
        const { prompt, negative, model, width, height } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Use provided values or defaults
        const finalModel = model || config.defaultModel;
        const finalWidth = width || config.defaultWidth;
        const finalHeight = height || config.defaultHeight;
        const finalNegative = negative || '';

        // Escape single quotes and wrap in single quotes to avoid shell interpretation issues
        const escapedPrompt = prompt.replace(/'/g, "'\\''");
        const escapedNegative = finalNegative.replace(/'/g, "'\\''");
        const escapedModel = finalModel.replace(/'/g, "'\\''");
        
        const command = `node generate-image.js '${escapedPrompt}' '${escapedNegative}' '${escapedModel}' '${finalWidth}' '${finalHeight}'`;
        console.log('Executing command:', command);

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('Error:', error);
                console.error('Stderr:', stderr);
                return res.status(500).json({ 
                    error: 'Failed to generate image',
                    details: error.message,
                    stderr: stderr
                });
            }

            try {
                const imagePath = stdout.trim();
                if (!imagePath) {
                    throw new Error('No image path returned');
                }
                res.json({ 
                    success: true, 
                    imagePath: imagePath,
                    formData: { prompt, negative, model, width, height }
                });
            } catch (parseError) {
                console.error('Error parsing output:', parseError);
                res.status(500).json({ 
                    error: 'Failed to parse image path',
                    details: parseError.message
                });
            }
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Add a new endpoint specifically for the survival game
app.post('/api/generate-image', express.json(), async (req, res) => {
    try {
        const { prompt, areaId } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Use default values
        const finalModel = config.defaultModel;
        const finalWidth = config.defaultWidth;
        const finalHeight = config.defaultHeight;

        // Escape single quotes and wrap in single quotes to avoid shell interpretation issues
        const escapedPrompt = prompt.replace(/'/g, "'\\''");
        const escapedModel = finalModel.replace(/'/g, "'\\''");
        const escapedAreaId = areaId ? `'${areaId}'` : "''";
        
        const command = `node generate-image.js '${escapedPrompt}' '' '${escapedModel}' '${finalWidth}' '${finalHeight}' ${escapedAreaId}`;
        console.log('Executing command:', command);

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('Error:', error);
                console.error('Stderr:', stderr);
                return res.status(500).json({ 
                    error: 'Failed to generate image',
                    details: error.message,
                    stderr: stderr
                });
            }

            try {
                const imagePath = stdout.trim();
                if (!imagePath) {
                    throw new Error('No image path returned');
                }
                res.json({ success: true, imageUrl: imagePath });
            } catch (parseError) {
                console.error('Error parsing output:', parseError);
                res.status(500).json({ 
                    error: 'Failed to parse image path',
                    details: parseError.message
                });
            }
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Original image generation endpoint for prompt-builder and other tools
app.post('/api/generate', express.json(), async (req, res) => {
    try {
        const { prompt, negative, model, width, height } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Use provided values or defaults
        const finalModel = model || config.defaultModel;
        const finalWidth = width || config.defaultWidth;
        const finalHeight = height || config.defaultHeight;
        const finalNegative = negative || '';

        // Escape single quotes and wrap in single quotes to avoid shell interpretation issues
        const escapedPrompt = prompt.replace(/'/g, "'\\''");
        const escapedNegative = finalNegative.replace(/'/g, "'\\''");
        const escapedModel = finalModel.replace(/'/g, "'\\''");
        
        const command = `node generate-image.js '${escapedPrompt}' '${escapedNegative}' '${escapedModel}' '${finalWidth}' '${finalHeight}'`;
        console.log('Executing command:', command);

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('Error:', error);
                console.error('Stderr:', stderr);
                return res.status(500).json({ 
                    error: 'Failed to generate image',
                    details: error.message,
                    stderr: stderr
                });
            }

            try {
                const imagePath = stdout.trim();
                if (!imagePath) {
                    throw new Error('No image path returned');
                }
                res.json({ success: true, imagePath: imagePath });
            } catch (parseError) {
                console.error('Error parsing output:', parseError);
                res.status(500).json({ 
                    error: 'Failed to parse image path',
                    details: parseError.message
                });
            }
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Home page
app.get('/', async (req, res) => {
    const models = await getAvailableModels();
    res.render('index', { 
        title: 'Local AI API Sandbox',
        imagePath: null,
        error: null,
        models: models,
        formData: { prompt: '', negative: '', model: '', width: 448, height: 640 }
    });
});

// Free Prompt page
app.get('/free-prompt', async (req, res) => {
    const models = await getAvailableModels();
    res.render('free-prompt', { 
        title: 'Free Prompt - Local AI API Sandbox',
        imagePath: null,
        error: null,
        models: models,
        formData: { prompt: '', negative: '', model: '', width: 448, height: 640 }
    });
});

// Prompt Builder page
app.get('/prompt-builder', async (req, res) => {
    const models = await getAvailableModels();
    res.render('prompt-builder', { 
        title: 'Character Builder - Local AI API Sandbox',
        imagePath: null,
        error: null,
        models: models,
        formData: { negative: '', model: '', width: 448, height: 640 }
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
            title: 'Remove Background - Local AI API Sandbox',
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

// Add Ollama route
app.get('/ollama-test', async (req, res) => {
    const models = await getAvailableOllamaModels();
    res.render('ollama-test', { models });
});

// Add Infinite Adventure route
app.get('/infinite-adventure', async (req, res) => {
    const models = await getAvailableOllamaModels();
    res.render('infinite-adventure', { 
        title: 'Infinite Adventure - Local AI API Sandbox',
        models: models
    });
});

// Add Survival Game route
app.get('/survival-game', (req, res) => {
    res.render('survival-game', { title: 'Post-Apocalyptic Survival' });
});

// Add Ollama API endpoint
app.post('/api/ollama', async (req, res) => {
    try {
        const { prompt, model, stream, role, conversation } = req.body;
        
        let messages = [];
        if (conversation && conversation.length > 0) {
            messages = conversation;
        }
        
        // Add system message based on role
        let systemMessage = "";
        if (role === "narrator") {
            systemMessage = "You are a narrator that provides brief, concise descriptions based on the given context. Keep your responses short and focused on key details. Use vivid language and maintain a consistent narrative style.";
        } else if (role === "character_builder") {
            systemMessage = `You are a character builder that ALWAYS responds in valid JSON format. Your response must be a valid JSON object with the following structure:
            {
                "name": "string",
                "description": "string",
                "attributes": {
                    "gender": "string",
                    "age": "string",
                    "bodyType": "string",
                    "eyeColor": "string",
                    "hairColor": "string",
                    "ethnicity": "string",
                    "clothing": "string"
                },
                "background": "string",
                "additionalDetails": "string"
            }
            Do not include any text outside the JSON object. Do not include markdown formatting. The response must be parseable as JSON.`;
        } else if (role === "sd-prompt") {
            systemMessage = "You are a Stable Diffusion prompt generator. Convert descriptions into optimized keyword-based prompts. Use parentheses for emphasis, commas for separation, and avoid long sentences. Focus on key visual elements and artistic styles. Example format: (detailed face), (asian female), (warrior armor), (dynamic pose), (epic lighting), (digital art), (highly detailed), (sharp focus).";
        }
        
        if (systemMessage) {
            messages.unshift({
                role: "system",
                content: systemMessage
            });
        }
        
        messages.push({
            role: "user",
            content: prompt
        });
        
        const response = await axios.post(`${config.ollamaUrl}/v1/chat/completions`, {
            model,
            messages,
            stream: stream || false,
            response_format: role === "character_builder" ? { type: "json_object" } : undefined,
            temperature: role === "character_builder" ? 0.1 : 0.7 // Lower temperature for more consistent JSON
        });
        
        // For character builder, validate JSON response
        if (role === "character_builder") {
            try {
                JSON.parse(response.data.choices[0].message.content);
            } catch (e) {
                console.error('Invalid JSON response:', e);
                // Retry with a more strict prompt
                const retryResponse = await axios.post(`${config.ollamaUrl}/v1/chat/completions`, {
                    model,
                    messages: [
                        {
                            role: "system",
                            content: systemMessage
                        },
                        {
                            role: "user",
                            content: `Please provide the character description in valid JSON format. The response must be a valid JSON object and nothing else. Here's the character data: ${prompt}`
                        }
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.1
                });
                response.data = retryResponse.data;
            }
        }
        
        // Add the assistant's response to the conversation
        const assistantResponse = {
            role: "assistant",
            content: response.data.choices[0].message.content
        };
        
        res.json({
            response: response.data,
            conversation: [...messages, assistantResponse]
        });
    } catch (error) {
        console.error('Ollama API error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
        res.status(500).json({ error: error.message });
    }
});

// Add function to get available Ollama models
async function getAvailableOllamaModels() {
    try {
        const response = await axios.get(`${config.ollamaUrl}/api/tags`);
        return response.data.models.map(model => model.name);
    } catch (error) {
        console.error('Error fetching Ollama models:', error.message);
        return [];
    }
}

// Add Ollama models endpoint
app.get('/api/ollama/models', async (req, res) => {
    try {
        const models = await getAvailableOllamaModels();
        res.json({ models });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Configuration routes
app.get('/config', async (req, res) => {
    try {
        // Get available models
        const models = await getAvailableModels();
        const ollamaModels = await getAvailableOllamaModels();
        
        // Log current configuration
        console.log('Current configuration for /config route:', config);
        
        res.render('config', {
            comfyuiUrl: config.comfyuiUrl,
            ollamaUrl: config.ollamaUrl,
            models: models,
            ollamaModels: ollamaModels,
            defaultModel: config.defaultModel,
            defaultOllamaModel: config.defaultOllamaModel,
            defaultWidth: config.defaultWidth,
            defaultHeight: config.defaultHeight
        });
    } catch (error) {
        console.error('Error in /config route:', error);
        res.status(500).send('Error loading configuration page');
    }
});

// Save configuration endpoint
app.post('/api/config/save', express.json(), async (req, res) => {
    try {
        const { comfyuiUrl, ollamaUrl, defaultModel, defaultOllamaModel, defaultWidth, defaultHeight } = req.body;
        
        console.log('Received configuration to save:', {
            comfyuiUrl,
            ollamaUrl,
            defaultModel,
            defaultOllamaModel,
            defaultWidth,
            defaultHeight
        });
        
        let comfyuiModels = [];
        let ollamaModels = [];
        
        // Only test ComfyUI if its configuration is being updated
        if (comfyuiUrl && defaultModel) {
            try {
                const comfyuiResponse = await axios.get(`${comfyuiUrl}/object_info`);
                const checkpointNode = comfyuiResponse.data.CheckpointLoaderSimple;
                if (checkpointNode && checkpointNode.input && checkpointNode.input.required) {
                    const ckptName = checkpointNode.input.required.ckpt_name;
                    if (ckptName && ckptName[0] && ckptName[0].length > 0) {
                        comfyuiModels.push(...ckptName[0]);
                    }
                }
                
                // Validate ComfyUI model
                if (!comfyuiModels.includes(defaultModel)) {
                    return res.json({ success: false, error: 'Invalid ComfyUI model selected' });
                }
            } catch (error) {
                return res.json({ success: false, error: 'Failed to connect to ComfyUI: ' + error.message });
            }
        }
        
        // Only test Ollama if its configuration is being updated
        if (ollamaUrl && defaultOllamaModel) {
            try {
                const ollamaResponse = await axios.get(`${ollamaUrl}/api/tags`);
                ollamaModels = ollamaResponse.data.models.map(model => model.name);
                
                // Validate Ollama model
                if (!ollamaModels.includes(defaultOllamaModel)) {
                    return res.json({ success: false, error: 'Invalid Ollama model selected' });
                }
            } catch (error) {
                return res.json({ success: false, error: 'Failed to connect to Ollama: ' + error.message });
            }
        }
        
        // Prepare new configuration
        const newConfig = {
            comfyuiUrl: comfyuiUrl || config.comfyuiUrl,
            ollamaUrl: ollamaUrl || config.ollamaUrl,
            defaultModel: defaultModel || config.defaultModel,
            defaultOllamaModel: defaultOllamaModel || config.defaultOllamaModel,
            defaultWidth: parseInt(defaultWidth) || config.defaultWidth,
            defaultHeight: parseInt(defaultHeight) || config.defaultHeight
        };
        
        console.log('Saving new configuration:', newConfig);
        
        if (saveConfig(newConfig)) {
            // Verify the configuration was saved
            const savedConfig = JSON.parse(fs.readFileSync(path.join(configDir, 'config.json'), 'utf8'));
            console.log('Verified saved configuration:', savedConfig);
            
            // Update the in-memory config
            Object.assign(config, savedConfig);
            
            res.json({ 
                success: true,
                models: comfyuiModels,
                ollamaModels
            });
        } else {
            res.json({ success: false, error: 'Failed to save configuration' });
        }
    } catch (error) {
        console.error('Error saving configuration:', error);
        res.json({ success: false, error: error.message });
    }
});

// Test ComfyUI endpoint
app.post('/api/config/test-comfyui', async (req, res) => {
    try {
        const { url } = req.body;
        const response = await axios.get(`${url}/object_info`);
        const models = [];
        
        // Get the CheckpointLoaderSimple node info
        const checkpointNode = response.data.CheckpointLoaderSimple;
        if (checkpointNode && checkpointNode.input && checkpointNode.input.required) {
            const ckptName = checkpointNode.input.required.ckpt_name;
            if (ckptName && ckptName[0] && ckptName[0].length > 0) {
                models.push(...ckptName[0]);
            }
        }
        
        res.json({ success: true, models });
    } catch (error) {
        console.error('ComfyUI test error:', error.message);
        res.json({ success: false, error: error.message });
    }
});

// Test Ollama endpoint
app.post('/api/config/test-ollama', async (req, res) => {
    try {
        const { url } = req.body;
        const response = await axios.get(`${url}/api/tags`);
        const models = response.data.models.map(model => model.name);
        
        res.json({ success: true, models });
    } catch (error) {
        console.error('Ollama test error:', error.message);
        res.json({ success: false, error: error.message });
    }
});

// Test Rembg node
app.post('/api/config/test-rembg', async (req, res) => {
    try {
        const { url } = req.body;
        const response = await axios.get(`${url}/object_info`);
        
        // Check if InspyrenetRembg node exists
        const hasRembgNode = 'InspyrenetRembg' in response.data;
        
        if (hasRembgNode) {
            res.json({ success: true });
        } else {
            res.json({ 
                success: false, 
                error: 'Rembg node not found. Please install the ComfyUI-Inspyrenet-Rembg custom node.' 
            });
        }
    } catch (error) {
        console.error('Rembg test error:', error.message);
        res.json({ success: false, error: error.message });
    }
});

// Get configuration endpoint
app.get('/api/config', async (req, res) => {
    try {
        // Get available models
        const models = await getAvailableModels();
        const ollamaModels = await getAvailableOllamaModels();
        
        console.log('Current configuration for /api/config:', config);
        
        res.json({
            ...config,
            models,
            ollamaModels
        });
    } catch (error) {
        console.error('Error getting configuration:', error);
        res.status(500).json({ error: error.message });
    }
});

// Initialize default Ollama model if not set
async function initializeDefaultOllamaModel() {
    if (!config.defaultOllamaModel) {
        try {
            const models = await getAvailableOllamaModels();
            if (models.length > 0) {
                config.defaultOllamaModel = models[0];
                saveConfig(config);
            }
        } catch (error) {
            console.error('Error initializing default Ollama model:', error);
        }
    }
}

// Call initialization on startup
initializeDefaultOllamaModel();

// API endpoint for generating new locations
app.post('/api/generate-location', async (req, res) => {
    try {
        const { context, previousLocations } = req.body;
        
        // Call Ollama API to generate location description
        const response = await axios.post(`${config.ollamaUrl}/api/generate`, {
            model: config.defaultOllamaModel,
            prompt: `Generate a unique post-apocalyptic location description. Context: ${context}. 
                    Previous locations: ${previousLocations.join(', ')}. 
                    Return the response in valid JSON format with 'title' and 'description' fields.
                    Example format: {"title": "Abandoned Hospital", "description": "A description here"}`,
            stream: false
        });

        console.log('Ollama response:', response.data);

        // Try to parse the response
        let locationData;
        try {
            // First try to parse the entire response
            locationData = JSON.parse(response.data.response);
        } catch (e) {
            console.error('Failed to parse full response, trying to extract JSON:', e);
            // If that fails, try to extract JSON from the response text
            const jsonMatch = response.data.response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                locationData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Could not find valid JSON in response');
            }
        }

        // Validate the response structure
        if (!locationData.title || !locationData.description) {
            throw new Error('Invalid location data structure');
        }

        res.json(locationData);
    } catch (error) {
        console.error('Error generating location:', error);
        console.error('Error details:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        res.status(500).json({ 
            error: 'Failed to generate location',
            details: error.message
        });
    }
});

app.listen(port, () => {
    console.log(`Web UI server running at http://localhost:${port}`);
}); 