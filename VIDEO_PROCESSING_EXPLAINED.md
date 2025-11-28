# 🎥 Video Processing Algorithm - Detailed Explanation

## Overview

The simple video processing algorithm detects when new clothing items appear in a video by:
1. **Comparing frames** to detect when something significantly changes
2. **Waiting for stability** to avoid capturing blurry/moving frames
3. **Filtering blurry images** to only keep sharp screenshots
4. **Finding the best frame** using interpolation

---

## Step-by-Step Process with Example

Let's say you have a 10-second video showing 3 clothing items:

### **Video Timeline:**
```
0s ────[Item 1]──── 2s ────[Transition]──── 3s ────[Item 2]──── 7s ────[Transition]──── 8s ────[Item 3]──── 10s
```

---

## Phase 1: Initial Setup

### 1.1 Starting Position
```javascript
// Skip first 100ms (let video stabilize)
currentTime = 0.1 seconds
baselineFrame = first frame at 0.1s
```

**What happens:**
- Video is paused
- We seek to 0.1 seconds (skipping the very start)
- Capture the first frame → this becomes our **baseline** for comparison

**Example:**
- Baseline frame = Frame showing the first clothing item

---

### 1.2 First Screenshot
```javascript
// Wait 0.5s (stability window) then capture
wait until 0.6s (0.1 + 0.5)
capture frame at 0.6s → First screenshot!
```

**What happens:**
- Wait 0.5 seconds for the video to stabilize on the first item
- Capture the frame at 0.6 seconds
- This becomes the first screenshot

**Example:**
- ✅ Screenshot #1 captured at 0.6s: "Red T-Shirt"

---

## Phase 2: Main Detection Loop

The algorithm now samples the video every **0.2 seconds** (200ms intervals).

### Step 2.1: Sample Frame at Regular Intervals

```javascript
currentTime = 0.8s  → Sample frame
currentTime = 1.0s  → Sample frame
currentTime = 1.2s  → Sample frame
currentTime = 1.4s  → Sample frame
...
```

**What happens:**
- Every 0.2 seconds, we capture a frame
- Compare it to the **baseline frame** (not the previous frame!)
- This is important: we compare to the last **stable** frame we captured

---

### Step 2.2: Frame Comparison (Two Methods)

For each sampled frame, we calculate **how different** it is from the baseline:

#### **Method A: Histogram Comparison** (Color Distribution)
```
Baseline Frame:  [Red: 30%, Blue: 20%, Green: 50%]
Current Frame:   [Red: 35%, Blue: 25%, Green: 40%]
Difference:      12% (significant change detected!)
```

**What it measures:**
- How the **color distribution** changed
- Good for detecting when a different colored item appears

#### **Method B: Structural Comparison** (Block-by-Block)
```
Divide frame into 32x32 pixel blocks
Compare each block: Is there a big object in a new position?
```

**What it measures:**
- Whether objects appeared/disappeared
- Better at detecting new items even with similar colors

#### **Combined Score:**
```javascript
finalDifference = (histogramDifference * 0.3) + (structuralDifference * 0.7)
// Structural is weighted more (70%) because it's better for object detection
```

---

### Step 2.3: Change Detection

```javascript
if (difference > changeThreshold) {
  // CHANGE DETECTED! New item appearing
  changeDetectedAt = currentTime
}
```

**Example Timeline:**

```
Time:  0.8s    1.0s    1.2s    1.4s    1.6s    1.8s    2.0s    2.2s
Diff:  2%      3%      5%      8%      15%     ✅ CHANGE! (15% > 12% threshold)
       └─────────────────────────────────┘
       Small variations (hand movement, camera shake)
```

**What happens:**
- From 0.8s to 1.6s: Small differences (2-8%) → just motion, same item
- At 1.8s: Difference jumps to 15% → **CHANGE DETECTED!**
- New clothing item is being shown!

---

### Step 2.4: Stability Window (The Key Innovation!)

Once change is detected, we **wait and collect stable frames**:

```javascript
changeDetectedAt = 1.8s
// Now wait 0.5 seconds (stability window)
// Collect frames that are STABLE (not moving)
```

**Example:**

```
Time:  1.8s ────[CHANGE DETECTED]────
       2.0s ────[Collecting frames...]
       2.2s ────[Frame: stable, blur=150 ✅]
       2.3s ────[Frame: stable, blur=180 ✅] ← Sharpest!
       2.4s ────[Frame: stable, blur=120 ✅]
       2.5s ────[Window ends, pick best frame]
```

**What happens:**
- After detecting change at 1.8s, we wait 0.5 seconds (until 2.3s)
- During this window, we collect frames that are:
  1. **Stable**: Similar to each other (difference < 5%)
  2. **Sharp**: Blur score > 100 (not blurry)

