import * as THREE from 'three';
import { WORLD_LANDMARKS, WORLD_RADIUS } from '../data/worldData';
import { ProceduralTextureSet } from './ProceduralTextures';

export interface BuildingCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface TrafficLightRig {
  x: number;
  z: number;
  nsBulbMat: THREE.MeshStandardMaterial;
  ewBulbMat: THREE.MeshStandardMaterial;
}

export interface WorldBuildResult {
  colliders: BuildingCollider[];
  oceanMesh: THREE.Mesh;
  landmarkBeacons: THREE.Mesh[];
  roadMaterials: THREE.MeshStandardMaterial[];
  windowMaterials: THREE.MeshStandardMaterial[];
  streetLampMaterials: THREE.MeshStandardMaterial[];
  trafficLightRigs: TrafficLightRig[];
}

export function getSurfaceType(x: number, z: number): 'asphalt' | 'dirt' | 'sand' | 'grass' {
  // International Airport Runway (-730..-340, z=135..185)
  if (x >= -730 && x <= -340 && z >= 132 && z <= 188) return 'asphalt';

  // Harbor Bridge (x=-160..160, z=280..325)
  if (Math.abs(x) < 16 && z >= 235 && z <= 345) return 'asphalt';

  // Highway perimeter & drag strip
  if (Math.abs(z + 260) < 12 && x > -380 && x < 460) return 'asphalt';
  if (Math.abs(x - 310) < 10 && z > -420 && z < 260) return 'asphalt';
  if (Math.abs(x + 310) < 10 && z > -270 && z < 260) return 'asphalt';
  if (Math.abs(z - 240) < 10 && x > -520 && x < 480) return 'asphalt';

  // Redwood Mountain Tunnel road (x=-240, z=-530..-260)
  if (Math.abs(x + 240) < 9 && z >= -540 && z <= -250) return 'asphalt';

  // Luxury Heights & Residential Roads
  if (Math.abs(z + 240) < 9 && x >= 240 && x <= 500) return 'asphalt';
  if (Math.abs(x - 400) < 9 && z >= -420 && z <= 240) return 'asphalt';
  if (Math.abs(z - 80) < 9 && x >= 240 && x <= 460) return 'asphalt';

  // City Grid Roads (-240..240 step 80)
  const inCityX = x > -265 && x < 265;
  const inCityZ = z > -265 && z < 255;
  if (inCityX && inCityZ) {
    const modX = Math.abs((x + 400) % 80);
    const modZ = Math.abs((z + 400) % 80);
    const distRoadX = Math.min(modX, 80 - modX);
    const distRoadZ = Math.min(modZ, 80 - modZ);
    if (distRoadX < 7.5 || distRoadZ < 7.5) return 'asphalt';
  }

  // Dockyard drift pad
  if (x > -275 && x < -55 && z > 115 && z < 285) return 'asphalt';

  // Mountain Rally Dirt Trail
  if (x < -70 && z < -270 && x > -460 && z > -540) return 'dirt';

  // Beach Sand
  if (z > 305 || x > 540) return 'sand';

  return 'grass';
}

