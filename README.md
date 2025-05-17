# MemoryStream - AI-Enhanced TV Experience

MemoryStream is an innovative AI-powered TV application built for the Synamedia Senza platform that transforms passive viewing into an interactive, intelligent experience. The app creates real-time subtitles using Whisper AI, enables natural language voice control via mobile companion, and provides contextual Q&A about content using timestamped dialogue search.

## Project Structure

The project consists of three main components:

```
memorystream/
├── backend/           # Node.js backend server
│   ├── src/           # Server source code
│   └── package.json   # Backend dependencies
├── tv-app/            # Senza TV application
│   ├── src/           # TV app source code
│   ├── public/        # Static assets
│   └── package.json   # TV app dependencies
└── mobile-app/        # Mobile companion app (PWA)
    ├── src/           # Mobile app source code
    ├── public/        # Static assets
    └── package.json   # Mobile app dependencies
```

## Features

- **Real-time Subtitles**: Automatically generates subtitles for any content using Whisper AI
- **Voice Control**: Natural language voice commands via mobile companion app
- **Content Q&A**: Ask questions about what's happening on screen and get contextual answers
- **TV-Mobile Pairing**: Simple QR code pairing between TV and mobile devices
- **Remote Control**: Use your phone as a remote control with d-pad and media buttons
- **Timestamp Search**: Find and jump to specific moments by searching dialogue

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- pnpm package manager
- Senza platform access (for TV app deployment)
- OpenAI API key (for AI features)

### Environment Setup

Create a `.env` file in the backend directory:

```
PORT=3000
OPENAI_API_KEY=your_openai_api_key
MOBILE_APP_URL=http://localhost:8081
```

### Installation

1. Install dependencies for all components:

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

### Development

To run the components in development mode:

```bash
# Run backend server
cd backend
pnpm run dev

# Run TV app (in a new terminal)
cd tv-app
pnpm run start

# Run mobile app (in a new terminal)
cd mobile-app
pnpm run start
```

The applications will be available at:
- TV App: [http://localhost:8080](http://localhost:8080)
- Mobile App: [http://localhost:8081](http://localhost:8081)
- Backend: [http://localhost:3000](http://localhost:3000)

### Building for Production

```bash
# Build backend
cd backend
pnpm run build

# Build TV app
cd ../tv-app
pnpm run build

# Build mobile app
cd ../mobile-app
pnpm run build
```

The built files will be available in the `dist` directories of each component.

## Usage

1. **TV App Setup**:
   - Launch the TV app in a browser or on the Senza platform
   - A session will be created and a QR code displayed

2. **Mobile Companion Setup**:
   - Open the mobile app in a browser or install the PWA
   - Scan the QR code displayed on the TV
   - Your devices are now paired

3. **Using Remote Control**:
   - Use the d-pad to navigate TV interface
   - Media controls for play/pause, rewind, forward
   - Volume controls for audio adjustment

4. **Voice Commands**:
   - Tab to the Voice section in the mobile app
   - Tap the microphone icon and speak your command
   - Examples: "Play", "Pause", "Jump forward 30 seconds"

5. **Content Q&A**:
   - Tab to the Chat section in the mobile app
   - Type questions about the content you're watching
   - The AI will respond with context-aware answers

## Architecture

### Backend

- Node.js with Express
- Socket.io for real-time communication
- OpenAI API integration for Whisper and GPT

### TV App

- Vanilla JavaScript
- Senza SDK integration
- ShakaPlayer for video playback

### Mobile App

- Progressive Web App (PWA)
- WebRTC for voice capture
- Socket.io for communication with backend

## Development Rules

The project follows a set of development rules defined in the `.cursor/rules/` directory:

- `architect.mdc`: System-wide architecture guidelines
- `tv-service.mdc`: TV application specific rules
- `mobile-service.mdc`: Mobile companion app rules
- `backend-service.mdc`: Backend service rules

## License

Proprietary - Daniel Hill AllPro.Enterprises Novus | Nexum Labs CR 2025

## Contributing

This project was developed as part of the Senza Hackathon and is not open for public contributions at this time. 