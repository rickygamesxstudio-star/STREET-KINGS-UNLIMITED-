import * as THREE from 'three';

export interface ProceduralTextureSet {
  asphalt: THREE.CanvasTexture;
  highway: THREE.CanvasTexture;
  dirt: THREE.CanvasTexture;
  buildingFacade: THREE.CanvasTexture;
  buildingWarm: THREE.CanvasTexture;
  checkered: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const configureColorTex = (canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = Math.max(1, maxAnisotropy);
    tex.needsUpdate = true;
    return tex;
  };

  // 1. City Asphalt with subtle aggregate & dashed lane markings
  const asphaltCanvas = document.createElement('canvas');
  asphaltCanvas.width = 512;
  asphaltCanvas.height = 512;
  const aCtx = asphaltCanvas.getContext('2d')!;
  aCtx.fillStyle = '#25272d';
  aCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 32 + Math.floor(Math.random() * 24);
    aCtx.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
    aCtx.fillRect(x, y, 2, 2);
  }
  // Outer edge white lines
  aCtx.fillStyle = 'rgba(244, 244, 245, 0.72)';
  aCtx.fillRect(14, 0, 8, 512);
  aCtx.fillRect(490, 0, 8, 512);
  // Center dashed yellow line
  aCtx.fillStyle = '#f59e0b';
  for (let y = 16; y < 512; y += 64) {
    aCtx.fillRect(252, y, 8, 34);
  }
  const asphalt = configureColorTex(asphaltCanvas, 1, 1);

  // 2. Highway 4-lane texture
  const hwCanvas = document.createElement('canvas');
  hwCanvas.width = 512;
  hwCanvas.height = 512;
  const hCtx = hwCanvas.getContext('2d')!;
  hCtx.fillStyle = '#1f2127';
  hCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 26 + Math.floor(Math.random() * 20);
    hCtx.fillStyle = `rgb(${v},${v},${v + 2})`;
    hCtx.fillRect(x, y, 2, 2);
  }
  hCtx.fillStyle = 'rgba(255,255,255,0.8)';
  hCtx.fillRect(12, 0, 8, 512);
  hCtx.fillRect(492, 0, 8, 512);
  hCtx.fillStyle = '#fbbf24';
  hCtx.fillRect(249, 0, 5, 512);
  hCtx.fillRect(258, 0, 5, 512);
  hCtx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let y = 12; y < 512; y += 64) {
    hCtx.fillRect(130, y, 6, 32);
    hCtx.fillRect(376, y, 6, 32);
  }
  const highway = configureColorTex(hwCanvas, 1, 1);

  // 3. Dirt / Rally trail texture
  const dirtCanvas = document.createElement('canvas');
  dirtCanvas.width = 256;
  dirtCanvas.height = 256;
  const dCtx = dirtCanvas.getContext('2d')!;
  dCtx.fillStyle = '#6b4f35';
  dCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const shade = Math.random() > 0.5 ? 'rgba(130,98,66,0.45)' : 'rgba(68,48,30,0.45)';
    dCtx.fillStyle = shade;
    dCtx.fillRect(x, y, 3, 3);
  }
  const dirt = configureColorTex(dirtCanvas, 1, 1);

  // 4. Cool Building Facade
  const makeBuildingTex = (warm: boolean) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 512;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = warm ? '#272422' : '#1e222b';
    ctx.fillRect(0, 0, 256, 512);
    const cols = 8;
    const rows = 16;
    const padX = 6;
    const padY = 8;
    const w = (256 - padX * (cols + 1)) / cols;
    const h = (512 - padY * (rows + 1)) / rows;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const lit = Math.random();
        if (lit > 0.42) {
          ctx.fillStyle = warm
            ? lit > 0.85
              ? '#fde68a'
              : '#fbbf24'
            : lit > 0.82
            ? '#bae6fd'
            : '#60a5fa';
        } else {
          ctx.fillStyle = '#0f131a';
        }
        ctx.fillRect(padX + col * (w + padX), padY + r * (h + padY), w, h);
      }
    }
    return configureColorTex(c, 1, 1);
  };

  const buildingFacade = makeBuildingTex(false);
  const buildingWarm = makeBuildingTex(true);

  // 5. Checkered Racing Banner
  const chkCanvas = document.createElement('canvas');
  chkCanvas.width = 256;
  chkCanvas.height = 64;
  const cCtx = chkCanvas.getContext('2d')!;
  const sq = 16;
  for (let y = 0; y < 64; y += sq) {
    for (let x = 0; x < 256; x += sq) {
      cCtx.fillStyle = ((x / sq + y / sq) % 2 === 0) ? '#fafafa' : '#18181b';
      cCtx.fillRect(x, y, sq, sq);
    }
  }
  const checkered = configureColorTex(chkCanvas, 2, 1);

  // 6. Contact Shadow radial gradient
  const shCanvas = document.createElement('canvas');
  shCanvas.width = 128;
  shCanvas.height = 128;
  const sCtx = shCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(64, 64, 12, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,0.68)');
  grad.addColorStop(0.65, 'rgba(0,0,0,0.32)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(shCanvas);
  contactShadow.needsUpdate = true;

  return {
    asphalt,
    highway,
    dirt,
    buildingFacade,
    buildingWarm,
    checkered,
    contactShadow,
  };
}
