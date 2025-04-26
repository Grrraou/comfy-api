# Local AI API Sandbox

A comprehensive web interface for interacting with local AI services, including ComfyUI for image generation and Ollama for text generation. The project provides a sandbox environment for testing and integrating various AI capabilities through a unified web interface.

## Features

- **Image Generation**: Generate images using ComfyUI with customizable prompts and models
- **Background Removal**: Remove backgrounds from images using the Rembg node
- **AI-Powered Prompt Generation**: Generate and enhance prompts using Ollama
- **Configuration Management**: Easy setup and testing of AI service endpoints
- **Node Testing**: Verify the presence and functionality of required ComfyUI nodes
- **Web UI**: User-friendly interface for all operations

## Prerequisites

- Docker and Docker Compose installed
- Local ComfyUI instance running
- Ollama instance running (optional, for AI prompt generation)
- Make (usually pre-installed on Linux/Mac, available via WSL on Windows)

## Project Structure

```
.
├── Dockerfile           # Container configuration
├── docker-compose.yml   # Docker services configuration
├── Makefile            # Build and management commands
├── webui.js            # Web UI server
├── views/              # Web UI templates
│   ├── index.ejs       # Main web UI template
│   ├── config.ejs      # Configuration page
│   ├── free-prompt.ejs # Free prompt generation page
│   ├── prompt-builder.ejs # Character builder page
│   └── remove-background.ejs # Background removal page
└── public/             # Static files
    └── images/         # Generated images
```

## Getting Started

1. Ensure your local ComfyUI instance is running
2. (Optional) Ensure your Ollama instance is running
3. Build and start the service:
   ```bash
   make build
   make up
   ```
4. Access the web UI at http://localhost:3000

## Web UI Features

### Image Generation
- Generate images using ComfyUI
- Customize prompts and negative prompts
- Select from available models
- View generated images with error handling

### Background Removal
- Upload images for background removal
- Uses the ComfyUI-Inspyrenet-Rembg node
- View original and processed images
- Download processed images

### AI-Powered Prompt Generation
- Generate prompts using Ollama
- Character builder with customizable attributes
- Free prompt generation with AI assistance
- Conversation history for context

### Configuration Management
- Configure ComfyUI and Ollama endpoints
- Test connection to services
- Verify required nodes (e.g., Rembg)
- View installation instructions for missing components

## Available Commands

- `make build` - Build the Docker image
- `make up` - Start the service
- `make down` - Stop the service
- `make logs` - View logs
- `make ps` - List running containers
- `make clean` - Clean up Docker resources
- `make shell` - Shell into the container
- `make check-comfyui` - Check if local ComfyUI is running
- `make webui` - Start the web UI
- `make help` - Show all available commands

## Environment Configuration

The service connects to your local AI services using the following configuration:

```yaml
environment:
  - COMFYUI_API=http://host.docker.internal:8188/api
  - OLLAMA_URL=http://host.docker.internal:11434
```

## Required ComfyUI Nodes

The project requires the following ComfyUI custom nodes:

1. **ComfyUI-Inspyrenet-Rembg**
   - Used for background removal
   - Installation:
     ```bash
     cd ComfyUI/custom_nodes
     git clone https://github.com/ltdrdata/ComfyUI-Inspyrenet-Rembg.git
     ```

## Development

To access the container's shell for debugging:
```bash
make shell
```

To view logs:
```bash
make logs
```

## Cleaning Up

To stop and remove all containers:
```bash
make down
make clean
```

## Troubleshooting

1. **ComfyUI Connection Issues**
   - Ensure ComfyUI is running and accessible
   - Check the configuration page for connection status
   - Verify the ComfyUI URL in the configuration

2. **Rembg Node Not Found**
   - Check the configuration page for installation instructions
   - Ensure the node is properly installed in ComfyUI
   - Restart ComfyUI after installing the node

3. **Ollama Connection Issues**
   - Ensure Ollama is running and accessible
   - Check the configuration page for connection status
   - Verify the Ollama URL in the configuration

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 