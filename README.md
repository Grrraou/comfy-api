# ComfyUI Test Project

This project provides a test environment for interacting with a local ComfyUI instance. It uses Docker for containerization and provides a set of convenient make commands for managing the test environment. The project includes a web UI for easy image generation and visualization.

## Prerequisites

- Docker and Docker Compose installed
- Local ComfyUI instance running on http://127.0.0.1:8188/
- Make (usually pre-installed on Linux/Mac, available via WSL on Windows)

## Project Structure

```
.
├── Dockerfile           # Test container configuration
├── docker-compose.yml   # Docker services configuration
├── Makefile            # Build and management commands
├── test-comfyui.js     # Test scripts
├── webui.js            # Web UI server
├── views/              # Web UI templates
│   └── index.ejs       # Main web UI template
└── public/             # Static files
    └── images/         # Generated images
```

## Getting Started

1. Ensure your local ComfyUI instance is running at http://127.0.0.1:8188/
2. Verify the connection:
   ```bash
   make check-comfyui
   ```
3. Build the test container:
   ```bash
   make build
   ```
4. Start the test service:
   ```bash
   make up
   ```

## Web UI

The project includes a web UI for easy image generation. To start the web UI:

```bash
make webui
```

Then open your browser and navigate to:
```
http://localhost:3000
```

The web UI provides:
- A form for entering prompts
- Optional negative prompts
- Optional model selection
- Display of generated images
- Error handling and feedback

## Available Commands

- `make build` - Build the Docker image
- `make up` - Start the test service
- `make down` - Stop the test service
- `make logs` - View logs
- `make ps` - List running containers
- `make clean` - Clean up Docker resources
- `make test` - Run tests
- `make shell` - Shell into the test container
- `make check-comfyui` - Check if local ComfyUI is running
- `make webui` - Start the web UI for image generation
- `make help` - Show all available commands

## Environment Configuration

The test service connects to your local ComfyUI instance using the following configuration:

```yaml
environment:
  - COMFYUI_API=http://host.docker.internal:8188/api
```

## Development

To run tests against your local ComfyUI instance:

```bash
make test
```

To access the test container's shell for debugging:

```bash
make shell
```

## Cleaning Up

To stop all services and clean up resources:

```bash
make clean
```

## Troubleshooting

1. If you can't connect to ComfyUI:
   - Verify ComfyUI is running locally: `make check-comfyui`
   - Check if the API URL is correct in docker-compose.yml
   - Ensure no firewall is blocking the connection

2. If tests fail:
   - Check the logs: `make logs`
   - Shell into the container: `make shell`
   - Verify ComfyUI API responses using the shell

3. If the web UI isn't working:
   - Ensure the container is running: `make ps`
   - Check the logs: `make logs`
   - Verify port 3000 is available
   - Make sure all dependencies are installed: `make build`

# ComfyUI Image Generator

A web interface for generating images using ComfyUI's API. This application provides three main features:

1. **Free Prompt Generator**: Write your own custom prompts and generate images with complete creative freedom.
2. **Character Builder**: Create detailed character prompts using a structured builder with predefined options.
3. **Background Remover**: Upload images and automatically remove their backgrounds using AI.

## Features

### Free Prompt Generator
- Write custom prompts
- Add negative prompts
- Select from available models
- Adjust image dimensions
- Save and load previous prompts

### Character Builder
- Select character background (forest, cave, castle)
- Define character attributes:
  - Gender
  - Age
  - Body type
  - Eye color
  - Hair color
  - Ethnicity
  - Clothing
- Custom input options for each attribute
- Additional details field for extra customization
- Real-time prompt preview
- Save and load character configurations

### Background Remover
- Upload images (JPG, PNG, GIF)
- Automatic background removal using AI
- Side-by-side comparison of original and processed images
- Support for different models
- File size limit: 10MB

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables (optional):
   - `COMFYUI_URL`: URL of your ComfyUI instance (default: http://host.docker.internal:8188)
   - `PORT`: Port for the web server (default: 3000)

## Docker Setup

1. Build the Docker image:
   ```bash
   make build
   ```

2. Run the web interface:
   ```bash
   make webui
   ```

The application will be available at http://localhost:3000

## Usage

1. **Free Prompt Generator**:
   - Navigate to `/free-prompt`
   - Enter your prompt and settings
   - Click "Generate Image"

2. **Character Builder**:
   - Navigate to `/prompt-builder`
   - Select character attributes
   - Use custom inputs for more specific details
   - Click "Generate Image"

3. **Background Remover**:
   - Navigate to `/remove-background`
   - Upload an image
   - Select a model (optional)
   - Click "Remove Background"

## API Endpoints

- `POST /api/generate`: Generate images from prompts
- `POST /api/remove-background`: Remove background from images
- `GET /api/models`: Get list of available models

## Requirements

- Node.js 18 or higher
- Docker (for containerized deployment)
- ComfyUI instance running and accessible

## License

ISC

# ComfyUI API

A simple API wrapper for ComfyUI that provides a web interface for generating images and removing backgrounds.

## Features

- Generate images using Stable Diffusion models
- Remove backgrounds from images using InspyrenetRembg
- Modern web interface with real-time preview
- Support for multiple models
- Background removal with transparent output

## Installation

1. Clone this repository
2. Install dependencies:
```bash
npm install
```

## Usage

1. Start the server:
```bash
npm start
```

2. Access the web interface at `http://localhost:3000`

## API Endpoints

### Image Generation
- `POST /api/generate`
  - Parameters:
    - `prompt`: Text prompt for image generation
    - `negative`: Negative prompt (optional)
    - `model`: Model name (optional)
    - `width`: Image width (optional)
    - `height`: Image height (optional)

### Background Removal
- `POST /api/remove-background`
  - Parameters:
    - `image`: Image file to process
  - Returns:
    - `originalImagePath`: Path to the original uploaded image
    - `processedImagePath`: Path to the processed image with transparent background

## Web Interface

The web interface provides three main pages:

1. **Home Page** (`/`)
   - Links to all available features:
     - Free Prompt Generator
     - Character Builder
     - Background Removal

2. **Free Prompt** (`/free-prompt`)
   - Generate images using text prompts
   - Customize model, dimensions, and negative prompts
   - Save and load previous prompts

3. **Character Builder** (`/prompt-builder`)
   - Create detailed character prompts using a structured builder
   - Select character attributes:
     - Background (forest, cave, castle)
     - Gender
     - Age
     - Body type
     - Eye color
     - Hair color
     - Ethnicity
     - Clothing
   - Add custom details for each attribute
   - Real-time prompt preview
   - Save and load character configurations

4. **Background Removal** (`/remove-background`)
   - Upload an image to remove its background
   - Download the processed image with transparent background
   - Side-by-side comparison of original and processed images

## Docker Support

The application is containerized and can be run using Docker:

```bash
docker build -t comfy-api .
docker run -p 3000:3000 comfy-api
```

## Configuration

The application can be configured using environment variables:

- `PORT`: Server port (default: 3000)
- `COMFYUI_URL`: URL of the ComfyUI server (default: http://host.docker.internal:8188)

## License

MIT

## Make Commands

The project includes several make commands for easy management:

```bash
# Build and run
make build        # Build the Docker image
make up          # Start the service
make down        # Stop the service
make logs        # View service logs
make ps          # List running containers
make clean       # Clean up Docker resources

# Development
make test        # Run tests
make shell       # Shell into the container
make webui       # Start the web UI

# ComfyUI
make check-comfyui  # Check if local ComfyUI is running

# Help
make help        # Show all available commands
``` 