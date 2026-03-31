# AI Gesture-Controlled Virtual Whiteboard

A production-quality computer vision project that allows users to draw on a virtual canvas using hand gestures captured via webcam.

## Features
- **Real-time Hand Tracking**: Uses MediaPipe Hands to detect 21 landmarks.
- **Gesture Modes**:
  - **Drawing Mode**: Raise only your index finger to draw.
  - **Selection Mode**: Raise both index and middle fingers to select colors or the eraser from the top toolbar.
- **Dynamic Toolbar**: Switch between Blue, Green, Red colors and an Eraser.
- **Smooth Drawing**: Implements continuous line drawing to avoid broken strokes.
- **Mirror Effect**: Flips the camera feed for a natural user experience.
- **Performance**: Real-time processing at 25-30 FPS.
- **Controls**:
  - `c`: Clear the entire canvas.
  - `ESC`: Exit the application.

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

## Technical Stack
- **Python**: Core logic.
- **OpenCV**: Video capture, image processing, and UI rendering.
- **MediaPipe**: Deep learning-based hand landmark detection.
- **NumPy**: High-performance canvas operations.
