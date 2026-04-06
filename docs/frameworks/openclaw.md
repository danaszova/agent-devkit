# OpenClaw — Personal AI Assistant

**Repository**: [https://github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)

## Overview
OpenClaw is a personal AI assistant that you run on your own devices. It supports multiple chat channels (WhatsApp, Telegram, Slack, Discord, Microsoft Teams, etc.) and offers features like live Canvas manipulation. It acts as an autonomous agent connecting via various API providers.

## Technical Requirements
- **Language/Runtime**: Node.js 24 (recommended via pnpm/bun)
- **Primary Process**: Gateway server

## Docker Support
OpenClaw has excellent Docker support. 
- **Official Image**: `ghcr.io/openclaw/openclaw:latest` (or versioned tags)
- **Dockerfile**: Uses a multi-stage build starting from `node:24-bookworm` or `node:24-bookworm-slim`.
- **User**: Runs as a non-root `node` user for better security.
- **Port**: The gateway server runs on port `18789` by default. Note: For Docker bridge networking, you must override the bind address to `0.0.0.0` or `lan` (as it binds to loopback by default).
- **Health Check**: Native health check endpoint at `/healthz` or `/readyz`.

## Configuration
It typically uses standard provider environment variables (e.g., `OPENAI_API_KEY`) and specific OpenClaw configs.
- Volumes needed: Typically `/app/skills`, `/app/config`, `/app/docs`.

## Integration into agent-devkit
We will use the official GHCR image `ghcr.io/openclaw/openclaw:latest` instead of a custom build, overriding the entrypoint/cmd to bind to `0.0.0.0` so it can communicate on the `agent-devkit` network.
