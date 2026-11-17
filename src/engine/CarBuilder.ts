import * as THREE from 'three';
import { CarBodyStyle, CarCustomization, CarSpec } from '../types/game';

export interface CarVisualRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  bodyMaterial: THREE.MeshPhysicalMaterial;
  rimMaterial: THREE.MeshStandardMaterial;
  tailLightMaterial: THREE.MeshStandardMaterial;
  headLightMaterial: THREE.MeshStandardMaterial;
  underglowMesh: THREE.Mesh;
  spoilerGroup: THREE.Group;
  steeringWheel: THREE.Group;
  frontSteerPivots: [THREE.Group, THREE.Group];
  wheelSpinGroups: THREE.Group[];
  nitroFlames: [THREE.Mesh, THREE.Mesh];
  policeBarLeft?: THREE.Mesh;
  policeBarRight?: THREE.Mesh;
  cockpitAnchor: THREE.Object3D;
  cockpitLookAt: THREE.Object3D;
  hoodAnchor: THREE.Object3D;
  hoodLookAt: THREE.Object3D;
}

export interface CharacterVisualRig {
  root: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
}

/**
 * Creates a sculpted, tapered lower hull + beltline using a multi-station cross-section loft
 * so cars have curved shoulders, tapered noses, tumblehome flanks, and realistic proportions
 * rather than flat boxy slabs.
 */
