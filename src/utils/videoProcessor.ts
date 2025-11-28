export interface Screenshot {
  id: string;
  dataUrl: string;
  timestamp: number;
  frameNumber: number;
  blurScore?: number; // Laplacian variance score (higher = sharper)
}

export interface ProcessingOptions {
  changeThreshold: number; // 0-1, higher = less sensitive (requires bigger change)
  minScreenshotInterval: number; // seconds between screenshots
  sampleInterval: number; // seconds between frame samples
  motionSmoothing: number; // number of frames to average for motion detection
  stabilityWindow: number; // seconds to wait for stability after change detected
  stabilityThreshold: number; // max difference to consider frame stable
  minBlurThreshold: number; // minimum blur score (Laplacian variance) to accept frame
}

/**
 * Calculate histogram difference between frames (better for handling motion)
 * Uses multiple comparison methods for better accuracy
 */
function calculateHistogramDifference(frame1: ImageData, frame2: ImageData): number {
  if (frame1.width !== frame2.width || frame1.height !== frame2.height) {
    return 1;
  }

  const bins = 64; // More bins for better accuracy
  const hist1 = new Array(bins * 3).fill(0); // R, G, B histograms
  const hist2 = new Array(bins * 3).fill(0);

  const data1 = frame1.data;
  const data2 = frame2.data;
  const pixelCount = data1.length / 4;
  const sampleRate = Math.max(1, Math.floor(pixelCount / 10000)); // Sample ~10000 pixels

  // Build histograms with smart sampling
  for (let i = 0; i < data1.length; i += 4 * sampleRate) {
    // Use weighted bins for better color distribution
    const r1 = Math.min(bins - 1, Math.floor((data1[i] / 255) * bins));
    const g1 = Math.min(bins - 1, Math.floor((data1[i + 1] / 255) * bins));
    const b1 = Math.min(bins - 1, Math.floor((data1[i + 2] / 255) * bins));
    
    hist1[r1]++;
    hist1[bins + g1]++;
    hist1[bins * 2 + b1]++;

    const r2 = Math.min(bins - 1, Math.floor((data2[i] / 255) * bins));
    const g2 = Math.min(bins - 1, Math.floor((data2[i + 1] / 255) * bins));
    const b2 = Math.min(bins - 1, Math.floor((data2[i + 2] / 255) * bins));
    
    hist2[r2]++;
    hist2[bins + g2]++;
    hist2[bins * 2 + b2]++;
  }

  // Normalize histograms
  const total = Math.floor(data1.length / (4 * sampleRate));
  if (total > 0) {
    for (let i = 0; i < hist1.length; i++) {
      hist1[i] /= total;
      hist2[i] /= total;
    }
  }

  // Calculate multiple similarity metrics
  let intersection = 0;
  let chiSquare = 0;
  
  for (let i = 0; i < hist1.length; i++) {
    // Histogram intersection
    intersection += Math.min(hist1[i], hist2[i]);
    
    // Chi-square distance (more sensitive to changes)
    const sum = hist1[i] + hist2[i];
    if (sum > 0) {
      const diff = hist1[i] - hist2[i];
      chiSquare += (diff * diff) / sum;
    }
  }

  // Combine both metrics (weighted average)
  const intersectionDiff = 1 - intersection;
  const chiSquareDiff = Math.min(1, chiSquare / hist1.length);
  
  // Weighted combination - chi-square is more sensitive
  return (intersectionDiff * 0.4 + chiSquareDiff * 0.6);
}

/**
 * Calculate structural similarity using block-based comparison
 * Better for detecting objects appearing/disappearing
 */
