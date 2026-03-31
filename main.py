import cv2
import mediapipe as mp
import numpy as np
import time

# ==========================================
# AI Gesture-Controlled Virtual Whiteboard
# ==========================================
# Author: Senior CV Engineer
# Description: Real-time hand gesture drawing app
# ==========================================

class VirtualWhiteboard:
    def __init__(self):
        # Initialize MediaPipe Hands
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
        )
        self.mp_draw = mp.solutions.drawing_utils

        # Colors and Brush settings
        self.colors = [
            (255, 0, 0),   # Blue
            (0, 255, 0),   # Green
            (0, 0, 255),   # Red
            (255, 0, 255), # Purple
            (0, 165, 255), # Orange
            (0, 255, 255)  # Yellow
        ]
        self.color_index = 0
        self.is_eraser = False
        self.brush_thickness = 12
        self.eraser_thickness = 80

        # Canvas for drawing
        self.canvas = None
        
        # Tracking points for smoothing
        self.prev_x, self.prev_y = 0, 0
        
        # FPS calculation
        self.prev_time = 0
        self.curr_time = 0

    def get_finger_status(self, hand_landmarks):
        """Detect which fingers are up."""
        # Index: Tip (8), MCP (5)
        # Middle: Tip (12), MCP (9)
        fingers = []
        
        # Index Finger
        # Tip must be significantly above MCP to be considered fully extended
        if hand_landmarks.landmark[8].y < hand_landmarks.landmark[5].y - 0.04:
            fingers.append(1)
        else:
            fingers.append(0)
            
        # Middle Finger
        if hand_landmarks.landmark[12].y < hand_landmarks.landmark[9].y - 0.04:
            fingers.append(1)
        else:
            fingers.append(0)
            
        return fingers

    def run(self):
        cap = cv2.VideoCapture(0)
        cap.set(3, 1280) # Width
        cap.set(4, 720)  # Height

        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                print("Ignoring empty camera frame.")
                continue

            # 1. Flip frame for mirror effect
            frame = cv2.flip(frame, 1)
            h, w, c = frame.shape

            # Initialize canvas if not exists
            if self.canvas is None:
                self.canvas = np.zeros((h, w, 3), np.uint8)

            # 2. Convert to RGB for MediaPipe
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.hands.process(rgb_frame)

            # 3. UI Toolbar
            toolbar_items = [
                ((0, 0), (150, 100), (255, 0, 0), "BLUE"),
                ((150, 0), (300, 100), (0, 255, 0), "GREEN"),
                ((300, 0), (450, 100), (0, 0, 255), "RED"),
                ((450, 0), (600, 100), (255, 0, 255), "PURPLE"),
                ((600, 0), (750, 100), (0, 165, 255), "ORANGE"),
                ((750, 0), (900, 100), (0, 255, 255), "YELLOW"),
                ((900, 0), (1100, 100), (255, 255, 255), "ERASER")
            ]

            for i, (p1, p2, color, label) in enumerate(toolbar_items):
                # Draw base rectangle
                cv2.rectangle(frame, p1, p2, color, cv2.FILLED)
                # Highlight active selection
                is_active = (i == self.color_index and not self.is_eraser) or (i == 6 and self.is_eraser)
                if is_active:
                    cv2.rectangle(frame, p1, p2, (255, 255, 255), 8) # Thick white border
                
                # Draw label
                text_color = (0, 0, 0) if i == 6 else (255, 255, 255)
                cv2.putText(frame, label, (p1[0] + 10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, text_color, 2)

            if results.multi_hand_landmarks:
                for hand_lms in results.multi_hand_landmarks:
                    # Get index finger tip coordinates
                    x8 = int(hand_lms.landmark[8].x * w)
                    y8 = int(hand_lms.landmark[8].y * h)
                    
                    # Get finger status
                    fingers = self.get_finger_status(hand_lms)
                    
                    # 4. Selection Mode (Index + Middle up)
                    if fingers[0] == 1 and fingers[1] == 1:
                        curr_x, curr_y = x8, y8 # Use raw coordinates for selection
                        self.prev_x, self.prev_y = 0, 0 # Reset drawing points
                        
                        # Check for Thumb "out" to enter Size Mode
                        thumb_tip = hand_lms.landmark[4]
                        index_tip = hand_lms.landmark[8]
                        mcp = hand_lms.landmark[5]
                        
                        is_thumb_out = abs(thumb_tip.x - mcp.x) > 0.1
                        
                        if is_thumb_out:
                            # Distance between thumb and index tip
                            dist = np.hypot(thumb_tip.x - index_tip.x, thumb_tip.y - index_tip.y)
                            # Map distance to thickness
                            self.brush_thickness = int(np.clip((dist - 0.05) * 300, 4, 80))
                            
                            # Visual feedback for size
                            cv2.circle(frame, (curr_x, curr_y), self.brush_thickness // 2, (255, 255, 255), cv2.FILLED)
                            cv2.putText(frame, f"SIZE: {self.brush_thickness}", (curr_x + 20, curr_y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                        else:
                            cv2.circle(frame, (curr_x, curr_y), 15, (255, 255, 255), cv2.FILLED)
                        
                        # Check if touching toolbar (using smoothed coordinates)
                        if curr_y < 100:
                            hover_idx = -1
                            if 0 < curr_x < 150: hover_idx = 0
                            elif 150 < curr_x < 300: hover_idx = 1
                            elif 300 < curr_x < 450: hover_idx = 2
                            elif 450 < curr_x < 600: hover_idx = 3
                            elif 600 < curr_x < 750: hover_idx = 4
                            elif 750 < curr_x < 900: hover_idx = 5
                            elif 900 < curr_x < 1100: hover_idx = 6
                            
                            if hover_idx != -1:
                                if hover_idx == 6:
                                    self.is_eraser = True
                                else:
                                    self.color_index = hover_idx
                                    self.is_eraser = False
                                
                                # Draw hover effect (inner border)
                                p1, p2 = toolbar_items[hover_idx][0], toolbar_items[hover_idx][1]
                                cv2.rectangle(frame, (p1[0]+15, p1[1]+15), (p2[0]-15, p2[1]-15), (255, 255, 255), 4)
                    
                    # 5. Drawing Mode (Only Index up)
                    elif fingers[0] == 1 and fingers[1] == 0:
                        # Apply exponential smoothing to coordinates
                        if self.prev_x == 0 and self.prev_y == 0:
                            curr_x, curr_y = x8, y8
                        else:
                            smoothing = 1.0 # Raw, instant response
                            curr_x = int(self.prev_x * (1 - smoothing) + x8 * smoothing)
                            curr_y = int(self.prev_y * (1 - smoothing) + y8 * smoothing)

                        cv2.circle(frame, (curr_x, curr_y), 15, self.colors[self.color_index] if not self.is_eraser else (255, 255, 255), cv2.FILLED)
                        
                        if self.prev_x != 0 or self.prev_y != 0:
                            thickness = self.eraser_thickness if self.is_eraser else self.brush_thickness
                            color = (0, 0, 0) if self.is_eraser else self.colors[self.color_index]
                            cv2.line(self.canvas, (self.prev_x, self.prev_y), (curr_x, curr_y), color, thickness)
                        
                        self.prev_x, self.prev_y = curr_x, curr_y
                    else:
                        self.prev_x, self.prev_y = 0, 0

            # 6. Overlay Canvas on Frame
            img_gray = cv2.cvtColor(self.canvas, cv2.COLOR_BGR2GRAY)
            _, img_inv = cv2.threshold(img_gray, 50, 255, cv2.THRESH_BINARY_INV)
            img_inv = cv2.cvtColor(img_inv, cv2.COLOR_GRAY2BGR)
            frame = cv2.bitwise_and(frame, img_inv)
            frame = cv2.bitwise_or(frame, self.canvas)

            # 7. FPS Counter
            self.curr_time = time.time()
            fps = 1 / (self.curr_time - self.prev_time)
            self.prev_time = self.curr_time
            cv2.putText(frame, f"FPS: {int(fps)}", (1100, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 255), 2)

            # 8. Display
            cv2.imshow("AI Virtual Whiteboard", frame)
            
            key = cv2.waitKey(1)
            if key == 27: # ESC to exit
                break
            elif key == ord('c'): # 'c' to clear
                self.canvas = np.zeros((h, w, 3), np.uint8)
            elif key == ord('['): # '[' to decrease size
                self.brush_thickness = max(2, self.brush_thickness - 2)
            elif key == ord(']'): # ']' to increase size
                self.brush_thickness = min(100, self.brush_thickness + 2)

        cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    board = VirtualWhiteboard()
    board.run()
