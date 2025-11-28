# 👕 Clothes Video Parser

A React application that processes videos containing multiple clothing items shown one by one, automatically detecting each item and extracting screenshots.

## 🎯 Features

- **Video Upload**: Drag and drop or click to upload video files
- **AI-Powered Detection**: Uses TensorFlow.js with COCO-SSD model to detect clothing items using object detection
- **Smart Object Tracking**: Detects when new objects appear or existing objects change significantly
- **Screenshot Extraction**: Captures high-quality screenshots of each detected item
- **Download Options**: Download individual screenshots or all at once
- **Progress Tracking**: Real-time progress indicator during video processing
- **Modern UI**: Beautiful, responsive interface with smooth animations

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`)

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## 📖 How to Use

1. **Upload a Video**: 
   - Drag and drop a video file onto the upload area, or
   - Click the upload area to browse and select a video file

2. **Preview**: 
   - The video will appear with standard video controls
   - You can play/pause and scrub through the video

3. **Process**: 
   - Click the "Start Processing" button
   - The app will analyze the video frame-by-frame
   - Progress is shown in real-time

4. **View Results**: 
   - Each detected clothing item appears as a screenshot in the gallery
   - Screenshots are organized by the time they appear in the video

5. **Download**: 
   - Click on any screenshot to download it individually
   - Or use "Download All" to get all screenshots at once

## 🔧 How It Works

The app uses TensorFlow.js AI for intelligent object detection:

1. **Model Loading**: Loads the COCO-SSD pre-trained object detection model (first time only)
2. **Frame Sampling**: Samples the video at regular intervals (every 500ms)
3. **Object Detection**: Uses TensorFlow.js to detect objects in each frame
4. **Object Comparison**: Compares detected objects between frames using bounding box overlap (IoU)
5. **Change Detection**: When new objects appear or objects change significantly, captures a screenshot
6. **Screenshot Extraction**: Captures a screenshot of the frame with the new item
7. **Deduplication**: Ensures screenshots are at least 1 second apart to avoid duplicates

## ⚙️ Customization

You can adjust the detection sensitivity in `src/utils/videoProcessorML.ts`:

- `CHANGE_THRESHOLD`: Object similarity threshold (0-1). Lower values = more sensitive. Default: 0.5
- `MIN_SCREENSHOT_INTERVAL`: Minimum time between screenshots in seconds. Default: 1.0
- `SAMPLE_INTERVAL`: How often to sample frames in seconds. Default: 0.5 (500ms) - slower for ML processing

## 🎨 Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **TensorFlow.js** - Machine learning framework
- **COCO-SSD** - Pre-trained object detection model
- **HTML5 Canvas** - Video frame processing

## 📝 Notes

- The app processes videos entirely in the browser - no data is sent to any server
- The TensorFlow.js model is downloaded on first use (~25MB) - this may take a minute
- Large video files may take some time to process (ML processing is slower but more accurate)
- For best results, use videos where items are held still for at least 1-2 seconds each
- The AI detection works best with clear, well-lit videos showing objects clearly
- Processing uses GPU acceleration when available for faster performance

## 🤝 Contributing

Feel free to submit issues or pull requests!

## 📄 License

MIT

