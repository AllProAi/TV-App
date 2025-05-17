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
   - Ensure your hosting service supports WebSocket connections
   - Set up proper security headers and CORS configuration
   - Consider using PM2 or similar process manager for reliability
   - Example AWS deployment:
     ```bash
     # Install PM2 globally
     npm install -g pm2
     
     # Build the backend
     cd backend
     pnpm run build
     
     # Start with PM2
     pm2 start dist/index.js --name memorystream-backend
     pm2 save
     ```

2. **TV App Deployment**:
   - Build the app with the correct backend URL:
     ```bash
     cd tv-app
     BACKEND_URL=https://your-backend-url pnpm run build
     ```
   - Deploy the contents of the `tv-app/dist` directory to a static web server or CDN
   - For Senza platform deployment, follow their specific deployment guidelines:
     1. Ensure the Senza SDK is properly integrated (already included in the build)
     2. Configure app metadata in `/tv-app/public/index.html` according to Senza requirements
     3. Register your application in the Senza Developer Portal if required
     4. Package your application according to Senza submission guidelines
     5. Submit your app package through the Senza Developer Portal
   - Configure proper caching headers for static assets:
     - Long cache time for versioned assets (JS/CSS with hashes)
     - Short cache time for HTML and configuration files
   - Example Nginx configuration:
     ```nginx
     server {
         listen 80;
         server_name tv.memorystream.example.com;
         
         root /path/to/tv-app/dist;
         index index.html;
         
         location / {
             try_files $uri $uri/ /index.html;
         }
         
         location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
             expires 30d;
             add_header Cache-Control "public, max-age=2592000";
         }
     }
     ```

### Senza Platform Specific Notes

For successful deployment to the Senza platform, ensure the following:

1. **SDK Integration**:
   - The Senza SDK is included in the package.json dependencies
   - The app properly initializes the SDK at startup:
     ```javascript
     import * as senza from 'senza-sdk';
     
     // Initialize Senza platform
     await senza.init();
     senza.uiReady();
     ```
   - Video element has the required attribute: `data-senza-media-element="true"`

2. **Metadata Configuration**:
   - The HTML includes required meta tags:
     ```html
     <meta name="application-name" content="MemoryStream">
     <meta name="application-version" content="0.1.0">
     <meta name="senza-app-type" content="streaming">
     ```
   - App container has the required attribute: `data-senza-app="MemoryStream"`

3. **Submission Package**:
   - Create a ZIP file containing the contents of the `tv-app/dist` directory
   - Include a manifest.json file with application metadata if required by Senza
   - Ensure all assets are included in the package
   - Test the application thoroughly in the Senza emulator before submission

4. **Platform Features Utilization**:
   - The VideoPlayer component is designed to use Senza player when available
   - Fallback to Shaka player when running outside the Senza environment
   - All media controls properly integrate with both Senza and standard players

3. **Mobile App Deployment**:
   - Build the app with the correct backend URL:
     ```bash
     cd mobile-app
     BACKEND_URL=https://your-backend-url pnpm run build
     ```
   - Deploy the contents of the `mobile-app/dist` directory to a static web server or CDN
   - Configure your server to support HTTPS (required for PWA and WebRTC features)
   - Set appropriate cache headers for service worker support
   - Example deployment to Firebase Hosting:
     ```bash
     # Install Firebase CLI if not already installed
     npm install -g firebase-tools
     
     # Login to Firebase
     firebase login
     
     # Initialize Firebase in the project
     cd mobile-app
     firebase init hosting
     
     # Deploy to Firebase
     firebase deploy --only hosting
     ```
   - Configure `firebase.json` for PWA support:
     ```json
     {
       "hosting": {
         "public": "dist",
         "ignore": [
           "firebase.json",
           "**/.*",
           "**/node_modules/**"
         ],
         "rewrites": [
           {
             "source": "**",
             "destination": "/index.html"
           }
         ],
         "headers": [
           {
             "source": "/service-worker.js",
             "headers": [
               {
                 "key": "Cache-Control",
                 "value": "no-cache"
               }
             ]
           },
           {
             "source": "**/*.@(js|css)",
             "headers": [
               {
                 "key": "Cache-Control",
                 "value": "max-age=31536000"
               }
             ]
           }
         ]
       }
     }
     ```

4. **Monitoring and Scaling**:
   - Set up monitoring for backend server health and performance
   - Configure alerts for API quota limits and errors
   - For high traffic scenarios, consider:
     - Horizontal scaling of backend servers with load balancing
     - Redis for session state sharing between instances
     - CDN caching for static assets
     - Rate limiting for API endpoints
     - WebSocket connection pooling

## Production Performance Considerations

When deploying MemoryStream to production environments, consider these performance optimizations:

### Backend Optimizations
1. **API Cost Management**:
   - Implement intelligent batching for Whisper API requests
   - Cache common AI responses for similar queries
   - Use a lower-cost model for initial processing, escalating to GPT-4 only when needed
   - Set up usage monitoring and alerting for OpenAI API costs

2. **Memory Management**:
   - Implement session cleanup for inactive sessions
   - Use a database like MongoDB for subtitle storage instead of in-memory
   - Stream large audio/video files instead of loading entire files in memory
   - Configure Node.js with appropriate memory limits for your hosting environment

3. **WebSocket Efficiency**:
   - Implement heartbeats to maintain connection stability
   - Add automatic reconnection with exponential backoff
   - Consider Socket.io adapter for Redis in multi-instance deployments
   - Optimize message payload sizes

### TV App Optimizations
1. **Video Playback**:
   - Optimize adaptive bitrate streaming settings
   - Implement proper buffer management
   - Consider using requestIdleCallback for non-critical operations
   - Optimize subtitle rendering for low-powered devices

2. **Resource Loading**:
   - Implement lazy loading for components
   - Use code splitting to reduce initial bundle size
   - Optimize asset loading order (critical CSS inline)
   - Implement proper caching strategies

### Mobile App Optimizations
1. **PWA Performance**:
   - Optimize service worker caching strategies
   - Preload critical resources
   - Minimize JavaScript bundle size
   - Implement performance monitoring with Web Vitals

2. **Battery Efficiency**:
   - Reduce microphone polling frequency when inactive
   - Optimize WebSocket connection management
   - Implement power-aware features (reduce animations on low battery)
   - Use passive event listeners where appropriate

3. **Data Usage**:
   - Compress WebSocket communications
   - Implement offline capabilities for frequently used features
   - Cache responses when appropriate
   - Add data usage settings for users on limited data plans

### Testing Under Load
Before full production release, perform load testing focusing on:
- Concurrent WebSocket connections (aim for 1000+ simultaneous users)
- Backend request handling under heavy load
- AI service throughput and response times
- Memory usage patterns during extended operation

Use tools like Artillery.io, k6, or custom Socket.io testing scripts to simulate real-world usage patterns.

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