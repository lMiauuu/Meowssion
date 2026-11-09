# Meowssion

> **Discord Quests Automation & Orbs Rewards Management Plugin for BetterDiscord.**  
> Automate quests, track your Orbs in real time, and simulate 3-day Nitro Credit redemptions safely.

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Version: 1.1.0](https://img.shields.io/badge/Version-1.1.0-brightgreen.svg)](Meowssion.plugin.js)
[![Author: Miau](https://img.shields.io/badge/Author-Miau-purple.svg)](https://github.com/lMiauuu)

Created by **Miau** ([@lMiauuu](https://github.com/lMiauuu)).

---

## Table of Contents / Sumário
- [English Documentation](#english-documentation)
  - [Overview & Objectives](#overview--objectives)
  - [Key Features (v1.1.0)](#key-features-v110)
  - [Anti-Ban & Security Model](#anti-ban--security-model)
  - [Installation](#installation)
- [Documentação em Português](#documentação-em-português)
  - [Visão Geral](#visão-geral)
  - [Novidades e Recursos (v1.1.0)](#novidades-e-recursos-v110)
  - [Segurança & Proteção Anti-Ban](#segurança--proteção-anti-ban)
  - [Instalação](#instalação)
- [License & Credits / Licença e Créditos](#license--credits--licença-e-créditos)

---

## English Documentation

### Overview & Objectives
**Meowssion** is a lightweight, high-performance BetterDiscord plugin designed to manage and complete Discord Quests automatically in the background, monitor accumulated Orbs rewards, and simulate Nitro Credit redemptions without tedious manual effort.

### Key Features (v1.1.0)
- **All Quest Types Supported:** Automates video-watching, desktop gaming spoofing, desktop stream quests, and voice channel activities.
- **Batch & Individual Execution:** Select specific quests or start all pending automatable quests with a single click.
- **Background Auto-Quest Mode:** Periodically scans for newly dropped quests and executes them quietly in the background without user intervention.
- **Real-Time Orbs Tracker (New in v1.1.0):**
  - **Earned Orbs (Conquistados):** Live total of Orbs earned from completed quests.
  - **Pending Orbs (Disponíveis):** Projected Orbs available to be claimed across all active pending quests.
- **Nitro Credit • Orbs Shop Tab (New in v1.1.0):**
  - Interactive simulator for the official **3-Day Nitro Credit** item (`1,400` Orbs each).
  - Quantity controls (`-`, `+`, direct numeric input, and `MAX` shortcut).
  - Instant calculation of total stacked days (`+{qty * 3} days of Nitro`), total Orbs cost, remaining balance, and pending quests coverage.
  - **Wallet Synchronization:** Allows manual adjustment or synchronization with your actual Discord wallet ledger.
- **Sleek Multi-Theme Interface:** Includes 4 visual themes (`Midnight`, `Dark`, `Glass`, and `Discord`) with instant language switching (`EN` / `PT`).

### Anti-Ban & Security Model
Meowssion is built with account safety as the #1 priority:
- Quests are progressed through sanctioned internal store dispatches and heartbeat events.
- **No Automated Purchase Loops:** Discord strictly requires interactive human challenge validation (hCaptcha/Arkose) on billing/shop checkout endpoints. Meowssion does **not** perform automated POST request loops against shop checkout endpoints, completely preventing account flags or bans.
- **Safe Guided Navigation:** The *"Open Discord Orbs Shop"* action closes the modal, smoothly navigates via Discord's internal router to the official `/shop` or `/quest-home` page, and guides the user to complete redemption manually and securely.

### Installation
1. Download [`Meowssion.plugin.js`](Meowssion.plugin.js).
2. Move the file into your BetterDiscord plugins folder:
   - **Windows:** `%appdata%\BetterDiscord\plugins`
   - *Or open Discord Settings > BetterDiscord > Plugins > Open Plugins Folder.*
3. Enable **Meowssion** in the plugins list.
4. Click the cat icon in Discord's top title bar to open the manager.

---

## Documentação em Português

### Visão Geral
O **Meowssion** é um plugin para BetterDiscord focado em automatizar e gerenciar Missões do Discord em segundo plano, monitorar orbes conquistados e simular resgates de Crédito Nitro com máxima segurança.

### Novidades e Recursos (v1.1.0)
- **Compatibilidade Total:** Executa missões de vídeo, jogos de desktop simulados, transmissões em chamadas e atividades.
- **Execução em Lote ou Individual:** Selecione missões específicas ou conclua todas as pendentes com um clique.
- **Modo Auto-Missão:** Monitoramento periódico em segundo plano que detecta e executa automaticamente novas missões disponíveis.
- **Contadores de Orbs em Tempo Real (Novidade v1.1.0):**
  - **Orbs Conquistados:** Total acumulado de orbes obtidos em missões concluídas.
  - **Orbs Disponíveis:** Soma de orbes que podem ser obtidos nas missões ativas pendentes.
- **Nova Aba: Crédito Nitro • Orbs (Novidade v1.1.0):**
  - Card exclusivo para resgate de **Crédito Nitro de 3 dias** (`1.400` Orbs cada).
  - Seletor de quantidade (`-`, `+`, digitação direta e botão `MAX`).
  - Painel com cálculo em tempo real: dias acumulados (`+{qty * 3} dias de Nitro`), custo total, saldo restante e cálculo de missões pendentes necessárias para cobrir o valor em caso de saldo insuficiente.
  - **Sincronização de Saldo:** Permite sincronizar manualmente o saldo com sua carteira real ou registrar resgates locais (`-{qty * 1400} Orbs`).
- **Interface Moderna:** 4 temas visuais (`Midnight`, `Dark`, `Glass` e `Discord`) e alternância imediata de idioma (`PT-BR` / `EN-US`).

### Segurança & Proteção Anti-Ban
A segurança da sua conta é prioridade absoluta no Meowssion:
- A progressão de missões utiliza despachos e canais das stores internas do próprio cliente Discord.
- **Sem Loops Automatizados de Compra:** O Discord exige validação humana interativa (hCaptcha) no checkout da loja de orbes. O Meowssion **não** tenta contornar nem enviar requisições POST automatizadas para compra, evitando flags ou banimentos da conta.
- **Redirecionamento Guiado Seguro:** O botão de resgate fecha o modal e utiliza o roteador nativo do Discord para levar você diretamente à aba oficial (`/shop` ou `/quest-home`), acompanhado de um aviso orientador para resgate manual seguro.

### Instalação
1. Baixe o arquivo [`Meowssion.plugin.js`](Meowssion.plugin.js).
2. Mova o arquivo para a pasta de plugins do BetterDiscord:
   - **Windows:** `%appdata%\BetterDiscord\plugins`
   - *Ou abra Configurações do Discord > BetterDiscord > Plugins > Abrir Pasta de Plugins.*
3. Ative o **Meowssion** na lista de plugins.
4. Clique no ícone de gato na barra de ferramentas superior do Discord para abrir o painel.

---

## License & Credits / Licença e Créditos

### License / Licença
This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.  
See the [`LICENSE`](LICENSE) file for the full license text.

Este projeto é distribuído sob a licença **GNU General Public License v3.0 (GPL-3.0)**.  
Consulte o arquivo [`LICENSE`](LICENSE) para o texto integral da licença.

---

### Authorship & Acknowledgements / Autoria e Agradecimentos

- **Miau ([@lMiauuu](https://github.com/lMiauuu)):**  
  Architecture, UI/UX design, visual themes, internationalization (i18n), Orbs management, and Nitro Credit simulator.  
  *Arquitetura, design de UI/UX, temas visuais, internacionalização (i18n), sistema de Orbs e simulador de Crédito Nitro.*

- **@aamiaa ([CompleteDiscordQuest Gist](https://gist.github.com/aamiaa/204cd9d42013ded9faf646fae7f89fbb)):**  
  Reference implementation for Discord Quests internal store spoofing logic under GPL-3.0.  
  *Referência técnica para a lógica de spoofing de stores internas de missões do Discord sob licença GPL-3.0.*
