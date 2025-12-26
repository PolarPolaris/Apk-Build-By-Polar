# Universal APK Builder

Motor de build universal que gera APKs a partir de projetos Web, C/C++, C#, React Native e Unity.

## Requisitos

- Node.js 20+
- Electron 28+

## Instalação

```bash
npm install
```

## Uso

### Interface Gráfica

```bash
npm run dev
```

Arraste sua pasta de projeto para a interface e clique em "Gerar APK".

### CLI

```bash
# Detectar tipo de projeto
npm run cli detect ./meu-projeto

# Compilar APK
npm run cli build ./meu-projeto --name "Meu App"

# Verificar SDKs
npm run cli verify
```

## Tipos de Projeto Suportados

| Tipo | Detecção | Template |
|------|----------|----------|
| **Web** | `index.html`, `package.json` | WebView + Bridge JS |
| **NDK** | `.c/.cpp`, `CMakeLists.txt` | CMake + JNI Wrapper |
| **MAUI** | `.csproj`, `MAUIProgram.cs` | dotnet Android |
| **React Native** | `react-native` em `package.json` | Metro + Gradle |
| **Unity** | `ProjectSettings/`, `Assets/` | Headless Export |

## Estrutura de SDKs

Os SDKs devem ser instalados em `bundled/`:

```
bundled/
├── jdk/           # OpenJDK 17
├── android-sdk/   # Android SDK 34
├── ndk/r26/       # Android NDK
├── gradle/        # Gradle 8.5
├── gradle-cache/  # Cache offline
├── node/          # Node.js 20
├── npm-cache/     # Cache npm
├── dotnet/        # dotnet SDK 8
└── unity/         # Unity Editor
```

## Licença

MIT
