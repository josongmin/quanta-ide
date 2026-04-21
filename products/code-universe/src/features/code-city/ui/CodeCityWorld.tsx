/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import gsap from "gsap";
import { THEME } from "../model/constants";
import type { CodeNode } from "../model/types";

/** Distance between lot centers (original city layout). */
const LAYOUT_SPACING = 20;
/** Extra floor tiles beyond the building grid — ~10 cells worth on each axis. */
const FLOOR_MARGIN_CELLS = 10;

/** Retina DPR cap — avoids 3× framebuffer cost on high-density displays. */
const MAX_PIXEL_RATIO = 2;
const SHADOW_MAP_SIZE = 1024;
const WIRE_CURVE_POINTS = 24;
const MAX_GRID_DIVISIONS = 72;
/** Fewer spheres + no per-particle gsap timelines. */
const FIRE_PARTICLE_COUNT_HIGH = 14;
const FIRE_PARTICLE_COUNT_LOW = 8;
/** Extra slack on building bounds so float / labels don’t pop at frustum edges. */
const CULL_SPHERE_PADDING = 1.35;
/** Tighten dependency wires to the actual arc AABB in world space (+ small margin). */
const WIRE_FRUSTUM_SLACK = 1.15;

/** Walk up to the lot root tagged with `userData.nodeId` (building `Group`). */
function buildingLotVisible(obj: THREE.Object3D): boolean {
  let o: THREE.Object3D | null = obj;
  while (o) {
    if (typeof o.userData.nodeId === "string") return o.visible;
    o = o.parent;
  }
  return true;
}

export interface CodeCityWorldProps {
  nodes: CodeNode[];
  /** Highest-risk file id — drives the “red drone” styling. */
  maliciousId: string | null;
  onNodeFocus: (node: CodeNode | null) => void;
}

