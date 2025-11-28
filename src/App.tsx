import { useState, useRef } from 'react';
import './App.css';
import { processVideo as processVideoSimple, ProcessingOptions, formatTime, Screenshot, getClarityIndex, getClarityColor } from './utils/videoProcessor';

function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  // Processing options (thresholds) - more sensitive default
  const [changeThreshold, setChangeThreshold] = useState(0.15); // 0-1, default 15%
  const [minInterval, setMinInterval] = useState(1.0); // seconds
  const [blurThreshold, setBlurThreshold] = useState(100); // Laplacian variance threshold
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('video/')) {
      alert('Please select a video file');
      return;
    }

    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setScreenshots([]);
    setProgress(0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleVideoLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleProcess = async () => {
    if (!videoRef.current || !videoFile) return;

    setIsProcessing(true);
    setProgress(0);
    setScreenshots([]);
    setCurrentTime(0);

    try {
      let results: Screenshot[];
      
      // Using stability-based processing (TensorFlow.js disabled for now)
      console.log('Using stability-based detection with blur filtering...');
      
      // Use stability-based processing with user-configured options
        const processingOptions: ProcessingOptions = {
          changeThreshold,
          minScreenshotInterval: minInterval,
          sampleInterval: 0.2,
          motionSmoothing: 3,
          stabilityWindow: 0.5, // Wait 0.5s for stability after change
          stabilityThreshold: 0.05, // 5% max difference for stability
          minBlurThreshold: blurThreshold, // Minimum blur score (Laplacian variance) - adjustable
        };
      
      results = await processVideoSimple(
        videoRef.current,
        (progressValue, currentTimeValue, durationValue) => {
          setProgress(progressValue);
          setCurrentTime(currentTimeValue);
          setDuration(durationValue);
        },
        (screenshot) => {
          setScreenshots((prev) => [...prev, screenshot]);
        },
        processingOptions
      );

      setScreenshots(results);
      setProgress(100);
    } catch (error) {
      console.error('Error processing video:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Error processing video: ${errorMessage}\n\nCheck the browser console (F12) for details.`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = (screenshot: Screenshot) => {
    const link = document.createElement('a');
    link.href = screenshot.dataUrl;
    link.download = `clothing-item-${screenshot.frameNumber}-${screenshot.timestamp.toFixed(2)}s.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = () => {
    screenshots.forEach((screenshot, index) => {
      setTimeout(() => {
        handleDownload(screenshot);
      }, index * 100); // Stagger downloads to avoid browser blocking
    });
  };

  const handleReset = () => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoFile(null);
    setVideoUrl(null);
    setScreenshots([]);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="app">
      <div className="container">
        <div className="header">
          <h1>👕 Clothes Video Parser</h1>
          <p>Upload a video showing clothes one by one, and we'll extract screenshots of each item</p>
          <p style={{ fontSize: '0.9rem', opacity: 0.8, marginTop: '0.5rem' }}>
            Stability-based detection with blur filtering
          </p>
        </div>

        {!videoFile ? (
          <div className="upload-section">
            <div
              className={`upload-area ${isDragging ? 'dragover' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="upload-icon">📹</div>
              <div className="upload-text">Drop your video here or click to upload</div>
              <div className="upload-hint">Supports MP4, WebM, MOV and other video formats</div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleInputChange}
            />
          </div>
        ) : (
          <>
            <div className="video-preview-section">
              {videoUrl && (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="video-preview"
                  onLoadedMetadata={handleVideoLoadedMetadata}
                />
              )}
              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ 
                  background: '#f8f9fa', 
                  padding: '1rem', 
                  borderRadius: '8px',
                  marginBottom: '1rem'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '0.5rem'
                  }}>
                    <label style={{ fontWeight: 600, color: '#333' }}>
                      Detection Sensitivity
                    </label>
                    <span style={{ 
                      fontSize: '0.9rem', 
                      color: '#666',
                      background: 'white',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '4px',
                      fontWeight: 600
                    }}>
                      {(changeThreshold * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.5"
                    step="0.05"
                    value={changeThreshold}
                    onChange={(e) => setChangeThreshold(parseFloat(e.target.value))}
                    disabled={isProcessing}
                    style={{
                      width: '100%',
                      height: '8px',
                      borderRadius: '4px',
                      background: 'linear-gradient(to right, #667eea, #764ba2)',
                      outline: 'none',
                      cursor: isProcessing ? 'not-allowed' : 'pointer'
                    }}
                  />
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    fontSize: '0.75rem',
                    color: '#666',
                    marginTop: '0.25rem'
                  }}>
                    <span>More Sensitive</span>
                    <span>Less Sensitive</span>
                  </div>
                  <div style={{ 
                    fontSize: '0.8rem', 
                    color: '#666', 
                    marginTop: '0.5rem',
                    lineHeight: '1.4'
                  }}>
                    <strong>Tips:</strong> Lower values (5-15%) detect smaller changes - good for fast-moving videos. 
                    Higher values (20-40%) require bigger changes - good for stable videos.
                    <br />Start with 10-15% for videos with motion and hand movement.
                  </div>
                </div>
                
                {showAdvanced && (
                  <>
                    <div style={{ 
                      background: '#f8f9fa', 
                      padding: '1rem', 
                      borderRadius: '8px',
                      marginBottom: '1rem'
                    }}>
                      <label style={{ fontWeight: 600, color: '#333', display: 'block', marginBottom: '0.5rem' }}>
                        Minimum Time Between Screenshots (seconds)
                      </label>
                      <input
                        type="range"
                        min="0.25"
                        max="3.0"
                        step="0.5"
                        value={minInterval}
                        onChange={(e) => setMinInterval(parseFloat(e.target.value))}
                        disabled={isProcessing}
                        style={{
                          width: '100%',
                          height: '8px',
                          borderRadius: '4px',
                          background: 'linear-gradient(to right, #667eea, #764ba2)',
                          outline: 'none'
                        }}
                      />
                      <div style={{ 
                        textAlign: 'center',
                        fontSize: '0.9rem',
                        color: '#666',
                        marginTop: '0.25rem'
                      }}>
                        {minInterval.toFixed(1)}s
                      </div>
                    </div>
                    
                    <div style={{ 
                      background: '#f8f9fa', 
                      padding: '1rem', 
                      borderRadius: '8px',
                      marginBottom: '1rem'
                    }}>
                      <label style={{ fontWeight: 600, color: '#333', display: 'block', marginBottom: '0.5rem' }}>
                        Blur Threshold (Image Sharpness) - {blurThreshold}
                      </label>
                      <input
                        type="range"
                        min="20"
                        max="300"
                        step="10"
                        value={blurThreshold}
                        onChange={(e) => setBlurThreshold(parseInt(e.target.value))}
                        disabled={isProcessing}
                        style={{
                          width: '100%',
                          height: '8px',
                          borderRadius: '4px',
                          background: 'linear-gradient(to right, #667eea, #764ba2)',
                          outline: 'none'
                        }}
                      />
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        fontSize: '0.75rem',
                        color: '#666',
                        marginTop: '0.25rem'
                      }}>
                        <span>Lower Quality</span>
                        <span>Higher Quality</span>
                      </div>
                      <div style={{ 
                        fontSize: '0.8rem', 
                        color: '#666', 
                        marginTop: '0.5rem',
                        lineHeight: '1.4'
                      }}>
                        <strong>Lower values (20-80):</strong> Accept more blurry images - good for lower quality videos.
                        <br />
                        <strong>Higher values (100-300):</strong> Only accept very sharp images - good for high quality videos.
                        <br />
                        <strong>Default: 100</strong> - Try lowering to 50-80 if videos are being rejected.
                      </div>
                    </div>
                  </>
                )}
                
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#667eea',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    padding: '0.5rem 0',
                    marginBottom: '1rem'
                  }}
                >
                  {showAdvanced ? '▼ Hide' : '▶ Show'} Advanced Settings
                </button>
              </div>
              
              <div className="controls">
                <button
                  className="btn btn-primary"
                  onClick={handleProcess}
                  disabled={isProcessing || !videoRef.current}
                >
                  {isProcessing ? (
                    <>
                      <span className="loading-spinner"></span>
                      Processing...
                    </>
                  ) : (
                    '🎬 Start Processing'
                  )}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleReset}
                  disabled={isProcessing}
                >
                  🔄 Reset
                </button>
              </div>
            </div>

            {isProcessing && (
              <div className="progress-section">
                <div style={{ marginBottom: '0.5rem', color: '#333', fontWeight: 600 }}>
                  Processing: {progress.toFixed(1)}%
                </div>
                <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
                  {formatTime(currentTime)} / {formatTime(duration)} • {screenshots.length} items detected
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  >
                    {progress > 5 && `${progress.toFixed(0)}%`}
                  </div>
                </div>
              </div>
            )}

            {screenshots.length > 0 && (
              <div className="screenshots-section">
                <div className="screenshots-header">
                  <h2>Detected Items ({screenshots.length})</h2>
                  <button
                    className="btn btn-primary btn-small"
                    onClick={handleDownloadAll}
                    disabled={screenshots.length === 0}
                  >
                    📥 Download All
                  </button>
                </div>

                {screenshots.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">🖼️</div>
                    <p>No screenshots yet. Start processing your video!</p>
                  </div>
                ) : (
                  <div className="screenshots-grid">
                    {screenshots.map((screenshot) => {
                      const clarityIndex = getClarityIndex(screenshot.blurScore);
                      const clarityColor = getClarityColor(clarityIndex);
                      return (
                        <div key={screenshot.id} className="screenshot-card" style={{ position: 'relative' }}>
                          <div style={{
                            position: 'absolute',
                            top: '10px',
                            left: '10px',
                            background: 'rgba(0, 0, 0, 0.7)',
                            color: clarityColor,
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                            zIndex: 10,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            backdropFilter: 'blur(4px)'
                          }}>
                            <span>📊</span>
                            <span>Clarity: {clarityIndex}%</span>
                            {screenshot.blurScore && (
                              <span style={{ 
                                fontSize: '0.75rem', 
                                opacity: 0.8,
                                color: '#fff'
                              }}>
                                ({Math.round(screenshot.blurScore)})
                              </span>
                            )}
                          </div>
                          <img
                            src={screenshot.dataUrl}
                            alt={`Clothing item at ${formatTime(screenshot.timestamp)}`}
                            className="screenshot-image"
                          />
                          <div className="screenshot-overlay">
                            <div className="screenshot-actions">
                              <button
                                className="btn btn-primary btn-small"
                                onClick={() => handleDownload(screenshot)}
                              >
                                📥 Download
                              </button>
                            </div>
                          </div>
                          <div className="screenshot-info">
                            <div className="screenshot-time">
                              Time: {formatTime(screenshot.timestamp)}
                            </div>
                            {screenshot.blurScore !== undefined && (
                              <div style={{
                                fontSize: '0.75rem',
                                color: clarityColor,
                                marginTop: '4px',
                                fontWeight: 600
                              }}>
                                Quality: {clarityIndex >= 70 ? 'Excellent' : 
                                         clarityIndex >= 50 ? 'Good' : 
                                         clarityIndex >= 30 ? 'Fair' : 'Poor'}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;

