# Framework Comparison: OpenClaw vs. Hermes Agent

## Feature Overview

| Feature | OpenClaw | Hermes Agent |
|---------|----------|--------------|
| **Core Language** | TypeScript / Node.js | Python |
| **Primary Interface** | Chat Gateway (Discord, Slack, etc.) & Web Canvas | CLI / TUI & external integrations (Telegram, Discord) |
| **Specialty** | Personal Assistant with Canvas/UI control | Continuous Learning, memory, skill generation |
| **Container Base** | `node:24-bookworm` | `debian:13.4` (Python 3.11+ & Node) |
| **Docker Availability** | Official GHCR Image available (`ghcr.io/openclaw/openclaw`) | No official image (must build from source or use community) |
| **Data Volumes** | `/app/skills`, `/app/config`, `/app/docs` | `/opt/data` (skills, memories, logs, config) |

## Integration Strategy in agent-devkit

1. **OpenClaw**:
   - Extremely straight-forward due to the availability of an official image.
   - We will utilize `ghcr.io/openclaw/openclaw:latest`.
   - Update `docker-compose.yml` to map configuration and skills directories to the `/app` volume, and override the start command to bind the web server to `0.0.0.0` for network accessibility.

2. **Hermes Agent**:
   - Because no official image is readily available on registries, we need to create a custom `Dockerfile` in `agent-devkit/src/docker/hermes/Dockerfile`.
   - The build process will clone the `nousresearch/hermes-agent` repo (or use a source tarball) and install dependencies as shown in their upstream `Dockerfile`.
   - We will bind the `HERMES_HOME` to a local folder in the devkit.

## Verdict
Both frameworks are highly capable and take different approaches to agent development.
- **OpenClaw** is more aligned with web-based interactions and complex multi-channel gateways.
- **Hermes Agent** is strongly aligned with autonomous skill creation, terminal interaction, and heavy NLP tasks using Python.