export function groundHeightAt(x: number, z: number): number {
  // Keep Mountain Tunnel corridor flat so player drives cleanly through the mountain!
  if (Math.abs(x + 240) < 14 && z >= -560 && z <= -250) {
    return 0;
  }

  // Airport Runway & Industrial Docks flat at y=0
  if (x >= -760 && x <= 480 && z >= -285 && z <= 275) {
    // Luxury Heights gentle terrace hills in NE (x > 340, z < -180)
    if (x > 330 && z < -170 && Math.abs(x - 400) > 12 && Math.abs(z + 240) > 12) {
      return Math.min(12, ((x - 330) * 0.04 + (-170 - z) * 0.03));
    }
    return 0;
  }

  // Coastal Bridge across harbor canal (x around 0, z=270..340)
  if (Math.abs(x) < 14 && z >= 265 && z <= 345) {
    const t = (z - 265) / 80;
    return Math.sin(t * Math.PI) * 5.2;
  }

  // Beach slopes gently down into water past z=315 or x=560
  if (z > 305 || x > 560) {
    const overZ = Math.max(0, z - 305);
    const overX = Math.max(0, x - 560);
    const distCoast = Math.max(overZ, overX);
    return Math.max(-4.0, -distCoast * 0.045);
  }

  // Redwood Peaks Mountain Range (NW quadrant)
  if (x < -60 && z < -285) {
    const dx = Math.max(0, -110 - x);
    const dz = Math.max(0, -295 - z);
    const baseRise = Math.min(34, dx * 0.04 + dz * 0.075);
    const ridgeWave =
      Math.sin(x * 0.022) * Math.cos(z * 0.022) * 5.0 +
      Math.sin((x + z) * 0.035) * 2.2;
    const smoothMask = THREE.MathUtils.clamp(((-285 - z) / 50) * ((-60 - x) / 60), 0, 1);
    // Flatten tunnel entrance/exit slightly
    const tunnelDist = Math.abs(x + 240);
    const tunnelMask = tunnelDist < 24 ? THREE.MathUtils.clamp((tunnelDist - 12) / 12, 0, 1) : 1;
    return Math.max(0, (baseRise + ridgeWave) * smoothMask * tunnelMask);
  }

  const distFromCenter = Math.hypot(x, z);
  if (distFromCenter > 780 && z < 280 && x < 540) {
    return Math.min(42, (distFromCenter - 780) * 0.14);
  }

  return 0;
}

