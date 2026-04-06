# Hermes Agent

**Repository**: [https://github.com/nousresearch/hermes-agent](https://github.com/nousresearch/hermes-agent)

## Overview
Hermes Agent is a self-improving AI agent built by Nous Research. It features a built-in learning loop where it creates skills from experience, improves them during use, searches its own past conversations, and builds a deepening model of the user. It supports multiple LLM providers (Nous Portal, OpenRouter, OpenAI, etc.).

## Technical Requirements
- **Language/Runtime**: Python 3.11+, Debian 13.4
- **Dependencies**: Node.js and npm (used for Playwright and WhatsApp bridge functionality)
- **Primary Process**: Python CLI via `hermes` command.

## Docker Support
Hermes Agent provides a Dockerfile but there is no widely published official image available on Docker Hub or GHCR under the core name.
- **Dockerfile**: Based on `debian:13.4`, installs Python3, pip, nodejs, npm, playwright, and ffmpeg. 
- **User**: Runs as root by default in the provided Dockerfile.
- **Entrypoint**: Runs `/opt/hermes/docker/entrypoint.sh` which executes `hermes "$@"`.
- **Volumes**: Data is expected to be mounted at `/opt/data` (`HERMES_HOME`).

## Configuration
- Environment configurations are loaded from `.env` and `config.yaml` located in `HERMES_HOME`.
- Skills, memories, and logs are persisted in `/opt/data`.

## Integration into agent-devkit
Since there is no verified public image on GHCR, we will need to create a Dockerfile that builds from the repository source (or provides an environment compatible with it) and manage the configuration. We will map local folders to `/opt/data` to ensure skill and memory persistence.
