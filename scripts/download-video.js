#!/usr/bin/env node

/**
 * Video Downloader Script for Fleek Product Pages
 * 
 * Usage:
 *   npm run download-video https://www.joinfleek.com/products/y2k-jeans-140
 *   npm run download-video https://www.joinfleek.com/products/y2k-jeans-140 --output assets/my-video.mp4
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Fetch HTML content from URL
 */
function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Extract product name from URL
 */
function getProductName(url) {
  const match = url.match(/\/products\/([^/?]+)/);
  if (match) {
    return match[1].replace(/-/g, '_');
  }
  return 'product_video';
}

/**
 * Extract video URLs from HTML
 * Looks for:
 * - <video> tags with src attribute
 * - <source> tags
 * - m3u8 URLs in script tags or JSON data
 * - Direct video file URLs
 * - Video URLs in JSON-LD or script tags (common in modern React apps)
 */
function extractVideoUrls(html, baseUrl) {
  const urls = [];
  const base = new URL(baseUrl).origin;
  
  // Pattern 1: <video> tags with src attribute
  const videoTagRegex = /<video[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = videoTagRegex.exec(html)) !== null) {
    urls.push(match[1]);
  }
  
  // Pattern 2: <source> tags inside video
  const sourceTagRegex = /<source[^>]*src=["']([^"']+)["'][^>]*>/gi;
  while ((match = sourceTagRegex.exec(html)) !== null) {
    urls.push(match[1]);
  }
  
  // Pattern 3: m3u8 URLs (HLS streams) - anywhere in HTML
  const m3u8Regex = /(https?:\/\/[^\s"'\\)]+\.m3u8[^\s"'\\)]*)/gi;
  while ((match = m3u8Regex.exec(html)) !== null) {
    urls.push(match[1]);
  }
  
  // Pattern 4: Direct video URLs (.mp4, .webm, .mov, etc.)
  const videoFileRegex = /(https?:\/\/[^\s"'\\)]+\.(mp4|webm|mov|avi|mkv|flv|m4v)[^\s"'\\)]*)/gi;
  while ((match = videoFileRegex.exec(html)) !== null) {
    urls.push(match[1]);
  }
  
  // Pattern 5: Look for video URLs in JSON data (common in React/Next.js apps)
  // Try to parse JSON-LD or script tags with JSON
  const scriptTags = html.match(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  scriptTags.forEach(script => {
    const jsonMatch = script.match(/>([\s\S]*?)<\/script>/);
    if (jsonMatch) {
      try {
        const json = JSON.parse(jsonMatch[1]);
        // Recursively search for video URLs in JSON
        const findUrlsInObject = (obj) => {
          if (typeof obj === 'string') {
            if (obj.includes('.m3u8') || obj.match(/\.(mp4|webm|mov|avi|mkv)/i)) {
              if (obj.startsWith('http')) {
                urls.push(obj);
              }
            }
          } else if (Array.isArray(obj)) {
            obj.forEach(item => findUrlsInObject(item));
          } else if (typeof obj === 'object' && obj !== null) {
            Object.values(obj).forEach(value => findUrlsInObject(value));
          }
        };
        findUrlsInObject(json);
      } catch (e) {
        // Not valid JSON, skip
      }
    }
  });
  
  // Pattern 6: Look for video URLs in data attributes
  const dataVideoRegex = /data-video[^=]*=["']([^"']+)["']/gi;
  while ((match = dataVideoRegex.exec(html)) !== null) {
    urls.push(match[1]);
  }
  
  // Pattern 7: Look in __NEXT_DATA__ or similar React hydration data
  const nextDataMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      const findUrlsInObject = (obj) => {
        if (typeof obj === 'string') {
          if (obj.includes('.m3u8') || obj.match(/\.(mp4|webm|mov|avi|mkv)/i)) {
            if (obj.startsWith('http')) {
              urls.push(obj);
            }
          }
        } else if (Array.isArray(obj)) {
          obj.forEach(item => findUrlsInObject(item));
        } else if (typeof obj === 'object' && obj !== null) {
          Object.values(obj).forEach(value => findUrlsInObject(value));
        }
      };
      findUrlsInObject(nextData);
    } catch (e) {
      // Not valid JSON, skip
    }
  }
  
  // Pattern 8: Video URLs in inline styles or CSS
  const styleVideoRegex = /url\(["']?([^"')]+\.(mp4|webm|m3u8))["']?\)/gi;
  while ((match = styleVideoRegex.exec(html)) !== null) {
    urls.push(match[1]);
  }
  
  // Resolve relative URLs to absolute
  const absoluteUrls = urls.map(url => {
    // Clean URL (remove trailing brackets, quotes, etc.)
    url = url.trim().replace(/[\\'"]+$/, '').replace(/[\\'"]+$/, '');
    
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('//')) {
      return 'https:' + url;
    }
    if (url.startsWith('/')) {
      return base + url;
    }
    return base + '/' + url;
  });
  
  // Remove duplicates and invalid URLs
  const validUrls = absoluteUrls.filter(url => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  });
  
  return [...new Set(validUrls)];
}

/**
 * Check if ffmpeg is installed
 */
async function checkFFmpeg() {
  try {
    await execAsync('ffmpeg -version');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Download video using ffmpeg
 */
async function downloadVideo(videoUrl, outputPath) {
  log(`\n📥 Downloading video from: ${videoUrl}`, 'blue');
  log(`💾 Saving to: ${outputPath}`, 'blue');
  
  const command = `ffmpeg -i "${videoUrl}" -c copy -y "${outputPath}"`;
  
  return new Promise((resolve, reject) => {
    log('⏳ Starting download (this may take a while)...', 'yellow');
    
    const process = exec(command, (error, stdout, stderr) => {
      if (error) {
        // ffmpeg writes to stderr even on success, check exit code
        if (error.code === 0 || stderr.includes('video:')) {
          log(`✅ Video downloaded successfully!`, 'green');
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg error: ${error.message}\n${stderr}`));
        }
      } else {
        log(`✅ Video downloaded successfully!`, 'green');
        resolve(outputPath);
      }
    });
    
    // Show progress from stderr
    process.stderr.on('data', (data) => {
      const output = data.toString();
      // Look for time progress
      const timeMatch = output.match(/time=(\d+:\d+:\d+\.\d+)/);
      if (timeMatch) {
        process.stdout.write(`\r⏳ Progress: ${timeMatch[1]}`);
      }
    });
  });
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    log('❌ Error: Please provide a product URL', 'red');
    log('\nUsage:', 'yellow');
    log('  node scripts/download-video.js <product-url> [--output <filename>]', 'yellow');
    log('\nExample:', 'yellow');
    log('  node scripts/download-video.js https://www.joinfleek.com/products/y2k-jeans-140', 'yellow');
    process.exit(1);
  }
  
  const productUrl = args[0];
  let outputPath = args.includes('--output') 
    ? args[args.indexOf('--output') + 1]
    : null;
  
  // Validate URL
  if (!productUrl.startsWith('http')) {
    log('❌ Error: Invalid URL. Please provide a full URL starting with http:// or https://', 'red');
    process.exit(1);
  }
  
  try {
    // Check ffmpeg
    log('🔍 Checking if ffmpeg is installed...', 'blue');
    const hasFFmpeg = await checkFFmpeg();
    
    if (!hasFFmpeg) {
      log('❌ Error: ffmpeg is not installed!', 'red');
      log('\nPlease install ffmpeg:', 'yellow');
      log('  macOS: brew install ffmpeg', 'yellow');
      log('  Linux: sudo apt-get install ffmpeg', 'yellow');
      log('  Windows: https://ffmpeg.org/download.html', 'yellow');
      process.exit(1);
    }
    
    log('✅ ffmpeg is installed', 'green');
    
    // Fetch product page
    log(`\n🌐 Fetching product page: ${productUrl}`, 'blue');
    const html = await fetchHTML(productUrl);
    log('✅ Page fetched successfully', 'green');
    
    // Extract video URLs
    log('\n🔍 Searching for video URLs...', 'blue');
    const videoUrls = extractVideoUrls(html, productUrl);
    
    if (videoUrls.length === 0) {
      log('❌ No video URLs found on the page', 'red');
      log('\nTrying to save HTML for debugging...', 'yellow');
      fs.writeFileSync('debug_page.html', html);
      log('✅ Saved page HTML to debug_page.html - you can inspect it manually', 'yellow');
      process.exit(1);
    }
    
    log(`✅ Found ${videoUrls.length} potential video URL(s):`, 'green');
    videoUrls.forEach((url, index) => {
      log(`  ${index + 1}. ${url}`, 'blue');
    });
    
    // Prefer m3u8 or direct video URLs
    const m3u8Url = videoUrls.find(url => url.includes('.m3u8'));
    const mp4Url = videoUrls.find(url => url.includes('.mp4'));
    const preferredUrl = m3u8Url || mp4Url || videoUrls[0];
    
    log(`\n🎯 Using video URL: ${preferredUrl}`, 'green');
    
    // Determine output filename
    if (!outputPath) {
      const productName = getProductName(productUrl);
      const assetsDir = path.join(process.cwd(), 'assets');
      
      // Ensure assets directory exists
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
        log(`📁 Created assets directory`, 'yellow');
      }
      
      outputPath = path.join(assetsDir, `${productName}.mp4`);
    }
    
    // Check if file already exists
    if (fs.existsSync(outputPath)) {
      log(`⚠️  Warning: File already exists: ${outputPath}`, 'yellow');
      log('   It will be overwritten...', 'yellow');
    }
    
    // Download video
    await downloadVideo(preferredUrl, outputPath);
    
    log(`\n🎉 Success! Video saved to: ${outputPath}`, 'green');
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the script
main();

