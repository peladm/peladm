'use client';

import { useState, useEffect } from 'react';

interface ChangelogEntry {
  date: string;
  title: string;
  features?: string[];
  improvements?: string[];
  fixes?: string[];
}

interface VersionInfo {
  version: string;
  releaseDate: string;
  changelog: Record<string, ChangelogEntry>;
}

export default function UpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>('');

  useEffect(() => {
    // Verifica versão no localStorage
    const storedVersion = localStorage.getItem('app_version');
    
    // Busca versão atual do servidor
    fetch('/version.json')
      .then(res => res.json())
      .then((data: VersionInfo) => {
        setVersionInfo(data);
        setCurrentVersion(data.version);
        
        // Se a versão mudou, mostra notificação
        if (storedVersion && storedVersion !== data.version) {
          setShowUpdate(true);
        } else if (!storedVersion) {
          // Primeira instalação - salva versão
          localStorage.setItem('app_version', data.version);
        }
      })
      .catch(err => {
        console.error('Erro ao verificar versão:', err);
      });

    // Escuta mensagens do Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_UPDATED') {
          console.log('🔄 Nova versão detectada:', event.data.version);
          // Recarrega dados de versão
          fetch('/version.json')
            .then(res => res.json())
            .then((data: VersionInfo) => {
              setVersionInfo(data);
              setCurrentVersion(data.version);
              setShowUpdate(true);
            });
        }
      });
    }
  }, []);

  const handleUpdate = () => {
    // Atualiza versão no localStorage
    localStorage.setItem('app_version', currentVersion);
    
    // Limpa cache do Service Worker
    if ('serviceWorker' in navigator) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName);
        });
      });
    }
    
    // Recarrega a página
    window.location.reload();
  };

  const viewChangelog = () => {
    localStorage.setItem('app_version', currentVersion);
    setShowUpdate(false);
    setShowChangelog(true);
  };

  if (!showUpdate && !showChangelog) return null;

  const latestChangelog = versionInfo?.changelog[currentVersion];

  return (
    <>
      {/* Modal de Atualização */}
      {showUpdate && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '20px',
            maxWidth: '450px',
            width: '100%',
            padding: '32px 24px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉</div>
            
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 'bold',
              marginBottom: '8px',
              color: '#1a1a1a'
            }}>
              Nova Atualização!
            </h2>
            
            <p style={{
              fontSize: '1.1rem',
              fontWeight: '600',
              color: '#16a34a',
              marginBottom: '16px'
            }}>
              Versão {currentVersion}
            </p>

            {latestChangelog && (
              <div style={{
                background: '#f8f9fa',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '24px',
                textAlign: 'left'
              }}>
                <h3 style={{
                  fontSize: '0.95rem',
                  fontWeight: '700',
                  color: '#1a1a1a',
                  marginBottom: '12px'
                }}>
                  {latestChangelog.title}
                </h3>
                
                {latestChangelog.features && latestChangelog.features.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    {latestChangelog.features.slice(0, 3).map((feature, idx) => (
                      <div key={idx} style={{
                        fontSize: '0.85rem',
                        color: '#4b5563',
                        marginBottom: '4px',
                        lineHeight: '1.4'
                      }}>
                        {feature}
                      </div>
                    ))}
                    {latestChangelog.features.length > 3 && (
                      <div style={{
                        fontSize: '0.8rem',
                        color: '#16a34a',
                        marginTop: '8px',
                        fontWeight: '600'
                      }}>
                        + {latestChangelog.features.length - 3} novidades...
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={handleUpdate}
                style={{
                  width: '100%',
                  padding: '14px',
                  fontSize: '1rem',
                  fontWeight: '700',
                  border: 'none',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                  color: '#fff',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)'
                }}
              >
                Atualizar Agora
              </button>
              
              <button
                onClick={viewChangelog}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  background: '#fff',
                  color: '#6b7280',
                  cursor: 'pointer'
                }}
              >
                Ver Todas as Novidades
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Changelog Completo */}
      {showChangelog && versionInfo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
          overflowY: 'auto'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '20px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #e5e7eb',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📋</div>
              <h2 style={{ 
                fontSize: '1.5rem', 
                fontWeight: 'bold',
                marginBottom: '4px',
                color: '#1a1a1a'
              }}>
                Histórico de Atualizações
              </h2>
              <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                Versão {versionInfo.version}
              </p>
            </div>

            {/* Changelog */}
            <div style={{
              padding: '24px',
              overflowY: 'auto',
              flex: 1
            }}>
              {Object.entries(versionInfo.changelog).map(([version, info]) => (
                <div key={version} style={{
                  marginBottom: '24px',
                  paddingBottom: '24px',
                  borderBottom: '1px solid #f3f4f6'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px'
                  }}>
                    <h3 style={{
                      fontSize: '1.1rem',
                      fontWeight: '700',
                      color: '#16a34a'
                    }}>
                      v{version}
                    </h3>
                    <span style={{
                      fontSize: '0.8rem',
                      color: '#9ca3af',
                      fontWeight: '600'
                    }}>
                      {info.date}
                    </span>
                  </div>

                  <p style={{
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    color: '#1a1a1a',
                    marginBottom: '12px'
                  }}>
                    {info.title}
                  </p>

                  {info.features && info.features.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <h4 style={{
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        color: '#4b5563',
                        marginBottom: '8px'
                      }}>
                        ✨ Novidades
                      </h4>
                      {info.features.map((feature, idx) => (
                        <div key={idx} style={{
                          fontSize: '0.85rem',
                          color: '#6b7280',
                          marginBottom: '4px',
                          paddingLeft: '8px'
                        }}>
                          {feature}
                        </div>
                      ))}
                    </div>
                  )}

                  {info.improvements && info.improvements.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <h4 style={{
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        color: '#4b5563',
                        marginBottom: '8px'
                      }}>
                        🚀 Melhorias
                      </h4>
                      {info.improvements.map((improvement, idx) => (
                        <div key={idx} style={{
                          fontSize: '0.85rem',
                          color: '#6b7280',
                          marginBottom: '4px',
                          paddingLeft: '8px'
                        }}>
                          {improvement}
                        </div>
                      ))}
                    </div>
                  )}

                  {info.fixes && info.fixes.length > 0 && (
                    <div>
                      <h4 style={{
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        color: '#4b5563',
                        marginBottom: '8px'
                      }}>
                        🔧 Correções
                      </h4>
                      {info.fixes.map((fix, idx) => (
                        <div key={idx} style={{
                          fontSize: '0.85rem',
                          color: '#6b7280',
                          marginBottom: '4px',
                          paddingLeft: '8px'
                        }}>
                          {fix}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{
              padding: '20px',
              borderTop: '1px solid #e5e7eb'
            }}>
              <button
                onClick={() => {
                  setShowChangelog(false);
                  handleUpdate();
                }}
                style={{
                  width: '100%',
                  padding: '14px',
                  fontSize: '1rem',
                  fontWeight: '700',
                  border: 'none',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                Entendido, Atualizar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
