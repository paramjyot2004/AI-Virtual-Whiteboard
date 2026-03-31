import React, { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Hands, Results, HAND_CONNECTIONS } from '@mediapipe/hands';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { Palette, Eraser, Trash2, Info, Activity, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for tailwind class merging
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
];

export default function App() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const [activeColor, setActiveColor] = useState(COLORS[0].value);
  const [isEraser, setIsEraser] = useState(false);
  const [fps, setFps] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [brushThickness, setBrushThickness] = useState(12);

  // Refs for toolbar buttons to detect "virtual" hover
  const toolbarRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  // Drawing state
  const prevPos = useRef<{ x: number; y: number } | null>(null);
  const smoothedPos = useRef<{ x: number; y: number } | null>(null);

  const onResults = useCallback((results: Results) => {
    const canvasCtx = canvasRef.current?.getContext('2d');
    const drawingCtx = drawingCanvasRef.current?.getContext('2d');
    if (!canvasCtx || !drawingCtx || !canvasRef.current || !drawingCanvasRef.current) return;

    // Clear main canvas (overlay)
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    // Draw hand landmarks for feedback
    if (results.multiHandLandmarks) {
      for (const landmarks of results.multiHandLandmarks) {
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: 'rgba(255, 255, 255, 0.5)', lineWidth: 1 });
        drawLandmarks(canvasCtx, landmarks, { color: '#ffffff', lineWidth: 1, radius: 2 });

        // Logic for drawing
        const indexTip = landmarks[8];
        const indexMcp = landmarks[5];
        const middleTip = landmarks[12];
        const middleMcp = landmarks[9];
        const thumbTip = landmarks[4];

        // More robust finger up detection (tip should be significantly above MCP)
        const isIndexUp = indexTip.y < indexMcp.y - 0.04;
        const isMiddleUp = middleTip.y < middleMcp.y - 0.04;
        
        // Thumb distance to index tip for size control
        const thumbToIndexDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
        
        // If thumb is "out" and index/middle are up, we can adjust size
        // We'll use a specific gesture: Index + Middle + Thumb "open"
        const isThumbOut = Math.abs(thumbTip.x - indexMcp.x) > 0.1;

        const rawX = indexTip.x * canvasRef.current.width;
        const rawY = indexTip.y * canvasRef.current.height;

        // Apply exponential smoothing to reduce jitter
        if (!smoothedPos.current) {
          smoothedPos.current = { x: rawX, y: rawY };
        } else {
          const smoothing = 1.0; // Raw, instant response
          smoothedPos.current.x = smoothedPos.current.x * (1 - smoothing) + rawX * smoothing;
          smoothedPos.current.y = smoothedPos.current.y * (1 - smoothing) + rawY * smoothing;
        }

        const x = smoothedPos.current.x;
        const y = smoothedPos.current.y;

        // Dynamic Size Control (Index + Middle + Thumb "active")
        // If all three are up/out, we adjust thickness based on thumb-index distance
        if (isIndexUp && isMiddleUp && isThumbOut) {
          // Map distance (approx 0.05 to 0.3) to thickness (4 to 80)
          const newThickness = Math.max(4, Math.min(80, (thumbToIndexDist - 0.05) * 300));
          setBrushThickness(Math.round(newThickness));
          
          // Visual feedback for size adjustment
          canvasCtx.beginPath();
          canvasCtx.arc(x, y, newThickness / 2, 0, Math.PI * 2);
          canvasCtx.strokeStyle = '#ffffff';
          canvasCtx.lineWidth = 2;
          canvasCtx.stroke();
          
          canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          canvasCtx.fill();
          
          canvasCtx.font = '12px monospace';
          canvasCtx.fillStyle = '#ffffff';
          canvasCtx.fillText(`SIZE: ${Math.round(newThickness)}px`, x + 20, y);
        }

        // Virtual Hover Detection for Toolbar
        const canvasRect = canvasRef.current.getBoundingClientRect();
        // The canvas is mirrored via CSS scaleX(-1). 
        // We map the normalized indexTip coordinates directly to viewport coordinates.
        const screenX = canvasRect.left + (1 - indexTip.x) * canvasRect.width;
        const screenY = canvasRect.top + indexTip.y * canvasRect.height;

        let currentHover: string | null = null;
        if (isIndexUp && isMiddleUp) {
          // Check each toolbar button's bounding box
          for (const [id, ref] of Object.entries(toolbarRefs.current)) {
            const button = ref as HTMLButtonElement | null;
            if (button) {
              const rect = button.getBoundingClientRect();
              // Add some padding to make it easier to "touch"
              const padding = 10;
              if (
                screenX >= rect.left - padding &&
                screenX <= rect.right + padding &&
                screenY >= rect.top - padding &&
                screenY <= rect.bottom + padding
              ) {
                currentHover = id;
                break;
              }
            }
          }
        }
        
        // Update hover state only if it changed to avoid unnecessary re-renders
        if (currentHover !== hoveredItem) {
          setHoveredItem(currentHover);
          
          // If we hover over an item in selection mode, let's auto-select it
          if (currentHover) {
            if (currentHover === 'eraser') {
              setIsEraser(true);
            } else if (currentHover.startsWith('color-')) {
              const colorValue = currentHover.replace('color-', '');
              setActiveColor(colorValue);
              setIsEraser(false);
            }
          }
        }

        // Selection Mode (Index + Middle up)
        if (isIndexUp && isMiddleUp) {
          prevPos.current = null;
          // Draw selection cursor
          canvasCtx.beginPath();
          canvasCtx.arc(x, y, 15, 0, Math.PI * 2);
          canvasCtx.strokeStyle = '#ffffff';
          canvasCtx.lineWidth = 2;
          canvasCtx.stroke();
          
          // Visual indicator for selection mode
          canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          canvasCtx.fill();
        } 
        // Drawing Mode (Only Index up)
        else if (isIndexUp && !isMiddleUp) {
          drawingCtx.lineCap = 'round';
          drawingCtx.lineJoin = 'round';
          drawingCtx.strokeStyle = isEraser ? '#000000' : activeColor;
          drawingCtx.lineWidth = isEraser ? 60 : brushThickness;

          if (isEraser) {
            drawingCtx.globalCompositeOperation = 'destination-out';
          } else {
            drawingCtx.globalCompositeOperation = 'source-over';
          }

          if (prevPos.current) {
            // Calculate distance to avoid drawing if the jump is too large (noise)
            const dist = Math.hypot(x - prevPos.current.x, y - prevPos.current.y);
            
            if (dist < 500) { // Increased threshold for fast movements (circles)
              drawingCtx.beginPath();
              drawingCtx.moveTo(prevPos.current.x, prevPos.current.y);
              drawingCtx.lineTo(x, y);
              drawingCtx.stroke();
            }
          }
          prevPos.current = { x, y };

          // Feedback cursor on overlay
          canvasCtx.beginPath();
          canvasCtx.arc(x, y, isEraser ? 30 : brushThickness / 2, 0, Math.PI * 2);
          canvasCtx.fillStyle = isEraser ? 'rgba(255, 255, 255, 0.5)' : activeColor;
          canvasCtx.fill();
          if (isEraser) {
            canvasCtx.strokeStyle = '#ffffff';
            canvasCtx.lineWidth = 1;
            canvasCtx.stroke();
          }
        } else {
          prevPos.current = null;
          smoothedPos.current = null;
        }
      }
    } else {
      prevPos.current = null;
      smoothedPos.current = null;
    }
    canvasCtx.restore();
  }, [activeColor, isEraser]);

  const onResultsRef = useRef(onResults);
  useEffect(() => {
    onResultsRef.current = onResults;
  }, [onResults]);

  useEffect(() => {
    let isMounted = true;
    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results) => {
      if (isMounted) {
        onResultsRef.current(results);
      }
    });

    let lastTime = performance.now();
    let frameCount = 0;
    let animId: number;

    const process = async () => {
      if (!isMounted) return;

      if (webcamRef.current?.video?.readyState === 4) {
        const video = webcamRef.current.video;
        
        // Match canvas sizes to video
        if (canvasRef.current && drawingCanvasRef.current) {
          if (canvasRef.current.width !== video.videoWidth) {
            canvasRef.current.width = video.videoWidth;
            canvasRef.current.height = video.videoHeight;
            drawingCanvasRef.current.width = video.videoWidth;
            drawingCanvasRef.current.height = video.videoHeight;
          }
        }

        try {
          await hands.send({ image: video });
          if (isMounted) setIsLoaded(true);
        } catch (err) {
          // Only log if still mounted to avoid noise during unmount
          if (isMounted) {
            console.error("MediaPipe error:", err);
          }
        }

        // Calculate FPS
        frameCount++;
        const now = performance.now();
        if (now - lastTime >= 1000) {
          if (isMounted) setFps(Math.round((frameCount * 1000) / (now - lastTime)));
          frameCount = 0;
          lastTime = now;
        }
      }
      animId = requestAnimationFrame(process);
    };

    animId = requestAnimationFrame(process);

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'c') {
        clearCanvas();
      } else if (e.key === '[') {
        setBrushThickness(prev => Math.max(2, prev - 2));
      } else if (e.key === ']') {
        setBrushThickness(prev => Math.min(100, prev + 2));
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
      hands.close();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []); // Empty dependency array to keep Hands instance stable

  const clearCanvas = () => {
    const drawingCtx = drawingCanvasRef.current?.getContext('2d');
    if (drawingCtx && drawingCanvasRef.current) {
      drawingCtx.clearRect(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-900/20 blur-[120px] rounded-full" />
      </div>

      {/* Header / Toolbar */}
      <header className="relative z-20 flex items-center justify-between px-8 py-6 bg-black/40 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Palette className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">AI Virtual Whiteboard</h1>
            <p className="text-xs text-white/40 uppercase tracking-widest font-medium">Gesture Control System</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-white/5 p-1.5 rounded-2xl border border-white/10">
          {COLORS.map((color) => (
            <button
              key={color.name}
              ref={(el) => (toolbarRefs.current[`color-${color.value}`] = el)}
              onClick={() => {
                setActiveColor(color.value);
                setIsEraser(false);
              }}
              className={cn(
                "w-10 h-10 rounded-xl transition-all duration-300 flex items-center justify-center relative group",
                activeColor === color.value && !isEraser ? "scale-110 shadow-lg" : "opacity-40 hover:opacity-100",
                hoveredItem === `color-${color.value}` && "ring-4 ring-white/50 scale-110"
              )}
              style={{ backgroundColor: color.value }}
            >
              {activeColor === color.value && !isEraser && (
                <motion.div layoutId="active" className="absolute -inset-1 border-2 border-white rounded-2xl" />
              )}
              <span className="sr-only">{color.name}</span>
            </button>
          ))}
          <div className="w-px h-6 bg-white/10 mx-1" />
          <button
            ref={(el) => (toolbarRefs.current['eraser'] = el)}
            onClick={() => setIsEraser(true)}
            className={cn(
              "w-10 h-10 rounded-xl transition-all duration-300 flex items-center justify-center relative",
              isEraser ? "bg-white text-black scale-110 shadow-lg" : "bg-white/10 text-white opacity-40 hover:opacity-100",
              hoveredItem === 'eraser' && "ring-4 ring-white/50 scale-110"
            )}
          >
            {isEraser && <motion.div layoutId="active" className="absolute -inset-1 border-2 border-white rounded-2xl" />}
            <Eraser className="w-5 h-5" />
          </button>
          <button
            onClick={clearCanvas}
            className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300 flex items-center justify-center"
            title="Clear Canvas (C)"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-white/40 uppercase tracking-tighter font-bold">System Status</span>
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full animate-pulse", isLoaded ? "bg-green-500" : "bg-yellow-500")} />
              <span className="text-sm font-mono tracking-tighter">{isLoaded ? 'ACTIVE' : 'INITIALIZING'}</span>
            </div>
          </div>
          <button 
            onClick={() => setShowInfo(!showInfo)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <Info className="w-5 h-5 text-white/60" />
          </button>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="relative flex-1 flex items-center justify-center p-8 h-[calc(100vh-100px)]">
        <div className="relative w-full max-w-5xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/5 group">
          {/* Webcam Layer */}
          <Webcam
            ref={webcamRef}
            mirrored
            audio={false}
            disablePictureInPicture={true}
            forceScreenshotSourceSize={false}
            imageSmoothing={true}
            screenshotFormat="image/jpeg"
            screenshotQuality={0.92}
            onUserMedia={() => {
              setIsLoaded(true);
              setPermissionError(null);
            }}
            onUserMediaError={(err) => {
              console.error("Webcam error:", err);
              if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
                setPermissionError("Camera access was denied. Please check your browser settings and allow camera access for this site.");
              } else {
                setPermissionError("Could not access the camera. Please ensure no other application is using it.");
              }
            }}
            className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale-[0.2]"
            videoConstraints={{
              width: 1280,
              height: 720,
              facingMode: "user"
            }}
          />

          {/* Drawing Canvas Layer */}
          <canvas
            ref={drawingCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ transform: 'scaleX(-1)' }} // Mirror the drawing to match webcam
          />

          {/* Interaction/Landmarks Overlay Layer */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ transform: 'scaleX(-1)' }} // Mirror landmarks
          />

          {/* FPS Counter */}
          <div className="absolute bottom-6 right-6 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-2">
            <Activity className="w-3 h-3 text-blue-400" />
            <span className="text-xs font-mono text-white/80">{fps} FPS</span>
          </div>

          {/* Loading Overlay */}
          <AnimatePresence>
            {!isLoaded && !permissionError && (
              <motion.div 
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 bg-black flex flex-col items-center justify-center"
              >
                <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
                <p className="text-white/60 font-mono text-sm animate-pulse">LOADING COMPUTER VISION ENGINE...</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Permission Error Overlay */}
          <AnimatePresence>
            {permissionError && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 z-40 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-12 text-center"
              >
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
                  <Camera className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold mb-4">Camera Access Required</h2>
                <p className="text-white/60 max-w-md mb-8 leading-relaxed">
                  {permissionError}
                </p>
                <div className="flex flex-col gap-4 w-full max-w-xs">
                  <button 
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-white/90 transition-colors"
                  >
                    RETRY PERMISSION
                  </button>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest">
                    Check your browser's address bar for the camera icon
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Instructions Overlay */}
          <AnimatePresence>
            {showInfo && isLoaded && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute top-6 left-6 z-20 w-64 p-5 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider">Gestures</h3>
                  <button onClick={() => setShowInfo(false)} className="text-white/40 hover:text-white">×</button>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold">1</div>
                    <div>
                      <p className="text-xs font-bold">DRAWING MODE</p>
                      <p className="text-[10px] text-white/50">Raise only your index finger to start drawing.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-bold">2</div>
                    <div>
                      <p className="text-xs font-bold">SELECTION MODE</p>
                      <p className="text-[10px] text-white/50">Raise index + middle fingers to hover/select.</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-white/5">
                    <p className="text-[10px] text-white/30 font-mono">PRESS 'C' TO CLEAR CANVAS</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer / Meta */}
      <footer className="absolute bottom-0 w-full px-8 py-4 flex justify-between items-center text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold">
        <span>Engine: MediaPipe Hands v0.10</span>
        <div className="flex gap-4">
          <span>Resolution: 1280x720</span>
          <span>Latency: Optimized</span>
        </div>
      </footer>
    </div>
  );
}
