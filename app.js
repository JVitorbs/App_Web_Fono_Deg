// Elementos DOM
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const detectBtn = document.getElementById('detectBtn');
const statusDiv = document.getElementById('status');

// Variáveis de estado
let faceDetector, poseDetector;
let isDetecting = false;
let stream = null;

// 1. Configurar detectores
async function setupDetectors() {
  const mp = {
    FaceDetection: window.facedetection?.FaceDetection || window.FaceDetection,
    Pose: window.pose?.Pose || window.Pose,
    DrawingUtils: window.DrawingUtils,
    POSE_CONNECTIONS: window.POSE_CONNECTIONS
  };

  // Face Detection
  faceDetector = new mp.FaceDetection({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
  });
  await faceDetector.setOptions({
    selfieMode: true,
    modelSelection: 0,
    minDetectionConfidence: 0.5
  });

  // Pose Detection (para tronco)
  poseDetector = new mp.Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
  });
  await poseDetector.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5
  });

  // Callbacks para resultados
  faceDetector.onResults(handleFaceResults);
  poseDetector.onResults(handlePoseResults);

  statusDiv.textContent = "Modelos carregados!";
  detectBtn.disabled = false;
}

// 2. Iniciar câmera
async function startCamera() {
  try {
    statusDiv.textContent = "Iniciando câmera...";
    startBtn.disabled = true;

    // Verifica se a API de mídia é suportada
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Seu navegador não suporta acesso à câmera.");
    }

    // Tenta acessar a câmera
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user" // Usa a câmera frontal
      },
      audio: false
    });

    video.srcObject = stream;

    // Espera o vídeo estar pronto
    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        resolve();
      };
    });

    video.play();
    statusDiv.textContent = "Câmera ativa!";
    detectBtn.disabled = false;

  } catch (error) {
    statusDiv.textContent = `Erro na câmera: ${error.message}`;
    console.error("Erro detalhado:", error);
    startBtn.disabled = false;

    // Mensagens específicas para erros comuns
    if (error.name === "NotAllowedError") {
      statusDiv.textContent = "Permissão da câmera negada. Atualize a página e clique em 'Permitir'.";
    } else if (error.name === "NotFoundError") {
      statusDiv.textContent = "Nenhuma câmera encontrada.";
    }
  }
}

// 3. Processar resultados do rosto
function handleFaceResults(results) {
  if (!isDetecting) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
  
  if (results.detections) {
    window.DrawingUtils.drawDetections(ctx, results.detections, {
      color: '#00FFFF',
      lineWidth: 2,
      radius: 4
    });
  }
}

// 4. Processar resultados do tronco
function handlePoseResults(results) {
  if (!isDetecting) return;
  
  if (results.poseLandmarks) {
    // Desenhar pontos do tronco (magenta)
    window.DrawingUtils.drawLandmarks(ctx, results.poseLandmarks, {
      color: '#FF00FF',
      radius: 4
    });
    
    // Conexões personalizadas para o tronco
    const TORSO_CONNECTIONS = [
      [11, 12], [11, 13], [12, 14],  // Ombros e braços
      [11, 23], [12, 24], [23, 24],   // Tronco
      [23, 25], [24, 26]              // Quadris
    ];
    
    window.DrawingUtils.drawConnectors(
      ctx,
      results.poseLandmarks,
      TORSO_CONNECTIONS,
      { color: '#00FF00', lineWidth: 3 }
    );
  }
}

// 5. Loop de detecção
function detect() {
  if (!isDetecting) return;
  
  faceDetector.send({ image: video });
  poseDetector.send({ image: video });
  
  requestAnimationFrame(detect);
}

// Event Listeners
startBtn.addEventListener('click', startCamera);
detectBtn.addEventListener('click', async () => {
  if (!isDetecting) {
    await setupDetectors();
    isDetecting = true;
    detectBtn.textContent = "Parar Detecção";
    detect();
  } else {
    isDetecting = false;
    detectBtn.textContent = "Iniciar Detecção";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
});