function calculateStructuralDifference(frame1: ImageData, frame2: ImageData): number {
  const blockSize = 32; // Compare 32x32 blocks
  const width = frame1.width;
  const height = frame1.height;
  const blocksX = Math.floor(width / blockSize);
  const blocksY = Math.floor(height / blockSize);
  
  let totalDiff = 0;
  let blockCount = 0;
  
  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      let blockDiff = 0;
      let pixelCount = 0;
      
      // Compare pixels in this block
      for (let py = 0; py < blockSize && by * blockSize + py < height; py++) {
        for (let px = 0; px < blockSize && bx * blockSize + px < width; px++) {
          const x = bx * blockSize + px;
          const y = by * blockSize + py;
          const idx = (y * width + x) * 4;
          
          const r1 = frame1.data[idx];
          const g1 = frame1.data[idx + 1];
          const b1 = frame1.data[idx + 2];
          
          const r2 = frame2.data[idx];
          const g2 = frame2.data[idx + 1];
          const b2 = frame2.data[idx + 2];
          
          const diff = (Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2)) / (3 * 255);
          blockDiff += diff;
          pixelCount++;
        }
      }
      
      if (pixelCount > 0) {
        const avgBlockDiff = blockDiff / pixelCount;
        totalDiff += avgBlockDiff;
        blockCount++;
      }
    }
  }
  
  return blockCount > 0 ? totalDiff / blockCount : 0;
}

/**
 * Calculate the difference between two frames using hybrid method
 * Combines histogram and structural comparison for best results
 */
function calculateFrameDifference(
  frame1: ImageData, 
  frame2: ImageData,
  useHistogram: boolean = true
): number {
  if (frame1.width !== frame2.width || frame1.height !== frame2.height) {
    return 1;
  }

  if (useHistogram) {
    // Use both histogram and structural comparison
    const histDiff = calculateHistogramDifference(frame1, frame2);
    const structDiff = calculateStructuralDifference(frame1, frame2);
    
    // Combine both: histogram catches color changes, structural catches object changes
    // Weight structural more heavily as it's better for detecting new objects
    return (histDiff * 0.3 + structDiff * 0.7);
  }

  // Fallback to pixel comparison
  const data1 = frame1.data;
  const data2 = frame2.data;
  
  const SAMPLE_RATE = 16;
  let diff = 0;
  let totalPixels = 0;

  for (let i = 0; i < data1.length; i += 4 * SAMPLE_RATE) {
    const rDiff = Math.abs(data1[i] - data2[i]);
    const gDiff = Math.abs(data1[i + 1] - data2[i + 1]);
    const bDiff = Math.abs(data1[i + 2] - data2[i + 2]);
    
    const pixelDiff = (rDiff + gDiff + bDiff) / 3 / 255;
    diff += pixelDiff;
    totalPixels++;
  }

  return totalPixels > 0 ? diff / totalPixels : 0;
}

/**
 * Capture a frame from video at the current time
 */
export function captureFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): ImageData | null {
  const context = canvas.getContext('2d');
  if (!context) return null;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Calculate blur score using Laplacian variance
 * Higher score = sharper image, lower score = blurrier image
 */
function calculateBlurScore(imageData: ImageData): number {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  
  // Convert to grayscale and calculate Laplacian
  const laplacian: number[] = [];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      // Get grayscale values of 3x3 neighborhood
      const getGray = (dx: number, dy: number) => {
        const idx = ((y + dy) * width + (x + dx)) * 4;
        return (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
      };
      
      // Laplacian kernel: [[0, -1, 0], [-1, 4, -1], [0, -1, 0]]
      const center = getGray(0, 0);
      const top = getGray(0, -1);
      const bottom = getGray(0, 1);
      const left = getGray(-1, 0);
      const right = getGray(1, 0);
      
      const laplacianValue = Math.abs(4 * center - top - bottom - left - right);
      laplacian.push(laplacianValue);
    }
  }
  
  // Calculate variance of Laplacian
  if (laplacian.length === 0) return 0;
  
  const mean = laplacian.reduce((a, b) => a + b, 0) / laplacian.length;
  const variance = laplacian.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / laplacian.length;
  
  return variance;
}

/**
 * Convert ImageData to data URL (screenshot)
 */
export function imageDataToDataUrl(imageData: ImageData): string {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Wait for video to seek to a specific time
 */
function seekToTime(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < 0.01) {
      resolve();
      return;
    }

    let resolved = false;
    const handleSeeked = () => {
      if (resolved) return;
      resolved = true;
      video.removeEventListener('seeked', handleSeeked);
      clearTimeout(timeoutId);
      resolve();
    };

    // Timeout fallback in case seeked event doesn't fire
    const timeoutId = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      video.removeEventListener('seeked', handleSeeked);
      console.warn(`Seek timeout at ${time}s, continuing anyway`);
      resolve();
    }, 1000);

    video.addEventListener('seeked', handleSeeked, { once: true });
    video.currentTime = time;
  });
}