function createSculptedLowerBodyGeometry(
  style: CarBodyStyle,
  width: number,
  length: number,
  height: number
): THREE.BufferGeometry {
  const halfL = length / 2;
  const halfW = width / 2;
  const shoulderH =
    style === 'offroad'
      ? height * 0.56
      : style === 'supercar'
      ? height * 0.54
      : height * 0.52;

  // Longitudinal stations from front (-halfL) to rear (+halfL)
  // [zNorm (-1 front .. +1 rear), bottomY, beltY, bottomHalfWScale, midHalfWScale, shoulderHalfWScale]
  type Station = [number, number, number, number, number, number];
  let stations: Station[];

  if (style === 'supercar') {
    stations = [
      [-1.0, 0.14, 0.28, 0.62, 0.72, 0.56],
      [-0.86, 0.11, 0.44, 0.88, 0.96, 0.84],
      [-0.55, 0.1, 0.54, 0.95, 1.0, 0.92],
      [-0.2, 0.09, 0.58, 0.93, 0.98, 0.91],
      [0.25, 0.09, 0.62, 0.96, 1.02, 0.94],
      [0.65, 0.11, 0.66, 0.98, 1.03, 0.93],
      [0.9, 0.14, 0.62, 0.91, 0.95, 0.86],
      [1.0, 0.19, 0.54, 0.76, 0.82, 0.72],
    ];
  } else if (style === 'offroad') {
    stations = [
      [-1.0, 0.24, 0.66, 0.8, 0.88, 0.82],
      [-0.84, 0.18, 0.82, 0.96, 1.0, 0.94],
      [-0.45, 0.16, 0.88, 0.97, 1.0, 0.95],
      [0.15, 0.16, 0.88, 0.97, 1.0, 0.95],
      [0.65, 0.18, 0.86, 0.97, 1.0, 0.94],
      [0.92, 0.22, 0.82, 0.93, 0.96, 0.89],
      [1.0, 0.26, 0.76, 0.84, 0.88, 0.82],
    ];
  } else if (style === 'muscle') {
    stations = [
      [-1.0, 0.13, 0.44, 0.76, 0.84, 0.74],
      [-0.85, 0.11, 0.58, 0.94, 0.99, 0.91],
      [-0.4, 0.1, 0.64, 0.95, 1.0, 0.93],
      [0.2, 0.1, 0.66, 0.96, 1.02, 0.94],
      [0.68, 0.12, 0.7, 0.97, 1.03, 0.94],
      [0.92, 0.15, 0.66, 0.92, 0.96, 0.88],
      [1.0, 0.19, 0.58, 0.8, 0.86, 0.78],
    ];
  } else {
    // coupe / jdm / sedan
    stations = [
      [-1.0, 0.13, 0.38, 0.7, 0.8, 0.68],
      [-0.84, 0.1, 0.54, 0.92, 0.98, 0.9],
      [-0.45, 0.09, 0.62, 0.95, 1.0, 0.92],
      [0.15, 0.09, 0.64, 0.94, 0.99, 0.91],
      [0.62, 0.11, 0.66, 0.96, 1.01, 0.92],
      [0.9, 0.14, 0.64, 0.9, 0.95, 0.86],
      [1.0, 0.18, 0.54, 0.76, 0.82, 0.74],
    ];
  }

  // Ring per station: 8 perimeter vertices (bottom-left, mid-left, shoulder-left, crown-left, crown-right, shoulder-right, mid-right, bottom-right)
  const rings: THREE.Vector3[][] = stations.map(([zn, bY, sY, bWs, mWs, sWs]) => {
    const z = zn * halfL;
    const midY = bY + (sY - bY) * 0.52;
    const crownY = sY + Math.max(0.03, shoulderH * 0.09);
    const bw = halfW * bWs;
    const mw = halfW * mWs;
    const sw = halfW * sWs;
    const cw = halfW * sWs * 0.74;
    return [
      new THREE.Vector3(-bw, bY, z),
      new THREE.Vector3(-mw, midY, z),
      new THREE.Vector3(-sw, sY, z),
      new THREE.Vector3(-cw, crownY, z),
      new THREE.Vector3(cw, crownY, z),
      new THREE.Vector3(sw, sY, z),
      new THREE.Vector3(mw, midY, z),
      new THREE.Vector3(bw, bY, z),
    ];
  });

  const positions: number[] = [];
  const pushTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  const pushQuad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
    pushTri(a, b, c);
    pushTri(a, c, d);
  };

  const ringPts = 8;
  for (let i = 0; i < rings.length - 1; i++) {
    const r1 = rings[i];
    const r2 = rings[i + 1];
    for (let j = 0; j < ringPts; j++) {
      const next = (j + 1) % ringPts;
      pushQuad(r1[j], r2[j], r2[next], r1[next]);
    }
  }

  // Cap front (-Z)
  const f = rings[0];
  const fCenter = new THREE.Vector3(0, (f[0].y + f[3].y) * 0.5, f[0].z - 0.04);
  for (let j = 0; j < ringPts; j++) {
    const next = (j + 1) % ringPts;
    pushTri(fCenter, f[j], f[next]);
  }

  // Cap rear (+Z)
  const b = rings[rings.length - 1];
  const bCenter = new THREE.Vector3(0, (b[0].y + b[3].y) * 0.5, b[0].z + 0.03);
  for (let j = 0; j < ringPts; j++) {
    const next = (j + 1) % ringPts;
    pushTri(bCenter, b[next], b[j]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a realistic sloped tumblehome cabin greenhouse shell (roof + pillars)
 * that tapers inward from the beltline up to the curved roof.
 */
function createCabinRoofGeometry(
  style: CarBodyStyle,
  width: number,
  length: number,
  height: number
): THREE.BufferGeometry {
  const halfL = length / 2;
  const waistH =
    style === 'offroad'
      ? height * 0.54
      : style === 'supercar'
      ? height * 0.52
      : height * 0.54;
  const roofH = height * 0.98;
  const waistHalfW = width * 0.43;
  const roofHalfW = width * (style === 'offroad' ? 0.37 : 0.33);

  const fWaistZ =
    style === 'supercar' ? -halfL * 0.42 : style === 'offroad' ? -halfL * 0.34 : -halfL * 0.36;
  const fRoofZ =
    style === 'supercar' ? -halfL * 0.12 : style === 'offroad' ? -halfL * 0.14 : -halfL * 0.1;
  const rRoofZ =
    style === 'supercar' ? halfL * 0.34 : style === 'offroad' ? halfL * 0.36 : halfL * 0.4;
  const rWaistZ =
    style === 'supercar' ? halfL * 0.72 : style === 'offroad' ? halfL * 0.48 : halfL * 0.72;

  const p = [
    // bottom base quad
    new THREE.Vector3(-waistHalfW, waistH, fWaistZ), // 0 flb
    new THREE.Vector3(waistHalfW, waistH, fWaistZ), // 1 frb
    new THREE.Vector3(waistHalfW, waistH, rWaistZ), // 2 rrb
    new THREE.Vector3(-waistHalfW, waistH, rWaistZ), // 3 rlb
    // roof quad
    new THREE.Vector3(-roofHalfW, roofH, fRoofZ), // 4 flt
    new THREE.Vector3(roofHalfW, roofH, fRoofZ), // 5 frt
    new THREE.Vector3(roofHalfW * 0.96, roofH * 0.98, rRoofZ), // 6 rrt
    new THREE.Vector3(-roofHalfW * 0.96, roofH * 0.98, rRoofZ), // 7 rlt
  ];

  const pos: number[] = [];
  const quad = (a: number, b: number, c: number, d: number) => {
    pos.push(
      p[a].x, p[a].y, p[a].z,
      p[b].x, p[b].y, p[b].z,
      p[c].x, p[c].y, p[c].z,
      p[a].x, p[a].y, p[a].z,
      p[c].x, p[c].y, p[c].z,
      p[d].x, p[d].y, p[d].z
    );
  };

  quad(4, 7, 6, 5); // Roof top
  quad(0, 4, 5, 1); // Front windshield slope
  quad(2, 6, 7, 3); // Rear window fastback slope
  quad(3, 7, 4, 0); // Left side tumblehome window slope
  quad(1, 5, 6, 2); // Right side tumblehome window slope

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds curved tubular fender arch lips wrapping the wheel wells
 */
function createWheelArchMesh(radius: number, thickness: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.TorusGeometry(radius, thickness, 8, 22, Math.PI * 0.96);
  geo.rotateY(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -0.04;
  return mesh;
}

export function createNameplateSprite(label: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(9, 9, 11, 0.82)';
  ctx.beginPath();
  ctx.roundRect(12, 12, 232, 40, 10);
  ctx.fill();
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.slice(0, 18), 128, 33);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(3.4, 0.85, 1);
  sprite.position.set(0, 2.45, 0);
  return sprite;
}

export function buildCompositeCar(
  spec: CarSpec,
  custom: CarCustomization,
  contactShadowTex: THREE.Texture,
  options?: { isPolice?: boolean; isAmbulance?: boolean; isTraffic?: boolean }
): CarVisualRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = spec.clearance;
  root.add(bodyPivot);

  const isPolice = Boolean(options?.isPolice);
  const isAmbulance = Boolean(options?.isAmbulance);
  const isTraffic = Boolean(options?.isTraffic);

  const roughness =
    custom.finish === 'matte' ? 0.58 : custom.finish === 'metallic' ? 0.16 : 0.08;
  const metalness =
    custom.finish === 'matte' ? 0.25 : custom.finish === 'metallic' ? 0.86 : 0.42;
  const clearcoat = custom.finish === 'matte' ? 0.06 : 1.0;

  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: isPolice ? '#14161b' : isAmbulance ? '#f8fafc' : custom.paintColor,
    roughness,
    metalness,
    clearcoat,
    clearcoatRoughness: 0.04,
    reflectivity: 0.96,
    envMapIntensity: 1.45,
  });

  const trimMaterial = new THREE.MeshStandardMaterial({
    color: '#141519',
    roughness: 0.5,
    metalness: 0.35,
  });

  const carbonMaterial = new THREE.MeshPhysicalMaterial({
    color: '#1b1d22',
    roughness: 0.26,
    metalness: 0.45,
    clearcoat: 0.85,
    clearcoatRoughness: 0.1,
  });

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: '#09111e',
    roughness: 0.04,
    metalness: 0.18,
    transparent: true,
    opacity: 0.62,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    reflectivity: 1.0,
    envMapIntensity: 1.7,
  });

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: custom.rimColor || '#e4e4e7',
    roughness: 0.16,
    metalness: 0.92,
    envMapIntensity: 1.4,
  });

  const tireMaterial = new THREE.MeshStandardMaterial({
    color: '#121417',
    roughness: 0.86,
    metalness: 0.05,
  });

  const rotorMaterial = new THREE.MeshStandardMaterial({
    color: '#9ca3af',
    roughness: 0.28,
    metalness: 0.88,
  });

  const caliperMaterial = new THREE.MeshStandardMaterial({
    color: isPolice ? '#2563eb' : '#ef4444',
    roughness: 0.3,
    metalness: 0.55,
  });

  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: '#e2e8f0',
    roughness: 0.1,
    metalness: 0.96,
    envMapIntensity: 1.5,
  });

  const headLightMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#fef9c3',
    emissiveIntensity: 2.5,
    roughness: 0.08,
  });

  const tailLightMaterial = new THREE.MeshStandardMaterial({
    color: '#991b1b',
    emissive: '#ef4444',
    emissiveIntensity: 1.3,
    roughness: 0.16,
  });

  const drlMat = new THREE.MeshStandardMaterial({
    color: '#e0f2fe',
    emissive: '#38bdf8',
    emissiveIntensity: 1.8,
    roughness: 0.1,
  });

  // 1. Sculpted Tapered Lower Chassis & Beltline
  const bodyGeo = createSculptedLowerBodyGeometry(
    spec.bodyStyle,
    spec.width,
    spec.length,
    spec.height
  );
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMaterial);
  bodyMesh.castShadow = !isTraffic;
  bodyMesh.receiveShadow = true;
  bodyPivot.add(bodyMesh);

  // Sculpted Hood Power Dome & Aero Vents
  const hoodBulge = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width * 0.44, 0.06, spec.length * 0.26),
    bodyMaterial
  );
  hoodBulge.position.set(0, spec.height * 0.56, -spec.length * 0.28);
  hoodBulge.rotation.x = 0.07;
  bodyPivot.add(hoodBulge);

  if (spec.bodyStyle === 'muscle') {
    const blowerBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.16, 0.48),
      chromeMaterial
    );
    blowerBlock.position.set(0, spec.height * 0.65, -spec.length * 0.27);
    const blowerIntake = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.08, 0.16),
      caliperMaterial
    );
    blowerIntake.position.set(0, spec.height * 0.72, -spec.length * 0.44);
    bodyPivot.add(blowerBlock, blowerIntake);
  } else if (spec.bodyStyle === 'supercar') {
    const hoodVentL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.3), carbonMaterial);
    hoodVentL.position.set(-0.28, spec.height * 0.53, -spec.length * 0.3);
    hoodVentL.rotation.x = 0.09;
    const hoodVentR = hoodVentL.clone();
    hoodVentR.position.x = 0.28;
    const rearLouver = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.54, 0.05, spec.length * 0.24), carbonMaterial);
    rearLouver.position.set(0, spec.height * 0.64, spec.length * 0.28);
    rearLouver.rotation.x = -0.14;
    bodyPivot.add(hoodVentL, hoodVentR, rearLouver);
  }

  // Flared Wheel Arch Fenders (front + rear)
  const wheelRadius = spec.bodyStyle === 'offroad' ? 0.44 : 0.35;
  const wheelWidth = spec.bodyStyle === 'offroad' ? 0.32 : 0.26;
  const trackHalf = spec.width / 2 - 0.04;
  const wheelbaseHalf = spec.length * 0.32;

  const archMat = spec.bodyStyle === 'offroad' || spec.bodyStyle === 'jdm' ? carbonMaterial : bodyMaterial;
  const archR = wheelRadius + 0.07;
  const archY = Math.max(0.14, wheelRadius - spec.clearance + 0.04);
  [
    { x: -trackHalf + 0.03, z: -wheelbaseHalf },
    { x: trackHalf - 0.03, z: -wheelbaseHalf },
    { x: -trackHalf + 0.03, z: wheelbaseHalf },
    { x: trackHalf - 0.03, z: wheelbaseHalf },
  ].forEach((pos) => {
    const arch = createWheelArchMesh(archR, 0.055, archMat);
    arch.position.set(pos.x, archY, pos.z);
    bodyPivot.add(arch);
  });

  // Side Door Shutlines & Quarter Air Scoops
  const sideCreaseGeo = new THREE.BoxGeometry(0.03, 0.03, spec.length * 0.42);
  const creaseL = new THREE.Mesh(sideCreaseGeo, trimMaterial);
  creaseL.position.set(-spec.width * 0.485, spec.height * 0.34, 0.02);
  const creaseR = new THREE.Mesh(sideCreaseGeo, trimMaterial);
  creaseR.position.set(spec.width * 0.485, spec.height * 0.34, 0.02);
  bodyPivot.add(creaseL, creaseR);

  if (isPolice) {
    const doorPanel = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width + 0.02, 0.38, spec.length * 0.36),
      new THREE.MeshStandardMaterial({ color: '#f4f4f5', roughness: 0.2, metalness: 0.18 })
    );
    doorPanel.position.set(0, 0.38, 0.04);
    bodyPivot.add(doorPanel);
  }

  if (isAmbulance) {
    const medStripe = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width + 0.03, 0.22, spec.length * 0.84),
      new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.3 })
    );
    medStripe.position.set(0, 0.44, 0.05);
    const cabinBox = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width * 0.92, spec.height * 0.68, spec.length * 0.52),
      new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.3 })
    );
    cabinBox.position.set(0, spec.height * 0.68, 0.65);
    bodyPivot.add(medStripe, cabinBox);
  }

  // 2. Sculpted Sloped Cabin Greenhouse + Carbon/Painted Roof Cap
  const greenhouseGeo = createCabinRoofGeometry(
    spec.bodyStyle,
    spec.width,
    spec.length,
    spec.height
  );
  const greenhouseMesh = new THREE.Mesh(greenhouseGeo, glassMaterial);
  bodyPivot.add(greenhouseMesh);

  const roofPanel = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width * 0.64, 0.045, spec.length * 0.25),
    spec.bodyStyle === 'supercar' || spec.bodyStyle === 'jdm' ? carbonMaterial : bodyMaterial
  );
  roofPanel.position.set(0, spec.height * 0.975, spec.length * 0.06);
  roofPanel.castShadow = !isTraffic;
  bodyPivot.add(roofPanel);

  // Front A-pillars framing the windshield
  const pillarGeo = new THREE.BoxGeometry(0.05, 0.05, spec.length * 0.2);
  const pillarL = new THREE.Mesh(pillarGeo, trimMaterial);
  pillarL.position.set(-spec.width * 0.36, spec.height * 0.76, -spec.length * 0.12);
  pillarL.rotation.set(-0.56, -0.14, 0);
  const pillarR = new THREE.Mesh(pillarGeo, trimMaterial);
  pillarR.position.set(spec.width * 0.36, spec.height * 0.76, -spec.length * 0.12);
  pillarR.rotation.set(-0.56, 0.14, 0);
  bodyPivot.add(pillarL, pillarR);

  // 3. Aerodynamic Wing Mirrors + Stalks
  const mirrorCapGeo = new THREE.BoxGeometry(0.18, 0.08, 0.14);
  const mirrorStalkGeo = new THREE.BoxGeometry(0.1, 0.035, 0.05);
  const mirrorL = new THREE.Mesh(mirrorCapGeo, bodyMaterial);
  mirrorL.position.set(-spec.width * 0.48, spec.height * 0.61, -spec.length * 0.12);
  const stalkL = new THREE.Mesh(mirrorStalkGeo, trimMaterial);
  stalkL.position.set(-spec.width * 0.42, spec.height * 0.58, -spec.length * 0.12);

  const mirrorR = new THREE.Mesh(mirrorCapGeo, bodyMaterial);
  mirrorR.position.set(spec.width * 0.48, spec.height * 0.61, -spec.length * 0.12);
  const stalkR = new THREE.Mesh(mirrorStalkGeo, trimMaterial);
  stalkR.position.set(spec.width * 0.42, spec.height * 0.58, -spec.length * 0.12);
  bodyPivot.add(mirrorL, stalkL, mirrorR, stalkR);

  // 4. Front Grille, Chin Splitter, Side Skirts & Multi-Fin Rear Diffuser
  const grille = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width * 0.46, 0.16, 0.08),
    trimMaterial
  );
  grille.position.set(0, 0.24, -spec.length / 2 + 0.03);
  const emblem = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.04, 0.03),
    chromeMaterial
  );
  emblem.position.set(0, 0.28, -spec.length / 2 + 0.01);
  bodyPivot.add(grille, emblem);

  const splitter = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width * 0.94, 0.055, 0.34),
    carbonMaterial
  );
  splitter.position.set(0, 0.1, -spec.length / 2 + 0.09);
  bodyPivot.add(splitter);

  const skirtGeo = new THREE.BoxGeometry(0.1, 0.06, spec.length * 0.54);
  const skirtL = new THREE.Mesh(skirtGeo, carbonMaterial);
  skirtL.position.set(-spec.width * 0.45, 0.09, 0.02);
  const skirtR = new THREE.Mesh(skirtGeo, carbonMaterial);
  skirtR.position.set(spec.width * 0.45, 0.09, 0.02);
  bodyPivot.add(skirtL, skirtR);

  const diffuser = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width * 0.84, 0.13, 0.24),
    carbonMaterial
  );
  diffuser.position.set(0, 0.14, spec.length / 2 - 0.06);
  bodyPivot.add(diffuser);
  [-0.24, -0.08, 0.08, 0.24].forEach((fx) => {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.14, 0.22), trimMaterial);
    fin.position.set(fx, 0.13, spec.length / 2 - 0.03);
    bodyPivot.add(fin);
  });

  // 5. Recessed LED Headlights + DRL Blades & OLED Taillights
  const hlHousingGeo = new THREE.BoxGeometry(0.38, 0.11, 0.12);
  const hlPodGeo = new THREE.BoxGeometry(0.28, 0.06, 0.06);
  const drlGeo = new THREE.BoxGeometry(0.34, 0.025, 0.04);

  [-1, 1].forEach((side) => {
    const hx = side * spec.width * 0.31;
    const hz = -spec.length / 2 + 0.09;
    const housing = new THREE.Mesh(hlHousingGeo, trimMaterial);
    housing.position.set(hx, 0.33, hz);
    housing.rotation.y = side * -0.18;
    const lens = new THREE.Mesh(hlPodGeo, headLightMaterial);
    lens.position.set(hx, 0.33, hz - 0.04);
    lens.rotation.y = side * -0.18;
    const drl = new THREE.Mesh(drlGeo, drlMat);
    drl.position.set(hx, 0.29, hz - 0.045);
    drl.rotation.y = side * -0.18;
    bodyPivot.add(housing, lens, drl);
  });

  const tlBarGeo = new THREE.BoxGeometry(0.46, 0.09, 0.08);
  const tlLeft = new THREE.Mesh(tlBarGeo, tailLightMaterial);
  tlLeft.position.set(-spec.width * 0.29, 0.47, spec.length / 2 - 0.02);
  const tlRight = new THREE.Mesh(tlBarGeo, tailLightMaterial);
  tlRight.position.set(spec.width * 0.29, 0.47, spec.length / 2 - 0.02);
  bodyPivot.add(tlLeft, tlRight);

  if (spec.bodyStyle === 'supercar' || spec.bodyStyle === 'jdm' || spec.bodyStyle === 'sedan') {
    const centerBar = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width * 0.56, 0.035, 0.06),
      tailLightMaterial
    );
    centerBar.position.set(0, 0.47, spec.length / 2 - 0.015);
    bodyPivot.add(centerBar);
  }

  // 6. Quad Chrome/Titanium Exhaust Tips + Nitro Flame Cones
  const exhaustGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.22, 14);
  exhaustGeo.rotateX(Math.PI / 2);

  [-spec.width * 0.28, -spec.width * 0.21, spec.width * 0.21, spec.width * 0.28].forEach((ex) => {
    const pipe = new THREE.Mesh(exhaustGeo, chromeMaterial);
    pipe.position.set(ex, 0.16, spec.length / 2 + 0.02);
    bodyPivot.add(pipe);
  });

  const flameGeo = new THREE.ConeGeometry(0.085, 0.78, 12);
  flameGeo.rotateX(Math.PI / 2);
  const flameMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0.9,
  });
  const flameL = new THREE.Mesh(flameGeo, flameMat);
  flameL.position.set(-spec.width * 0.245, 0.16, spec.length / 2 + 0.42);
  flameL.visible = false;
  const flameR = new THREE.Mesh(flameGeo, flameMat);
  flameR.position.set(spec.width * 0.245, 0.16, spec.length / 2 + 0.42);
  flameR.visible = false;
  bodyPivot.add(flameL, flameR);

  // 7. GT Carbon Spoiler Wing with Endplates (or Off-Road Rollbar + Roof Light Rack)
  const spoilerGroup = new THREE.Group();
  if (spec.bodyStyle === 'offroad') {
    const roofRack = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width * 0.74, 0.07, 0.18),
      trimMaterial
    );
    roofRack.position.set(0, spec.height * 1.02, -0.08);
    const ledBar = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width * 0.66, 0.05, 0.06),
      headLightMaterial
    );
    ledBar.position.set(0, spec.height * 1.02, -0.16);
    spoilerGroup.add(roofRack, ledBar);
    spoilerGroup.visible = true;
  } else {
    const pylonGeo = new THREE.BoxGeometry(0.05, 0.22, 0.16);
    const pylonL = new THREE.Mesh(pylonGeo, trimMaterial);
    pylonL.position.set(-spec.width * 0.26, spec.height * 0.62, spec.length / 2 - 0.22);
    const pylonR = new THREE.Mesh(pylonGeo, trimMaterial);
    pylonR.position.set(spec.width * 0.26, spec.height * 0.62, spec.length / 2 - 0.22);
    const wingBlade = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width * 0.96, 0.045, 0.26),
      carbonMaterial
    );
    wingBlade.position.set(0, spec.height * 0.74, spec.length / 2 - 0.24);
    wingBlade.rotation.x = 0.08;
    const plateGeo = new THREE.BoxGeometry(0.04, 0.16, 0.32);
    const plateL = new THREE.Mesh(plateGeo, bodyMaterial);
    plateL.position.set(-spec.width * 0.48, spec.height * 0.73, spec.length / 2 - 0.24);
    const plateR = new THREE.Mesh(plateGeo, bodyMaterial);
    plateR.position.set(spec.width * 0.48, spec.height * 0.73, spec.length / 2 - 0.24);
    spoilerGroup.add(pylonL, pylonR, wingBlade, plateL, plateR);
    spoilerGroup.visible = custom.spoiler;
  }
  bodyPivot.add(spoilerGroup);

  // 8. Detailed Cockpit Interior (Bucket Seats, Console, Gauge Screen & Flat-Bottom Wheel)
  const seatBackGeo = new THREE.BoxGeometry(0.36, 0.48, 0.1);
  [-0.3, 0.3].forEach((sx) => {
    const seat = new THREE.Mesh(seatBackGeo, trimMaterial);
    seat.position.set(sx, spec.height * 0.52, 0.18);
    seat.rotation.x = -0.18;
    bodyPivot.add(seat);
  });

  const dash = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width * 0.72, 0.2, 0.34),
    trimMaterial
  );
  dash.position.set(0, spec.height * 0.55, -0.34);
  bodyPivot.add(dash);

  const gaugeScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.1),
    new THREE.MeshBasicMaterial({ color: '#06b6d4' })
  );
  gaugeScreen.position.set(-0.28, spec.height * 0.62, -0.16);
  bodyPivot.add(gaugeScreen);

  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(-0.28, spec.height * 0.59, -0.11);
  steeringWheel.rotation.x = -0.32;
  const swRing = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.022, 10, 22), trimMaterial);
  const swSpoke = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.028, 0.02), rimMaterial);
  steeringWheel.add(swRing, swSpoke);
  bodyPivot.add(steeringWheel);

  const cockpitAnchor = new THREE.Object3D();
  cockpitAnchor.position.set(-0.28, spec.height * 0.77, 0.14);
  bodyPivot.add(cockpitAnchor);

  const cockpitLookAt = new THREE.Object3D();
  cockpitLookAt.position.set(-0.28, spec.height * 0.7, -8.0);
  bodyPivot.add(cockpitLookAt);

  const hoodAnchor = new THREE.Object3D();
  hoodAnchor.position.set(0, spec.height * 0.74, -0.55);
  bodyPivot.add(hoodAnchor);

  const hoodLookAt = new THREE.Object3D();
  hoodLookAt.position.set(0, spec.height * 0.58, -12.0);
  bodyPivot.add(hoodLookAt);

  // 9. Emergency Lightbar (Police or Ambulance)
  let policeBarLeft: THREE.Mesh | undefined;
  let policeBarRight: THREE.Mesh | undefined;
  if (isPolice || isAmbulance) {
    const barY = isAmbulance ? spec.height * 1.06 : spec.height * 1.01;
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.06, 0.22), trimMaterial);
    barBase.position.set(0, barY - 0.02, 0.08);
    policeBarLeft = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.08, 0.18),
      new THREE.MeshStandardMaterial({
        color: '#ef4444',
        emissive: '#ef4444',
        emissiveIntensity: 3,
      })
    );
    policeBarLeft.position.set(-0.22, barY, 0.08);
    policeBarRight = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.08, 0.18),
      new THREE.MeshStandardMaterial({
        color: isAmbulance ? '#f8fafc' : '#3b82f6',
        emissive: isAmbulance ? '#f8fafc' : '#3b82f6',
        emissiveIntensity: 3,
      })
    );
    policeBarRight.position.set(0.22, barY, 0.08);
    bodyPivot.add(barBase, policeBarLeft, policeBarRight);
  }

  // 10. Underglow
  const underglowMat = new THREE.MeshBasicMaterial({
    color: custom.underglowColor || '#06b6d4',
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const underglowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(spec.width * 0.9, spec.length * 0.85),
    underglowMat
  );
  underglowMesh.rotation.x = -Math.PI / 2;
  underglowMesh.position.y = 0.04;
  underglowMesh.visible = Boolean(custom.underglowColor);
  root.add(underglowMesh);

  // 11. Contact Shadow
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(spec.width * 1.45, spec.length * 1.25),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  root.add(shadowPlane);

  // 12. High-Detail Sculpted Wheels: Rounded Tire Shoulders + Forged 5-Twin-Spoke Rims + Cross-Drilled Brake Discs + Calipers
  const tireTreadGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth * 0.72, 28);
  tireTreadGeo.rotateZ(Math.PI / 2);

  const sidewallGeo = new THREE.TorusGeometry(wheelRadius * 0.82, wheelRadius * 0.18, 10, 26);
  sidewallGeo.rotateY(Math.PI / 2);

  const barrelGeo = new THREE.CylinderGeometry(
    wheelRadius * 0.66,
    wheelRadius * 0.66,
    wheelWidth * 0.84,
    24,
    1,
    true
  );
  barrelGeo.rotateZ(Math.PI / 2);

  const rimLipGeo = new THREE.TorusGeometry(wheelRadius * 0.65, 0.018, 8, 24);
  rimLipGeo.rotateY(Math.PI / 2);

  const rotorGeo = new THREE.CylinderGeometry(wheelRadius * 0.5, wheelRadius * 0.5, 0.035, 20);
  rotorGeo.rotateZ(Math.PI / 2);

  const centerCapGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.06, 12);
  centerCapGeo.rotateZ(Math.PI / 2);

  const spokeGeo = new THREE.BoxGeometry(0.035, wheelRadius * 1.18, 0.032);
  const caliperGeo = new THREE.BoxGeometry(0.11, wheelRadius * 0.44, 0.19);

  const wheelCoords = [
    { x: -trackHalf, z: -wheelbaseHalf, front: true },
    { x: trackHalf, z: -wheelbaseHalf, front: true },
    { x: -trackHalf, z: wheelbaseHalf, front: false },
    { x: trackHalf, z: wheelbaseHalf, front: false },
  ];

  const frontSteerPivots: THREE.Group[] = [];
  const wheelSpinGroups: THREE.Group[] = [];

  wheelCoords.forEach((wc) => {
    const steerPivot = new THREE.Group();
    steerPivot.position.set(wc.x, wheelRadius, wc.z);

    // Stationary Knuckle + Brembo Brake Caliper
    const caliper = new THREE.Mesh(caliperGeo, caliperMaterial);
    const outerSign = wc.x > 0 ? 1 : -1;
    caliper.position.set(outerSign * 0.01, 0.03, 0.11);
    steerPivot.add(caliper);

    const spinGroup = new THREE.Group();

    const tread = new THREE.Mesh(tireTreadGeo, tireMaterial);
    tread.castShadow = !isTraffic;
    const swOuter = new THREE.Mesh(sidewallGeo, tireMaterial);
    swOuter.position.x = outerSign * (wheelWidth * 0.31);
    const swInner = new THREE.Mesh(sidewallGeo, tireMaterial);
    swInner.position.x = -outerSign * (wheelWidth * 0.31);

    const barrel = new THREE.Mesh(barrelGeo, rimMaterial);
    const lip = new THREE.Mesh(rimLipGeo, chromeMaterial);
    lip.position.x = outerSign * (wheelWidth * 0.43);

    const rotor = new THREE.Mesh(rotorGeo, rotorMaterial);
    rotor.position.x = -outerSign * 0.01;

    const hub = new THREE.Mesh(centerCapGeo, rimMaterial);
    hub.position.x = outerSign * (wheelWidth * 0.36);

    spinGroup.add(tread, swOuter, swInner, barrel, lip, rotor, hub);

    // 5-Spoke Star Alloy Design
    for (let s = 0; s < 5; s++) {
      const spoke = new THREE.Mesh(spokeGeo, rimMaterial);
      spoke.position.x = outerSign * (wheelWidth * 0.38);
      spoke.rotation.x = (s / 5) * Math.PI * 2;
      spinGroup.add(spoke);
    }

    steerPivot.add(spinGroup);
    root.add(steerPivot);

    wheelSpinGroups.push(spinGroup);
    if (wc.front) frontSteerPivots.push(steerPivot);
  });

  return {
    root,
    bodyPivot,
    bodyMaterial,
    rimMaterial,
    tailLightMaterial,
    headLightMaterial,
    underglowMesh,
    spoilerGroup,
    steeringWheel,
    frontSteerPivots: [frontSteerPivots[0], frontSteerPivots[1]],
    wheelSpinGroups,
    nitroFlames: [flameL, flameR],
    policeBarLeft,
    policeBarRight,
    cockpitAnchor,
    cockpitLookAt,
    hoodAnchor,
    hoodLookAt,
  };
}

