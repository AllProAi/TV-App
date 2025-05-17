# MemoryStream System Architecture

```
+--------------------+
|                    |
|   TV Application   |
|                    |
+--------+-----------+
         |
         | WebSocket (Socket.io)
         |
+--------v-----------+            +-----------------+
|                    |            |                 |
|  Backend Server    +------------> OpenAI Services |
|                    |            |                 |
+--------+-----------+            +-----------------+
         |
         | WebSocket (Socket.io)
         |
+--------v-----------+
|                    |
| Mobile Companion   |
|                    |
+--------------------+
```

## Component Breakdown

### TV Application
- **ShakaPlayer**: Video playback and streaming
- **RemoteNavigation**: Focus-based UI navigation
- **SubtitleManager**: Display and synchronization of subtitles
- **AIAssistant**: Display of contextual responses
- **ConnectionManager**: WebSocket status handling

### Backend Server
- **Socket.io Namespaces**:
  - `/tv`: TV-specific events
  - `/mobile`: Mobile-specific events
  - `/subtitle`: Subtitle streaming
  - `/voice`: Voice command processing
  - `/ai`: AI response handling
- **Session Management**: Handles TV-mobile pairing and state
- **AI Service Integration**: OpenAI API wrappers for Whisper and GPT

### Mobile Companion
- **QRCodeScanner**: Camera-based QR scanning for pairing
- **RemoteControl**: D-pad and media button emulation
- **VoiceRecorder**: WebRTC audio capture and streaming
- **ChatInterface**: Text-based interaction with AI
- **ConnectionManager**: WebSocket status handling

## Data Flow

1. **TV-Mobile Pairing**:
   ```
   TV App -> Backend -> QR Code -> Mobile App -> Backend -> TV App
   ```

2. **Subtitle Generation**:
   ```
   TV Video -> Backend -> Whisper API -> Backend -> TV Subtitles
   ```

3. **Voice Commands**:
   ```
   Mobile Mic -> Backend -> Whisper API -> Command Parser -> TV App
   ```

4. **Content Q&A**:
   ```
   Mobile Query -> Backend -> GPT + Context -> Mobile Display + TV Display
   ```

## Scalability Considerations

- Session data can be migrated from in-memory to Redis for multi-server deployment
- WebSocket connections can be load-balanced with sticky sessions
- AI processing can be moved to separate microservices
- Subtitle data can be cached to reduce API costs 