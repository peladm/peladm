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

  // Som de gol - Melodia celebração
  playGoalSound() {
    this.init();
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Melodia de gol: C5 -> E5 -> G5
    const frequencies = [523.25, 659.25, 783.99]; // Dó, Mi, Sol
    let time = now;

    frequencies.forEach((freq, index) => {
      oscillator.frequency.setValueAtTime(freq, time);
      gainNode.gain.setValueAtTime(0.3, time);
      gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
      time += 0.15;
    });

    oscillator.start(now);
    oscillator.stop(now + 0.5);
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
