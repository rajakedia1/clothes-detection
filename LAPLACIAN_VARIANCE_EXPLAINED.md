# 🔍 Laplacian Variance - How Blur Detection Works

## Overview

Laplacian variance is a method to measure how **sharp** or **blurry** an image is by analyzing the edges in the image. The idea is simple:

- **Sharp images** have clear, defined edges → High variance
- **Blurry images** have soft, fuzzy edges → Low variance

---

## What is the Laplacian Operator?

The Laplacian is a mathematical operator that detects **edges** (places where brightness changes quickly) in an image.

### Visual Concept

Think of an edge as a sudden change in brightness:

```
Sharp Edge (Sharp Image):
━━━━━━━━━━━━━━━━━━━━
  Dark  │  Light
━━━━━━━━━━━━━━━━━━━━
     ↑ Sudden change = Strong edge

Blurry Edge (Blurry Image):
━━━━━━━━━━━━━━━━━━━━
 Dark → Gray → Light (gradual)
━━━━━━━━━━━━━━━━━━━━
     ↑ Gradual change = Weak edge
```

---

## How It Works: Step by Step

### Step 1: Convert to Grayscale

First, we convert the colored image to grayscale (single brightness value per pixel):

```
Original (RGB):
Pixel: R=200, G=100, B=50

Grayscale formula:
Gray = (R × 0.299) + (G × 0.587) + (B × 0.114)
Gray = (200 × 0.299) + (100 × 0.587) + (50 × 0.114)
Gray = 59.8 + 58.7 + 5.7 = 124.2 ≈ 124
```

**Why?** We only need brightness, not color, to detect edges.

---

### Step 2: Apply Laplacian Kernel

The Laplacian uses a 3×3 kernel (small matrix) that highlights edges:

```
Laplacian Kernel:
┌─────────────┐
│  0  -1   0  │
│ -1   4  -1  │
│  0  -1   0  │
└─────────────┘
```

This kernel is applied to each pixel in the image (except edges).

### How the Kernel Works

For each pixel, we look at its 8 neighbors:

```
Example: Sharp Edge in Image

Original Grayscale Values:
┌──────────────┐
│ 20  20  20   │
│ 20  20  180  │ ← Edge here (sudden change from 20 to 180)
│ 180 180 180  │
└──────────────┘

Focus on center pixel (value = 20):
Neighbors: Top=20, Bottom=180, Left=20, Right=180

Laplacian Calculation:
Result = (0×20) + (-1×20) + (0×180) +  ← Top row
         (-1×20) + (4×20) + (-1×180) +  ← Center row
         (0×180) + (-1×180) + (0×180)   ← Bottom row

Result = 0 - 20 + 0 - 20 + 80 - 180 + 0 - 180 + 0
Result = -320

Absolute value: |−320| = 320 ← HIGH VALUE (strong edge detected!)
```

**For a Blurry Edge:**

```
Blurry Grayscale Values:
┌──────────────┐
│ 20  40  60   │
│ 40  60  100  │ ← Gradual change
│ 80  100 140  │
└──────────────┘

Focus on center pixel (value = 60):
Neighbors: Top=40, Bottom=100, Left=40, Right=100

Laplacian Calculation:
Result = 0 - 40 + 0 - 40 + 240 - 100 + 0 - 100 + 0
Result = -40

Absolute value: |−40| = 40 ← LOW VALUE (weak edge)
```

---

### Step 3: Calculate Variance

After applying Laplacian to all pixels, we get an array of values:

```
Sharp Image Laplacian Values:
[320, 280, 310, 0, 290, 300, 25, 50, ...]
     ↑ Many high values (strong edges everywhere)

Blurry Image Laplacian Values:
[40, 35, 30, 10, 25, 20, 5, 15, ...]
     ↑ Many low values (weak edges)
```

**Variance Formula:**

