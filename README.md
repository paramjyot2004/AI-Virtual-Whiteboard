
# 🎨 AI Gesture-Controlled Virtual Whiteboard

<p align="center">
  <img src="https://img.shields.io/badge/Computer%20Vision-Project-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/OpenCV-Real--Time-green?style=for-the-badge" />
  <img src="https://img.shields.io/badge/AI-Gesture%20Control-orange?style=for-the-badge" />
</p>

🚀 A production-quality Computer Vision project that enables users to draw on a virtual canvas using hand gestures captured via webcam — no mouse, no touch, completely contactless!

---

## ✨ Features

🔍 **Real-time Hand Tracking**  
- Uses MediaPipe Hands to detect **21 hand landmarks** with high accuracy  

✋ **Gesture-Based Interaction**
- ☝️ **Drawing Mode** → Raise only index finger  
- ✌️ **Selection Mode** → Raise index + middle finger  

🎨 **Dynamic Toolbar**
- Switch between:
  - 🔵 Blue  
  - 🟢 Green  
  - 🔴 Red  
  - 🧽 Eraser  

🖌 **Smooth Drawing**
- Continuous stroke rendering to avoid broken lines  

🪞 **Mirror Effect**
- Natural interaction using flipped webcam feed  

⚡ **High Performance**
- Real-time processing at **25–30 FPS**

---

## 🎮 Controls

| Action | Gesture / Key |
|------|-------------|
| Draw | ☝️ Index finger up |
| Select Mode | ✌️ Index + Middle finger |
| Erase | Select Eraser from toolbar |
| Clear Canvas | Press **C** |
| Exit | Press **ESC** |

---

## 🛠️ Installation

### 1️⃣ Clone the repository
```bash
git clone https://github.com/paramjyot2004/AI-Virtual-Whiteboard.git
cd AI-Virtual-Whiteboard

## Installation

1. **Clone the repository** (or download the files).
2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
3. **Run the application**:
   ```bash
   python main.py
   ```

## How It Works
The application captures frames from the webcam, processes them using MediaPipe to find hand landmarks, and determines the gesture based on the relative positions of finger tips. A separate NumPy-based canvas is maintained to store the drawing, which is then overlaid on the live video feed using bitwise operations.

## ⚙️ Tech Stack

- 🐍 **Python** → Core logic  
- 🎥 **OpenCV** → Video processing & rendering  
- 🤖 **MediaPipe** → AI hand tracking  
- 🔢 **NumPy** → Efficient canvas operations  

---

## 🚀 Future Improvements

- 💾 Save drawings as image/PDF  
- 🤖 AI-based gesture classifier (ML model)  
- 👥 Multi-user collaboration  
- 🎯 AR/VR integration  
