<!-- Generated by SpecStory -->

# System Architecture and Framework Handoff (2025-05-17 00:39:36)

_**User**_

@system-architecture.md @ADR-001-javascript-framework.md @1-Handoff.md 

---

_**Assistant**_



---

Based on the documents, I understand that MemoryStream is an AI-powered TV application with three main components:

1. **TV App**: Vanilla JavaScript application using ShakaPlayer for the Senza platform
   - Focus-based navigation for remote control
   - Real-time subtitle display
   - AI response integration

2. **Mobile Companion App**: Progressive Web App with:
   - QR code pairing with TV
   - Remote control functionality
   - Voice command recording
   - Chat interface for content questions

3. **Backend Server**: Node.js with Socket.io
   - WebSocket communication with namespaces
   - OpenAI integration (Whisper for subtitles, GPT for Q&A)
   - Session management for TV-mobile pairing

The architecture deliberately uses vanilla JavaScript instead of frameworks for performance optimization on TV platforms, with Socket.io for real-time communication between components.

What specific aspect of the architecture would you like me to help with?

---

