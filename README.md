<div align="center">
  <img src="https://raw.githubusercontent.com/ai-studio-labs/agent-devkit/main/assets/logo.png" alt="Agent-DevKit Logo" width="200" onerror="this.src='https://via.placeholder.com/200x200.png?text=Agent-DevKit'"/>
  
  # Agent-DevKit ⚡️

  **The Universal OS for AI Agents**

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![NPM Version](https://img.shields.io/npm/v/agent-devkit.svg)](https://www.npmjs.com/package/agent-devkit)
  [![Build Status](https://github.com/ai-studio-labs/agent-devkit/workflows/CI/badge.svg)](https://github.com/ai-studio-labs/agent-devkit/actions)
  [![Discord](https://img.shields.io/discord/1234567890?label=Discord&logo=discord&logoColor=white)](https://discord.gg/agent-devkit)
  
  <p align="center">
    <em>A secure, vendor-agnostic, production-ready environment for developing, orchestrating, and deploying AI agents safely.</em>
  </p>
</div>

---

## 🤯 The Problem

Building AI agents today is chaotic. You're forced to choose between rigid proprietary ecosystems or stitching together a dozen open-source tools. You worry about:
- **Security:** "What if the agent deletes my database or leaks my API keys?"
- **Vendor Lock-in:** "If I build on Framework X, can I switch to Framework Y later?"
- **Tool Sprawl:** "How do I make my Python-based agent talk to my Node.js-based tools?"
- **Deployment:** "It works on my laptop, but how do I get it to production?"

## 🦸‍♂️ The Solution: Agent-DevKit

Agent-DevKit is a **unified orchestration layer** built on top of secure Docker containers. It abstracts away the underlying frameworks (like OpenClaw or Hermes), normalizes the tool/skill APIs, and provides a 5-layer security sandbox.

Write your agent logic once. Run it anywhere. Swap providers instantly.

---

## ✨ Key Features

* 🛡️ **Safety-First Architecture:** 5 layers of security protection including network isolation, volume mounts, and strict resource limits.
* 🧩 **Vendor-Agnostic Plugins:** Swap between Claude, OpenAI, DeepSeek, or Local LLMs (Ollama) with a single command.
* 🤖 **Universal Skill Orchestration:** Discover, route, and execute skills dynamically across Local, OpenClaw, and Hermes frameworks.
* 🔗 **Skill Chaining:** Sequentially pipe the JSON output of one agent tool into the input of the next.
* 📦 **Containerized Dev Envs:** Seamlessly switch between isolated Docker projects.
* 🚀 **One-Click Deployment:** Deploy to Railway, AWS, or your own cloud infrastructure instantly.
* 💻 **CLI-First Design:** Powerful command-line interface for the terminal power-user.

---

## ⚡️ Quick Start

Get your secure agent environment running in under 2 minutes.

### 1. Install
```bash
npm install -g agent-devkit
```

### 2. Initialize
```bash
agent-devkit init --name my-awesome-agent --framework openclaw
```

### 3. Start & Play
```bash
cd my-awesome-agent
agent-devkit start
agent-devkit skills list
```

---

## 🧠 The Killer Feature: Universal Skill Orchestration

Agent-DevKit's true power lies in its ability to abstract tools ("Skills") across disparate environments.

Imagine you have a web-scraper built in OpenClaw (Node.js) and an NLP sentiment analyzer built in Hermes (Python). Agent-DevKit unifies them into a single, chainable interface.

```bash
# Discover all skills automatically across all running containers
$ agent-devkit skills list
🦞 OpenClaw Skills: openclaw.browser, openclaw.bash
⚕️ Hermes Skills: hermes.whatsapp_bridge, hermes.calendar
💻 Local Skills: local.weather, local.calculator

# Let AI route your natural language intent to the right skill
$ agent-devkit skills route "What's the weather like in San Francisco?" --execute
> Executing local.weather...
> Result: {"condition": "Sunny", "temp": "22°C"}

# Chain complex workflows effortlessly!
$ agent-devkit skills chain local.weather local.calculator -i '{"location": "San Francisco"}'
```

---

## 🏗 Architecture

```mermaid
graph TD
    CLI[Agent-DevKit CLI] --> Router[Skill Router / LLM]
    CLI --> Executor[Skill Executor]
    
    Router --> Discovery[Skill Discovery]
    Discovery --> Registry[(Skill Registry)]
    
    Executor --> |Docker API| OpenClaw[OpenClaw Container (Node.js)]
    Executor --> |Docker API| Hermes[Hermes Container (Python)]
    Executor --> |Local execution| Local[Local Skills (TS/JS)]
    
    OpenClaw --> Tools1[Browser, Bash]
    Hermes --> Tools2[WhatsApp, Calendar]
```
*(Rendered natively in supported markdown viewers)*

---

## 🔌 Supported AI Providers

We believe in choice. Agent-DevKit supports the leading AI models out of the box:

| Provider | Status | Best For |
|----------|--------|----------|
| **Anthropic (Claude)** | ✅ Ready | Complex reasoning & coding tasks |
| **OpenAI** | ✅ Ready | General purpose & large context windows |
| **DeepSeek** | ✅ Ready | Cost-effective scaling |
| **Ollama (Local)** | ✅ Ready | Privacy & offline development |
| **OpenRouter** | ✅ Ready | Accessing hundreds of open models |

---

## 📚 Documentation

Dive deeper into what makes Agent-DevKit the ultimate agent development environment:

- [Getting Started Guide](./docs/getting-started.md)
- [Architecture & Security Decisions](./docs/architecture.md)
- [Building Custom Skills](./docs/building-skills.md)
- [API Reference](./docs/api-reference.md)
- [Deployment Guide](./docs/deployment.md)

---

## 🤝 Contributing

We are building a community of developers who believe that AI agents should be secure, modular, and vendor-agnostic. We'd love your help!

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Read our full [Contributing Guidelines](./CONTRIBUTING.md).

---

## 💬 Community

- Join our [Discord Server](https://discord.gg/agent-devkit) to chat with fellow builders.
- Follow us on [Twitter/X](https://twitter.com/ai_studio_labs) for updates.
- Check out the [Discussions](https://github.com/ai-studio-labs/agent-devkit/discussions) tab for Q&A.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

<div align="center">
  <i>Built with ❤️ by the AI Studio Labs Team and our amazing contributors.</i>
</div>
