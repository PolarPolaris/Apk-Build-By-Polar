// src/renderer/App.tsx
// Interface principal do Universal APK Builder

import React, { useState, useEffect, useCallback } from 'react';
import type { ProjectInfo, BuildOptions, BuildResult, BuildProgress } from '../core/types';

type BuildStatus = 'idle' | 'detecting' | 'building' | 'success' | 'error';

const PROJECT_TYPE_LABELS: Record<string, { icon: string; name: string; template: string }> = {
    web: { icon: '🌐', name: 'Aplicação Web (HTML/CSS/JS)', template: 'WebView com Bridge JS-Nativa' },
    ndk: { icon: '⚡', name: 'Projeto Nativo (C/C++)', template: 'NDK com JNI Wrapper' },
    maui: { icon: '🔷', name: 'Projeto .NET (MAUI/Xamarin)', template: 'dotnet Android Target' },
    reactnative: { icon: '⚛️', name: 'React Native / Expo', template: 'Metro Bundler + Gradle' },
    unity: { icon: '🎮', name: 'Projeto Unity', template: 'Unity Headless Export' },
    unknown: { icon: '❓', name: 'Tipo Desconhecido', template: 'Não detectado' }
};

const App: React.FC = () => {
    // Estado
    const [projectPath, setProjectPath] = useState<string | null>(null);
    const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
    const [status, setStatus] = useState<BuildStatus>('idle');
    const [progress, setProgress] = useState<BuildProgress | null>(null);
    const [result, setResult] = useState<BuildResult | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [envWarning, setEnvWarning] = useState<string[] | null>(null);

    // Configurações de build
    const [config, setConfig] = useState({
        appName: '',
        packageName: 'com.example.app',
        version: '1.0.0',
        versionCode: 1,
        minSdk: 21,
        targetSdk: 34,
        signMode: 'debug' as 'debug' | 'release'
    });

    // Verifica ambiente na inicialização
    useEffect(() => {
        window.electronAPI.verifyEnvironment().then(result => {
            if (!result.valid) {
                setEnvWarning(result.missing);
            }
        });
    }, []);

    // Listener de progresso
    useEffect(() => {
        window.electronAPI.onBuildProgress((prog) => {
            setProgress(prog);
            setLogs(prev => [...prev.slice(-50), `[${prog.percent}%] ${prog.message}`]);
        });

        return () => {
            window.electronAPI.offBuildProgress();
        };
    }, []);

    // Drop handler
    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const items = e.dataTransfer.items;
        if (items.length > 0) {
            const item = items[0];
            if (item.kind === 'file') {
                // No Electron, o objeto File tem a propriedade 'path' com o caminho absoluto
                // @ts-ignore
                const path = e.dataTransfer.files[0].path;
                await detectProject(path);
            }
        }
    }, []);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    // Seleciona pasta manualmente
    const handleSelectFolder = async () => {
        const path = await window.electronAPI.selectFolder();
        if (path) {
            await detectProject(path);
        }
    };

    // Detecta projeto
    const detectProject = async (path: string) => {
        setStatus('detecting');
        setProjectPath(path);

        try {
            const info = await window.electronAPI.detectProject(path);
            setProjectInfo(info);
            // Atualiza path com o retornado (pode ser temp dir se for arquivo único)
            setProjectPath(info.path);

            setConfig(prev => ({
                ...prev,
                appName: info.suggestedName,
                packageName: `com.${info.suggestedName.toLowerCase()}.app`
            }));
            setStatus('idle');
        } catch (error) {
            console.error('Erro ao detectar projeto:', error);
            setStatus('idle');
        }
    };

    // Inicia build
    const handleBuild = async () => {
        if (!projectPath || !projectInfo) return;

        setStatus('building');
        setLogs([]);
        setResult(null);

        const options: Partial<BuildOptions> = {
            appName: config.appName,
            packageName: config.packageName,
            version: config.version,
            versionCode: config.versionCode,
            minSdk: config.minSdk,
            targetSdk: config.targetSdk,
            compileSdk: config.targetSdk,
            signMode: config.signMode,
            abis: ['arm64-v8a', 'armeabi-v7a'],
            permissions: ['android.permission.INTERNET'],
            proguardEnabled: false
        };

        try {
            const buildResult = await window.electronAPI.startBuild(projectPath, options);
            setResult(buildResult);
            setStatus(buildResult.success ? 'success' : 'error');
        } catch (error) {
            setResult({
                success: false,
                errors: [error instanceof Error ? error.message : String(error)],
                warnings: [],
                buildTime: 0
            });
            setStatus('error');
        }
    };

    // Abre pasta do APK
    const handleOpenFolder = () => {
        if (result?.apkPath) {
            window.electronAPI.openOutputFolder(result.apkPath);
        }
    };

    // Reseta para novo build
    const handleReset = () => {
        setProjectPath(null);
        setProjectInfo(null);
        setStatus('idle');
        setProgress(null);
        setResult(null);
        setLogs([]);
    };

    const typeInfo = projectInfo ? PROJECT_TYPE_LABELS[projectInfo.type] : null;

    return (
        <div className="app">
            {/* Header */}
            <header className="header fade-in-down">
                <div className="header-content">
                    <div className="header-icon-wrapper">
                        <div className="header-icon">❄️</div>
                    </div>
                    <div>
                        <h1 className="header-title">Polar Build Apk</h1>
                        <div className="header-subtitle">Construção Universal de Apps • Offline First</div>
                    </div>
                </div>
            </header>

            <main className="main-content">
                {/* ... conteúdo existente ... */}
                {/* Aviso de ambiente */}
                {envWarning && (
                    <div className="env-warning fade-in">
                        <div className="env-warning-icon">⚠️</div>
                        <div className="env-warning-text">
                            <div className="env-warning-title">SDKs não encontrados</div>
                            <div className="env-warning-list">
                                Faltando: {envWarning.join(', ')}
                            </div>
                        </div>
                    </div>
                )}

                {/* Drop Zone */}
                <div
                    className={`drop-zone ${status === 'detecting' ? 'pulse' : ''} ${projectPath ? 'has-project' : ''}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={!projectPath ? handleSelectFolder : undefined}
                >
                    <div className="drop-zone-content">
                        <div className="drop-zone-icon">
                            {status === 'detecting' ? '🔍' : projectPath ? '✨' : '📂'}
                        </div>
                        <div className="drop-zone-title">
                            {status === 'detecting'
                                ? 'Analisando projeto...'
                                : projectPath
                                    ? 'Projeto Identificado'
                                    : 'Arraste seu projeto aqui'}
                        </div>
                        <div className="drop-zone-subtitle">
                            {projectPath ? 'Clique para trocar de projeto' : 'Suporta Web, Android Nativo, React Native, Unity'}
                        </div>
                        {projectPath && (
                            <div className="project-path">{projectPath}</div>
                        )}
                    </div>
                </div>

                {/* Tipo de Projeto Detectado */}
                {projectInfo && typeInfo && (
                    <div className="project-type-card glass-card fade-in-up">
                        <div className="project-type-header">
                            <span className="project-type-icon">{typeInfo.icon}</span>
                            <div className="project-type-info">
                                <span className="project-type-name">{typeInfo.name}</span>
                                <span className="project-type-template">{typeInfo.template}</span>
                            </div>
                            <div className="project-type-badge">
                                {projectInfo.confidence}% Confiança
                            </div>
                        </div>
                    </div>
                )}

                {/* Configuração */}
                {projectInfo && projectInfo.type !== 'unknown' && status !== 'building' && status !== 'success' && status !== 'error' && (
                    <div className="config-section fade-in">
                        <h3 className="config-title">Configuração</h3>
                        <div className="config-grid">
                            <div className="form-group">
                                <label className="form-label">Nome do App</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={config.appName}
                                    onChange={e => setConfig(prev => ({ ...prev, appName: e.target.value }))}
                                    placeholder="Meu App"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Package Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={config.packageName}
                                    onChange={e => setConfig(prev => ({ ...prev, packageName: e.target.value }))}
                                    placeholder="com.exemplo.app"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Versão</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={config.version}
                                    onChange={e => setConfig(prev => ({ ...prev, version: e.target.value }))}
                                    placeholder="1.0.0"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">SDK Mínimo</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={config.minSdk}
                                    onChange={e => setConfig(prev => ({ ...prev, minSdk: parseInt(e.target.value) || 21 }))}
                                    min={21}
                                    max={34}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">SDK Alvo</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={config.targetSdk}
                                    onChange={e => setConfig(prev => ({ ...prev, targetSdk: parseInt(e.target.value) || 34 }))}
                                    min={21}
                                    max={34}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Assinatura</label>
                                <div className="radio-group">
                                    <label className="radio-label">
                                        <input
                                            type="radio"
                                            className="radio-input"
                                            name="signMode"
                                            checked={config.signMode === 'debug'}
                                            onChange={() => setConfig(prev => ({ ...prev, signMode: 'debug' }))}
                                        />
                                        Debug
                                    </label>
                                    <label className="radio-label">
                                        <input
                                            type="radio"
                                            className="radio-input"
                                            name="signMode"
                                            checked={config.signMode === 'release'}
                                            onChange={() => setConfig(prev => ({ ...prev, signMode: 'release' }))}
                                        />
                                        Release
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Botão de Build */}
                {projectInfo && projectInfo.type !== 'unknown' && status === 'idle' && (
                    <button
                        className="btn-primary"
                        onClick={handleBuild}
                        disabled={!config.appName || !config.packageName}
                    >
                        🚀 Iniciar Build APK
                    </button>
                )}

                {/* Progresso */}
                {status === 'building' && progress && (
                    <div className="progress-section fade-in">
                        <div className="progress-header">
                            <span className="progress-stage">{progress.stage}</span>
                            <span className="progress-percent">{progress.percent}%</span>
                        </div>
                        <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
                        </div>
                        <div className="progress-message">{progress.message}</div>
                    </div>
                )}

                {/* Logs */}
                {logs.length > 0 && (status === 'building' || status === 'error') && (
                    <div className="log-section fade-in">
                        {logs.map((log, i) => (
                            <div
                                key={i}
                                className={`log-line ${log.includes('erro') || log.includes('Error') ? 'error' : ''}`}
                            >
                                {log}
                            </div>
                        ))}
                    </div>
                )}

                {/* Resultado - Sucesso */}
                {status === 'success' && result && (
                    <div className="result-card success fade-in">
                        <div className="result-icon">✅</div>
                        <div className="result-title">APK Gerado com Sucesso!</div>
                        <div className="result-message">
                            Tempo de build: {(result.buildTime / 1000).toFixed(1)}s
                        </div>
                        {result.apkPath && (
                            <>
                                <div className="result-path">{result.apkPath}</div>
                                <button className="btn-primary" onClick={handleOpenFolder}>
                                    📂 Abrir Pasta
                                </button>
                            </>
                        )}
                        <button
                            className="btn-secondary"
                            onClick={handleReset}
                            style={{ marginLeft: 12 }}
                        >
                            🔄 Novo Build
                        </button>
                    </div>
                )}

                {/* Resultado - Erro */}
                {status === 'error' && result && (
                    <div className="result-card error fade-in">
                        <div className="result-icon">❌</div>
                        <div className="result-title">Falha no Build</div>
                        <div className="result-message">
                            {result.errors.join('\n')}
                        </div>
                        <button className="btn-danger" onClick={handleReset}>
                            🔄 Tentar Novamente
                        </button>
                    </div>
                )}
            </main>

            <footer className="footer fade-in">
                <div className="footer-content">
                    <p>By Matheus Polar Polaris 2026</p>
                    <div className="footer-badges">
                        <span className="badge">Secured</span>
                        <span className="badge">v2.0</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default App;
