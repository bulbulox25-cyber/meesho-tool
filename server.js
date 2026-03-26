const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from 'optimized' folder
app.use('/optimized', express.static(path.join(__dirname, 'optimized')));

const upload = multer({ dest: 'uploads/' });

// Create directories
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads', { recursive: true });
if (!fs.existsSync('optimized')) fs.mkdirSync('optimized', { recursive: true });

// 1. Optimize + Download
app.post('/optimize', upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    const timestamp = Date.now();
    const optimizedFilename = `optimized-${timestamp}.jpg`;
    const optimizedPath = path.join(__dirname, 'optimized', optimizedFilename);
    
    // Optimize image
    await sharp(file.path)
      .resize(800, 800, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toFile(optimizedPath);
    
    // Get metadata
    const metadata = await sharp(optimizedPath).metadata();
    
    // Calculate weight & shipping rate
    const estimatedWeight = Math.round((metadata.width * metadata.height) / 20000);
    const dimensions = {
      length: Math.round(metadata.width / 10),
      width: Math.round(metadata.height / 10),
      height: 5
    };
    
    const baseRate = 52;
    const finalRate = Math.min(55, Math.round(baseRate + (estimatedWeight - 100) * 0.1));
    
    // Clean up original upload
    fs.unlinkSync(file.path);
    
    // Return direct download URL
    const downloadUrl = `/optimized/${optimizedFilename}`;
    
    res.json({
      success: true,
      weight: `${estimatedWeight}g`,
      dimensions: dimensions,
      shipping_rate: `₹${finalRate}`,
      original_rate: "₹85-100",
      savings: `Saved ₹${85 - finalRate}`,
      download_url: downloadUrl,
      meesho_copy_text: `Weight: ${estimatedWeight}g | Size: ${dimensions.length}x${dimensions.width}x${dimensions.height}cm | Shipping: ₹${finalRate}`
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// 2. Homepage
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Image Optimizer + Shipping Rate</title>
    <meta name="viewport" content="width=device-width">
    <style>
        body{font-family:sans-serif;background:#f0f2f5;max-width:500px;margin:20px auto;padding:20px;}
        .container{background:white;border-radius:15px;padding:30px;box-shadow:0 10px 30px rgba(0,0,0,0.1);}
        h1{color:#ff6b35;text-align:center;font-size:22px;margin-bottom:10px;}
        .upload-area{border:3px dashed #ff6b35;border-radius:15px;padding:40px;text-align:center;cursor:pointer;}
        .upload-area:hover{background:#fff5f2;}
        #result{display:none;background:#e8f5e8;border:1px solid #27ae60;border-radius:10px;padding:20px;margin-top:20px;}
        .rate{font-size:28px;font-weight:bold;color:#27ae60;}
        button{background:#ff6b35;color:white;border:none;padding:12px 24px;border-radius:25px;font-size:16px;cursor:pointer;width:100%;margin:10px 0;}
        input[type=file]{display:none;}
        .savings{color:#27ae60;font-weight:bold;}
        .image-preview{max-width:100%;border-radius:10px;margin:10px 0;}
        .copy-box{background:#f8f9fa;padding:10px;border-radius:5px;font-size:12px;margin:10px 0;}
    </style>
</head>
<body>
    <div class="container">
        <h1>📦 Image Optimizer + Shipping Rate</h1>
        <p style="text-align:center;color:#666;margin-bottom:20px;">Optimize + 70-100₹ → <span style="color:#ff6b35;font-weight:bold;">50-55₹</span></p>
        
        <div class="upload-area" onclick="document.getElementById('fileInput').click()">
            <p>🖼️ Upload Product Image</p>
            <p style="font-size:12px;color:#999;">Auto optimize + rate calculation</p>
        </div>
        <input id="fileInput" type="file" accept="image/*">
        
        <div id="result">
            <h3>✅ Results:</h3>
            <img id="preview" class="image-preview" style="display:none;">
            <p><b>Optimized Size:</b> <span id="optSize"></span></p>
            <p><b>Weight:</b> <span id="weight"></span></p>
            <p><b>Shipping Rate:</b> <span class="rate" id="rate"></span></p>
            <p class="savings" id="savings"></p>
            
            <div class="copy-box" id="copyBox">
                <b>Meesho Copy Text:</b><br>
                <span id="copyText"></span>
            </div>
            
            <button onclick="downloadImage()">📥 Download Optimized Image</button>
            <button onclick="copyToClipboard()">📋 Copy Meesho Data</button>
        </div>
    </div>

    <script>
        const fileInput = document.getElementById('fileInput');
        
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            const formData = new FormData();
            formData.append('image', file);
            
            try {
                const res = await fetch('/optimize', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                
                if(data.success) {
                    document.getElementById('preview').src = data.download_url;
                    document.getElementById('preview').style.display = 'block';
                    document.getElementById('optSize').textContent = data.weight + ' (optimized)';
                    document.getElementById('weight').textContent = data.weight;
                    document.getElementById('rate').textContent = data.shipping_rate;
                    document.getElementById('savings').textContent = data.savings;
                    document.getElementById('copyText').textContent = data.meesho_copy_text;
                    document.getElementById('result').style.display = 'block';
                    
                    // Store download URL
                    window.downloadUrl = data.download_url;
                }
            } catch(err) {
                alert('Error: ' + err);
            }
        });
        
        function downloadImage() {
            if(window.downloadUrl) {
                // Open in new tab for download
                window.open(window.downloadUrl, '_blank');
            } else {
                alert('Please upload an image first!');
            }
        }
        
        function copyToClipboard() {
            const text = document.getElementById('copyText').textContent;
            navigator.clipboard.writeText(text);
            alert('✅ Copied! Meesho listing me paste karo');
        }
    </script>
</body>
</html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
