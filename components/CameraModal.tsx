import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw } from 'lucide-react';

interface CameraModalProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
}

const CameraModal: React.FC<CameraModalProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Use a ref for the stream to ensure cleanup works correctly in useEffect 
  // without stale closures issues common with useState
  const streamRef = useRef<MediaStream | null>(null);
  
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');
  const [error, setError] = useState<string>('');

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async (deviceId?: string) => {
    // Ensure any existing stream is stopped before starting a new one
    stopCamera();
    setError('');
    
    // Constraints: Prefer environment (back) camera, fallback to any video if specific ID not requested
    const constraints: MediaStreamConstraints = {
      video: deviceId 
        ? { deviceId: { exact: deviceId } } 
        : { facingMode: 'environment' } 
    };

    try {
      let stream: MediaStream;
      
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr) {
        console.warn("Primary constraint failed, trying fallback...", firstErr);
        // If the specific constraint failed (e.g. facingMode on laptop), try generic video
        if (!deviceId) {
           stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } else {
           throw firstErr;
        }
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Update active device ID
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      if (settings.deviceId) {
        setCurrentDeviceId(settings.deviceId);
      }

      // Refresh device list now that we have permissions
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);

    } catch (err) {
      console.error("Camera Error:", err);
      setError('Gagal memulai kamera. Pastikan izin diberikan dan kamera tidak sedang digunakan aplikasi lain.');
    }
  };

  // Initial mount: Start camera
  useEffect(() => {
    startCamera();

    // Cleanup on unmount
    return () => {
      stopCamera();
    };
  }, []);

  const handleSwitchCamera = () => {
    if (devices.length < 2) return;
    
    const currentIndex = devices.findIndex(d => d.deviceId === currentDeviceId);
    const idx = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = (idx + 1) % devices.length;
    const nextDevice = devices[nextIndex];
    
    if (nextDevice) {
      startCamera(nextDevice.deviceId);
    }
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Match canvas size to video stream resolution
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        onCapture(imageData);
        stopCamera(); // Stop stream after capture
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-black rounded-xl overflow-hidden shadow-2xl flex flex-col h-full md:h-auto md:max-h-[90vh]">
        
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent">
          <span className="text-white font-bold flex items-center gap-2">
            <Camera className="w-5 h-5" /> Ambil Foto
          </span>
          <button onClick={() => { stopCamera(); onClose(); }} className="p-2 bg-white/20 rounded-full text-white hover:bg-red-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Preview */}
        <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="text-white text-center p-6">
              <p className="mb-2 text-red-400 font-bold">{error}</p>
              <button onClick={() => startCamera()} className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-bold hover:bg-blue-700">Coba Lagi</button>
            </div>
          ) : (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              className="w-full h-full object-cover md:object-contain"
            />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Controls */}
        <div className="p-6 bg-black flex justify-between items-center gap-4">
           {/* Switch Camera Button (Only if multiple devices) */}
           <div className="w-12">
             {devices.length > 1 && (
               <button 
                 onClick={handleSwitchCamera}
                 className="p-3 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition border border-slate-700"
                 title="Ganti Kamera"
               >
                 <RefreshCw className="w-5 h-5" />
               </button>
             )}
           </div>

           {/* Capture Button */}
           <button 
             onClick={handleCapture}
             disabled={!!error}
             className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center group relative hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
           >
              <div className="w-16 h-16 bg-white rounded-full group-active:scale-90 transition-transform"></div>
           </button>

           <div className="w-12"></div> 
        </div>
      </div>
    </div>
  );
};

export default CameraModal;