---

### Step 2.5: Blur Detection (Quality Filter)

For each frame, we calculate a **blur score**:

```javascript
blurScore = calculateBlurScore(frame)
// Uses Laplacian variance - detects how sharp edges are
```

**How it works:**
```
Sharp Frame:    [Clear edges] → High variance → Score: 250 ✅
Blurry Frame:   [Soft edges]  → Low variance  → Score: 45  ❌
```

**Example:**
```
Frame at 2.2s: blurScore = 150 ✅ (sharp enough)
Frame at 2.3s: blurScore = 180 ✅ (sharper! - best one)
Frame at 2.4s: blurScore = 120 ✅ (acceptable)
Frame at 2.5s: blurScore = 85  ❌ (too blurry, rejected)
```

**Result:**
- Frame at 2.3s is selected (highest blur score = sharpest)

---

### Step 2.6: Interpolation - Finding the Best Frame

After collecting stable frames, we pick the **best one**:

```javascript
stableFrames = [
  { time: 2.2s, blurScore: 150, stability: 0.03 },
  { time: 2.3s, blurScore: 180, stability: 0.02 }, ← Best!
  { time: 2.4s, blurScore: 120, stability: 0.04 }
]

// Sort by combined score:
score = blurScore * 0.7 + (1 - stability) * 0.3
// Prioritize sharpness (70%) but also consider stability (30%)

bestFrame = stableFrames[0] // Frame at 2.3s
```

**Why this works:**
- Instead of capturing the exact moment change is detected (likely blurry)
- We wait for the item to be held still
- We pick the sharpest, most stable frame

---

### Step 2.7: Capture Screenshot

```javascript
Screenshot #2 captured at 2.3s: "Blue Jeans"
baselineFrame = frame at 2.3s (update baseline!)
```

**What happens:**
- Take screenshot of the best frame (2.3s)
- Update baseline → now we compare future frames to this new item
- Skip ahead 0.5s to avoid re-detecting the same change

---

## Phase 3: Repeat for All Items

The process repeats:

```
Baseline: Item 2 (Blue Jeans)

Time:  4.0s    4.2s    4.4s    4.6s    4.8s    5.0s    5.2s
Diff:  3%      5%      7%      14%     ✅ CHANGE!

       [Wait 0.5s stability window]
       5.4s ────[Collecting stable frames...]
       5.5s ────[Best frame: blur=200 ✅]
       5.6s ────[Window ends]

Screenshot #3 captured at 5.5s: "Green Shirt"
```

---

## Complete Example Timeline

Here's a complete example for a 10-second video with 3 items:

```
Time  | Action                          | Result
------|---------------------------------|------------------
0.1s  | Start, capture baseline        | Baseline = Item 1
0.6s  | First screenshot               | ✅ Screenshot #1 (Item 1)
0.8s  | Sample frame, compare          | Diff: 2% (no change)
1.0s  | Sample frame, compare          | Diff: 3% (no change)
1.2s  | Sample frame, compare          | Diff: 5% (no change)
1.4s  | Sample frame, compare          | Diff: 8% (no change)
1.6s  | Sample frame, compare          | Diff: 10% (no change)
1.8s  | Sample frame, compare          | Diff: 15% ✅ CHANGE!
1.8s  | Change detected, start window  | Collecting stable frames...
2.0s  | Collect stable frame           | blur=150, stable ✅
2.2s  | Collect stable frame           | blur=180, stable ✅ (best)
2.3s  | Window ends, pick best         | 
2.3s  | Capture screenshot             | ✅ Screenshot #2 (Item 2)
2.3s  | Update baseline                | Baseline = Item 2
2.8s  | Skip ahead, resume sampling    |
3.0s  | Sample frame, compare          | Diff: 3% (no change)
3.2s  | Sample frame, compare          | Diff: 4% (no change)
...
4.8s  | Sample frame, compare          | Diff: 16% ✅ CHANGE!
4.8s  | Change detected, start window  | Collecting stable frames...
5.0s  | Collect stable frame           | blur=200, stable ✅ (best)
5.2s  | Collect stable frame           | blur=180, stable ✅
5.3s  | Window ends, pick best         |
5.3s  | Capture screenshot             | ✅ Screenshot #3 (Item 3)
5.3s  | Update baseline                | Baseline = Item 3
...
10s   | End of video                   | Done!
```

---

## Key Algorithms Explained

### 1. **Histogram Comparison**

**What it does:**
Counts how many pixels of each color exist in the frame.

