from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import cv2
import mediapipe as mp
import numpy as np
import math
import time
import base64
from io import BytesIO

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or specify domains
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods like POST, GET, OPTIONS, etc.
    allow_headers=["*"],  # Allow all headers
)

# Initialize Mediapipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(min_detection_confidence=0.5, min_tracking_confidence=0.5)

# Thresholds for detecting attention states
PITCH_FORWARD_THRESH = 15
YAW_LEFT_THRESH = -40
YAW_RIGHT_THRESH = 40
PITCH_DOWN_THRESH = -30
DISTRACTED_TIME_THINKING = 5
DISTRACTED_TIME_NOTES = 5

# Initialize state tracking variables
current_state = "paying attention"
thinking_start_time = None
notes_start_time = None

# Helper function to convert rotation matrix to angles
def rotation_matrix_to_angles(rotation_matrix):
    x = math.atan2(rotation_matrix[2, 1], rotation_matrix[2, 2])
    y = math.atan2(-rotation_matrix[2, 0], math.sqrt(rotation_matrix[0, 0] ** 2 + rotation_matrix[1, 0] ** 2))
    z = math.atan2(rotation_matrix[1, 0], rotation_matrix[0, 0])
    return np.array([x, y, z]) * 180. / math.pi

# Function to update the state based on pitch and yaw
def update_state(pitch, yaw):
    global current_state, thinking_start_time, notes_start_time

    if -PITCH_FORWARD_THRESH <= pitch <= PITCH_FORWARD_THRESH and abs(yaw) <= 15:
        current_state = "paying attention"
        thinking_start_time = None
        notes_start_time = None
    elif pitch < PITCH_DOWN_THRESH:
        if current_state != "taking notes" and current_state != "distracted2" and current_state != "distracted":
            current_state = "taking notes"
            notes_start_time = time.time() if notes_start_time is None else notes_start_time
        elif notes_start_time and time.time() - notes_start_time > DISTRACTED_TIME_NOTES:
            current_state = "distracted2"
            notes_start_time = None
    elif yaw < YAW_LEFT_THRESH or yaw > YAW_RIGHT_THRESH or pitch > PITCH_FORWARD_THRESH:
        if current_state != "thinking" and current_state != "distracted2" and current_state != "distracted":
            current_state = "thinking"
            thinking_start_time = time.time() if thinking_start_time is None else thinking_start_time
        elif thinking_start_time and time.time() - thinking_start_time > DISTRACTED_TIME_THINKING:
            current_state = "distracted"
            thinking_start_time = None

# API endpoint for processing a base64-encoded string representing the video frame (JPG)
@app.post("/process_video/")
async def process_video(file: dict):
    base64_image = file.get('image', None)
    if base64_image is None:
        return JSONResponse({"error": "Image data missing"}, status_code=400)

    # Decode the Base64 string back into binary data (bytes)
    image_bytes = base64.b64decode(base64_image)
    
    # Convert bytes data to OpenCV image
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # Convert the image to RGB for Mediapipe
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(image)
    
    h, w, _ = image.shape
    face_coordination_in_image = []

    # Get the face landmarks and calculate head pose
    if results.multi_face_landmarks:
        for face_landmarks in results.multi_face_landmarks:
            for idx, lm in enumerate(face_landmarks.landmark):
                if idx in [1, 9, 57, 130, 287, 359]:
                    x, y = int(lm.x * w), int(lm.y * h)
                    face_coordination_in_image.append([x, y])

            if len(face_coordination_in_image) == 6:
                face_coordination_in_image = np.array(face_coordination_in_image, dtype=np.float64)
                face_coordination_in_real_world = np.array([
                    [285, 528, 200], [285, 371, 152], [197, 574, 128],
                    [173, 425, 108], [360, 574, 128], [391, 425, 108]
                ], dtype=np.float64)

                focal_length = w
                cam_matrix = np.array([[focal_length, 0, w / 2], [0, focal_length, h / 2], [0, 0, 1]])
                dist_matrix = np.zeros((4, 1), dtype=np.float64)

                success, rotation_vec, _ = cv2.solvePnP(
                    face_coordination_in_real_world, face_coordination_in_image, cam_matrix, dist_matrix
                )
                rotation_matrix, _ = cv2.Rodrigues(rotation_vec)
                pitch, yaw, _ = rotation_matrix_to_angles(rotation_matrix)

                update_state(pitch, yaw)

    # Encode the processed image to JPG and convert to Base64
    _, img_encoded = cv2.imencode('.jpg', image)
    img_bytes = img_encoded.tobytes()
    img_base64 = base64.b64encode(img_bytes).decode('utf-8')

    # Return the Base64-encoded processed image and the state
    return JSONResponse({"state": current_state})
