import React, { useState, useRef, useEffect } from 'react';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff,
  Monitor,
  MonitorOff,
  MessageSquare,
  Settings,
  Maximize2,
  Minimize2,
  Camera,
  Volume2,
  VolumeX,
  Record,
  Square,
  MoreVertical,
  Users,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';

const VideoCallInterface = ({ 
  roomId, 
  userId, 
  onCallEnd,
  isInitiator = false,
  participantName = "Usuario"
}) => {
  // Estados de la videollamada
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionQuality, setConnectionQuality] = useState('good'); // 'excellent', 'good', 'poor', 'disconnected'
  const [callDuration, setCallDuration] = useState(0);
  
  // Estados de medios
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  // Estados de UI
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [remoteVideoLoaded, setRemoteVideoLoaded] = useState(false);
  
  // Chat durante llamada
  const [chatMessages, setChatMessages] = useState([]);
  const [newChatMessage, setNewChatMessage] = useState('');
  
  // Referencias
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const durationIntervalRef = useRef(null);

  // Simular conexión WebRTC
  useEffect(() => {
    initializeVideoCall();
    
    return () => {
      cleanup();
    };
  }, []);

  // Timer de duración
  useEffect(() => {
    if (isConnected) {
      durationIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(durationIntervalRef.current);
    }

    return () => clearInterval(durationIntervalRef.current);
  }, [isConnected]);

  const initializeVideoCall = async () => {
    try {
      setIsConnecting(true);
      
      // Obtener stream local
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideoEnabled,
        audio: isAudioEnabled
      });
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Simular conexión
      setTimeout(() => {
        setIsConnected(true);
        setIsConnecting(false);
        setRemoteVideoLoaded(true);
        
        // Simular stream remoto
        if (remoteVideoRef.current) {
          // En producción: aquí se conectaría el stream remoto real
          remoteVideoRef.current.srcObject = stream; // Usando el mismo stream como demo
        }
      }, 2000);

      // Simular variaciones en la calidad de conexión
      const qualityInterval = setInterval(() => {
        const qualities = ['excellent', 'good', 'poor'];
        const randomQuality = qualities[Math.floor(Math.random() * qualities.length)];
        setConnectionQuality(randomQuality);
      }, 10000);

      return () => clearInterval(qualityInterval);

    } catch (error) {
      console.error('Error iniciando videollamada:', error);
      setIsConnecting(false);
      setConnectionQuality('disconnected');
    }
  };

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach(track => track.stop());
    }
    clearInterval(durationIntervalRef.current);
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  // Compartir pantalla
  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        // Reemplazar track de video
        if (localStreamRef.current) {
          const videoTrack = screenStream.getVideoTracks()[0];
          const sender = localStreamRef.current.getVideoTracks()[0];
          // En producción: aquí se reemplazaría el track en la conexión WebRTC
        }
        
        setIsScreenSharing(true);
        
        // Escuchar cuando termine el screen share
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          // Volver a video de cámara
          initializeVideoCall();
        };
      } else {
        setIsScreenSharing(false);
        // Volver a video de cámara
        initializeVideoCall();
      }
    } catch (error) {
      console.error('Error con screen share:', error);
    }
  };

  // Toggle grabación
  const toggleRecording = () => {
    setIsRecording(prev => !prev);
    // En producción: iniciar/parar grabación real
  };

  // Enviar mensaje de chat
  const sendChatMessage = () => {
    if (newChatMessage.trim()) {
      const message = {
        id: Date.now(),
        senderId: userId,
        text: newChatMessage.trim(),
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, message]);
      setNewChatMessage('');
    }
  };

  // Finalizar llamada
  const endCall = () => {
    cleanup();
    onCallEnd && onCallEnd();
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Formatear duración
  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Configuración de calidad de conexión
  const qualityConfig = {
    excellent: { color: 'text-green-600', label: 'Excelente', icon: <Wifi className="w-4 h-4" /> },
    good: { color: 'text-yellow-600', label: 'Buena', icon: <Wifi className="w-4 h-4" /> },
    poor: { color: 'text-red-600', label: 'Pobre', icon: <Wifi className="w-4 h-4" /> },
    disconnected: { color: 'text-gray-600', label: 'Desconectado', icon: <WifiOff className="w-4 h-4" /> }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header de la videollamada */}
      <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="font-medium">{participantName}</span>
          </div>
          
          {isConnected && (
            <Badge variant="outline" className="text-white border-white">
              {formatDuration(callDuration)}
            </Badge>
          )}
          
          <div className={`flex items-center gap-1 ${qualityConfig[connectionQuality].color}`}>
            {qualityConfig[connectionQuality].icon}
            <span className="text-xs">{qualityConfig[connectionQuality].label}</span>
          </div>

          {isRecording && (
            <Badge className="bg-red-600 text-white animate-pulse">
              <Record className="w-3 h-3 mr-1" />
              Grabando
            </Badge>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="text-white border-white hover:bg-white hover:text-black"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            className="text-white border-white hover:bg-white hover:text-black"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Área principal de video */}
      <div className="flex-1 relative bg-gray-900">
        {isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-10">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold mb-2">Conectando...</h3>
              <p className="text-gray-300">Estableciendo conexión con {participantName}</p>
            </div>
          </div>
        )}

        {/* Video remoto (principal) */}
        <div className="relative w-full h-full">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          
          {!remoteVideoLoaded && isConnected && (
            <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
              <div className="text-center text-white">
                <VideoOff className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-300">{participantName} tiene el video deshabilitado</p>
              </div>
            </div>
          )}

          {/* Nombre del participante remoto */}
          <div className="absolute bottom-4 left-4">
            <Badge className="bg-black bg-opacity-50 text-white">
              {participantName}
            </Badge>
          </div>
        </div>

        {/* Video local (PiP) */}
        <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          
          {!isVideoEnabled && (
            <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
              <VideoOff className="w-8 h-8 text-gray-400" />
            </div>
          )}

          <div className="absolute bottom-2 left-2">
            <Badge className="bg-black bg-opacity-50 text-white text-xs">
              Tú
            </Badge>
          </div>

          {/* Indicadores de estado */}
          <div className="absolute top-2 right-2 flex space-x-1">
            {!isAudioEnabled && (
              <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center">
                <MicOff className="w-3 h-3 text-white" />
              </div>
            )}
            {isScreenSharing && (
              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                <Monitor className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        </div>

        {/* Panel de chat lateral */}
        {showChat && (
          <div className="absolute top-0 right-0 w-80 h-full bg-white shadow-lg flex flex-col">
            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Chat durante llamada</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowChat(false)}
                >
                  <Minimize2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {chatMessages.map(message => (
                <div key={message.id} className={`p-2 rounded-lg max-w-xs ${
                  message.senderId === userId 
                    ? 'ml-auto bg-[#3ce923] text-white' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  <p className="text-sm">{message.text}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
            
            <div className="p-4 border-t bg-gray-50">
              <div className="flex space-x-2">
                <Input
                  value={newChatMessage}
                  onChange={(e) => setNewChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Escribe un mensaje..."
                  className="flex-1"
                />
                <Button onClick={sendChatMessage} size="sm">
                  <MessageSquare className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controles de la videollamada */}
      <div className="bg-gray-900 p-4">
        <div className="flex justify-center items-center space-x-4">
          {/* Control de audio */}
          <Button
            onClick={toggleAudio}
            className={`w-12 h-12 rounded-full ${
              isAudioEnabled 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </Button>

          {/* Control de video */}
          <Button
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-full ${
              isVideoEnabled 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </Button>

          {/* Compartir pantalla */}
          <Button
            onClick={toggleScreenShare}
            className={`w-12 h-12 rounded-full ${
              isScreenSharing 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </Button>

          {/* Chat */}
          <Button
            onClick={() => setShowChat(!showChat)}
            className={`w-12 h-12 rounded-full ${
              showChat 
                ? 'bg-[#ac7afc] hover:bg-purple-600 text-white' 
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
          </Button>

          {/* Grabación */}
          <Button
            onClick={toggleRecording}
            className={`w-12 h-12 rounded-full ${
              isRecording 
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' 
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
          >
            {isRecording ? <Square className="w-5 h-5" /> : <Record className="w-5 h-5" />}
          </Button>

          {/* Finalizar llamada */}
          <Button
            onClick={endCall}
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white ml-8"
          >
            <PhoneOff className="w-6 h-6" />
          </Button>

          {/* Más opciones */}
          <Button
            className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 text-white"
          >
            <MoreVertical className="w-5 h-5" />
          </Button>
        </div>

        {/* Información adicional */}
        <div className="flex justify-center mt-4 space-x-6 text-sm text-gray-400">
          <div className="flex items-center space-x-1">
            <Users className="w-4 h-4" />
            <span>2 participantes</span>
          </div>
          
          <div className="flex items-center space-x-1">
            <Badge variant="outline" className="text-gray-400 border-gray-600">
              Room: {roomId}
            </Badge>
          </div>
          
          {connectionQuality === 'poor' && (
            <div className="flex items-center space-x-1 text-yellow-500">
              <Wifi className="w-4 h-4" />
              <span>Conexión lenta</span>
            </div>
          )}
        </div>
      </div>

      {/* Notificaciones de estado */}
      {connectionQuality === 'poor' && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2">
          <Alert className="bg-yellow-100 border-yellow-400">
            <AlertDescription className="text-yellow-800">
              <strong>Conexión lenta detectada.</strong> La calidad del video puede verse afectada.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {connectionQuality === 'disconnected' && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2">
          <Alert variant="destructive">
            <AlertDescription>
              <strong>Conexión perdida.</strong> Intentando reconectar...
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
};

export default VideoCallInterface;