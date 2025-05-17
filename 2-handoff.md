# MemoryStream Project Handoff

## Project Overview

MemoryStream is an AI-powered TV application built for the Senza platform that transforms passive viewing into an interactive, intelligent experience. The system consists of three main components:

1. **Backend Server**: Node.js/Express with Socket.io for real-time communication
2. **TV App**: Vanilla JavaScript application with ShakaPlayer for video playback
3. **Mobile Companion App**: Progressive Web App (PWA) for remote control, voice commands, and content Q&A

## Current Implementation Status

All three components have been implemented with core functionality working:

### Backend
- Express server with Socket.io namespaces for different connection types
- OpenAI integration for Whisper (transcription) and GPT (content Q&A)
- Session management for TV-mobile pairing
- Real-time subtitle processing pipeline
- Command processing for voice and remote control

### TV App
- Video playback with ShakaPlayer
- Real-time subtitle display
- QR code generation for mobile pairing
- WebSocket connection to backend
- Navigation system for remote control

### Mobile App
- Progressive Web App with offline capabilities
- QR code scanning for TV pairing
- Remote control interface with D-pad and media controls
- Voice command recording and processing
- Chat interface for content Q&A
- Robust connection management with reconnection logic

## Key Components and Their Functionality

### Backend Services
- **whisperService.js**: Handles audio transcription for subtitles and voice commands
- **gptService.js**: Processes natural language queries about content
- **sessionService.js**: Manages sessions, connections, and device pairing
- **index.js**: Main server with Socket.io namespaces and API routes

### Mobile App Components
- **RemoteControl**: D-pad and media button UI for TV navigation
- **VoiceRecorder**: Voice command recording and processing
- **ChatInterface**: Content-aware Q&A interface
- **ConnectionManager**: WebSocket connection with robust reconnection
- **QRCodeScanner**: Pairing with TV via QR code

## Architecture

The system uses a WebSocket-based architecture for real-time communication:

1. **Socket.io Namespaces**:
   - `/tv`: TV app connections
   - `/mobile`: Mobile companion app connections
   - `/subtitle`: Subtitle streaming
   - `/voice`: Voice command processing
   - `/ai`: AI query and response handling

2. **Data Flow**:
   - Video audio → Backend → Whisper AI → Subtitles → TV display
   - Mobile voice → Backend → Whisper + GPT → Command → TV action
   - Mobile queries → Backend → GPT (with subtitle context) → Response

## Environment Setup

The project uses pnpm as package manager and includes helper scripts:

- **dev.js**: Starts all components in development mode
- **build.js**: Builds all components for production

Environment variables needed in backend `.env`:
```
PORT=3000
OPENAI_API_KEY=your_openai_api_key
MOBILE_APP_URL=http://localhost:8081
```

## Known Limitations

1. **Subtitle Processing Delay**: There's a 2-3 second delay in subtitle generation
2. **Voice Command Accuracy**: Noisy environments affect command recognition
3. **Content Context Window**: Limited to recent subtitles (~1000) for memory reasons
4. **Mobile Reconnection**: May require manual reconnection after long disconnections

## Next Steps

### Immediate Improvements
1. **Subtitle Optimization**: Implement batched processing for more efficient API usage
2. **Voice Command Enhancements**: Add local wake word detection before sending to server
3. **Content Understanding**: Improve relevance scoring for subtitle context selection
4. **User Profiles**: Add user profiles for personalized experiences

### Future Features
1. **Multi-Language Support**: Add translation for subtitles and responses
2. **Content Recognition**: Implement automatic show/movie recognition
3. **Scene Analysis**: Add visual content understanding via image recognition
4. **Social Features**: Enable shared viewing with synchronized playback
5. **Accessibility Enhancements**: Add more features for users with disabilities

## Testing

The project currently lacks comprehensive test coverage. Priorities for testing:

1. Unit tests for backend services (whisperService, gptService)
2. Integration tests for Socket.io communication
3. End-to-end tests for pairing and command execution
4. Mobile app offline functionality tests

## Deployment Considerations

For production deployment:

1. **Backend**: Deploy to a Node.js hosting service with WebSocket support
2. **TV App**: Deploy to CDN or Senza platform
3. **Mobile App**: Deploy to CDN with HTTPS enabled for PWA functionality
4. **Scaling**: Consider horizontal scaling for backend with Redis for session sharing
5. **API Keys**: Secure management of OpenAI API keys
6. **Rate Limiting**: Implement to prevent API cost overruns

## Questions?

For additional information or questions about the implementation, please contact:
- Daniel Hill, AllPro.Enterprises Novus | Nexum Labs 