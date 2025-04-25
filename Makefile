.PHONY: build up down logs ps clean test shell help generate webui

# Build the Docker image
build:
	docker-compose build

# Start the test service
up:
	docker-compose up -d

# Stop the test service
down:
	docker-compose down

# View logs
logs:
	docker-compose logs -f

# List running containers
ps:
	docker-compose ps

# Clean up Docker resources
clean:
	docker-compose down -v
	docker system prune -f

# Run tests
test:
	docker-compose run --rm comfyui-test npm test

# Generate an image
generate:
	docker-compose run --rm comfyui-test npm run generate -- "$(PROMPT)" "$(NEGATIVE)" "$(MODEL)"

# Shell into the test container
shell:
	docker-compose run --rm comfyui-test /bin/bash

# Check ComfyUI connection
check-comfyui:
	@echo "Checking ComfyUI connection..."
	@curl -s http://127.0.0.1:8188/ > /dev/null && echo "ComfyUI is running" || echo "ComfyUI is not running"

# Start the web UI
webui:
	docker-compose run --rm -p 3000:3000 -v $(PWD)/public/images:/app/public/images comfyui-test npm start

# Help command
help:
	@echo "Available commands:"
	@echo "  make build           - Build the Docker image"
	@echo "  make up             - Start the test service"
	@echo "  make down           - Stop the test service"
	@echo "  make logs           - View logs"
	@echo "  make ps             - List running containers"
	@echo "  make clean          - Clean up Docker resources"
	@echo "  make test           - Run tests"
	@echo "  make generate PROMPT=\"your prompt\" [NEGATIVE=\"negative prompt\"] [MODEL=\"model name\"] - Generate an image"
	@echo "  make shell          - Shell into the test container"
	@echo "  make check-comfyui  - Check if local ComfyUI is running"
	@echo "  make webui          - Start the web UI for image generation"
	@echo "  make help           - Show this help message"
