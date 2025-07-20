import React, { useState, useRef, useCallback } from 'react';
import { 
  Upload, 
  Camera, 
  Video, 
  Mic, 
  X, 
  FileImage, 
  Play,
  Pause,
  Square,
  RotateCcw,
  Check,
  AlertTriangle,
  Loader2,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';

const MediaUploader = ({ 
  chatId, 
  userId, 
  onClose, 
  onUploadComplete,
  allowedTypes = ['image', 'video', 'audio'],
  maxFiles = 5,
  maxSizeMB = 50
}) => {
  const [uploadMode, setUploadMode] = useState('select'); // 'select', 'camera', 'video', 'audio'
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [description, setDescription] = useState('');
  
  // Camera/Video recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [stream, setStream] = useState(null);
  
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingIntervalRef = useRef(null);

  // Tipos de archivo soportados
  const fileTypes = {
    image: {
      accept: 'image/jpeg,image/png,image/webp',
      label: 'Imágenes',
      icon: <FileImage className="w-5 h-5" />,
      color: 'text-[#3ce923]'
    },
    video: {
      accept: 'video/mp4,video/webm,video/quicktime',
      label: 'Videos',
      icon: <Video className="w-5 h-5" />,
      color: 'text-[#60cdff]'
    },
    audio: {
      accept: 'audio/mp3,audio/wav,audio/m4a',
      label: 'Audio',
      icon: <Mic className="w-5 h-5" />,
      color: 'text-[#ac7afc]'
    }
  };

  // Validar archivo
  const validateFile = (file) => {
    // Tamaño
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `Archivo muy grande. Máximo ${maxSizeMB}MB`;
    }

    // Tipo
    const isValidType = allowedTypes.some(type => 
      fileTypes[type].accept.split(',').some(acceptType => 
        file.type.includes(acceptType.split('/')[1])
      )
    );

    if (!isValidType) {
      return 'Tipo de archivo no permitido';
    }

    return null;
  };

  // Manejar selección de archivos
  const handleFileSelection = (event) => {
    const files = Array.from(event.target.files);
    const validFiles = [];
    const errors = [];

    files.forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else if (selectedFiles.length + validFiles.length < maxFiles) {
        validFiles.push({
          file,
          type: file.type.startsWith('image/') ? 'image' : 
                file.type.startsWith('video/') ? 'video' : 'audio',
          preview: URL.createObjectURL(file),
          name: file.name,
          size: file.size
        });
      } else {
        errors.push(`Máximo ${maxFiles} archivos permitidos`);
      }
    });

    if (errors.length > 0) {
      setError(errors.join('. '));
    } else {
      setError('');
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  // Remover archivo
  const removeFile = (index) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  // Iniciar cámara
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setUploadMode('camera');
    } catch (err) {
      setError('No se pudo acceder a la cámara: ' + err.message);
    }
  };

  // Tomar foto
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    canvas.toBlob(blob => {
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const fileData = {
        file,
        type: 'image',
        preview: URL.createObjectURL(blob),
        name: file.name,
        size: file.size
      };
      setSelectedFiles(prev => [...prev, fileData]);
      stopCamera();
    }, 'image/jpeg', 0.8);
  };

  // Iniciar grabación de video
  const startVideoRecording = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      const mediaRecorder = new MediaRecorder(mediaStream);
      const chunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        setRecordedBlob(blob);
        const file = new File([blob], `video_${Date.now()}.webm`, { type: 'video/webm' });
        const fileData = {
          file,
          type: 'video',
          preview: URL.createObjectURL(blob),
          name: file.name,
          size: file.size
        };
        setSelectedFiles(prev => [...prev, fileData]);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setUploadMode('video');

      // Contador de tiempo
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      setError('No se pudo acceder a la cámara/micrófono: ' + err.message);
    }
  };

  // Parar grabación
  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingIntervalRef.current);
      setRecordingTime(0);
      stopCamera();
    }
  };

  // Iniciar grabación de audio
  const startAudioRecording = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(mediaStream);
      const chunks = [];

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
        const fileData = {
          file,
          type: 'audio',
          preview: null,
          name: file.name,
          size: file.size
        };
        setSelectedFiles(prev => [...prev, fileData]);
        mediaStream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      setStream(mediaStream);
      mediaRecorder.start();
      setIsRecording(true);
      setUploadMode('audio');

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      setError('No se pudo acceder al micrófono: ' + err.message);
    }
  };

  // Parar grabación de audio
  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingIntervalRef.current);
      setRecordingTime(0);
    }
  };

  // Parar cámara
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setUploadMode('select');
  };

  // Subir archivos
  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    setError('');

    try {
      // Preparar archivos para upload
      const filesToUpload = selectedFiles.map(fileData => ({
        data: fileData.file, // En producción: convertir a base64
        type: fileData.file.type,
        size: fileData.file.size,
        name: fileData.file.name
      }));

      // Simular progreso
      for (let i = 0; i <= 100; i += 10) {
        setUploadProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Llamar a la función de upload
      const uploadQuotationMedia = firebase.functions().httpsCallable('uploadQuotationMedia');
      
      const result = await uploadQuotationMedia({
        chatId,
        userId,
        files: filesToUpload,
        messageType: selectedFiles[0].type,
        description: description.trim()
      });

      if (result.data.success) {
        onUploadComplete && onUploadComplete();
        onClose();
      }
    } catch (err) {
      console.error('Error subiendo archivos:', err);
      setError('Error subiendo archivos: ' + err.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Formatear tiempo de grabación
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Formatear tamaño de archivo
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="bg-gradient-to-r from-[#ac7afc] to-purple-600">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Subir Archivos Multimedia
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onClose}
              className="text-white border-white hover:bg-white hover:text-purple-600"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* Selector de modo */}
          {uploadMode === 'select' && (
            <div className="space-y-6">
              {/* Opciones de entrada */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Seleccionar archivos */}
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-24 flex flex-col gap-2 bg-gradient-to-br from-gray-100 to-gray-200 text-gray-800 hover:from-gray-200 hover:to-gray-300 border-2 border-dashed border-gray-300"
                >
                  <Upload className="w-6 h-6" />
                  <span className="text-sm font-medium">Seleccionar Archivos</span>
                </Button>

                {/* Tomar foto */}
                {allowedTypes.includes('image') && (
                  <Button
                    onClick={startCamera}
                    className="h-24 flex flex-col gap-2 bg-gradient-to-br from-green-100 to-green-200 text-green-800 hover:from-green-200 hover:to-green-300"
                  >
                    <Camera className="w-6 h-6" />
                    <span className="text-sm font-medium">Tomar Foto</span>
                  </Button>
                )}

                {/* Grabar video */}
                {allowedTypes.includes('video') && (
                  <Button
                    onClick={startVideoRecording}
                    className="h-24 flex flex-col gap-2 bg-gradient-to-br from-blue-100 to-blue-200 text-blue-800 hover:from-blue-200 hover:to-blue-300"
                  >
                    <Video className="w-6 h-6" />
                    <span className="text-sm font-medium">Grabar Video</span>
                  </Button>
                )}

                {/* Grabar audio */}
                {allowedTypes.includes('audio') && (
                  <Button
                    onClick={startAudioRecording}
                    className="h-24 flex flex-col gap-2 bg-gradient-to-br from-purple-100 to-purple-200 text-purple-800 hover:from-purple-200 hover:to-purple-300"
                  >
                    <Mic className="w-6 h-6" />
                    <span className="text-sm font-medium">Grabar Audio</span>
                  </Button>
                )}
              </div>

              {/* Archivos seleccionados */}
              {selectedFiles.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Archivos Seleccionados ({selectedFiles.length}/{maxFiles})
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedFiles.map((fileData, index) => (
                      <div key={index} className="relative border rounded-lg p-3 bg-gray-50">
                        <div className="flex items-start justify-between mb-2">
                          <Badge className={`${fileTypes[fileData.type]?.color} bg-opacity-10`}>
                            {fileTypes[fileData.type]?.icon}
                            <span className="ml-1">{fileData.type}</span>
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeFile(index)}
                            className="p-1 h-auto text-red-600 hover:bg-red-50"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>

                        {/* Preview */}
                        {fileData.type === 'image' && (
                          <img 
                            src={fileData.preview} 
                            alt="Preview"
                            className="w-full h-32 object-cover rounded mb-2"
                          />
                        )}
                        
                        {fileData.type === 'video' && (
                          <video 
                            src={fileData.preview} 
                            className="w-full h-32 object-cover rounded mb-2"
                            controls
                          />
                        )}

                        {fileData.type === 'audio' && (
                          <div className="w-full h-32 bg-gradient-to-br from-purple-100 to-purple-200 rounded mb-2 flex items-center justify-center">
                            <Mic className="w-8 h-8 text-purple-600" />
                          </div>
                        )}

                        <div className="text-sm">
                          <p className="font-medium text-gray-900 truncate">{fileData.name}</p>
                          <p className="text-gray-600">{formatFileSize(fileData.size)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Descripción */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Descripción (opcional)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe lo que muestran estas imágenes/videos..."
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ac7afc] focus:border-transparent"
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Modo cámara */}
          {uploadMode === 'camera' && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-4">Tomar Foto</h3>
                <div className="relative inline-block">
                  <video 
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full max-w-md rounded-lg border-4 border-[#3ce923]"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              </div>
              
              <div className="flex justify-center gap-4">
                <Button
                  onClick={capturePhoto}
                  className="bg-[#3ce923] hover:bg-green-600"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Capturar
                </Button>
                <Button
                  variant="outline"
                  onClick={stopCamera}
                >
                  <X className="w-5 h-5 mr-2" />
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Modo grabación de video */}
          {uploadMode === 'video' && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-4">Grabar Video</h3>
                <div className="relative inline-block">
                  <video 
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full max-w-md rounded-lg border-4 border-[#60cdff]"
                  />
                  {isRecording && (
                    <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      REC {formatTime(recordingTime)}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-center gap-4">
                {!isRecording ? (
                  <Button
                    onClick={startVideoRecording}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Video className="w-5 h-5 mr-2" />
                    Iniciar Grabación
                  </Button>
                ) : (
                  <Button
                    onClick={stopVideoRecording}
                    className="bg-gray-600 hover:bg-gray-700"
                  >
                    <Square className="w-5 h-5 mr-2" />
                    Parar Grabación
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={stopCamera}
                >
                  <X className="w-5 h-5 mr-2" />
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Modo grabación de audio */}
          {uploadMode === 'audio' && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-4">Grabar Audio</h3>
                <div className="w-48 h-48 mx-auto bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center">
                  <Mic className={`w-16 h-16 text-purple-600 ${isRecording ? 'animate-pulse' : ''}`} />
                </div>
                {isRecording && (
                  <div className="mt-4">
                    <p className="text-lg font-semibold text-red-600">
                      Grabando... {formatTime(recordingTime)}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex justify-center gap-4">
                {!isRecording ? (
                  <Button
                    onClick={startAudioRecording}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Mic className="w-5 h-5 mr-2" />
                    Iniciar Grabación
                  </Button>
                ) : (
                  <Button
                    onClick={stopAudioRecording}
                    className="bg-gray-600 hover:bg-gray-700"
                  >
                    <Square className="w-5 h-5 mr-2" />
                    Parar Grabación
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setUploadMode('select')}
                >
                  <X className="w-5 h-5 mr-2" />
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Input de archivos oculto */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={allowedTypes.map(type => fileTypes[type].accept).join(',')}
            onChange={handleFileSelection}
            className="hidden"
          />

          {/* Error message */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Progress bar */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Subiendo archivos...</span>
                <span className="text-sm text-gray-600">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          {/* Botones de acción */}
          {uploadMode === 'select' && selectedFiles.length > 0 && (
            <div className="flex justify-end gap-3 mt-6">
              <Button 
                variant="outline" 
                onClick={onClose}
                disabled={uploading}
              >
                Cancelar
              </Button>
              <Button 
                onClick={uploadFiles}
                disabled={uploading || selectedFiles.length === 0}
                className="bg-[#3ce923] hover:bg-green-600"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Subir {selectedFiles.length} archivo{selectedFiles.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MediaUploader;