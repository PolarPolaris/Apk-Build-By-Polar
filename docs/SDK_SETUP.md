# Configuração dos SDKs - Universal APK Builder

Este guia explica como configurar os SDKs necessários para compilar APKs offline.

## Download Automático (Recomendado)

Execute o script de setup:

```bash
npm run setup-sdks
```

## Download Manual

Se preferir baixar manualmente:

### 1. OpenJDK 17

- **URL**: https://adoptium.net/temurin/releases/?version=17
- **Destino**: `bundled/jdk/`
- Extraia o conteúdo para que `bundled/jdk/bin/java.exe` exista

### 2. Android SDK

- **URL**: https://developer.android.com/studio#command-line-tools-only
- **Destino**: `bundled/android-sdk/cmdline-tools/latest/`

Após extrair, execute:
```bash
sdkmanager "platform-tools" "build-tools;34.0.0" "platforms;android-34"
```

### 3. Android NDK

- **URL**: https://developer.android.com/ndk/downloads
- **Destino**: `bundled/ndk/r26/`
- Baixe a versão r26 ou mais recente

### 4. Gradle

- **URL**: https://gradle.org/releases/
- **Destino**: `bundled/gradle/8.5/`
- Baixe a versão 8.5 ou compatível

### 5. Node.js

- **URL**: https://nodejs.org/
- **Destino**: `bundled/node/`
- Baixe a versão LTS (20.x)

### 6. .NET SDK (para MAUI)

- **URL**: https://dotnet.microsoft.com/download
- **Destino**: `bundled/dotnet/`
- Instale workloads: `dotnet workload install android maui`

### 7. Unity (Opcional, para jogos)

- **URL**: https://unity.com/download
- **Destino**: `bundled/unity/`
- Instale com suporte Android Build

## Estrutura Final

```
bundled/
├── jdk/
│   └── bin/java.exe
├── android-sdk/
│   ├── platform-tools/
│   ├── build-tools/34.0.0/
│   ├── platforms/android-34/
│   └── cmdline-tools/latest/bin/
├── ndk/r26/
├── gradle/8.5/
├── gradle-cache/
├── node/
├── npm-cache/
├── dotnet/
│   ├── sdk/8.0/
│   └── workloads/
└── unity/ (opcional)
```

## Verificação

Execute para verificar a instalação:

```bash
npm run cli verify
```