**Example:**
```
Frame 1 (Red shirt):
  Red pixels:    30,000
  Blue pixels:   5,000
  Green pixels:  15,000
  Total:         50,000
  
  Histogram: [Red: 60%, Blue: 10%, Green: 30%]

Frame 2 (Blue jeans):
  Red pixels:    8,000
  Blue pixels:   35,000
  Green pixels:  7,000
  Total:         50,000
  
  Histogram: [Red: 16%, Blue: 70%, Green: 14%]

Difference = How much the color distribution changed
          = 44% (big change = new item!)
```

### 2. **Structural Comparison**

**What it does:**
Divides frame into blocks and compares each block.

**Example:**
```
Frame divided into 20x15 = 300 blocks (each 32x32 pixels)

Block at (100, 100): 
  Frame 1: Has red object
  Frame 2: Has blue object
  → Block difference: High

Total difference = Average of all block differences
                 = 18% (big change = new item!)
```

### 3. **Blur Detection (Laplacian Variance)**

**What it does:**
Measures how sharp the edges are in the image.

**Example:**
```
Sharp image (holding still):
  Edge detection finds: 5,000 clear edges
  Variance: 250
  → High score = sharp ✅

Blurry image (moving):
  Edge detection finds: 1,000 soft edges
  Variance: 45
  → Low score = blurry ❌
```

### 4. **Stability Detection**

**What it does:**
Checks if frames are similar to each other (not moving).

**Example:**
```
Frame at 2.0s vs Frame at 2.2s:
  Difference: 3% (very similar)
  → Stable ✅ (item is being held still)

Frame at 1.0s vs Frame at 1.2s:
  Difference: 25% (very different)
  → Not stable ❌ (item is moving)
```

---

## Configuration Parameters

You can adjust these in the UI:

### **Change Threshold (10-50%)**
- **Lower (10%)**: Detects smaller changes → more screenshots
- **Higher (40%)**: Requires bigger changes → fewer screenshots
- **Default: 12%** - Good balance

### **Minimum Screenshot Interval (0.5-3 seconds)**
- **Lower (0.5s)**: Screenshots can be closer together
- **Higher (3s)**: Forces more time between screenshots
- **Default: 1.0s** - Prevents duplicate screenshots

### **Stability Window (0.3-1.0 seconds)**
- **Lower (0.3s)**: Faster detection, might miss best frame
- **Higher (1.0s)**: More time to find perfect frame
- **Default: 0.5s** - Good balance

### **Blur Threshold (50-300)**
- **Lower (50)**: Accepts slightly blurry images
- **Higher (200)**: Only very sharp images
- **Default: 100** - Filters most blurry frames

---

## Why This Approach Works

### ✅ **Compares to Baseline, Not Previous Frame**
- Previous approach: Compared frame-by-frame → detected every small movement
- New approach: Compares to last **stable** frame → only detects new items

### ✅ **Waits for Stability**
- Previous approach: Captured immediately when change detected → blurry!
- New approach: Waits 0.5s after change → captures when item is held still

### ✅ **Filters Blurry Images**
- Previous approach: Captured blurry frames during movement
- New approach: Only keeps frames with blur score > 100

### ✅ **Uses Interpolation**
- Previous approach: Single frame capture
- New approach: Collects multiple frames, picks the best one

---

## Example Output

For a video showing 3 items over 10 seconds:

```
Processing video...
  Frame 12 at 0.80s: diff=0.020, smoothed=0.015, threshold=0.120
  Frame 14 at 1.00s: diff=0.030, smoothed=0.025, threshold=0.120
  Frame 16 at 1.20s: diff=0.050, smoothed=0.035, threshold=0.120
  Change detected at 1.80s (diff: 0.150, smoothed: 0.120)
  Frame at 2.20s rejected: too blurry (score: 45.2)
  Frame at 2.30s: blur=180, stable ✅
  Sharp frame captured at 2.30s (blur score: 180.5, stability: 0.023)
  
  ✅ Screenshot #2 captured (Item 2)
  
  Frame 28 at 4.80s: diff=0.160, smoothed=0.140, threshold=0.120
  Change detected at 4.80s (diff: 0.160, smoothed: 0.140)
  Sharp frame captured at 5.30s (blur score: 195.2, stability: 0.018)
  
  ✅ Screenshot #3 captured (Item 3)
  
Processing complete! Detected 3 items.
```

---

## Summary

The algorithm is like a **smart photographer** that:
1. 👀 **Watches** for when a new item appears (change detection)
2. ⏳ **Waits** for the item to be held still (stability window)
3. 📸 **Finds** the sharpest, clearest frame (blur detection + interpolation)
4. 💾 **Captures** only the best screenshots
5. 🔄 **Repeats** for each new item

This ensures you get **clean, sharp screenshots** of each clothing item, not blurry images during movement!

