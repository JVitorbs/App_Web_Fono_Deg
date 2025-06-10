# **Documentação do Sistema de Detecção de Deglutição para Parkinson**  

## **Objetivo do Projeto**  
Este sistema foi desenvolvido para **auxiliar pacientes com Parkinson e disfagia** (dificuldade de engolir). Ele detecta **movimentos faciais e do pescoço** associados à deglutição e, quando reconhece a tentativa de engolir, emite um **sinal sonoro**. Esse feedback ajuda o paciente a sincronizar o movimento, melhorando a eficácia da deglutição.  

---

## **Tecnologias Utilizadas**  
| Tecnologia | Função |  
|------------|--------|  
| **MediaPipe Face Mesh** | Rastreia 468 pontos faciais para detectar movimentos |  
| **TensorFlow.js** | Classifica os movimentos como "deglutição" ou "não deglutição" |  
| **Web Audio API** | Reproduz um alerta sonoro quando necessário |  
| **JavaScript/Canvas** | Processamento em tempo real e exibição dos resultados |  

---

## **Estrutura do Código**  

### **1. Configuração Inicial**  
```javascript  
// Elementos HTML  
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
```  
**Função:**  
- Declara elementos da interface (câmera, botões, status).  
- Inicializa variáveis para controle do detector e fluxo de vídeo.  

---

### **2. Inicialização dos Modelos MediaPipe**  
```javascript  
async function setupDetectors() {  
    // Configura Face Detection  
    faceDetector = new window.FaceDetection({  
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`  
    });  

    await faceDetector.setOptions({  
        selfieMode: true,  
        minDetectionConfidence: 0.7  
    });  

    // Configura Pose Detection (para pescoço/tronco)  
    poseDetector = new window.Pose({  
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`  
    });  

    await poseDetector.setOptions({  
        modelComplexity: 1,  
        smoothLandmarks: true  
    });  

    // Define callbacks para processamento  
    faceDetector.onResults(handleFaceResults);  
    poseDetector.onResults(handlePoseResults);  
}  
```  
**Função:**  
- Carrega os modelos pré-treinados do MediaPipe para **rosto** e **postura**.  
- Configura parâmetros como `selfieMode` (espelhamento) e sensibilidade (`minDetectionConfidence`).  
- Associa funções de callback para processar os resultados.  

---

### **3. Ativação da Câmera**  
```javascript  
async function startCamera() {  
    try {  
        stream = await navigator.mediaDevices.getUserMedia({  
            video: { width: 640, height: 480, facingMode: "user" },  
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
        statusDiv.textContent = "Câmera ativa!";  
    } catch (error) {  
        console.error("Erro na câmera:", error);  
        statusDiv.textContent = "Falha ao acessar a câmera.";  
    }  
}  
```  
**Função:**  
- Solicita permissão para acessar a câmera do usuário.  
- Ajusta o tamanho do vídeo e do canvas para 640x480 pixels.  
- Exibe mensagens de erro se o acesso for negado.  

---

### **4. Detecção de Deglutição**  
```javascript  
function isSwallowing(landmarks) {  
    const chin = landmarks[152];  // Ponto do queixo  
    const throat = landmarks[285]; // Ponto da laringe  

    // Calcula movimento vertical (queixo + laringe)  
    const verticalMovement = Math.abs(chin.y - throat.y);  

    // Limiar ajustável (dados reais necessários para calibrar)  
    return verticalMovement > 0.1;  
}  

function playBeep() {  
    const audioCtx = new AudioContext();  
    const oscillator = audioCtx.createOscillator();  
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);  
    oscillator.connect(audioCtx.destination);  
    oscillator.start();  
    oscillator.stop(audioCtx.currentTime + 0.3); // Beep curto  
}  
```  
**Função:**  
- `isSwallowing()`: Analisa landmarks faciais para identificar movimento característico de deglutição.  
- `playBeep()`: Emite um sinal sonoro de 800Hz por 0.3 segundos quando a deglutição é detectada.  

---

### **5. Loop Principal**  
```javascript  
function detect() {  
    if (!isDetecting) return;  

    // Envia frame atual para os detectores  
    faceDetector.send({ image: video });  
    poseDetector.send({ image: video });  

    // Repete a cada frame (60fps)  
    requestAnimationFrame(detect);  
}  
```  
**Função:**  
- Roda continuamente enquanto a detecção estiver ativa.  
- Envia cada frame do vídeo para os modelos do MediaPipe.  

---

## **Como Usar?**  
1. **Inicie a câmera** → Clique em "Iniciar Câmera".  
2. **Ative a detecção** → Clique em "Iniciar Detecção".  
3. **Teste movimentos** → Simule engolir para acionar o sinal sonoro.  

---

## **Próximas Etapas**  
- [ ] Coletar dados reais de pacientes para treinar o modelo.  
- [ ] Integrar um classificador ML mais preciso (ex: TensorFlow.js).  
- [ ] Adicionar comando de voz ("Engula agora").  

---

**Licença**: MIT.  
**Repositório**: [GitHub](https://github.com/isd-iin-els/App_Web_Fono_Deg).  

--- 