```javascript
1. Calculate Mean:
   mean = (320 + 280 + 310 + 0 + 290 + 300 + ...) / total_pixels

2. Calculate Variance:
   variance = Σ(value - mean)² / total_pixels
   
   For sharp image: variance = 15,000 (HIGH)
   For blurry image: variance = 250 (LOW)
```

**What Variance Tells Us:**

- **High variance** = Values spread out widely
  - Many strong edges (sharp image) ✅
  
- **Low variance** = Values clustered close together
  - Many weak edges (blurry image) ❌

---

## Real-World Example

### Example 1: Sharp Image (Item Held Still)

```
Clothing item clearly visible, sharp edges:
- Shirt collar: Clear edge
- Button: Sharp outline  
- Fabric texture: Visible

Laplacian detects:
- Edge at collar: 280
- Edge at button: 310
- Edge at fabric: 245
- Edge at sleeve: 290
- ... (many more)

Mean: 275
Variance: 12,500
→ HIGH VARIANCE = SHARP IMAGE ✅
```

### Example 2: Blurry Image (Item Moving)

```
Clothing item moving, edges are soft:
- Everything looks fuzzy
- No clear edges
- All transitions are gradual

Laplacian detects:
- Weak edge: 45
- Weak edge: 38
- Weak edge: 52
- Weak edge: 41
- ... (all low values)

Mean: 44
Variance: 180
→ LOW VARIANCE = BLURRY IMAGE ❌
```

---

## Implementation in Our Code

```javascript
function calculateBlurScore(imageData: ImageData): number {
  // Step 1: Get pixel data
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data; // RGBA values
  
  const laplacian: number[] = [];
  
  // Step 2: For each pixel (except edges), calculate Laplacian
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      
      // Get grayscale values of 3x3 neighborhood
      const getGray = (dx: number, dy: number) => {
        const idx = ((y + dy) * width + (x + dx)) * 4;
        // Convert RGB to grayscale
        return (data[idx] * 0.299 + 
                data[idx + 1] * 0.587 + 
                data[idx + 2] * 0.114);
      };
      
      // Laplacian kernel application
      const center = getGray(0, 0);   // Center pixel
      const top = getGray(0, -1);     // Above
      const bottom = getGray(0, 1);   // Below
      const left = getGray(-1, 0);    // Left
      const right = getGray(1, 0);    // Right
      
      // Laplacian formula: 4*center - neighbors
      const laplacianValue = Math.abs(4 * center - top - bottom - left - right);
      laplacian.push(laplacianValue);
    }
  }
  
  // Step 3: Calculate variance
  const mean = laplacian.reduce((a, b) => a + b, 0) / laplacian.length;
  const variance = laplacian.reduce(
    (sum, val) => sum + Math.pow(val - mean, 2), 0
  ) / laplacian.length;
  
  return variance;
}
```

---

## Why This Works

### Mathematical Intuition

The Laplacian measures the **second derivative** of brightness:
- **High second derivative** = Sudden change = Edge = Sharp
- **Low second derivative** = Gradual change = No edge = Blurry

### Visual Comparison

```
Sharp Image Pixel Values:
Brightness:  [0, 0, 0, 0, 255, 255, 255, 255]
Position:    [0, 1, 2, 3,  4,   5,   6,   7]
                      ↑ Sudden jump at edge

First Derivative (rate of change):
             [0, 0, 0, 255, 0, 0, 0]
                      ↑ High value

Second Derivative (Laplacian):
             [0, 0, 255, -255, 0, 0]
                      ↑ Very high value = Edge detected!


Blurry Image Pixel Values:
Brightness:  [0, 50, 100, 150, 200, 255]
Position:    [0,  1,   2,   3,   4,   5]
                  ↑ Gradual change

First Derivative:
             [50, 50, 50, 50, 55]
                  ↑ Lower values

Second Derivative (Laplacian):
             [0, 0, 0, 0, 5]
                  ↑ Very low values = Weak edge
```