export function buildPlayerCharacter(jacketHex = '#e11d48'): CharacterVisualRig {
  const root = new THREE.Group();

  const jacketMat = new THREE.MeshStandardMaterial({ color: jacketHex, roughness: 0.62 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.78 });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#d99b6c', roughness: 0.5 });
  const hairMat = new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 0.75 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#f4f4f5', roughness: 0.45 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#09090b', roughness: 0.12, metalness: 0.85 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.38, 6, 12), jacketMat);
  torso.position.y = 1.15;
  torso.scale.set(1.18, 1, 0.68);
  torso.castShadow = true;
  root.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), skinMat);
  head.position.y = 1.68;
  head.castShadow = true;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.165, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMat);
  hair.position.y = 1.69;
  root.add(head, hair);

  const shades = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.08), glassMat);
  shades.position.set(0, 1.7, -0.14);
  root.add(shades);

  const makeArm = (xOffset: number) => {
    const g = new THREE.Group();
    g.position.set(xOffset, 1.4, 0);
    const armMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.38, 4, 10), jacketMat);
    armMesh.position.y = -0.24;
    armMesh.castShadow = true;
    const handMesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), skinMat);
    handMesh.position.y = -0.49;
    g.add(armMesh, handMesh);
    root.add(g);
    return g;
  };
  const leftArm = makeArm(-0.32);
  const rightArm = makeArm(0.32);

  const makeLeg = (xOffset: number) => {
    const g = new THREE.Group();
    g.position.set(xOffset, 0.82, 0);
    const legMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.54, 4, 10), pantsMat);
    legMesh.position.y = -0.35;
    legMesh.castShadow = true;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.11, 0.28), shoeMat);
    shoe.position.set(0, -0.73, -0.04);
    g.add(legMesh, shoe);
    root.add(g);
    return g;
  };
  const leftLeg = makeLeg(-0.12);
  const rightLeg = makeLeg(0.12);

  return { root, leftArm, rightArm, leftLeg, rightLeg };
}
