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