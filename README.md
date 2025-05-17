# MemoryStream - AI-Enhanced TV Experience

MemoryStream is an innovative AI-powered TV application built for the Synamedia Senza platform that transforms passive viewing into an interactive, intelligent experience. The app creates real-time subtitles using Whisper AI, enables natural language voice control via mobile companion, and provides contextual Q&A about content using timestamped dialogue search.

## Project Structure

The project consists of three main components:

```
memorystream/
├── backend/           # Node.js backend server
│   ├── src/           # Server source code
│   │   ├── index.js   # Main server file
│   │   └── services/  # Services for AI, session management, etc.
│   └── package.json   # Backend dependencies
├── tv-app/            # Senza TV application
│   ├── src/           # TV app source code
│   │   ├── index.js   # Entry point
│   │   └── components/# UI Components
│   ├── public/        # Static assets
│   └── package.json   # TV app dependencies
└── mobile-app/        # Mobile companion app (PWA)
    ├── src/           # Mobile app source code
    │   ├── index.js   # Entry point
    │   └── components/# UI Components
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
- pnpm package manager (`npm install -g pnpm`)
- OpenAI API key (for AI features)
- Modern web browser (Chrome/Edge recommended for best compatibility)

### Environment Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/memorystream.git
   cd memorystream
   ```

2. Create a `.env` file in the backend directory:

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
   - The app will connect to the backend and create a session
   - A QR code will be displayed for mobile pairing
   - You can select a video from the provided samples or enter a custom URL

2. **Mobile Companion Setup**:
   - Open the mobile app in a browser or install the PWA
   - Scan the QR code displayed on the TV using your phone's camera
   - Your devices are now paired and ready to communicate

3. **Using Remote Control**:
   - The Remote tab provides a D-pad for navigating the TV interface
   - Media controls allow play/pause, rewind, and fast forward
   - Volume controls adjust audio level or mute the sound
   - Additional buttons provide functions like back, home, and settings

4. **Voice Commands**:
   - Navigate to the Voice tab in the mobile app
   - Press and hold the microphone button while speaking your command
   - Release the button to process the command
   - Examples: 
     - "Play the video"
     - "Pause"
     - "Skip forward 30 seconds"
     - "Volume up"
     - "Turn on subtitles"

5. **Content Q&A**:
   - Go to the Chat tab in the mobile app
   - Type questions about what you're watching
   - The AI will analyze the content and provide relevant answers
   - You can tap on timestamps in the responses to jump to specific moments
   - Example questions:
     - "Who is that character?"
     - "What just happened?"
     - "Why did they do that?"
     - "Explain the plot so far"

## Technical Implementation

### Backend Architecture

- **Node.js with Express**: Provides the API endpoints and manages WebSocket connections
- **Socket.io**: Enables real-time bidirectional communication between the TV app, mobile app, and server
- **OpenAI Integration**:
  - Whisper API for real-time speech-to-text and subtitle generation
  - GPT-4 for natural language understanding and content question answering
- **Session Management**: Tracks connections between TV and mobile devices

### TV App Implementation

- **Vanilla JavaScript**: Lightweight implementation for optimal performance on TV platforms
- **ShakaPlayer**: Advanced media player for streaming video content
- **Component Architecture**: Modular design with specialized components:
  - `VideoPlayer`: Handles video playback and media controls
  - `SubtitleManager`: Processes and displays real-time subtitles
  - `RemoteNavigation`: Manages focus-based navigation for remote control
  - `ConnectionManager`: Handles WebSocket connections with backend
  - `AIAssistant`: Displays AI responses and content information

### Mobile App Implementation

- **Progressive Web App**: Cross-platform compatibility with native-like features
- **Responsive Design**: Works seamlessly on various mobile devices and orientations
- **WebRTC**: Captures voice input for command processing
- **Socket.io Client**: Communicates with the backend in real-time
- **Component Architecture**:
  - `QRCodeScanner`: Scans TV pairing code
  - `RemoteControl`: D-pad and media button interface
  - `VoiceRecorder`: Voice command recording and processing
  - `ChatInterface`: Text-based interaction with AI
  - `ConnectionManager`: Robust WebSocket connection handling with auto-reconnect

## Deploying to Production

For a production deployment, follow these steps:

1. **Backend Deployment**:
   - Deploy to a Node.js hosting environment (AWS, Heroku, DigitalOcean, etc.)
   - Set environment variables for `PORT`, `NODE_ENV=production`, and `OPENAI_API_KEY`
   - Configure a production database for session storage (optional)

2. **TV App Deployment**:
   - Build the app with the correct backend URL: `BACKEND_URL=https://your-backend-url pnpm run build`
   - Deploy the contents of the `tv-app/dist` directory to a static web server or CDN
   - For Senza platform deployment, follow their specific deployment guidelines

3. **Mobile App Deployment**:
   - Build the app with the correct backend URL: `BACKEND_URL=https://your-backend-url pnpm run build`
   - Deploy the contents of the `mobile-app/dist` directory to a static web server or CDN
   - Configure your server to support HTTPS (required for PWA and WebRTC features)
   - Set appropriate cache headers for service worker support

## Development Rules

The project follows a set of development rules defined in the `.cursor/rules/` directory:

- `architect.mdc`: System-wide architecture guidelines
- `tv-service.mdc`: TV application specific rules
- `mobile-service.mdc`: Mobile companion app rules
- `backend-service.mdc`: Backend service rules

## Troubleshooting

- **Connection Issues**: Ensure the backend server is running and accessible from both the TV and mobile app
- **QR Code Scanning**: Ensure good lighting and a clear view of the QR code
- **Voice Commands**: Check microphone permissions in your browser settings
- **Subtitle Generation**: Verify your OpenAI API key has sufficient credits and permissions

## License

Proprietary - Daniel Hill AllPro.Enterprises Novus | Nexum Labs CR 2025 ALL RIGHTS RESERVED

## Contact

For questions about the project, please contact:
- Daniel Hill, AllPro.Enterprises Novus | Nexum Labs 