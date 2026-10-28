# Guía de Compilación de APK Android (EAS Build)

Este documento describe el procedimiento exacto para compilar y generar la aplicación móvil Android (`.apk` independiente) utilizando Expo Application Services (EAS Build).

---

## 1. Requisitos Previos

1. **Cuenta en Expo:** Registro gratuito en [expo.dev](https://expo.dev/signup).
2. **EAS CLI:** Instalar la herramienta oficial de compilación en la nube:
   ```powershell
   npm install -g eas-cli
   ```
3. **Inicio de sesión en EAS:**
   ```powershell
   eas login
   ```

---

## 2. Configuración de Conectividad Móvil (Crucial para APK)

> [!IMPORTANT]
> Un teléfono físico o emulador con la APK instalada **no puede conectarse a `localhost` ni a `127.0.0.1`**, ya que intentaría consultar el propio dispositivo móvil.

Para compilar la APK apuntando a un backend accesible:
1. Define la variable de entorno en `frontend/.env` (o en tu build profile de `eas.json`):
   ```env
   EXPO_PUBLIC_API_URL=https://tu-dominio-o-ip-publica.com/api/v1
   ```
2. Si realizas pruebas en tu red WiFi local, utiliza la IP de tu PC:
   ```env
   EXPO_PUBLIC_API_URL=http://192.168.1.XX:3000/api/v1
   ```

---

## 3. Configuración del Proyecto con EAS

Dentro del directorio `frontend/`:

```powershell
cd frontend
eas project:init
```
Este comando vinculará el proyecto con tu cuenta de Expo y asignará el `projectId` automáticamente en `app.json`.

---

## 4. Ejecutar la Compilación de la APK

Para generar un archivo APK instalable directamente en cualquier dispositivo Android (perfil `preview` configurado en `frontend/eas.json`):

```powershell
eas build -p android --profile preview
```

### Flujo de la compilación:
1. EAS CLI te consultará si deseas generar un nuevo Android Keystore. Selecciona **Yes** (EAS gestionará las firmas de forma segura).
2. La compilación se ejecutará en los servidores de Expo en la nube.
3. Al finalizar, la terminal te entregará una URL directa de descarga del archivo `.apk` y un código QR para instalarlo escaneando con la cámara del celular.

---

## 5. Declaración de Estado de la APK

- **Estado actual:** La configuración de compilación local y en la nube (`app.json`, `eas.json` con `buildType: "apk"`, bundle package `com.kinesiologia.app`) está **100% preparada y validada**.
- **Generación en este entorno:** La generación efectiva de la APK requiere una sesión activa con credenciales de usuario en Expo (`eas login`), por lo que **el archivo `.apk` no ha sido generado localmente en esta máquina de trabajo**. Debe ejecutarse el comando indicado arriba con una cuenta de Expo.
