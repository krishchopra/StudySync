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
from inference_sdk import InferenceHTTPClient

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Mediapipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(min_detection_confidence=0.5, min_tracking_confidence=0.5)

# Thresholds for detecting attention states
PITCH_FORWARD_THRESH = 25
YAW_LEFT_THRESH = -30
YAW_RIGHT_THRESH = 30
PITCH_DOWN_THRESH = -15
PITCH_DOWN_THRESH_WITH_ROLL = -8
DISTRACTED_TIME_THINKING = 5
DISTRACTED_TIME_NOTES = 5
ROLL_BIDIRECTION_THRESH = 10
PITCH_DOWN_SLEEP_THRESH = 45

# Phone detection thresholds
PHONE_DETECTION_INTERVAL = 3  # Seconds
PHONE_DETECTION_COUNT = 2
PHONE_MAX_DETECTION_TIME = 10  # Maximum time before changing state to getOffPhone

# Initialize state tracking variables
current_state = "paying attention"
thinking_start_time = None
notes_start_time = None
distracted2_start_time = None  # Track start time of 'distracted2' state
on_phone_state = False
phone_detection_count = 0
phone_last_detected_time = None
on_phone_start_time = None  # Timer for "onPhone"


# Initialize the Inference API client for phone detection
CLIENT = InferenceHTTPClient(
    api_url="https://detect.roboflow.com",
    api_key="tZu7n2l18p3upfbwSIMP"  # Replace with your actual API key
)

# Helper function to convert rotation matrix to angles
def rotation_matrix_to_angles(rotation_matrix):
    x = math.atan2(rotation_matrix[2, 1], rotation_matrix[2, 2])
    y = math.atan2(-rotation_matrix[2, 0], math.sqrt(rotation_matrix[0, 0] ** 2 + rotation_matrix[1, 0] ** 2))
    z = math.atan2(rotation_matrix[1, 0], rotation_matrix[0, 0])
    return np.array([x, y, z]) * 180. / math.pi

# Function to update the state based on pitch and yaw
def update_state(pitch, yaw, roll):
    global current_state, thinking_start_time, notes_start_time, distracted2_start_time

    if -PITCH_FORWARD_THRESH <= pitch <= PITCH_FORWARD_THRESH and abs(yaw) <= 15:
        current_state = "paying attention"
        thinking_start_time = None
        notes_start_time = None
        distracted2_start_time = None
    elif (pitch < PITCH_DOWN_THRESH and abs(roll) < ROLL_BIDIRECTION_THRESH) or (pitch < PITCH_DOWN_THRESH_WITH_ROLL):
        if current_state != "taking notes" and current_state != "distracted2" and current_state != "distracted" and current_state != "sleeping":
            current_state = "taking notes"
            notes_start_time = time.time() if notes_start_time is None else notes_start_time
        elif notes_start_time and time.time() - notes_start_time > DISTRACTED_TIME_NOTES:
            current_state = "distracted2"
            distracted2_start_time = time.time() if distracted2_start_time is None else distracted2_start_time
            notes_start_time = None
    elif yaw < YAW_LEFT_THRESH or yaw > YAW_RIGHT_THRESH or pitch > PITCH_FORWARD_THRESH:
        if current_state != "thinking" and current_state != "distracted2" and current_state != "distracted":
            current_state = "thinking"
            thinking_start_time = time.time() if thinking_start_time is None else thinking_start_time
        elif thinking_start_time and time.time() - thinking_start_time > DISTRACTED_TIME_THINKING:
            current_state = "distracted"
            thinking_start_time = None

    # Check if 'distracted2' lasts more than 5 seconds, if so switch to 'sleeping'
    if current_state == "distracted2" and distracted2_start_time and time.time() - distracted2_start_time > 5:
        current_state = "sleeping"
        distracted2_start_time = None

# Function to detect phone in the frame
def detect_phone(image):
    try:
        cv2.imwrite("current_frame.jpg", image)
        result = CLIENT.infer("current_frame.jpg", model_id="mobile-phone-detection-mtsje/1")
        if 'predictions' in result and len(result['predictions']) > 0:
            return True  # Phone detected
    except Exception as e:
        print(f"Phone detection error: {e}")
    return False  # Default to no phone detected if any error occurs

# Function to manage phone detection state
def update_phone_state(phone_detected):
    global on_phone_state, phone_detection_count, phone_last_detected_time, on_phone_start_time
    
    current_time = time.time()
    
    if phone_detected:
        if phone_last_detected_time is None or current_time - phone_last_detected_time > PHONE_DETECTION_INTERVAL:
            phone_detection_count = 0
        phone_detection_count += 1
        phone_last_detected_time = current_time
        
        if phone_detection_count >= PHONE_DETECTION_COUNT:
            if not on_phone_state:
                on_phone_state = True
                on_phone_start_time = time.time()  # Start timer when the phone is detected
            
            # If phone is detected for more than 10 seconds, change state to "getOffPhone"
            elif on_phone_state and current_time - on_phone_start_time > PHONE_MAX_DETECTION_TIME:
                on_phone_state = "getOffPhone"
    else:
        if phone_last_detected_time and current_time - phone_last_detected_time > PHONE_DETECTION_INTERVAL:
            on_phone_state = False
            phone_detection_count = 0
            on_phone_start_time = None  # Reset the timer when phone is not detected

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
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(image_rgb)
    
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
                pitch, yaw, roll = rotation_matrix_to_angles(rotation_matrix)

                update_state(pitch, yaw, roll)

    # Detect if a phone is present in the image
    phone_detected = detect_phone(image)
    update_phone_state(phone_detected)
    
    # Return the state, prioritizing "onPhone" or "getOffPhone" over all other states
    if on_phone_state == "getOffPhone":
        final_state = "getOffPhone"
    else:
        final_state = "onPhone" if on_phone_state else current_state
    
    return JSONResponse({"state": final_state})