/**
 * Process video to detect individual clothing items
 */
export async function processVideo(
  video: HTMLVideoElement,
  onProgress: (progress: number, currentTime: number, duration: number) => void,
  onScreenshot: (screenshot: Screenshot) => void,
  options: Partial<ProcessingOptions> = {}
): Promise<Screenshot[]> {
  // Default options - more sensitive defaults
  const opts: ProcessingOptions = {
    changeThreshold: options.changeThreshold ?? 0.12, // Default 12% change required
    minScreenshotInterval: options.minScreenshotInterval ?? 1.0, // 1 second between screenshots
    sampleInterval: options.sampleInterval ?? 0.2, // Sample every 200ms
    motionSmoothing: options.motionSmoothing ?? 3, // Average over 3 frames
    stabilityWindow: options.stabilityWindow ?? 0.5, // Wait 0.5s for stability
    stabilityThreshold: options.stabilityThreshold ?? 0.05, // 5% max difference for stability
    minBlurThreshold: options.minBlurThreshold ?? 100, // Minimum blur score (adjust based on video quality)
  };
  // Wait for video to be ready
  if (!video.readyState || video.readyState < 2) {
    await new Promise<void>((resolve) => {
      video.addEventListener('loadeddata', () => resolve(), { once: true });
    });
  }

  const screenshots: Screenshot[] = [];
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) {
    throw new Error('Could not get canvas context');
  }

  if (!video.videoWidth || !video.videoHeight) {
    throw new Error('Video dimensions not available');
  }

  const duration = video.duration;
  if (!duration || !isFinite(duration)) {
    throw new Error('Invalid video duration');
  }

  // Pause video
  video.pause();

  let baselineFrame: ImageData | null = null; // Stable baseline frame to compare against
  let frameNumber = 0;
  let lastScreenshotTime = -1;
  
  // Keep history of recent frame differences for smoothing
  const recentDifferences: number[] = [];
  let changeDetectedAt: number | null = null;
  let stableFrames: Array<{ time: number; frame: ImageData; stability: number; blurScore: number }> = [];
  
  console.log(`Processing with options:`, opts);

  // Start from beginning with small offset to let video stabilize
  await seekToTime(video, 0.1); // Skip first 100ms
  await new Promise(resolve => setTimeout(resolve, 100));

  let currentTime = 0.1;

  // Capture first baseline frame
  const firstFrame = captureFrame(video, canvas);
  if (firstFrame) {
    baselineFrame = firstFrame;
    frameNumber++;
    
    // Wait a bit and capture first stable frame
    await seekToTime(video, 0.1 + opts.stabilityWindow);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const stableFrame = captureFrame(video, canvas);
    if (stableFrame) {
      const blurScore = calculateBlurScore(stableFrame);
      const dataUrl = imageDataToDataUrl(stableFrame);
      const screenshot: Screenshot = {
        id: `screenshot-${Date.now()}-0`,
        dataUrl,
        timestamp: 0.1 + opts.stabilityWindow,
        frameNumber: 0,
        blurScore: blurScore
      };
      screenshots.push(screenshot);
      onScreenshot(screenshot);
      lastScreenshotTime = 0.1 + opts.stabilityWindow;
      baselineFrame = stableFrame;
      console.log(`First frame captured at ${(0.1 + opts.stabilityWindow).toFixed(2)}s`);
    }
  }

  currentTime = 0.1 + opts.stabilityWindow + opts.sampleInterval;

  while (currentTime < duration - 0.1) {
    // Update progress
    const progress = (currentTime / duration) * 100;
    onProgress(Math.min(progress, 99.9), currentTime, duration);

    // Wait for frame to be ready after seek
    await new Promise(resolve => setTimeout(resolve, 50));

    // Capture current frame
    const currentFrame = captureFrame(video, canvas);
    
    if (currentFrame && baselineFrame) {
      frameNumber++;
      const difference = calculateFrameDifference(baselineFrame, currentFrame, true);
      
      // Add to recent differences for smoothing
      recentDifferences.push(difference);
      if (recentDifferences.length > opts.motionSmoothing) {
        recentDifferences.shift();
      }
      
      // Calculate smoothed difference
      const smoothedDifference = recentDifferences.reduce((a, b) => a + b, 0) / recentDifferences.length;
      
      // Debug logging
      if (frameNumber % 10 === 0) {
        const blurScore = calculateBlurScore(currentFrame);
        console.log(
          `Frame ${frameNumber} at ${currentTime.toFixed(2)}s: ` +
          `diff=${difference.toFixed(3)}, smoothed=${smoothedDifference.toFixed(3)}, ` +
          `threshold=${opts.changeThreshold.toFixed(3)}, blur=${blurScore.toFixed(1)}/${opts.minBlurThreshold}`
        );
      }
      
      // Check if frame is stable (low variation from baseline)
      const isStable = difference < opts.stabilityThreshold;
      
      if (isStable && !changeDetectedAt) {
        // Calculate blur score for this frame
        const blurScore = calculateBlurScore(currentFrame);
        
        // Only store frames that are not too blurry
        if (blurScore >= opts.minBlurThreshold) {
          stableFrames.push({
            time: currentTime,
            frame: currentFrame,
            stability: difference,
            blurScore: blurScore
          });
          
          // Keep only recent stable frames (keep best ones)
          if (stableFrames.length > 5) {
            // Sort by blur score (highest = sharpest) and keep best
            stableFrames.sort((a, b) => b.blurScore - a.blurScore);
            stableFrames = stableFrames.slice(0, 5);
          }
        } else {
          console.log(`Frame at ${currentTime.toFixed(2)}s rejected: too blurry (score: ${blurScore.toFixed(1)})`);
        }
      }
      
      // Detect significant change from baseline
      const isSignificantChange = smoothedDifference > opts.changeThreshold || 
                                 difference > opts.changeThreshold * 1.5;
      
      if (isSignificantChange && !changeDetectedAt) {
        // Change detected - mark time and wait for stability
        changeDetectedAt = currentTime;
        stableFrames = []; // Clear old stable frames
        console.log(`Change detected at ${currentTime.toFixed(2)}s (diff: ${difference.toFixed(3)})`);
      }
      
      // After change detected, wait for stability window
      if (changeDetectedAt && (currentTime - changeDetectedAt) >= opts.stabilityWindow) {
        // Find the best frame in the window (prioritize sharpness over stability)
        if (stableFrames.length > 0 && currentTime - lastScreenshotTime >= opts.minScreenshotInterval) {
          // Sort by blur score first (highest = sharpest), then by stability
          stableFrames.sort((a, b) => {
            // Prioritize sharpness, but also consider stability
            const scoreA = a.blurScore * 0.7 + (1 - a.stability) * 0.3;
            const scoreB = b.blurScore * 0.7 + (1 - b.stability) * 0.3;
            return scoreB - scoreA;
          });
          const bestFrame = stableFrames[0];
          
          const dataUrl = imageDataToDataUrl(bestFrame.frame);
          const screenshot: Screenshot = {
            id: `screenshot-${Date.now()}-${frameNumber}`,
            dataUrl,
            timestamp: bestFrame.time,
            frameNumber,
            blurScore: bestFrame.blurScore
          };

          screenshots.push(screenshot);
          onScreenshot(screenshot);
          lastScreenshotTime = bestFrame.time;
          
          // Update baseline to new stable frame
          baselineFrame = bestFrame.frame;
          
          console.log(
            `Sharp frame captured at ${bestFrame.time.toFixed(2)}s ` +
            `(blur score: ${bestFrame.blurScore.toFixed(1)}, stability: ${bestFrame.stability.toFixed(3)})`
          );
        } else if (stableFrames.length === 0 && currentTime - lastScreenshotTime >= opts.minScreenshotInterval) {
          // Fallback: no stable frame found, check if current frame is sharp enough
          const blurScore = calculateBlurScore(currentFrame);
          if (blurScore >= opts.minBlurThreshold) {
            const dataUrl = imageDataToDataUrl(currentFrame);
            const screenshot: Screenshot = {
              id: `screenshot-${Date.now()}-${frameNumber}`,
              dataUrl,
              timestamp: currentTime,
              frameNumber,
              blurScore: blurScore
            };

            screenshots.push(screenshot);
            onScreenshot(screenshot);
            lastScreenshotTime = currentTime;
            baselineFrame = currentFrame;
            
            console.log(
              `Frame captured at ${currentTime.toFixed(2)}s ` +
              `(blur score: ${blurScore.toFixed(1)}, no stable frame found)`
            );
          } else {
            console.log(
              `Frame at ${currentTime.toFixed(2)}s rejected: too blurry ` +
              `(score: ${blurScore.toFixed(1)}, threshold: ${opts.minBlurThreshold})`
            );
          }
        }
        
        // Reset for next detection
        changeDetectedAt = null;
        stableFrames = [];
        recentDifferences.length = 0;
        
        // Skip ahead a bit to avoid re-detecting same change
        currentTime += opts.minScreenshotInterval * 0.5;
        continue;
      }
    }

    // Move to next sample point
    currentTime += opts.sampleInterval;
    
    if (currentTime < duration - 0.1) {
      await seekToTime(video, currentTime);
    }
  }

  // Handle any pending change detection
  if (changeDetectedAt && stableFrames.length > 0) {
    stableFrames.sort((a, b) => {
      const scoreA = a.blurScore * 0.7 + (1 - a.stability) * 0.3;
      const scoreB = b.blurScore * 0.7 + (1 - b.stability) * 0.3;
      return scoreB - scoreA;
    });
    const bestFrame = stableFrames[0];
    
    if (bestFrame.time - lastScreenshotTime >= opts.minScreenshotInterval) {
      const dataUrl = imageDataToDataUrl(bestFrame.frame);
      const screenshot: Screenshot = {
        id: `screenshot-${Date.now()}-${frameNumber}`,
        dataUrl,
        timestamp: bestFrame.time,
        frameNumber,
        blurScore: bestFrame.blurScore
      };
      screenshots.push(screenshot);
      onScreenshot(screenshot);
    }
  }
  
  // Capture final frame if needed (only if sharp enough)
  await seekToTime(video, Math.max(0, duration - 0.1));
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const finalFrame = captureFrame(video, canvas);
  if (finalFrame) {
    const blurScore = calculateBlurScore(finalFrame);
    
    if (screenshots.length > 0) {
      const lastScreenshot = screenshots[screenshots.length - 1];
      if (Math.abs(duration - lastScreenshot.timestamp) >= opts.minScreenshotInterval && 
          blurScore >= opts.minBlurThreshold) {
        const dataUrl = imageDataToDataUrl(finalFrame);
        const screenshot: Screenshot = {
          id: `screenshot-${Date.now()}-${frameNumber + 1}`,
          dataUrl,
          timestamp: duration - 0.1,
          frameNumber: frameNumber + 1,
          blurScore: blurScore
        };
        screenshots.push(screenshot);
        onScreenshot(screenshot);
      }
    } else if (blurScore >= opts.minBlurThreshold) {
      // No screenshots at all, capture final frame if sharp enough
      const dataUrl = imageDataToDataUrl(finalFrame);
      const screenshot: Screenshot = {
        id: `screenshot-${Date.now()}-final`,
        dataUrl,
        timestamp: duration - 0.1,
        frameNumber: 0,
        blurScore: blurScore
      };
      screenshots.push(screenshot);
      onScreenshot(screenshot);
    }
  }

  onProgress(100, duration, duration);
  return screenshots;
}

/**
 * Format time in seconds to MM:SS format
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get clarity index from blur score (0-100 scale)
 */
export function getClarityIndex(blurScore: number | undefined): number {
  if (!blurScore) return 0;
  // Normalize blur score to 0-100 scale
  // Assuming blur scores typically range from 0-300 for practical purposes
  return Math.min(100, Math.round((blurScore / 300) * 100));
}

/**
 * Get color for clarity index badge
 */
export function getClarityColor(clarityIndex: number): string {
  if (clarityIndex >= 70) {
    return '#22c55e'; // Green - excellent
  } else if (clarityIndex >= 50) {
    return '#eab308'; // Yellow - good
  } else if (clarityIndex >= 30) {
    return '#f59e0b'; // Orange - fair
  } else {
    return '#ef4444'; // Red - poor
  }
}

