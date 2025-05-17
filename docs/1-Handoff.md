# MemoryStream Project Handoff Document

## Project Overview
MemoryStream is an AI-powered TV application built for the Synamedia Senza platform that transforms passive viewing into an interactive, intelligent experience. The app provides real-time subtitles using Whisper AI, enables natural language voice control via mobile companion, and offers contextual Q&A about content using timestamped dialogue search.

## Architecture
The project follows a three-component architecture:

1. **TV App**: Vanilla JavaScript application for the Senza platform
   - Video playback using ShakaPlayer
   - Subtitle display and management
   - Focus-based navigation for remote control
   - AI response display

2. **Mobile Companion App**: Progressive Web App (PWA)
   - QR code pairing with TV
   - Remote control functionality
   - Voice command recording and processing
   - Text chat interface for content questions

3. **Backend Server**: Node.js with Express
   - WebSocket communication using Socket.io
   - Session management for TV-mobile pairing
   - AI service integration (OpenAI Whisper and GPT)
   - Real-time subtitle generation and content Q&A

## Current Implementation Status

### Completed Components
- Basic project structure with three main components
- Package.json files and build systems (Webpack) for all components
- WebSocket server with namespaces for different communication channels
- Session management system with QR code pairing
- TV app UI with video player integration
- Mobile app UI with remote control and voice interfaces
- Navigation system for TV remote control
- Connection management between TV and mobile devices

### In Progress
- OpenAI integration for subtitle generation
- Content Q&A functionality
- Voice command processing
- Timestamp-based content search

### Key Files

#### Backend
- `backend/src/index.js`: Main server implementation with WebSocket namespaces
- `backend/src/services/whisperService.js`: OpenAI Whisper integration
- `backend/src/services/gptService.js`: OpenAI GPT integration
- `backend/src/services/sessionService.js`: Session management

#### TV App
- `tv-app/src/index.js`: Main TV app implementation
- `tv-app/src/components/VideoPlayer.js`: ShakaPlayer integration
- `tv-app/src/components/SubtitleManager.js`: Subtitle display and management
- `tv-app/src/components/RemoteNavigation.js`: Focus-based navigation
- `tv-app/src/components/ConnectionManager.js`: WebSocket connection management
- `tv-app/src/components/AIAssistant.js`: AI response display

#### Mobile App
- `mobile-app/src/index.js`: Main mobile app implementation
- `mobile-app/src/components/QRCodeScanner.js`: QR code scanning for pairing
- `mobile-app/src/components/RemoteControl.js`: Remote control interface
- `mobile-app/src/components/VoiceRecorder.js`: Voice recording and processing
- `mobile-app/src/components/ChatInterface.js`: Text chat interface
- `mobile-app/src/components/ConnectionManager.js`: WebSocket connection management

## Technical Decisions & Rationale

1. **Vanilla JavaScript over Frameworks**:
   - Chosen for performance optimization on TV platforms
   - Reduces bundle size and improves startup time
   - Simplifies integration with Senza platform

2. **Socket.io with Namespaces**:
   - Separates communication concerns (TV, mobile, subtitle, voice)
   - Enables targeted event broadcasting
   - Simplifies server-side handling of different client types

3. **In-Memory Session Storage** (for demo):
   - Simple implementation for prototype
   - Can be replaced with Redis or other database for production
   - Stores session metadata, subtitle history, and connection status

4. **QR Code Pairing**:
   - Simplifies connection process between TV and mobile
   - Eliminates need for manual code entry
   - Improves user experience with quick setup

5. **Spatial Navigation**:
   - Custom focus-based navigation for remote control
   - Handles directional input (up, down, left, right)
   - Improves TV interface usability with remote

## Development Environment

### Prerequisites
- Node.js 18.x or higher
- pnpm package manager
- OpenAI API key (for AI features)

### Setup Instructions
1. Clone the repository
2. Create a `.env` file in the backend directory:
   ```
   PORT=3000
   OPENAI_API_KEY=your_openai_api_key
   MOBILE_APP_URL=http://localhost:8081
   ```
3. Install dependencies:
   ```bash
   # Install backend dependencies
   cd backend
   pnpm install

   # Install TV app dependencies
   cd ../tv-app
   pnpm install

   # Install mobile app dependencies
   cd ../mobile-app
   pnpm install
   ```
4. Run development servers:
   ```bash
   # Run backend server
   cd backend
   pnpm run dev

   # Run TV app (in a new terminal)
   cd ../tv-app
   pnpm run start

   # Run mobile app (in a new terminal)
   cd ../mobile-app
   pnpm run start
   ```

## Future Work & Recommendations

### Priority Tasks
1. **Complete OpenAI Integration**:
   - Implement Whisper API for real-time subtitle generation
   - Connect GPT for contextual content Q&A
   - Add caching mechanism for API responses

2. **Enhance Error Handling**:
   - Implement circuit breakers for API calls
   - Add graceful degradation for disconnections
   - Improve error messaging for users

3. **Add Timestamp Search**:
   - Implement subtitle indexing for search
   - Create UI for jumping to specific moments
   - Add relevance scoring for search results

4. **Performance Optimization**:
   - Reduce bundle sizes with code splitting
   - Optimize WebSocket payload sizes
   - Improve UI responsiveness on low-end devices

5. **Testing Suite**:
   - Add unit tests for core components
   - Implement integration tests for TV-mobile communication
   - Add end-to-end tests for critical user flows

### Architectural Improvements
1. **Persistent Storage**: Replace in-memory session storage with Redis or MongoDB for production
2. **Authentication**: Add user authentication for personalized experiences
3. **Caching Layer**: Implement caching for OpenAI responses to reduce API costs
4. **Metrics Collection**: Add telemetry for performance monitoring

## Known Issues
1. Subtitle synchronization may drift on longer videos
2. Voice recording needs permission handling improvements on iOS
3. Remote navigation can be improved for complex layouts
4. Session management needs expiration handling

## Contact Information
For questions about the project, please contact:
- Daniel Hill, AllPro.Enterprises Novus | Nexum Labs
- Project Manager: [Contact information]
- Lead Developer: [Contact information]

## License
Proprietary - Daniel Hill AllPro.Enterprises Novus | Nexum Labs CR 2025 ALL RIGHTS RESERVED 