import {
  FaceDetector,
  FilesetResolver,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

// Elementos DOM
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const detectBtn = document.getElementById('detectBtn');
const statusDiv = document.getElementById('status');
const cameraSelect = document.getElementById('cameraSelect');

// Variáveis de estado
let faceDetector;
let stream = null;
let isDetecting = false;
let availableCameras = [];
let lastVideoTime = -1;
let animationFrameId;
const drawingUtils = new DrawingUtils(ctx);

// 1. Configurar detector de faces
async function setupDetector() {
  try {
    statusDiv.textContent = "Carregando modelos...";
    
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    
    faceDetector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`,
        delegate: "GPU"
      },
      runningMode: "VIDEO" // Modo vídeo para detecção contínua
    });
    
    statusDiv.textContent = "Modelo carregado!";
    detectBtn.disabled = false;
    
  } catch (error) {
    console.error("Erro ao configurar detector:", error);
    statusDiv.textContent = `Erro: ${error.message}`;
    detectBtn.disabled = true;
  }
}

// 2. Listar câmeras disponíveis
async function populateCameraSelect() {
  try {
    cameraSelect.innerHTML = '';
    
    availableCameras = (await navigator.mediaDevices.enumerateDevices())
      .filter(device => device.kind === 'videoinput');
    
    if (availableCameras.length === 0) {
      cameraSelect.innerHTML = '<option value="">Nenhuma câmera encontrada</option>';
      startBtn.disabled = true;
      statusDiv.textContent = "Nenhuma câmera detectada";
      return;
    }
    
    availableCameras.forEach((camera, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.text = camera.label || `Câmera ${index + 1}`;
      cameraSelect.appendChild(option);
    });

    startBtn.disabled = false;
    statusDiv.textContent = `${availableCameras.length} câmera(s) detectada(s)`;

  } catch (error) {
    console.error("Erro ao listar câmeras:", error);
    statusDiv.textContent = "Erro ao acessar dispositivos";
    startBtn.disabled = true;
  }
}

// 3. Iniciar câmera selecionada
async function startCamera() {
  try {
    statusDiv.textContent = "Iniciando câmera...";
    startBtn.disabled = true;
    detectBtn.disabled = true;

    const selectedCameraIndex = cameraSelect.value;
    
    if (!availableCameras[selectedCameraIndex]) {
      throw new Error("Selecione uma câmera válida");
    }

    // Encerrar stream anterior se existir
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        deviceId: availableCameras[selectedCameraIndex].deviceId
      },
      audio: false
    });

    video.srcObject = stream;

    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        resolve();
      };
    });

    video.play();
    statusDiv.textContent = `Câmera ativa! Usando: ${availableCameras[selectedCameraIndex].label || 'Câmera'}`;
    detectBtn.disabled = false;

  } catch (error) {
    statusDiv.textContent = `Erro na câmera: ${error.message}`;
    console.error("Erro detalhado:", error);
    startBtn.disabled = false;

    if (error.name === "NotAllowedError") {
      statusDiv.textContent = "Permissão negada. Atualize e clique em 'Permitir'.";
    } else if (error.name === "NotFoundError") {
      statusDiv.textContent = "Câmera não encontrada.";
    } else if (error.name === "NotReadableError") {
      statusDiv.textContent = "Câmera em uso por outro app.";
    }
  }
}

// 4. Função de detecção principal
function detect() {
  if (!isDetecting || !faceDetector) return;
  
  const startTimeMs = performance.now();
  
  // Só processar se o vídeo tiver tempo novo
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    
    // Limpar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Desenhar frame do vídeo
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Detectar faces
    const detections = faceDetector.detectForVideo(video, startTimeMs).detections;
    
    // Desenhar detecções
    drawDetections(detections);
  }
  
  animationFrameId = requestAnimationFrame(detect);
}

// 5. Desenhar detecções no canvas
function drawDetections(detections) {
  for (const detection of detections) {
    const box = detection.boundingBox;

    // Desenhar caixa delimitadora
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(box.originX, box.originY, box.width, box.height);

    // Desenhar pontos faciais
    if (detection.keypoints) {
      for (const keypoint of detection.keypoints) {
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#FF00FF';
        ctx.fill();
      }
    }

    // Mostrar confiança
    if (detection.categories && detection.categories[0]) {
      const score = Math.round(detection.categories[0].score * 100);
      ctx.fillStyle = '#00FF00';
      ctx.font = '16px Arial';
      ctx.fillText(
        `${score}%`,
        box.originX + 5,
        box.originY + 20
      );
    }
  }
}


// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  populateCameraSelect();
  setupDetector();
});

startBtn.addEventListener('click', startCamera);

detectBtn.addEventListener('click', () => {
  if (!isDetecting) {
    isDetecting = true;
    detectBtn.textContent = "Parar Detecção";
    detect();
  } else {
    isDetecting = false;
    detectBtn.textContent = "Iniciar Detecção";
    cancelAnimationFrame(animationFrameId);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
});

// Atualizar lista de câmeras quando dispositivos mudarem
navigator.mediaDevices.addEventListener('devicechange', populateCameraSelect);