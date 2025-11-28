import * as cocoSsd from '@tensorflow-models/coco-ssd';

export interface Screenshot {
  id: string;
  dataUrl: string;
  timestamp: number;
  frameNumber: number;
}

let model: cocoSsd.ObjectDetection | null = null;

/**
 * Load the COCO-SSD model (only loads once)
 */
async function loadModel(): Promise<cocoSsd.ObjectDetection> {
  if (!model) {
    try {
      console.log('Loading TensorFlow.js model...');
      model = await cocoSsd.load();
      console.log('Model loaded successfully!');
    } catch (error) {
      console.error('Failed to load TensorFlow.js model:', error);
      throw new Error(
        `Failed to load AI model: ${error instanceof Error ? error.message : String(error)}\n` +
        `Make sure you have installed dependencies with: npm install`
      );
    }
  }
  return model;
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
 * Detect objects in a frame using TensorFlow.js
 */
async function detectObjects(
  model: cocoSsd.ObjectDetection,
  canvas: HTMLCanvasElement
): Promise<cocoSsd.DetectedObject[]> {
  try {
    const predictions = await model.detect(canvas);
    return predictions;
  } catch (error) {
    console.error('Error detecting objects:', error);
    return [];
  }
}

/**
 * Calculate similarity between two sets of object detections
 */
function calculateObjectSimilarity(
  objects1: cocoSsd.DetectedObject[],
  objects2: cocoSsd.DetectedObject[]
): number {
  // If object counts are very different, it's a significant change
  if (objects1.length === 0 && objects2.length === 0) return 1.0;
  if (objects1.length === 0 || objects2.length === 0) return 0.0;

  // Calculate overlap of bounding boxes
  let totalOverlap = 0;
  const usedIndices = new Set<number>();

  for (const obj1 of objects1) {
    let bestOverlap = 0;
    let bestIndex = -1;

    for (let i = 0; i < objects2.length; i++) {
      if (usedIndices.has(i)) continue;

      const obj2 = objects2[i];
      const overlap = calculateBoxOverlap(obj1.bbox, obj2.bbox);
      if (overlap > bestOverlap && obj1.class === obj2.class) {
        bestOverlap = overlap;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0) {
      usedIndices.add(bestIndex);
      totalOverlap += bestOverlap;
    }
  }

  // Normalize by average count
  const avgCount = (objects1.length + objects2.length) / 2;
  return avgCount > 0 ? totalOverlap / avgCount : 0;
}

/**
 * Calculate overlap between two bounding boxes (IoU - Intersection over Union)
 */
function calculateBoxOverlap(
  box1: [number, number, number, number],
  box2: [number, number, number, number]
): number {
  const [x1, y1, w1, h1] = box1;
  const [x2, y2, w2, h2] = box2;

  const x1_end = x1 + w1;
  const y1_end = y1 + h1;
  const x2_end = x2 + w2;
  const y2_end = y2 + h2;

  const interX1 = Math.max(x1, x2);
  const interY1 = Math.max(y1, y2);
  const interX2 = Math.min(x1_end, x2_end);
  const interY2 = Math.min(y1_end, y2_end);

  if (interX2 <= interX1 || interY2 <= interY1) return 0;

  const interArea = (interX2 - interX1) * (interY2 - interY1);
  const box1Area = w1 * h1;
  const box2Area = w2 * h2;
  const unionArea = box1Area + box2Area - interArea;

  return unionArea > 0 ? interArea / unionArea : 0;
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

    const timeoutId = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      video.removeEventListener('seeked', handleSeeked);
      resolve();
    }, 1000);

    video.addEventListener('seeked', handleSeeked, { once: true });
    video.currentTime = time;
  });
}

/**
 * Process video to detect individual clothing items using TensorFlow.js
 */
