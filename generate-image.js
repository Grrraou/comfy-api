const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
    comfyuiUrl: process.env.COMFYUI_URL || 'http://host.docker.internal:8188',
    apiEndpoint: '/api',
    timeout: 300000, // 5 minutes timeout for generation
    pollInterval: 1000, // 1 second between polls
    outputDir: path.join(__dirname, 'public', 'images')
};

async function getAvailableModels() {
    try {
        const apiUrl = `${config.comfyuiUrl}${config.apiEndpoint}`;
        const response = await axios.get(`${apiUrl}/object_info`, {
            timeout: config.timeout
        });
        return response.data;
    } catch (error) {
        console.error('Error getting available models:', error.message);
        throw error;
    }
}

// Example workflow for text-to-image generation
function createWorkflow(prompt, negativePrompt = "text, watermark", modelName = "dreamshaper_8.safetensors", width = 832, height = 1216) {
    return {
        "prompt": {
            "3": {
                "inputs": {
                    "seed": Math.floor(Math.random() * 1000000),
                    "steps": 20,
                    "cfg": 7,
                    "sampler_name": "euler",
                    "scheduler": "normal",
                    "denoise": 1,
                    "model": ["4", 0],
                    "positive": ["6", 0],
                    "negative": ["7", 0],
                    "latent_image": ["5", 0]
                },
                "class_type": "KSampler"
            },
            "4": {
                "inputs": {
                    "ckpt_name": modelName
                },
                "class_type": "CheckpointLoaderSimple"
            },
            "5": {
                "inputs": {
                    "width": width,
                    "height": height,
                    "batch_size": 1
                },
                "class_type": "EmptyLatentImage"
            },
            "6": {
                "inputs": {
                    "text": prompt,
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "7": {
                "inputs": {
                    "text": negativePrompt,
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "8": {
                "inputs": {
                    "samples": ["3", 0],
                    "vae": ["4", 2]
                },
                "class_type": "VAEDecode"
            },
            "9": {
                "inputs": {
                    "filename_prefix": "ComfyUI",
                    "images": ["8", 0]
                },
                "class_type": "SaveImage"
            }
        }
    };
}

async function validateWorkflow(workflow) {
    try {
        const apiUrl = `${config.comfyuiUrl}${config.apiEndpoint}`;
        console.log('Validating workflow...');
        console.log('Workflow:', JSON.stringify(workflow, null, 2));
        
        const response = await axios.post(`${apiUrl}/prompt`, workflow, {
            timeout: config.timeout
        });
        return response.data;
    } catch (error) {
        if (error.response) {
            console.error('Validation error response:', error.response.data);
            throw new Error(`Workflow validation failed: ${JSON.stringify(error.response.data)}`);
        }
        throw error;
    }
}

async function generateImage(prompt, negativePrompt, modelName, width, height) {
    try {
        const apiUrl = `${config.comfyuiUrl}${config.apiEndpoint}`;
        console.log('Generating image with prompt:', prompt);
        if (negativePrompt) {
            console.log('Negative prompt:', negativePrompt);
        }
        console.log('Using model:', modelName);
        console.log('Dimensions:', width, 'x', height);

        // Check available models
        console.log('Checking available models...');
        const models = await getAvailableModels();
        const availableModels = Object.keys(models);
        console.log('Available models:', availableModels);

        if (!modelName) {
            modelName = "dreamshaper_8.safetensors";
        }
        
        // Create and validate the workflow
        const workflow = createWorkflow(prompt, negativePrompt, modelName, width, height);
        console.log('Validating workflow...');
        const validationResult = await validateWorkflow(workflow);
        console.log('Workflow validation successful:', validationResult);

        // Queue the prompt
        console.log('Sending workflow to ComfyUI...');
        const queueResponse = await axios.post(`${apiUrl}/prompt`, workflow, {
            timeout: config.timeout
        });
        const promptId = queueResponse.data.prompt_id;
        console.log('Prompt queued with ID:', promptId);

        // Poll for completion and image
        console.log('Waiting for generation to complete...');
        const startTime = Date.now();
        let imageFound = false;

        while (!imageFound && Date.now() - startTime < config.timeout) {
            try {
                console.log('Checking history...');
                const historyResponse = await axios.get(`${apiUrl}/history/${promptId}`);
                const history = historyResponse.data;
                
                if (history[promptId] && history[promptId].outputs) {
                    const outputs = history[promptId].outputs;
                    console.log('Outputs found:', Object.keys(outputs));
                    
                    for (const nodeId in outputs) {
                        const nodeOutput = outputs[nodeId];
                        if (nodeOutput.images && nodeOutput.images.length > 0) {
                            const image = nodeOutput.images[0];
                            console.log('Found image:', image.filename);
                            
                            // Try to get the image
                            try {
                                console.log('Fetching image from:', `${apiUrl}/view?filename=${image.filename}`);
                                const imageResponse = await axios.get(`${apiUrl}/view?filename=${image.filename}`, {
                                    responseType: 'arraybuffer'
                                });
                                
                                // Save the image
                                const imageBuffer = Buffer.from(imageResponse.data);
                                const outputPath = path.join(config.outputDir, 'generated.png');
                                
                                // Ensure the output directory exists
                                if (!fs.existsSync(config.outputDir)) {
                                    fs.mkdirSync(config.outputDir, { recursive: true });
                                }
                                
                                // Delete the previous image if it exists
                                if (fs.existsSync(outputPath)) {
                                    fs.unlinkSync(outputPath);
                                }
                                
                                fs.writeFileSync(outputPath, imageBuffer);
                                console.log('Image saved to:', outputPath);
                                return outputPath;
                            } catch (error) {
                                console.log('Image not available yet, waiting...');
                            }
                        }
                    }
                }
                
                console.log('Waiting for image...');
                await new Promise(resolve => setTimeout(resolve, config.pollInterval));
            } catch (error) {
                console.error('Error checking history:', error.message);
                await new Promise(resolve => setTimeout(resolve, config.pollInterval));
            }
        }

        throw new Error('Image not found after timeout');
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Error response:', error.response.data);
        }
        throw error;
    }
}

// Get prompt from command line arguments
const args = process.argv.slice(2);
const prompt = args[0];
const negativePrompt = args[1];
const modelName = args[2];
const width = parseInt(args[3]) || 832;
const height = parseInt(args[4]) || 1216;

if (!prompt) {
    console.error('Please provide a prompt as a command line argument');
    console.error('Usage: node generate-image.js "your prompt here" ["negative prompt"] ["model name"] [width] [height]');
    process.exit(1);
}

// Run the generation
generateImage(prompt, negativePrompt, modelName, width, height)
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Error:', error.message);
        process.exit(1);
    }); 