---

## Threshold Values

In our implementation, we use a threshold of **100**:

```javascript
if (blurScore >= 100) {
  // Frame is sharp enough ✅
} else {
  // Frame is too blurry ❌
}
```

### What Different Scores Mean:

| Blur Score | Image Quality | Interpretation |
|------------|---------------|----------------|
| 0-50       | Very Blurry   | ❌ Reject - Item is moving |
| 50-100     | Slightly Blurry | ⚠️ Acceptable but not ideal |
| 100-200    | Sharp         | ✅ Good quality |
| 200-400    | Very Sharp    | ✅ Excellent quality |
| 400+       | Extremely Sharp | ✅ Perfect - Item held very still |

---

## Example: Comparing Frames

Let's say we're processing a video and have two frames:

### Frame A: Item Moving (Blurry)

```
Time: 2.1 seconds
Item: Blue shirt (person is putting it on)

Grayscale values around edge:
[120, 125, 130, 135, 140, 145]
 ↑ Gradual transition (blurry)

Laplacian values:
[5, 5, 5, 5, 5] ← All low

Mean: 5
Variance: 0.2

Blur Score: 0.2 ❌ TOO BLURRY - REJECT
```

### Frame B: Item Held Still (Sharp)

```
Time: 2.5 seconds  
Item: Blue shirt (person is holding it still)

Grayscale values around edge:
[120, 122, 124, 245, 247, 249]
                    ↑ Sudden change (sharp)

Laplacian values:
[2, 2, 360, 2, 2] ← High value at edge

Mean: 73.6
Variance: 25,600

Blur Score: 25,600 ✅ SHARP - ACCEPT!
```

---

## Performance Optimization

In our implementation, we process every pixel, but for very large images, we could optimize:

```javascript
// Current: Process all pixels
for (let y = 1; y < height - 1; y++) {
  for (let x = 1; x < width - 1; x++) {
    // Calculate Laplacian
  }
}

// Could optimize by sampling:
for (let y = 2; y < height - 1; y += 2) {  // Every 2nd row
  for (let x = 2; x < width - 1; x += 2) { // Every 2nd column
    // Calculate Laplacian (4x faster)
  }
}
```

We don't do this because blur detection is fast enough, and we want accuracy.

---

## Why Laplacian Variance > Simple Edge Count

### Bad Approach: Just Count Edges

```javascript
// This doesn't work well:
edgeCount = 0
if (pixel difference > threshold) edgeCount++

// Problem: Blurry images might still have many "edges"
// (they're just weak edges, but still count)
```

### Good Approach: Variance of Edge Strengths

```javascript
// This works:
laplacianValues = [strong edges, weak edges, ...]
variance = calculate variance

// Why it works:
// Sharp image: Some very strong edges + many weak = High variance ✅
// Blurry image: All weak edges = Low variance ❌
```

**Variance captures the "spread" of edge strengths**, not just the count!

---

## Summary

1. **Laplacian operator** detects edges by measuring brightness changes
2. **Sharp images** have strong edges → High Laplacian values → High variance
3. **Blurry images** have weak edges → Low Laplacian values → Low variance
4. **Variance threshold** (100) filters out blurry frames
5. **Result**: Only sharp, clear screenshots are captured!

---

## Quick Reference

```
┌─────────────────────────────────────────┐
│  Laplacian Variance Blur Detection      │
├─────────────────────────────────────────┤
│                                         │
│  Sharp Image → Strong Edges →          │
│  High Laplacian Values →                │
│  High Variance (200+) ✅                │
│                                         │
│  Blurry Image → Weak Edges →           │
│  Low Laplacian Values →                 │
│  Low Variance (<100) ❌                 │
│                                         │
└─────────────────────────────────────────┘
```

The beauty of this method is it's **automatic** - it doesn't need to know what's in the image, just whether the edges are sharp or blurry!