export async function processVideo(
  video: HTMLVideoElement,
  onProgress: (progress: number, currentTime: number, duration: number) => void,
  onScreenshot: (screenshot: Screenshot) => void
): Promise<Screenshot[]> {
  // Load model first with better error handling
  let model: cocoSsd.ObjectDetection;
  try {
    console.log('Loading ML model...');
    model = await loadModel();
    console.log('ML model ready!');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`Model loading failed: ${errorMsg}`);
  }

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

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const duration = video.duration;
  if (!duration || !isFinite(duration)) {
    throw new Error('Invalid video duration');
  }

  // Pause video
  video.pause();

  let lastObjects: cocoSsd.DetectedObject[] = [];
  let frameNumber = 0;
  let lastScreenshotTime = -1;
  
  // Minimum time between screenshots (in seconds) to avoid duplicates
  const MIN_SCREENSHOT_INTERVAL = 1.0;
  
  // Threshold for detecting significant changes (0-1, lower = more sensitive)
  const CHANGE_THRESHOLD = 0.5;

  // Sample video at regular intervals (slower for ML processing)
  const SAMPLE_INTERVAL = 0.5; // Sample every 500ms

  // Start from beginning
  await seekToTime(video, 0);

  let currentTime = 0;

  while (currentTime < duration - 0.1) {
    // Update progress
    const progress = (currentTime / duration) * 100;
    onProgress(Math.min(progress, 99.9), currentTime, duration);

    // Wait for frame to be ready
    await new Promise(resolve => setTimeout(resolve, 50));

    // Draw current frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Detect objects in current frame
    const currentObjects = await detectObjects(model, canvas);
    
    frameNumber++;

    // Always capture first frame
    if (screenshots.length === 0) {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const dataUrl = imageDataToDataUrl(imageData);
      const screenshot: Screenshot = {
        id: `screenshot-${Date.now()}-0`,
        dataUrl,
        timestamp: currentTime,
        frameNumber: 0
      };
      screenshots.push(screenshot);
      onScreenshot(screenshot);
      lastScreenshotTime = currentTime;
      lastObjects = currentObjects;
      console.log(`First frame captured at ${currentTime.toFixed(2)}s with ${currentObjects.length} objects`);
    }
    // Compare objects with previous frame
    else if (lastObjects.length > 0 || currentObjects.length > 0) {
      const similarity = calculateObjectSimilarity(lastObjects, currentObjects);
      
      // Debug logging
      if (frameNumber % 5 === 0) {
        console.log(
          `Frame ${frameNumber} at ${currentTime.toFixed(2)}s: ` +
          `${lastObjects.length} -> ${currentObjects.length} objects, ` +
          `similarity: ${similarity.toFixed(3)}`
        );
      }
      
      // If significant change detected (new objects appeared or objects changed)
      const hasSignificantChange = 
        similarity < CHANGE_THRESHOLD || // Objects changed significantly
        Math.abs(currentObjects.length - lastObjects.length) > 0; // Object count changed
      
      if (hasSignificantChange && 
          currentTime - lastScreenshotTime >= MIN_SCREENSHOT_INTERVAL) {
        
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const dataUrl = imageDataToDataUrl(imageData);
        const screenshot: Screenshot = {
          id: `screenshot-${Date.now()}-${frameNumber}`,
          dataUrl,
          timestamp: currentTime,
          frameNumber
        };

        screenshots.push(screenshot);
        onScreenshot(screenshot);
        lastScreenshotTime = currentTime;
        console.log(
          `New item detected at ${currentTime.toFixed(2)}s: ` +
          `${lastObjects.length} -> ${currentObjects.length} objects ` +
          `(similarity: ${similarity.toFixed(3)})`
        );
      }

      lastObjects = currentObjects;
    } else {
      lastObjects = currentObjects;
    }

    // Move to next sample point
    currentTime += SAMPLE_INTERVAL;
    
    if (currentTime < duration - 0.1) {
      await seekToTime(video, currentTime);
    }
  }

  // Capture final frame if needed
  await seekToTime(video, Math.max(0, duration - 0.1));
  await new Promise(resolve => setTimeout(resolve, 100));
  
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  if (screenshots.length > 0) {
    const lastScreenshot = screenshots[screenshots.length - 1];
    if (Math.abs(duration - lastScreenshot.timestamp) >= MIN_SCREENSHOT_INTERVAL) {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const dataUrl = imageDataToDataUrl(imageData);
      const screenshot: Screenshot = {
        id: `screenshot-${Date.now()}-${frameNumber + 1}`,
        dataUrl,
        timestamp: duration,
        frameNumber: frameNumber + 1
      };
      screenshots.push(screenshot);
      onScreenshot(screenshot);
    }
  }

  onProgress(100, duration, duration);
  console.log(`Processing complete! Detected ${screenshots.length} items.`);
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

