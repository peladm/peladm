// =========================================
// SERVIÇO DE SONS
// =========================================
// Gerencia sons do aplicativo usando Web Audio API

class SoundService {
  private audioContext: AudioContext | null = null;
  private isInitialized = false;

  // Inicializar contexto de áudio (necessário após interação do usuário)
  private init() {
    if (!this.isInitialized && typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.isInitialized = true;
    }
  }

  // Som de gol - Torcida comemorando
  playGoalSound() {
    this.init();
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    
    // Criar múltiplas camadas de ruído para simular torcida
    for (let i = 0; i < 3; i++) {
      const bufferSize = this.audioContext.sampleRate * 0.8; // 0.8 segundos
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      
      // Gerar ruído branco com variação para simular vozes
      for (let j = 0; j < bufferSize; j++) {
        data[j] = (Math.random() * 2 - 1) * 0.08;
      }
      
      const source = this.audioContext.createBufferSource();
      const filter = this.audioContext.createBiquadFilter();
      const gainNode = this.audioContext.createGain();
      
      source.buffer = buffer;
      
      // Filtro para simular vozes humanas (100-3000Hz)
      filter.type = 'bandpass';
      filter.frequency.value = 800 + (i * 400); // Variação de frequência
      filter.Q.value = 1.5;
      
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Envelope: crescendo até pico e depois fade out
      const startTime = now + (i * 0.05);
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.1); // Crescendo
      gainNode.gain.setValueAtTime(0.15, startTime + 0.3); // Mantém
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.8); // Fade out
      
      source.start(startTime);
      source.stop(startTime + 0.8);
    }
    
    // Adicionar um "apito de comemoração" curto no início
    const whistle = this.audioContext.createOscillator();
    const whistleGain = this.audioContext.createGain();
    
    whistle.connect(whistleGain);
    whistleGain.connect(this.audioContext.destination);
    
    whistle.frequency.setValueAtTime(2000, now);
    whistle.frequency.exponentialRampToValueAtTime(2500, now + 0.15);
    whistle.type = 'sine';
    
    whistleGain.gain.setValueAtTime(0.12, now);
    whistleGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    
    whistle.start(now);
    whistle.stop(now + 0.15);
  }

  // Som de apito - Apito de fim de jogo (3 toques curtos)
  playWhistleSound() {
    this.init();
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    
    // 3 apitos curtos
    for (let i = 0; i < 3; i++) {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Frequência de apito: ~3000Hz
      oscillator.frequency.value = 3000;
      oscillator.type = 'sine';

      const startTime = now + (i * 0.2);
      const duration = 0.15;

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    }
  }

  // Som de sucesso - Feedback positivo
  playSuccessSound() {
    this.init();
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.setValueAtTime(440, now); // A4
    oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.1); // A5
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    oscillator.start(now);
    oscillator.stop(now + 0.3);
  }
}

export const soundService = new SoundService();
