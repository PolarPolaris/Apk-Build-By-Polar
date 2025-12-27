# Universal APK Builder
# Meu Projeto 🚀

Este repositório contém o código-fonte e instruções do projeto.  
Os arquivos grandes estão hospedados externamente devido ao limite do GitHub.

## 📂 Download do Arquivo

- [Arquivo compactado (2.42 GB)](https://mega.nz/file/Kt5gBCDL#EmfP7g_8gv0ZGpZRiduKQA0iBXtfxztIaKkXyQ3RH4I)

## ⚙️ Instruções de Uso

1. **Baixe o arquivo** pelo link acima.  
2. **Descompacte** o arquivo.  
3. Clique em **iniciar.bat** dentro da pasta descompactada.  
   - O programa irá iniciar automaticamente.  
   - Um **atalho será criado na área de trabalho**.  
4. Para usar:
   - Arraste o arquivo da arquivadora diretamente para o programa e solte.  
   - Ao terminar, aparecerá a opção para abrir o arquivo.  
   - Abra e depois **copie ou corte** o arquivo para mover para outra pasta (ex.: `Downloads` ou `Documentos`).

## 🖥️ Compatibilidade

- **Versão 2.0**  
- Suporte a **FreeBSD**, **Linux** e **Windows**.

## ℹ️ Observações

- O arquivo hospedado no Mega é **somente leitura**.  
- Caso o link expire ou você tenha problemas para baixar, abra uma *issue* aqui no GitHub.


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