export function buildOpenWorld(
  scene: THREE.Scene,
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean
): WorldBuildResult {
  const colliders: BuildingCollider[] = [];
  const landmarkBeacons: THREE.Mesh[] = [];
  const roadMaterials: THREE.MeshStandardMaterial[] = [];
  const windowMaterials: THREE.MeshStandardMaterial[] = [];
  const streetLampMaterials: THREE.MeshStandardMaterial[] = [];
  const trafficLightRigs: TrafficLightRig[] = [];

  // 1. Sculpted Terrain
  const terrainSize = WORLD_RADIUS * 2.25;
  const segs = 148;
  const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segs, segs);
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  const cGrass = new THREE.Color('#225c2b');
  const cSand = new THREE.Color('#e6d3a3');
  const cRock = new THREE.Color('#4a5c43');
  const cUrban = new THREE.Color('#282c34');
  const cSuburb = new THREE.Color('#2d6135');
  const tmpColor = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = groundHeightAt(vx, vz);
    posAttr.setY(i, vy);

    if (vz > 280 || vx > 520) {
      tmpColor.copy(cSand);
    } else if (vy > 7.5) {
      tmpColor.copy(cRock).lerp(cGrass, 0.36);
    } else if (vx > -265 && vx < 265 && vz > -270 && vz < 255) {
      tmpColor.copy(cUrban);
    } else if (vx >= 265 && vx <= 515 && vz > -380 && vz < 245) {
      tmpColor.copy(cSuburb);
    } else {
      tmpColor.copy(cGrass);
    }
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMesh = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.02 })
  );
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  // 2. Caribbean Sea (Turquoise Tropical Ocean)
  const oceanGeo = new THREE.PlaneGeometry(3600, 1900, 32, 16);
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanMesh = new THREE.Mesh(
    oceanGeo,
    new THREE.MeshStandardMaterial({
      color: '#06b6d4',
      roughness: 0.14,
      metalness: 0.38,
      transparent: true,
      opacity: 0.88,
    })
  );
  oceanMesh.position.set(220, -0.85, 860);
  scene.add(oceanMesh);

  const registerRoadMat = (tex: THREE.CanvasTexture) => {
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.82,
      metalness: 0.06,
    });
    roadMaterials.push(mat);
    return mat;
  };

  // 3. City Grid Roads
  const gridCoords = [-240, -160, -80, 0, 80, 160, 240];
  gridCoords.forEach((coord) => {
    const nsTex = textures.asphalt.clone();
    nsTex.needsUpdate = true;
    nsTex.repeat.set(1, 34);
    const nsRoad = new THREE.Mesh(new THREE.PlaneGeometry(14, 520), registerRoadMat(nsTex));
    nsRoad.rotation.x = -Math.PI / 2;
    nsRoad.position.set(coord, 0.02, -10);
    nsRoad.receiveShadow = true;
    scene.add(nsRoad);

    if (coord !== -240) {
      const ewTex = textures.asphalt.clone();
      ewTex.needsUpdate = true;
      ewTex.repeat.set(1, 34);
      const ewRoad = new THREE.Mesh(new THREE.PlaneGeometry(14, 520), registerRoadMat(ewTex));
      ewRoad.rotation.x = -Math.PI / 2;
      ewRoad.rotation.z = Math.PI / 2;
      ewRoad.position.set(0, 0.025, coord);
      ewRoad.receiveShadow = true;
      scene.add(ewRoad);
    }
  });

  // 4. Perimeter Highways, Luxury/Suburb Roads, Tunnel Road & Airport Runway
  const addHighwaySegment = (x: number, z: number, width: number, len: number, rotZ = 0) => {
    const tex = textures.highway.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, Math.max(4, Math.round(len / 16)));
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, len), registerRoadMat(tex));
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rotZ;
    mesh.position.set(x, 0.03, z);
    mesh.receiveShadow = true;
    scene.add(mesh);
  };

  // North Drag Expressway (-380..480 at z=-260)
  addHighwaySegment(50, -260, 22, 860, Math.PI / 2);
  // South Coastal Boulevard (-520..480 at z=240)
  addHighwaySegment(-20, 240, 18, 1000, Math.PI / 2);
  // West & East Connectors
  addHighwaySegment(-310, -10, 18, 520, 0);
  addHighwaySegment(310, -80, 18, 660, 0);
  // Luxury Heights & Residential Connector (x=400, z=-420..240)
  addHighwaySegment(400, -90, 14, 660, 0);
  addHighwaySegment(360, 80, 14, 240, Math.PI / 2);
  addHighwaySegment(370, -240, 14, 260, Math.PI / 2);
  // Redwood Tunnel Road (x=-240, z=-540..-250)
  addHighwaySegment(-240, -395, 14, 290, 0);

  // International Airport Runway (-730..-340 at z=160)
  const runwayTex = textures.highway.clone();
  runwayTex.needsUpdate = true;
  runwayTex.repeat.set(2, 24);
  const runwayMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 390),
    registerRoadMat(runwayTex)
  );
  runwayMesh.rotation.x = -Math.PI / 2;
  runwayMesh.rotation.z = Math.PI / 2;
  runwayMesh.position.set(-535, 0.035, 160);
  runwayMesh.receiveShadow = true;
  scene.add(runwayMesh);

  // Airport Control Tower & Hangar
  const towerMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.4, metalness: 0.3 });
  const towerBase = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.2, 26, 12), towerMat);
  towerBase.position.set(-460, 13, 118);
  const towerCab = new THREE.Mesh(
    new THREE.CylinderGeometry(6.2, 4.5, 4.5, 12),
    new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.15, metalness: 0.7 })
  );
  towerCab.position.set(-460, 27.5, 118);
  scene.add(towerBase, towerCab);
  colliders.push({ minX: -465, maxX: -455, minZ: 113, maxZ: 123 });

  const hangar = new THREE.Mesh(
    new THREE.BoxGeometry(36, 12, 24),
    new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.5, metalness: 0.4 })
  );
  hangar.position.set(-660, 6, 118);
  scene.add(hangar);
  colliders.push({ minX: -678, maxX: -642, minZ: 106, maxZ: 130 });

  // 5. Harbor Bridge (x=0, z=265..345) & Redwood Mountain Tunnel (x=-240, z=-450..-350)
  const bridgeGroup = new THREE.Group();
  const bridgeDeckMat = registerRoadMat(textures.asphalt);
  for (let s = 0; s < 8; s++) {
    const z0 = 265 + s * 10;
    const z1 = z0 + 10;
    const y0 = groundHeightAt(0, z0);
    const y1 = groundHeightAt(0, z1);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(16, 0.7, 10.6), bridgeDeckMat);
    seg.position.set(0, (y0 + y1) / 2 - 0.25, (z0 + z1) / 2);
    seg.rotation.x = -Math.atan2(y1 - y0, 10);
    bridgeGroup.add(seg);
  }
  // Port Royal / Harbour Bridge Arch Towers (Jamaican Gold & Emerald accent)
  const archMat = new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.3, metalness: 0.65 });
  const crossMat = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.35, metalness: 0.45 });
  [-7.5, 7.5].forEach((bx) => {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.9, 14, 1.4), archMat);
    pylon.position.set(bx, 7, 305);
    bridgeGroup.add(pylon);
  });
  const archBeam = new THREE.Mesh(new THREE.BoxGeometry(16, 1.0, 1.5), crossMat);
  archBeam.position.set(0, 13.6, 305);
  bridgeGroup.add(archBeam);
  scene.add(bridgeGroup);

  // Redwood Mountain Tunnel Shell
  const tunnelShell = new THREE.Mesh(
    new THREE.CylinderGeometry(8.5, 8.5, 95, 16, 1, true, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 0.85, side: THREE.DoubleSide })
  );
  tunnelShell.rotation.z = Math.PI / 2;
  tunnelShell.rotation.y = Math.PI / 2;
  tunnelShell.position.set(-240, 0, -405);
  scene.add(tunnelShell);

  // Dockyard Drift Pad
  const dockMat = registerRoadMat(textures.asphalt);
  const driftPad = new THREE.Mesh(new THREE.PlaneGeometry(210, 160), dockMat);
  driftPad.rotation.x = -Math.PI / 2;
  driftPad.position.set(-165, 0.018, 200);
  driftPad.receiveShadow = true;
  scene.add(driftPad);

  // 6. City Skyscrapers, Luxury Villas, Residential Houses & Industrial Warehouses
  const coolMat = new THREE.MeshStandardMaterial({
    map: textures.buildingFacade,
    roughness: 0.35,
    metalness: 0.3,
    emissive: '#38bdf8',
    emissiveMap: textures.buildingFacade,
    emissiveIntensity: 0.25,
  });
  const warmMat = new THREE.MeshStandardMaterial({
    map: textures.buildingWarm,
    roughness: 0.4,
    metalness: 0.25,
    emissive: '#fbbf24',
    emissiveMap: textures.buildingWarm,
    emissiveIntensity: 0.25,
  });
  windowMaterials.push(coolMat, warmMat);

  const roofMat = new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 0.85 });

  const blockCenters = [-200, -120, -40, 40, 120, 200];
  blockCenters.forEach((bx) => {
    blockCenters.forEach((bz) => {
      if (bx < -50 && bz > 100) return;
      if (Math.abs(bx) === 40 && Math.abs(bz) === 40) return;
      const nearLandmark = WORLD_LANDMARKS.some(
        (lm) => Math.hypot(lm.x - bx, lm.z - bz) < 42
      );
      if (nearLandmark) return;

      const isDowntown = Math.abs(bx) <= 130 && Math.abs(bz) <= 130;
      const w = 36 + (Math.abs(bx * 7 + bz * 3) % 14);
      const d = 36 + (Math.abs(bx * 5 + bz * 11) % 14);
      const h = isDowntown
        ? 40 + (Math.abs(bx * 13 + bz * 17) % 62)
        : 14 + (Math.abs(bx * 3 + bz * 7) % 24);

      const building = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        (bx + bz) % 160 === 0 ? warmMat : coolMat
      );
      building.position.set(bx, h / 2, bz);
      building.castShadow = !isSoftwareGl && isDowntown;
      building.receiveShadow = true;
      scene.add(building);

      const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.65, 2.4, d * 0.65), roofMat);
      crown.position.set(bx, h + 1.2, bz);
      scene.add(crown);

      colliders.push({
        minX: bx - w / 2,
        maxX: bx + w / 2,
        minZ: bz - d / 2,
        maxZ: bz + d / 2,
      });
    });
  });

  // Luxury Villas & Residential Suburbs (East of x=340)
  const villaMat = new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.45 });
  const villaRoofMat = new THREE.MeshStandardMaterial({ color: '#7c2d12', roughness: 0.7 });
  const houseCoords = [
    { x: 355, z: -200, w: 22, d: 18, h: 8 },
    { x: 445, z: -200, w: 24, d: 20, h: 9 },
    { x: 445, z: -300, w: 26, d: 22, h: 10 },
    { x: 355, z: 30, w: 16, d: 14, h: 5.5 },
    { x: 445, z: 30, w: 16, d: 14, h: 5.5 },
    { x: 355, z: 130, w: 16, d: 14, h: 5.5 },
    { x: 445, z: 130, w: 16, d: 14, h: 5.5 },
  ];
  houseCoords.forEach((hc) => {
    const gy = groundHeightAt(hc.x, hc.z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(hc.w, hc.h, hc.d), villaMat);
    body.position.set(hc.x, gy + hc.h / 2, hc.z);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(hc.w, hc.d) * 0.75, 4, 4),
      villaRoofMat
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.set(hc.x, gy + hc.h + 2, hc.z);
    scene.add(body, roof);
    colliders.push({
      minX: hc.x - hc.w / 2,
      maxX: hc.x + hc.w / 2,
      minZ: hc.z - hc.d / 2,
      maxZ: hc.z + hc.d / 2,
    });
  });

  // 7. Traffic Lights at Downtown Intersections
  const intersections = [
    { x: 0, z: 0 },
    { x: 0, z: -80 },
    { x: 80, z: 0 },
    { x: -80, z: 0 },
    { x: 0, z: 80 },
  ];
  intersections.forEach((ix) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 5.2, 8), roofMat);
    pole.position.set(ix.x + 8.5, 2.6, ix.z + 8.5);
    const nsBulbMat = new THREE.MeshStandardMaterial({
      color: '#10b981',
      emissive: '#10b981',
      emissiveIntensity: 2.5,
    });
    const ewBulbMat = new THREE.MeshStandardMaterial({
      color: '#ef4444',
      emissive: '#ef4444',
      emissiveIntensity: 2.5,
    });
    const nsBulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), nsBulbMat);
    nsBulb.position.set(ix.x + 8.5, 5.1, ix.z + 8.1);
    const ewBulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), ewBulbMat);
    ewBulb.position.set(ix.x + 8.1, 5.1, ix.z + 8.5);
    scene.add(pole, nsBulb, ewBulb);
    trafficLightRigs.push({ x: ix.x, z: ix.z, nsBulbMat, ewBulbMat });
  });

  // 8. Street Lamps along Main Boulevards
  const lampBulbMat = new THREE.MeshStandardMaterial({
    color: '#fef3c7',
    emissive: '#fde68a',
    emissiveIntensity: 0.4,
  });
  streetLampMaterials.push(lampBulbMat);
  for (let lz = -220; lz <= 220; lz += 55) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), roofMat);
    pole.position.set(8.5, 3, lz);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.4), lampBulbMat);
    bulb.position.set(7.8, 6, lz);
    scene.add(pole, bulb);
  }

  // 9. Instanced Caribbean Palms & Blue Mountain Lush Canopy
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.35, 6.5, 7);
  trunkGeo.translate(0, 3.25, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b4c35', roughness: 0.9 });
  const palmCrownGeo = new THREE.ConeGeometry(2.8, 1.9, 7);
  palmCrownGeo.translate(0, 6.8, 0);
  const palmLeafMat = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.72 });

  const palmCount = 96;
  const palmTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmCount);
  const palmCrowns = new THREE.InstancedMesh(palmCrownGeo, palmLeafMat, palmCount);
  const dummy = new THREE.Object3D();
  const colorTmp = new THREE.Color();
  for (let i = 0; i < palmCount; i++) {
    const px = -420 + (i / palmCount) * 960 + Math.sin(i * 3.1) * 14;
    const pz = 272 + (i % 4) * 10;
    if (Math.abs(px) < 22) continue; // clear bridge
    const py = groundHeightAt(px, pz);
    dummy.position.set(px, py, pz);
    dummy.rotation.set(0.06 * Math.sin(i), i * 1.1, 0.06 * Math.cos(i));
    dummy.scale.setScalar(0.85 + (i % 5) * 0.09);
    dummy.updateMatrix();
    palmTrunks.setMatrixAt(i, dummy.matrix);
    palmCrowns.setMatrixAt(i, dummy.matrix);
    colorTmp.setHSL(0.35, 0.7, 0.3 + (i % 4) * 0.03);
    palmCrowns.setColorAt(i, colorTmp);
  }
  palmTrunks.computeBoundingSphere();
  palmCrowns.computeBoundingSphere();
  scene.add(palmTrunks, palmCrowns);

  const pineGeo = new THREE.ConeGeometry(2.5, 9.0, 7);
  pineGeo.translate(0, 5.2, 0);
  const pineMat = new THREE.MeshStandardMaterial({ color: '#14532d', roughness: 0.85 });
  const pineCount = 90;
  const pineTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, pineCount);
  const pineCrowns = new THREE.InstancedMesh(pineGeo, pineMat, pineCount);
  for (let i = 0; i < pineCount; i++) {
    const px = -520 + ((i * 41) % 420);
    const pz = -560 + ((i * 59) % 240);
    if (Math.abs(px + 240) < 22) continue; // keep tunnel road clear
    const py = groundHeightAt(px, pz);
    dummy.position.set(px, py, pz);
    dummy.rotation.set(0, i * 0.8, 0);
    dummy.scale.setScalar(0.85 + (i % 4) * 0.12);
    dummy.updateMatrix();
    pineTrunks.setMatrixAt(i, dummy.matrix);
    pineCrowns.setMatrixAt(i, dummy.matrix);
    colorTmp.setHSL(0.38, 0.52, 0.2 + (i % 3) * 0.04);
    pineCrowns.setColorAt(i, colorTmp);
  }
  pineTrunks.computeBoundingSphere();
  pineCrowns.computeBoundingSphere();
  scene.add(pineTrunks, pineCrowns);

  // 10. Landmark 3D Structures & Beacons
  const beaconGeo = new THREE.CylinderGeometry(3.2, 3.2, 18, 16, 1, true);
  beaconGeo.translate(0, 9, 0);

  WORLD_LANDMARKS.forEach((lm) => {
    const gy = groundHeightAt(lm.x, lm.z);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: lm.color,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(lm.x, gy, lm.z);
    scene.add(beacon);
    landmarkBeacons.push(beacon);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3.3, 4.0, 28),
      new THREE.MeshBasicMaterial({ color: lm.color, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(lm.x, gy + 0.08, lm.z);
    scene.add(ring);

    if (
      lm.type === 'dealership' ||
      lm.type === 'garage' ||
      lm.type === 'bank' ||
      lm.type === 'police'
    ) {
      const pavilion = new THREE.Group();
      pavilion.position.set(lm.x + (lm.x > 0 ? 14 : -14), gy, lm.z);
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(16, 7, 14),
        new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 0.35, metalness: 0.5 })
      );
      base.position.y = 3.5;
      const neonTrim = new THREE.Mesh(
        new THREE.BoxGeometry(16.4, 0.45, 14.4),
        new THREE.MeshStandardMaterial({ color: lm.color, emissive: lm.color, emissiveIntensity: 1.8 })
      );
      neonTrim.position.y = 6.9;
      pavilion.add(base, neonTrim);
      scene.add(pavilion);
      colliders.push({
        minX: pavilion.position.x - 8,
        maxX: pavilion.position.x + 8,
        minZ: pavilion.position.z - 7,
        maxZ: pavilion.position.z + 7,
      });
    } else if (lm.type === 'gas') {
      const canopy = new THREE.Group();
      canopy.position.set(lm.x + 10, gy, lm.z);
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(12, 0.8, 8),
        new THREE.MeshStandardMaterial({ color: '#059669', roughness: 0.3, metalness: 0.4 })
      );
      roof.position.y = 5.2;
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.2, 0.6), roofMat);
      p1.position.set(-4.5, 2.6, 0);
      const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.2, 0.6), roofMat);
      p2.position.set(4.5, 2.6, 0);
      canopy.add(roof, p1, p2);
      scene.add(canopy);
    } else if (lm.type === 'race') {
      const arch = new THREE.Group();
      arch.position.set(lm.x, gy, lm.z);
      const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6.5, 0.8), roofMat);
      pillarL.position.set(-6.5, 3.25, 0);
      const pillarR = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6.5, 0.8), roofMat);
      pillarR.position.set(6.5, 3.25, 0);
      const banner = new THREE.Mesh(
        new THREE.BoxGeometry(14, 1.5, 0.4),
        new THREE.MeshStandardMaterial({ map: textures.checkered, roughness: 0.4 })
      );
      banner.position.set(0, 6.2, 0);
      arch.add(pillarL, pillarR, banner);
      scene.add(arch);
    }
  });

  return {
    colliders,
    oceanMesh,
    landmarkBeacons,
    roadMaterials,
    windowMaterials,
    streetLampMaterials,
    trafficLightRigs,
  };
}
