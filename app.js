// Importação dos módulos do MediaPipe
import {
  FaceLandmarker,
  FilesetResolver
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
let faceLandmarker;
let stream = null;
let isDetecting = false;
let availableCameras = [];
let lastVideoTime = -1;
let animationFrameId;

// Configurar FaceLandmarker
async function setupFaceLandmarker() {
  try {
    statusDiv.textContent = "Carregando modelos...";

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );

    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU",
      },
      outputFaceBlendshapes: false,
      runningMode: "VIDEO",
      numFaces: 1
    });

    statusDiv.textContent = "Modelo carregado!";
    detectBtn.disabled = false;
  } catch (error) {
    console.error("Erro ao configurar FaceLandmarker:", error);
    statusDiv.textContent = `Erro: ${error.message}`;
    detectBtn.disabled = true;
  }
}

// Listar câmeras
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

// Iniciar câmera
async function startCamera() {
  try {
    statusDiv.textContent = "Iniciando câmera...";
    startBtn.disabled = true;
    detectBtn.disabled = true;

    const selectedCameraIndex = cameraSelect.value;

    if (!availableCameras[selectedCameraIndex]) {
      throw new Error("Selecione uma câmera válida");
    }

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

// Função de detecção
function detect() {
  if (!isDetecting || !faceLandmarker) return;

  const startTimeMs = performance.now();

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;

    const results = faceLandmarker.detectForVideo(video, startTimeMs);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (results.faceLandmarks.length > 0) {
      drawLandmarks(results.faceLandmarks[0]);
      checkHeadTilt(results.faceLandmarks[0]);
    }
  }

  animationFrameId = requestAnimationFrame(detect);
}

// Desenhar pontos no rosto
function drawLandmarks(landmarks) {
  ctx.fillStyle = '#00FFFF';
  for (const point of landmarks) {
    ctx.beginPath();
    ctx.arc(point.x * canvas.width, point.y * canvas.height, 2, 0, 2 * Math.PI);
    ctx.fill();
  }
}

// Áudio
const engulaAudio = new Audio('audio/engula_audio.mp3');

// Variáveis de controle do tempo
let tiltStartTime = null;
const tiltThreshold = 75;       // Limite de ângulo
const holdDuration = 1000;      // Tempo necessário em ms (1 segundo)
let audioPlayed = false;        // Controle para não tocar várias vezes

// Detectar inclinação (para deglutição)
function checkHeadTilt(landmarks) {
  const noseTip = landmarks[1];   // Ponta do nariz
  const chin = landmarks[152];    // Queixo

  const noseY = noseTip.y * canvas.height;
  const chinY = chin.y * canvas.height;

  const diffY = chinY - noseY;   // Diferença vertical

  // Mostrar valor de diferença na tela
  ctx.fillStyle = '#00FF00';
  ctx.font = '18px Arial';
  ctx.fillText(`Diferença Y: ${Math.round(diffY)}`, 10, 30);

  const now = Date.now();

  if (diffY < tiltThreshold) {
    if (!tiltStartTime) {
      tiltStartTime = now; // Começa a contar
      audioPlayed = false; // Reseta áudio
    }

    const elapsed = now - tiltStartTime;

    if (elapsed >= holdDuration) {
      ctx.fillStyle = 'red';
      ctx.font = '24px Arial';
      ctx.fillText("Engula!", canvas.width / 2 - 50, 50);

      if (!audioPlayed) {
        engulaAudio.play();
        audioPlayed = true;
      }
    }

  } else {
    // Se saiu da posição, zera o contador e permite tocar novamente
    tiltStartTime = null;
    audioPlayed = false;
  }
}




// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  populateCameraSelect();
  setupFaceLandmarker();
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

navigator.mediaDevices.addEventListener('devicechange', populateCameraSelect);