export function CodeCityWorld({ nodes, maliciousId, onNodeFocus }: CodeCityWorldProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const workerRef = useRef<THREE.Group | null>(null);
  const nodesGroupRef = useRef<THREE.Group | null>(null);
  
  const [activeNodeIndex, setActiveNodeIndex] = useState(0);
  const activeNodeIndexRef = useRef(0);
  const targetFocalPoint = useRef(new THREE.Vector3(0, 0, 0));
  const cameraOrbitRadius = useRef(60);
  const cameraOrbitHeight = useRef(35);

  useEffect(() => {
    activeNodeIndexRef.current = activeNodeIndex;
  }, [activeNodeIndex]);

  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return;

    let effectAlive = true;
    const intervalIds: ReturnType<typeof setInterval>[] = [];
    const blockFloats: Array<{
      instancedMesh: THREE.InstancedMesh;
      index: number;
      baseY: number;
      phase: number;
      amp: number;
      speed: number;
      offsetX: number;
      offsetZ: number;
      rotX: number;
      rotY: number;
      rotZ: number;
    }> = [];
    const fireAnimations: Array<{
      mesh: THREE.Mesh;
      mat: THREE.MeshBasicMaterial;
      baseY: number;
      bx: number;
      bz: number;
      phase: number;
      speed: number;
      lift: number;
    }> = [];
    const leakAnimations: Array<{
      sprite: THREE.Sprite;
      mat: THREE.SpriteMaterial;
      startX: number;
      startZ: number;
      baseY: number;
      rise: number;
      phase: number;
    }> = [];
    const dripAnimations: Array<{
      mesh: THREE.Mesh;
      topY: number;
      phase: number;
      period: number;
    }> = [];
    const rotatingMeshes: Array<{ mesh: THREE.Mesh; speed: number }> = [];
    const busBobs: Array<{ bus: THREE.Group; baseX: number }> = [];

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(THEME.sky);
    scene.fog = new THREE.Fog(THEME.sky, 60, 250);
    sceneRef.current = scene;

    const cw = containerRef.current.clientWidth || 640;
    const ch = containerRef.current.clientHeight || 480;
    const camera = new THREE.PerspectiveCamera(50, cw / ch, 0.1, 1000);
    camera.position.set(30, 60, 30);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(cw, ch);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // --- Lights ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(20, 40, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = SHADOW_MAP_SIZE;
    directionalLight.shadow.mapSize.height = SHADOW_MAP_SIZE;
    scene.add(directionalLight);

    const gridCols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    const gridRows = Math.ceil(nodes.length / gridCols);
    const spacing = LAYOUT_SPACING;

    // Building stacks — original narrow towers on each lot (not full-cell width).
    const blockW = 4;
    const blockD = 4;
    const TOWER_BLOCK_STRIDE = 2;
    /** One shared hull; per-lot InstancedMesh batches (opaque | dead | wire). */
    const towerBlockGeometry = new THREE.BoxGeometry(blockW, TOWER_BLOCK_STRIDE - 0.1, blockD);
    const towerMatOpaque = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const towerMatDead = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    const towerMatWire = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
      wireframe: true,
      depthWrite: false,
    });
    const _composePos = new THREE.Vector3();
    const _composeQuat = new THREE.Quaternion();
    const _composeEuler = new THREE.Euler();
    const _composeScale = new THREE.Vector3(1, 1, 1);
    const _composeMtx = new THREE.Matrix4();

    // --- Floor / Foundation — covers all lots + FLOOR_MARGIN_CELLS extra grid cells ---
    const slabHeight = 4;
    const cityW = gridCols * spacing;
    const cityD = gridRows * spacing;
    const margin = FLOOR_MARGIN_CELLS * spacing;
    const slabW = Math.max(110, cityW + margin);
    const slabD = Math.max(110, cityD + margin);
    const slabGeometry = new THREE.BoxGeometry(slabW, slabHeight, slabD);
    const slabMaterial = new THREE.MeshLambertMaterial({
      color: THEME.bg,
    });
    const foundationSlab = new THREE.Mesh(slabGeometry, slabMaterial);
    foundationSlab.position.y = -slabHeight / 2; // Top surface at y=0
    foundationSlab.receiveShadow = true;
    scene.add(foundationSlab);

    // Square grid overlay sized to the larger slab edge; ~2-unit cells like the original 100/50 grid.
    const gridExtent = Math.max(slabW, slabD);
    const gridDivisions = Math.min(
      MAX_GRID_DIVISIONS,
      Math.max(32, Math.round(gridExtent / 2)),
    );
    const gridHelper = new THREE.GridHelper(gridExtent, gridDivisions, THEME.grid, THEME.grid);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // --- Nodes (Buildings) ---
    const nodesGroup = new THREE.Group();
    nodesGroupRef.current = nodesGroup;
    scene.add(nodesGroup);

    const nodePositions: Record<string, THREE.Vector3> = {};

    nodes.forEach((node, index) => {
      const group = new THREE.Group();
      group.userData.nodeId = node.id;

      // Calculate position in a larger grid
      const x = (index % gridCols) * spacing - ((gridCols - 1) * spacing) / 2;
      const z = Math.floor(index / gridCols) * spacing - ((gridCols - 1) * spacing) / 2;
      group.position.set(x, 0, z);
      nodePositions[node.id] = new THREE.Vector3(x, 0, z);

      // 1. Building Height (LoC) — stacked blocks as InstancedMesh (≤3 draws / lot).
      const height = node.loc / 100;
      const numBlocks = Math.max(1, Math.ceil(height / TOWER_BLOCK_STRIDE));
      const isMessy = node.solidViolations > 3 || node.risk > 0.6 || node.techDebt > 0.6 || node.complexity > 50;
      const isWireframe = node.testCoverage < 0.3;

      type TowerBucketKind = "opaque" | "dead" | "wire";
      interface PendingTowerBlock {
        kind: TowerBucketKind;
        color: THREE.Color;
        offsetX: number;
        offsetZ: number;
        rotX: number;
        rotY: number;
        rotZ: number;
        baseHeight: number;
        amp: number;
        phase: number;
        speed: number;
      }
      const pendingTower: PendingTowerBlock[] = [];

      for (let i = 0; i < numBlocks; i++) {
        let offsetX = 0;
        let offsetZ = 0;
        let rotX = 0;
        let rotY = 0;
        let rotZ = 0;

        if (isMessy) {
          const intensity = 0.5 + (i / numBlocks) * 1.5;
          offsetX = (Math.random() - 0.5) * intensity;
          offsetZ = (Math.random() - 0.5) * intensity;
          rotX = (Math.random() - 0.5) * 0.2 * intensity;
          rotY = (Math.random() - 0.5) * 0.5 * intensity;
          rotZ = (Math.random() - 0.5) * 0.2 * intensity;
        }

        const baseHeight = i * TOWER_BLOCK_STRIDE + TOWER_BLOCK_STRIDE / 2;
        const kind: TowerBucketKind = node.isDead ? "dead" : isWireframe ? "wire" : "opaque";
        const color = new THREE.Color(
          node.isDead ? THEME.ghost : isWireframe ? "#94A3B8" : THEME.buildingBase,
        );
        pendingTower.push({
          kind,
          color,
          offsetX,
          offsetZ,
          rotX,
          rotY,
          rotZ,
          baseHeight,
          amp: Math.random() * 0.4 + 0.1,
          phase: Math.random() * Math.PI * 2,
          speed: 0.9 + Math.random() * 0.55,
        });
      }

      const towerOpaque: PendingTowerBlock[] = [];
      const towerDead: PendingTowerBlock[] = [];
      const towerWire: PendingTowerBlock[] = [];
      for (const p of pendingTower) {
        if (p.kind === "opaque") towerOpaque.push(p);
        else if (p.kind === "dead") towerDead.push(p);
        else towerWire.push(p);
      }

      const commitTowerBucket = (
        items: PendingTowerBlock[],
        mat: THREE.MeshLambertMaterial,
        renderOrder: number,
      ) => {
        if (items.length === 0) return;
        const im = new THREE.InstancedMesh(towerBlockGeometry, mat, items.length);
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        im.castShadow = false;
        im.receiveShadow = false;
        im.frustumCulled = false;
        im.renderOrder = renderOrder;
        for (let i = 0; i < items.length; i++) {
          const spec = items[i];
          im.setColorAt(i, spec.color);
          _composePos.set(spec.offsetX, spec.baseHeight, spec.offsetZ);
          _composeQuat.setFromEuler(_composeEuler.set(spec.rotX, spec.rotY, spec.rotZ));
          _composeMtx.compose(_composePos, _composeQuat, _composeScale);
          im.setMatrixAt(i, _composeMtx);
          blockFloats.push({
            instancedMesh: im,
            index: i,
            baseY: spec.baseHeight,
            phase: spec.phase,
            amp: spec.amp,
            speed: spec.speed,
            offsetX: spec.offsetX,
            offsetZ: spec.offsetZ,
            rotX: spec.rotX,
            rotY: spec.rotY,
            rotZ: spec.rotZ,
          });
        }
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        group.add(im);
      };

      commitTowerBucket(towerOpaque, towerMatOpaque, 0);
      commitTowerBucket(towerDead, towerMatDead, 1);
      commitTowerBucket(towerWire, towerMatWire, 2);

      // 3. SOLID Violations (Tilt)
      if (node.solidViolations > 5) {
        group.rotation.z = Math.PI / 8;
      } else if (node.solidViolations > 0) {
        group.rotation.z = (node.solidViolations / 10) * (Math.PI / 8);
      }

      // 2. Risk (Fire) - Muted and subtler
      if (node.risk > 0.5) {
        const fireParticles = new THREE.Group();
        const fireCount = node.risk > 0.8 ? FIRE_PARTICLE_COUNT_HIGH : FIRE_PARTICLE_COUNT_LOW;
        for (let i = 0; i < fireCount; i++) {
          const sizeRandom = Math.random() * 0.3 + 0.15;
          const mat = new THREE.MeshBasicMaterial({
            color: i % 3 === 0 ? THEME.fire : i % 3 === 1 ? "#ffcc00" : "#ff4400",
            transparent: true,
            opacity: 0.95,
          });
          const p = new THREE.Mesh(new THREE.SphereGeometry(sizeRandom, 4, 4), mat);
          const startY = Math.random() * height;
          const range = 1.5 + node.risk * 1.5;
          const bx = (Math.random() - 0.5) * range;
          const bz = (Math.random() - 0.5) * range;
          p.position.set(bx, startY, bz);
          fireParticles.add(p);
          fireAnimations.push({
            mesh: p,
            mat,
            baseY: startY,
            bx,
            bz,
            phase: Math.random() * Math.PI * 2,
            speed: 1.1 + Math.random() * 0.9,
            lift: 3 + Math.random() * 3,
          });
        }
        group.add(fireParticles);
      }

      // --- Lightning Visual (For severe issues) ---
      if (node.blastRadius > 0.7 || node.securityLeak || node.risk > 0.8) {
        const lightningGroup = new THREE.Group();
        
        const createBolt = () => {
          const boltPoints = [];
          const currentPos = new THREE.Vector3((Math.random() - 0.5) * 4, height + 10, (Math.random() - 0.5) * 4);
          boltPoints.push(currentPos.clone());
          
          const segments = 5;
          for (let i = 0; i < segments; i++) {
            currentPos.x += (Math.random() - 0.5) * 3;
            currentPos.y -= (height + 10) / segments;
            currentPos.z += (Math.random() - 0.5) * 3;
            boltPoints.push(currentPos.clone());
          }
          
          const boltGeo = new THREE.BufferGeometry().setFromPoints(boltPoints);
          const boltMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
          const bolt = new THREE.Line(boltGeo, boltMat);
          lightningGroup.add(bolt);
          
          gsap.to(boltMat, {
            opacity: 0,
            duration: 0.2,
            onComplete: () => {
              lightningGroup.remove(bolt);
              boltGeo.dispose();
              boltMat.dispose();
            }
          });
        };

        const scheduleStrike = () => {
          window.setTimeout(() => {
            if (!effectAlive || !sceneRef.current) return;
            createBolt();
            scheduleStrike();
          }, Math.random() * 3000 + 500);
        };
        scheduleStrike();
        group.add(lightningGroup);
      }

      // --- Security Leak Visual (PII flying up) ---
      if (node.securityLeak) {
        const leakGroup = new THREE.Group();
        const piiLabels = ['USER_NAME', 'PHONE_NUM', 'SSN', 'EMAIL', 'ADDRESS', 'CREDIT_CARD'];
        const dataCount = 12;
        
        for (let i = 0; i < dataCount; i++) {
          const text = piiLabels[i % piiLabels.length];
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 64;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.9)'; // Alarm red leakage
            ctx.font = 'bold 30px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(text, 128, 40);
          }
          const texture = new THREE.CanvasTexture(canvas);
          const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
          const sprite = new THREE.Sprite(spriteMat);
          sprite.scale.set(3, 0.75, 1);
          
          const startX = (Math.random() - 0.5) * 5;
          const startZ = (Math.random() - 0.5) * 5;
          sprite.position.set(startX, Math.random() * height, startZ);
          leakGroup.add(sprite);

          const rise = 20 + Math.random() * 18;
          leakAnimations.push({
            sprite,
            mat: spriteMat,
            startX,
            startZ,
            baseY: sprite.position.y,
            rise,
            phase: Math.random() * 8,
          });
        }
        group.add(leakGroup);
      }

      // --- Building Name Label (Enhanced with Hints) ---
      const canvas = document.createElement('canvas');
      canvas.width = 1024; // Wider canvas for more text space
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
          const isBad = node.securityLeak || node.risk > 0.7 || node.ifNesting > 8 || node.techDebt > 0.7 || node.isDead || node.isGodClass || node.blastRadius > 0.8;
          const labelColor = isBad ? '#FF4444' : THEME.neonBlue; // Red for bad
          const alertColor = '#FF4444'; // Red for alerts

          // Background (Semi-transparent)
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.roundRect(0, 0, 1024, 256, 20);
          ctx.fill();
          
          // NO THICK SOLID BORDER (Removed strokeRect)
          
          ctx.fillStyle = labelColor;
          ctx.font = 'bold 64px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(node.name, 512, 80);

          const hint = node.securityLeak
            ? "[SECURITY LEAK!!]"
            : node.isGodClass
              ? "[GOD CLASS / RED ALERT]"
              : node.blastRadius > 0.8
                ? "[CRITICAL BLAST RADIUS]"
                : node.ifNesting > 8
                  ? "[IF-STATEMENT HELL]"
                  : node.isDead
                    ? "[DEAD CODE / GHOST]"
                    : node.risk > 0.7
                      ? "[CRITICAL RISK]"
                      : node.aiGenerated
                        ? "[AI SLOP DETECTED]"
                        : node.heuristicLevel > 0.7
                          ? "[HEURISTIC GUESSING]"
                          : "[SECTOR OPTIMAL]";

          ctx.font = '32px monospace';
          ctx.fillStyle = isBad ? alertColor : '#1E293B';
          ctx.fillText(hint, 512, 140);
          
          ctx.font = '24px monospace';
          ctx.fillStyle = '#64748B';
          ctx.fillText(`LOC: ${node.loc} | NEST: ${node.ifNesting} | BLAST: ${node.blastRadius.toFixed(1)}`, 512, 190);
      }
      const texture = new THREE.CanvasTexture(canvas);
      const labelMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const label = new THREE.Sprite(labelMat);
      label.scale.set(12, 3, 1);
      label.position.set(0, height + 4, 0);
      group.add(label);

      // --- Special "GOD CLASS" Aerial Label (Sky-high) ---
      if (node.isGodClass) {
        const skyLabelCanvas = document.createElement('canvas');
        skyLabelCanvas.width = 512;
        skyLabelCanvas.height = 128;
        const skyCtx = skyLabelCanvas.getContext('2d');
        if (skyCtx) {
          skyCtx.fillStyle = '#FFC107'; // Golden Yellow
          skyCtx.font = 'bold 80px monospace';
          skyCtx.textAlign = 'center';
          skyCtx.shadowColor = 'rgba(0,0,0,0.5)';
          skyCtx.shadowBlur = 10;
          skyCtx.fillText('GOD CLASS', 256, 80);
        }
        const skyTexture = new THREE.CanvasTexture(skyLabelCanvas);
        const skyLabelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: skyTexture, transparent: true }));
        skyLabelSprite.scale.set(10, 2.5, 1);
        skyLabelSprite.position.set(0, height + 15, 0);
        group.add(skyLabelSprite);
      }

      // --- AI Generated Visual (Dual-Mode Autonomous Drones) ---
      if (node.aiGenerated) {
        const droneGroup = new THREE.Group();
        // ONLY ONE RED DRONE (at BigBallOfMud, id '7')
        const isMalicious = maliciousId !== null && node.id === maliciousId;
        const droneColor = isMalicious ? 0xff0000 : 0x00ccff;
        const droneCount = 1; 
        
        for (let i = 0; i < droneCount; i++) {
          const droneHost = new THREE.Group();
          const drone = new THREE.Group();
          const scaleMult = isMalicious ? 1.5 : 1;

          // 🤖 Emoji Style Robot Design
          const skinColor = isMalicious ? 0xcc0000 : 0xcccccc;
          const metalMat = new THREE.MeshLambertMaterial({
            color: skinColor,
          });

          // 1. Squared Head
          const headGeo = new THREE.BoxGeometry(0.8 * scaleMult, 0.7 * scaleMult, 0.7 * scaleMult);
          const head = new THREE.Mesh(headGeo, metalMat);
          head.position.y = 0.8 * scaleMult;
          drone.add(head);

          // 2. Glowing Eyes
          const eyeGeo = new THREE.BoxGeometry(0.15 * scaleMult, 0.15 * scaleMult, 0.1 * scaleMult);
          const eyeMat = new THREE.MeshBasicMaterial({ color: droneColor, transparent: true });
          const leftEye = new THREE.Mesh(eyeGeo, eyeMat.clone());
          leftEye.position.set(-0.2 * scaleMult, 0.9 * scaleMult, 0.35 * scaleMult);
          drone.add(leftEye);
          const rightEye = new THREE.Mesh(eyeGeo, eyeMat.clone());
          rightEye.position.set(0.2 * scaleMult, 0.9 * scaleMult, 0.35 * scaleMult);
          drone.add(rightEye);

          // Pulsing eyes
          [leftEye, rightEye].forEach(eye => {
            gsap.to(eye.material, { opacity: 0.3, duration: isMalicious ? 0.3 : 1, repeat: -1, yoyo: true });
          });

          // 3. Rectangular Body
          const bodyGeo = new THREE.BoxGeometry(0.9 * scaleMult, 1.0 * scaleMult, 0.6 * scaleMult);
          const body = new THREE.Mesh(bodyGeo, metalMat);
          body.position.y = 0;
          drone.add(body);

          // 4. Ears (Antennas)
          const earGeo = new THREE.CylinderGeometry(0.1 * scaleMult, 0.1 * scaleMult, 0.2 * scaleMult, 8);
          const leftEar = new THREE.Mesh(earGeo, metalMat);
          leftEar.position.set(-0.45 * scaleMult, 0.9 * scaleMult, 0);
          leftEar.rotation.z = Math.PI / 2;
          drone.add(leftEar);
          const rightEar = new THREE.Mesh(earGeo, metalMat);
          rightEar.position.set(0.45 * scaleMult, 0.9 * scaleMult, 0);
          rightEar.rotation.z = -Math.PI / 2;
          drone.add(rightEar);

          // 5. Antenna on top
          const antPoleGeo = new THREE.CylinderGeometry(0.02 * scaleMult, 0.02 * scaleMult, 0.3 * scaleMult, 8);
          const antPole = new THREE.Mesh(antPoleGeo, metalMat);
          antPole.position.set(0, 1.25 * scaleMult, 0);
          drone.add(antPole);
          const antTipGeo = new THREE.SphereGeometry(0.1 * scaleMult, 8, 8);
          const antTip = new THREE.Mesh(antTipGeo, new THREE.MeshBasicMaterial({ color: droneColor }));
          antTip.position.set(0, 1.4 * scaleMult, 0);
          drone.add(antTip);

          // 6. Construction Action (Looping Block Stacking)
          const createFallingBlock = () => {
            if (!effectAlive || !sceneRef.current || !droneHost.parent) return;

            const blockGeo = new THREE.BoxGeometry(2 * scaleMult, 0.8 * scaleMult, 2 * scaleMult);
            const blockMat = new THREE.MeshLambertMaterial({
              color: THEME.buildingBase,
              transparent: true,
              opacity: 1,
            });
            const fallingBlock = new THREE.Mesh(blockGeo, blockMat);
            
            // Spawn at robot's current global position
            const robotWorldPos = new THREE.Vector3();
            droneHost.getWorldPosition(robotWorldPos);
            
            // Adjust to be slightly under the robot
            fallingBlock.position.copy(robotWorldPos);
            fallingBlock.position.y -= 1.5 * scaleMult;
            
            sceneRef.current.add(fallingBlock);

            // Animate stacking onto the building
            const targetY = height + 0.5;
            gsap.to(fallingBlock.position, {
              y: targetY,
              x: group.position.x,
              z: group.position.z,
              duration: isMalicious ? 0.8 : 1.5,
              ease: "bounce.out",
              onComplete: () => {
                // Fade out after stacking
                gsap.to(blockMat, {
                  opacity: 0,
                  duration: 0.5,
                  onComplete: () => {
                    if (sceneRef.current) sceneRef.current.remove(fallingBlock);
                    blockGeo.dispose();
                    blockMat.dispose();
                  }
                });
              }
            });
          };

          intervalIds.push(
            window.setInterval(createFallingBlock, isMalicious ? 1500 : 3000),
          );

          // Initial positioning
          const angle = Math.random() * Math.PI * 2;
          const radius = isMalicious ? 10 : 8;
          droneHost.position.set(
            Math.cos(angle) * radius,
            height * 0.7,
            Math.sin(angle) * radius
          );
          
          droneHost.add(drone);
          droneGroup.add(droneHost);
          
          if (isMalicious) {
            // RED BOT (Aggressive Scanning)
            gsap.to(droneHost.position, {
              y: "+=4",
              duration: 2,
              repeat: -1,
              yoyo: true,
              ease: "sine.inOut"
            });
            
            const action = () => {
              if (!effectAlive || !sceneRef.current) return;
              gsap.to(droneHost.position, {
                x: (Math.random() - 0.5) * 20,
                z: (Math.random() - 0.5) * 20,
                duration: 1.5,
                ease: "power2.inOut",
                onComplete: () => {
                  if (!effectAlive) return;
                  window.setTimeout(action, Math.random() * 1000 + 500);
                },
              });
              drone.lookAt(0, height * Math.random(), 0);
            };
            action();
          } else {
            // BLUE BOT (Smooth Construction)
            gsap.to(droneHost.position, {
              y: droneHost.position.y + 2,
              duration: 4,
              repeat: -1,
              yoyo: true,
              ease: "sine.inOut"
            });

            gsap.to(droneGroup.rotation, {
              y: Math.PI * 2,
              duration: 20,
              repeat: -1,
              ease: "none"
            });
            
            drone.lookAt(0, height / 2, 0);
          }
        }
        group.add(droneGroup);
      }

      // 6. Tech Debt (Trash and Clutter)
      if (node.techDebt > 0.6) {
        const trashGroup = new THREE.Group();
        for (let i = 0; i < 5; i++) {
          const trash = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.5, 0.5),
            new THREE.MeshLambertMaterial({ color: 0x4b3621 }) // Brownish "trash"
          );
          trash.position.set(
            (Math.random() - 0.5) * 4,
            0.25,
            (Math.random() - 0.5) * 4
          );
          trash.rotation.set(Math.random(), Math.random(), Math.random());
          trashGroup.add(trash);
        }
        group.add(trashGroup);
      }

      // 8. Memory Leak (Leaking Pipes)
      if (node.memoryLeak) {
        // Puddle
        const puddle = new THREE.Mesh(
          new THREE.CircleGeometry(4, 16),
          new THREE.MeshBasicMaterial({ color: '#3B82F6', transparent: true, opacity: 0.4 })
        );
        puddle.rotation.x = -Math.PI / 2;
        puddle.position.y = 0.05;
        group.add(puddle);

        // Pipe
        const pipe = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.2, 2),
          new THREE.MeshLambertMaterial({ color: 0x888888 })
        );
        pipe.rotation.z = Math.PI / 2;
        pipe.position.set(2, height / 2, 0);
        group.add(pipe);

        // Dripping particles
        const dripGroup = new THREE.Group();
        for (let i = 0; i < 3; i++) {
          const drip = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial({ color: '#3B82F6' }));
          const topY = height / 2;
          drip.position.set(2, topY, 0);
          dripGroup.add(drip);
          dripAnimations.push({
            mesh: drip,
            topY,
            phase: i * 0.35,
            period: 1 + Math.random() * 0.6,
          });
        }
        group.add(dripGroup);
      }

      // 11. Duplication (Cloned sub-blocks)
      if (node.duplication > 0.4) {
        const clone = new THREE.Mesh(
            new THREE.BoxGeometry(2, 2, 2),
            new THREE.MeshLambertMaterial({ color: THEME.buildingBase, wireframe: true })
        );
        clone.position.set(3, 1, 0);
        group.add(clone);
        rotatingMeshes.push({ mesh: clone, speed: (Math.PI * 2) / 10 });
      }

      // 9. Bus Factor
      if (node.busFactor === 0) {
          const busLaneX = 8;
          // Bus
          const bus = new THREE.Group();
          const busBody = new THREE.Mesh(
              new THREE.BoxGeometry(6, 3, 3),
              new THREE.MeshLambertMaterial({ color: 0xffcc00 })
          );
          bus.add(busBody);

          // Windows
          const windowMat = new THREE.MeshLambertMaterial({ color: 0x33ccff, transparent: true, opacity: 0.6 });
          const frontWindow = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.5), windowMat);
          frontWindow.position.set(-3.05, 0.5, 0);
          frontWindow.rotation.y = -Math.PI / 2;
          bus.add(frontWindow);

          for (let i = 0; i < 2; i++) {
            const sideWindow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1), windowMat);
            sideWindow.position.set(i * 2 - 1, 0.5, 1.55);
            bus.add(sideWindow);
            const sideWindow2 = sideWindow.clone();
            sideWindow2.position.z = -1.55;
            sideWindow2.rotation.y = Math.PI;
            bus.add(sideWindow2);
          }

          // Lights
          const lightGeo = new THREE.SphereGeometry(0.2);
          const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
          const light1 = new THREE.Mesh(lightGeo, lightMat);
          light1.position.set(-3, -0.5, 1);
          bus.add(light1);
          const light2 = light1.clone();
          light2.position.z = -1;
          bus.add(light2);

          // Wheels
          const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 3.2);
          const wheel1 = new THREE.Mesh(wheelGeo, new THREE.MeshLambertMaterial({ color: 0x000000 }));
          wheel1.rotation.z = Math.PI/2;
          wheel1.position.set(2, -1.2, 0);
          bus.add(wheel1);
          const wheel2 = wheel1.clone();
          wheel2.position.set(-2, -1.2, 0);
          bus.add(wheel2);

          bus.position.set(busLaneX, 1.5, 0);
          group.add(bus);
          busBobs.push({ bus, baseX: busLaneX });

          // Hero (Flattened)
          const hero = new THREE.Group();
          const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 2), new THREE.MeshLambertMaterial({ color: 0xffd700 }));
          hero.add(torso);
          const head = new THREE.Mesh(new THREE.SphereGeometry(0.4), new THREE.MeshLambertMaterial({ color: 0xffd700 }));
          head.position.z = 1.2;
          hero.add(head);

          hero.position.set(8, 0.1, 3.5);
          group.add(hero);

          // Bus Factor Label
          const bfCanvas = document.createElement('canvas');
          bfCanvas.width = 256;
          bfCanvas.height = 64;
          const bfCtx = bfCanvas.getContext('2d');
          if (bfCtx) {
            bfCtx.fillStyle = 'rgba(15, 23, 42, 0.9)'; // Dark slate background
            bfCtx.roundRect(0, 0, 256, 64, 10);
            bfCtx.fill();
            bfCtx.fillStyle = '#ffffff';
            bfCtx.font = 'bold 24px monospace';
            bfCtx.textAlign = 'center';
            bfCtx.fillText(`BUS FACTOR: ${node.busFactor}`, 128, 40);
          }
          const bfTexture = new THREE.CanvasTexture(bfCanvas);
          const bfSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: bfTexture, transparent: true }));
          bfSprite.scale.set(4, 1, 1);
          bfSprite.position.set(8, 2, 4);
          group.add(bfSprite);
      }

      // Label (using Group but HUD will handle UI)
      nodesGroup.add(group);
      group.updateMatrixWorld(true);
      const boundsBox = new THREE.Box3().setFromObject(group);
      const cullSphere = new THREE.Sphere();
      if (boundsBox.isEmpty()) {
        cullSphere.center.set(x, Math.max(height, 4) * 0.5 + 4, z);
        cullSphere.radius = 36;
      } else {
        boundsBox.getBoundingSphere(cullSphere);
      }
      // Sprites / decals often yield a too-tight AABB; anchor to the lot and enforce a floor radius.
      const stackTop = numBlocks * TOWER_BLOCK_STRIDE + 10;
      const minLotRadius = Math.max(
        30,
        Math.hypot(16, stackTop * 0.55) + CULL_SPHERE_PADDING * 4,
      );
      cullSphere.radius = Math.max(cullSphere.radius * CULL_SPHERE_PADDING, minLotRadius);
      cullSphere.center.x = x;
      cullSphere.center.z = z;
      cullSphere.center.y = Math.max(cullSphere.center.y, stackTop * 0.42 + 2);
      group.userData.cullSphere = cullSphere;
      // Lot-level cull replaces per-mesh frustum tests for this subtree.
      group.traverse((obj) => {
        obj.frustumCulled = false;
      });
    });

    // --- Dependency Wires (High overhead) ---
    const depLines: THREE.Line[] = [];
    const locById = new Map(nodes.map(n => [n.id, n.loc] as const));
    nodes.forEach((node) => {
      const fromPos = nodePositions[node.id];
      const fromHeight = node.loc / 100;
      
      node.dependencies.forEach((depId) => {
        const toPos = nodePositions[depId];
        const toLoc = locById.get(depId);
        if (toLoc === undefined) return;
        const toHeight = toLoc / 100;
        
        if (fromPos && toPos) {
          // Arc curve for high overhead wires
          const midX = (fromPos.x + toPos.x) / 2;
          const midZ = (fromPos.z + toPos.z) / 2;
          const arcHeight = Math.max(fromHeight, toHeight) + 15;
          
          const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(fromPos.x, fromHeight, fromPos.z),
            new THREE.Vector3(midX, arcHeight, midZ),
            new THREE.Vector3(toPos.x, toHeight, toPos.z)
          ]);
          
          const points = curve.getPoints(WIRE_CURVE_POINTS);
          const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
          const lineMat = new THREE.LineBasicMaterial({ 
            color: THEME.neonBlue, 
            transparent: true, 
            opacity: 0.3 
          });
          const line = new THREE.Line(lineGeo, lineMat);
          line.frustumCulled = false;
          lineGeo.computeBoundingSphere();
          const edgeCullSphere = lineGeo.boundingSphere?.clone() ?? new THREE.Sphere();
          edgeCullSphere.radius *= WIRE_FRUSTUM_SLACK;
          line.userData.edgeCullSphere = edgeCullSphere;
          scene.add(line);
          depLines.push(line);
        }
      });
    });

    // --- Worker Character ---
    const worker = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 0.5), new THREE.MeshLambertMaterial({ color: 0x3366ff }));
    body.position.y = 1.2;
    worker.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshLambertMaterial({ color: 0xffcc99 }));
    head.position.y = 2.1;
    worker.add(head);

    const legGeo = new THREE.BoxGeometry(0.3, 0.8, 0.3);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.25, 0.4, 0);
    worker.add(leftLeg);
    
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.25, 0.4, 0);
    worker.add(rightLeg);

    worker.position.set(0, 0, 5);
    scene.add(worker);
    workerRef.current = worker;

    // --- Animation Loop ---
    const clock = new THREE.Clock();
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    const animate = () => {
      requestAnimationFrame(animate);
      clock.getDelta();
      const time = clock.getElapsedTime();

      if (document.visibilityState === "hidden") {
        return;
      }

      // Walking animation if moving (using indices to check if we should be "walking")
      // Simple logic: if distance to target is significant, animate legs
      if (workerRef.current) {
        // Legs swing
        leftLeg.rotation.x = Math.sin(time * 10) * 0.5;
        rightLeg.rotation.x = -Math.sin(time * 10) * 0.5;
        // Body bob
        body.position.y = 1.2 + Math.abs(Math.sin(time * 10)) * 0.1;
        head.position.y = 2.1 + Math.abs(Math.sin(time * 10)) * 0.1;
      }
      // Helicopter orbit & Focus
      if (cameraRef.current) {
        const orbitSpeed = 0.15;
        const radius = cameraOrbitRadius.current;
        const height = cameraOrbitHeight.current;
        const angle = time * orbitSpeed;

        // Orbital path around focal point
        cameraRef.current.position.x = targetFocalPoint.current.x + Math.cos(angle) * radius;
        cameraRef.current.position.z = targetFocalPoint.current.z + Math.sin(angle) * radius;
        cameraRef.current.position.y = height + Math.sin(time * 0.5) * 2; // Subtle vertical sway

        // Constantly look at the focal point (smoothly)
        cameraRef.current.lookAt(targetFocalPoint.current);
      }

      controls.update();

      // Frustum cull *after* camera + controls — only lots in view stay visible.
      if (cameraRef.current) {
        cameraRef.current.updateMatrixWorld(true);
        projScreenMatrix.multiplyMatrices(
          cameraRef.current.projectionMatrix,
          cameraRef.current.matrixWorldInverse,
        );
        frustum.setFromProjectionMatrix(projScreenMatrix);
        for (const g of nodesGroup.children) {
          const sp = g.userData.cullSphere as THREE.Sphere | undefined;
          if (sp) g.visible = frustum.intersectsSphere(sp);
        }
        for (const line of depLines) {
          const sp = line.userData.edgeCullSphere as THREE.Sphere | undefined;
          line.visible = sp !== undefined && frustum.intersectsSphere(sp);
        }
      }

      // Match original gsap yoyo: only float *upward* from rest (never sink below baseY).
      const dirtyTowerMeshes = new Set<THREE.InstancedMesh>();
      for (const b of blockFloats) {
        if (!buildingLotVisible(b.instancedMesh)) continue;
        const bob = 0.5 + 0.5 * Math.sin(time * b.speed + b.phase);
        const y = b.baseY + bob * b.amp;
        _composePos.set(b.offsetX, y, b.offsetZ);
        _composeQuat.setFromEuler(_composeEuler.set(b.rotX, b.rotY, b.rotZ));
        _composeMtx.compose(_composePos, _composeQuat, _composeScale);
        b.instancedMesh.setMatrixAt(b.index, _composeMtx);
        dirtyTowerMeshes.add(b.instancedMesh);
      }
      for (const m of dirtyTowerMeshes) {
        m.instanceMatrix.needsUpdate = true;
      }

      const fireCycle = 2.4;
      for (const f of fireAnimations) {
        if (!buildingLotVisible(f.mesh)) continue;
        const u = ((time * f.speed + f.phase) % fireCycle) / fireCycle;
        f.mesh.position.y = f.baseY + u * f.lift;
        f.mesh.position.x = f.bx + Math.sin(time * 2.2 + f.phase) * 0.35;
        f.mesh.position.z = f.bz + Math.cos(time * 2.2 + f.phase) * 0.35;
        const s = 0.35 + Math.sin(u * Math.PI) * 0.85;
        f.mesh.scale.setScalar(s);
        f.mat.opacity = Math.max(0.12, 1 - u * u);
      }

      const leakCycle = 9;
      for (const L of leakAnimations) {
        if (!buildingLotVisible(L.sprite)) continue;
        const u = ((time * 0.11 + L.phase) % leakCycle) / leakCycle;
        L.sprite.position.y = L.baseY + u * L.rise;
        L.sprite.position.x = L.startX + Math.sin(u * Math.PI * 2) * 3;
        L.sprite.position.z = L.startZ + Math.cos(u * Math.PI * 2) * 3;
        L.mat.opacity = Math.max(0.05, 0.95 * (1 - u * u));
      }

      for (const d of dripAnimations) {
        if (!buildingLotVisible(d.mesh)) continue;
        const u = ((time + d.phase) % d.period) / d.period;
        d.mesh.position.y = d.topY - u * (d.topY - 0.12);
      }

      for (const r of rotatingMeshes) {
        if (!buildingLotVisible(r.mesh)) continue;
        r.mesh.rotation.y = time * r.speed;
      }

      for (const bb of busBobs) {
        const lot = bb.bus.parent;
        if (lot && typeof lot.userData.nodeId === "string" && !lot.visible) continue;
        bb.bus.position.x = bb.baseX + Math.sin(time * 1.2) * 0.9;
      }

      renderer.render(scene, camera);
    };
    animate();

    // --- Handle Resize ---
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
      rendererRef.current.setSize(width, height);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(containerRef.current);

    return () => {
      effectAlive = false;
      intervalIds.forEach((id) => clearInterval(id));
      resizeObserver.disconnect();
      gsap.globalTimeline.clear();
      towerBlockGeometry.dispose();
      towerMatOpaque.dispose();
      towerMatDead.dispose();
      towerMatWire.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [nodes, maliciousId]);

  useEffect(() => {
    setActiveNodeIndex(i => (nodes.length === 0 ? 0 : Math.min(i, nodes.length - 1)));
  }, [nodes.length]);

  // --- Patrolling Logic ---
  useEffect(() => {
    if (nodes.length === 0) return;
    const patrol = async () => {
      const targetNode = nodes[activeNodeIndex];
      if (!targetNode) return;
      const gridCols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
      const spacing = LAYOUT_SPACING;
      const targetPos = {
        x: (activeNodeIndex % gridCols) * spacing - ((gridCols - 1) * spacing) / 2,
        z: Math.floor(activeNodeIndex / gridCols) * spacing - ((gridCols - 1) * spacing) / 2
      };

      if (workerRef.current && cameraRef.current) {
        onNodeFocus(targetNode);
        
        const currentPos = workerRef.current.position.clone();
        const destX = targetPos.x + 8;
        const destZ = targetPos.z + 8;
        
        // Calculate distance and duration for constant speed
        const dist = Math.sqrt(Math.pow(destX - currentPos.x, 2) + Math.pow(destZ - currentPos.z, 2));
        const speed = 6; // units per second (Slower movement)
        const duration = dist / speed;

        // Move worker to target building (offset)
        gsap.to(workerRef.current.position, {
          x: destX,
          z: destZ,
          duration: duration,
          ease: "none",
          onComplete: () => {
            // Stay for a bit
            setTimeout(() => {
              setActiveNodeIndex((prev) => (prev + 1) % nodes.length);
            }, 6000); // 1s more
          }
        });

        // Rotate worker to face move direction
        workerRef.current.lookAt(destX, 0, destZ);

        // Update focal point
        gsap.to(targetFocalPoint.current, {
          x: targetPos.x,
          y: 0,
          z: targetPos.z,
          duration: 3,
          ease: "power2.inOut"
        });
      }
    };

    patrol();
  }, [activeNodeIndex, onNodeFocus, nodes]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#000",
      }}
    />
  );
}
