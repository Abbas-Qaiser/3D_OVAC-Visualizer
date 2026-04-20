/* 3D Memristive Device Visualizer v4 — Improved */

// ═══════ 1. CONFIG ═══════
const CFG = {
    cylRadius:1.8, cylHeight:5.0, topThick:0.5, botThick:0.5,
    atomSize:0.12, atomDensity:1.0,
    filThick:0.5, filRand:0.3, growSpeed:1.0, buildProg:0,
    ruptureLocation:'top', ruptureStyle:'progressive', rupture:0,
    clrTopLid:'#c0a050', clrBotLid:'#a0a0b0', clrBody:'#4a7a9b',
    clrFilament:'#ff6030', clrVacancy:'#ffcc00', clrBg:'#0d1117',
    opacity:0.85, lightInt:1.0, glow:0.3,
    showLabels:true, autoAnimate:false, animSpeed:1.0,
    mode:'solid', shape:'cylinder', cutaway:false, theme:'dark-lab',
    showTopElectrode:true, showBotElectrode:true,
    growDir:'bottom-up', polarity:'top-pos',
    showGrid:true,
    interactiveMode:null, // null | 'ion' | 'vacancy'
    _animPhase:'idle', _time:0, _ruptureY:null
};

// ═══════ 2. THEMES ═══════
const THEMES = {
    'dark-lab':     {bg:'#0d1117',topLid:'#c0a050',botLid:'#a0a0b0',body:'#4a7a9b',filament:'#ff6030',vacancy:'#ffcc00'},
    'light-pub':    {bg:'#f0f2f5',topLid:'#b8963e',botLid:'#7a7a8a',body:'#3d6a88',filament:'#d94820',vacancy:'#e6a800'},
    'white-ppt':    {bg:'#ffffff',topLid:'#b09030',botLid:'#707080',body:'#3a6080',filament:'#cc4018',vacancy:'#cc9900'},
    'neutral':      {bg:'#303032',topLid:'#bfa448',botLid:'#9898a4',body:'#5a8aaa',filament:'#ee5528',vacancy:'#e0b020'},
    'high-contrast':{bg:'#000000',topLid:'#ffcc00',botLid:'#00ccff',body:'#336699',filament:'#ff4400',vacancy:'#ffff00'}
};

function applyTheme(name) {
    CFG.theme = name;
    const t = THEMES[name]; if (!t) return;
    document.body.setAttribute('data-theme', name);
    CFG.clrBg=t.bg; CFG.clrTopLid=t.topLid; CFG.clrBotLid=t.botLid;
    CFG.clrBody=t.body; CFG.clrFilament=t.filament; CFG.clrVacancy=t.vacancy;
    scene.background = new THREE.Color(t.bg);
    const ids = {topLid:'clr-topLid',botLid:'clr-botLid',body:'clr-body',filament:'clr-filament',vacancy:'clr-vacancy'};
    Object.entries(ids).forEach(([k,id]) => { const e=document.getElementById(id); if(e) e.value=t[k]; });
    filamentAtoms = []; rebuildDevice();
}

// ═══════ 3. SCENE SETUP — NO SHADOWS ═══════
const container = document.getElementById('canvas-container');
const renderer = new THREE.WebGLRenderer({antialias:true, alpha:true, preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputEncoding = THREE.sRGBEncoding;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(CFG.clrBg);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth/window.innerHeight, 0.1, 100);
camera.position.set(6, 4.5, 8);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 3;
controls.maxDistance = 30;
controls.target.set(0, 0, 0);
controls.update();

// Lighting — even, soft, NO shadows
const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
scene.add(ambientLight);
const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x8899aa, 0.4);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xffffff, CFG.lightInt*0.5);
dirLight.position.set(4, 6, 5); dirLight.castShadow = false;
scene.add(dirLight);
const fillLight = new THREE.DirectionalLight(0xccccdd, 0.3);
fillLight.position.set(-3, 3, -4); fillLight.castShadow = false;
scene.add(fillLight);
const rimLight = new THREE.PointLight(0x88aadd, 0.25, 20);
rimLight.position.set(-4, 2, 4); rimLight.castShadow = false;
scene.add(rimLight);

// Bloom
let composer;
try {
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    const bp = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth,window.innerHeight), CFG.glow, 0.4, 0.75);
    composer.addPass(bp); composer._bloomPass = bp;
} catch(e) { composer = null; }

// ═══════ 4. GROUPS ═══════
const deviceGroup = new THREE.Group();
scene.add(deviceGroup);
const topLidGroup = new THREE.Group();
const botLidGroup = new THREE.Group();
const bodyGroup = new THREE.Group();
const filamentGroup = new THREE.Group();
const shellGroup = new THREE.Group();
deviceGroup.add(topLidGroup, botLidGroup, bodyGroup, filamentGroup, shellGroup);

// Higher quality atom geometry (smoother spheres)
const atomGeo = new THREE.SphereGeometry(1, 20, 16);

// Interactive particles group
const interactiveGroup = new THREE.Group();
deviceGroup.add(interactiveGroup);
let interactiveParticles = []; // [{mesh, type:'ion'|'vacancy', pos:{x,y,z}}]
let selectedParticle = null;
let isDragging = false;
let dragPlane = new THREE.Plane();
let dragOffset = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// GRID
const gridGroup = new THREE.Group();
scene.add(gridGroup);

function buildGrid() {
    while(gridGroup.children.length) { const c=gridGroup.children[0]; if(c.geometry)c.geometry.dispose(); if(c.material)c.material.dispose(); gridGroup.remove(c); }
    if(!CFG.showGrid) return;
    const isLight = CFG.theme==='white-ppt' || CFG.theme==='light-pub';
    const gridColor = isLight ? 0xcccccc : 0x222233;
    const gridColorCenter = isLight ? 0xaaaaaa : 0x334455;
    const gridSize = 12, gridDivisions = 20;
    const grid = new THREE.GridHelper(gridSize, gridDivisions, gridColorCenter, gridColor);
    grid.position.y = -CFG.cylHeight/2 - 0.6;
    grid.material.transparent = true;
    grid.material.opacity = isLight ? 0.4 : 0.3;
    grid.material.depthWrite = false;
    gridGroup.add(grid);
    const axLen = gridSize * 0.5;
    const xAxisGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-axLen,0,0), new THREE.Vector3(axLen,0,0)]);
    const xAxisMat = new THREE.LineBasicMaterial({color:0xff4444, transparent:true, opacity:0.25, depthWrite:false});
    const xAxis = new THREE.Line(xAxisGeo, xAxisMat);
    xAxis.position.y = grid.position.y + 0.005;
    gridGroup.add(xAxis);
    const zAxisGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,-axLen), new THREE.Vector3(0,0,axLen)]);
    const zAxisMat = new THREE.LineBasicMaterial({color:0x4444ff, transparent:true, opacity:0.25, depthWrite:false});
    const zAxis = new THREE.Line(zAxisGeo, zAxisMat);
    zAxis.position.y = grid.position.y + 0.005;
    gridGroup.add(zAxis);
}
buildGrid();

// ═══════ 5. MATERIALS — SMOOTH & PREMIUM ═══════
function createMatteMat(color, opts={}) {
    return new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: opts.roughness !== undefined ? opts.roughness : 0.92,
        metalness: opts.metalness !== undefined ? opts.metalness : 0.02,
        transparent: !!opts.transparent, opacity: opts.opacity !== undefined ? opts.opacity : 1.0,
        emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
        emissiveIntensity: opts.emissiveIntensity || 0,
        side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
        depthWrite: opts.transparent ? false : true
    });
}

function createElectrodeMat(color) {
    return new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: 0.35,
        metalness: 0.45,
        envMapIntensity: 0.6,
        flatShading: false
    });
}

// ═══════ 6. ATOM PACKING ═══════
function packAtomsInCylinder(radius, yMin, yMax, atomR, density) {
    const pos = [], sp = atomR*2.1/density;
    for (let y=yMin+atomR; y<=yMax-atomR; y+=sp*0.866) {
        const ri = Math.round((y-yMin)/(sp*0.866)), off=(ri%2)*sp*0.5;
        for (let x=-radius+atomR; x<=radius-atomR; x+=sp) {
            for (let z=-radius+atomR; z<=radius-atomR; z+=sp) {
                const px=x+off, pz=z+((ri%2)*sp*0.25), rl=radius-atomR;
                if (px*px+pz*pz <= rl*rl) {
                    const j=atomR*0.12;
                    pos.push({x:px+(Math.random()-.5)*j, y:y+(Math.random()-.5)*j, z:pz+(Math.random()-.5)*j});
                }
            }
        }
    }
    return pos;
}

function packAtomsInBox(hw, hd, yMin, yMax, atomR, density) {
    const pos = [], sp = atomR*2.1/density;
    for (let y=yMin+atomR; y<=yMax-atomR; y+=sp*0.866) {
        const ri = Math.round((y-yMin)/(sp*0.866)), off=(ri%2)*sp*0.5;
        for (let x=-hw+atomR; x<=hw-atomR; x+=sp) {
            for (let z=-hd+atomR; z<=hd-atomR; z+=sp) {
                const j=atomR*0.12;
                pos.push({x:x+off+(Math.random()-.5)*j, y:y+(Math.random()-.5)*j, z:z+(Math.random()-.5)*j});
            }
        }
    }
    return pos;
}

function buildAtomInstances(positions, material, parentGroup, atomRadius) {
    if (!positions.length) return null;
    const mesh = new THREE.InstancedMesh(atomGeo, material, positions.length);
    mesh.castShadow = false; mesh.receiveShadow = false;
    const dummy = new THREE.Object3D();
    positions.forEach((p,i) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.setScalar(atomRadius);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    parentGroup.add(mesh);
    return mesh;
}

// ═══════ 7. SHELL BUILDERS — SMOOTH, NO HARD EDGES ═══════
function buildHollowShell(radius, height, yCenter, color, opacity, isBox) {
    const group = new THREE.Group();
    const isWhite = CFG.theme === 'white-ppt' || CFG.theme === 'light-pub';
    const edgeOpacity = isWhite ? Math.max(opacity, 0.25) : opacity;
    const col = new THREE.Color(color);

    if (isBox) {
        // Smooth box shell — no visible edge lines
        const outerGeo = new THREE.BoxGeometry(radius*2, height, radius*2, 2, 2, 2);
        const outerMat = new THREE.MeshStandardMaterial({
            color: col, transparent:true, opacity:edgeOpacity,
            roughness:0.3, metalness:0.08, side:THREE.DoubleSide, depthWrite:false
        });
        const outer = new THREE.Mesh(outerGeo, outerMat);
        outer.castShadow=false; outer.receiveShadow=false;
        group.add(outer);
    } else {
        // Smooth cylinder shell — high segment count, no seams
        const outerGeo = new THREE.CylinderGeometry(radius, radius, height, 96, 1, true);
        const outerMat = new THREE.MeshStandardMaterial({
            color: col, transparent:true, opacity:edgeOpacity,
            roughness:0.3, metalness:0.08, side:THREE.DoubleSide, depthWrite:false
        });
        const outer = new THREE.Mesh(outerGeo, outerMat);
        outer.castShadow=false; outer.receiveShadow=false;
        group.add(outer);

        // Soft rim rings at top/bottom (subtle, not harsh)
        const ringGeo = new THREE.TorusGeometry(radius, radius*0.012, 12, 96);
        const ringMat = new THREE.MeshStandardMaterial({
            color: col.clone().multiplyScalar(1.2),
            roughness:0.3, metalness:0.1, transparent:true,
            opacity:Math.min(1, edgeOpacity*2.5)
        });
        const tr = new THREE.Mesh(ringGeo, ringMat);
        tr.position.y = height/2; tr.rotation.x = Math.PI/2; tr.castShadow=false;
        group.add(tr);
        const br = new THREE.Mesh(ringGeo.clone(), ringMat.clone());
        br.position.y = -height/2; br.rotation.x = Math.PI/2; br.castShadow=false;
        group.add(br);
    }

    group.position.y = yCenter;
    return group;
}

function buildSolidLid(radius, thickness, yCenter, color, isBox) {
    let geo;
    if (isBox) {
        // Smooth box electrode — higher subdivision
        geo = new THREE.BoxGeometry(radius*2, thickness, radius*2, 4, 1, 4);
    } else {
        // High-segment cylinder for perfectly smooth electrode
        geo = new THREE.CylinderGeometry(radius, radius, thickness, 96, 1);
    }
    const mat = createElectrodeMat(color);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = yCenter; mesh.castShadow=false; mesh.receiveShadow=false;
    return mesh;
}

// ═══════ 8. FILAMENT — DRAMATIC TAPER (WIDE BASE → NARROW TIP) ═══════
let filamentAtoms = [];
let filamentMesh = null;

function generateFilamentPath() {
    const H=CFG.cylHeight, BT=CFG.botThick, TT=CFG.topThick;
    const botY=-H/2+BT, topY=H/2-TT, bodyH=topY-botY;
    const path=[], atomR=CFG.atomSize*1.1, spacing=atomR*2.0;
    const wanderMax=CFG.filThick*CFG.filRand, filR=CFG.filThick*0.5;
    const isReverse = CFG.growDir==='top-down' || (CFG.polarity==='top-neg' && CFG.growDir==='bottom-up');
    const isDual = CFG.growDir==='dual';

    function buildHalf(startY, endY, dir) {
        let cx=0, cz=0, prevDx=0, prevDz=0;
        const totalSteps = Math.ceil(Math.abs(endY-startY)/spacing);
        let step=0;

        for (let y=startY; dir>0 ? y<=endY : y>=endY; y+=spacing*dir) {
            const progress = step/Math.max(totalSteps,1);
            // Dramatic taper: base is 1.8x wide, tip narrows to 15%
            const widthFactor = (1.0 - progress) * 1.8 + 0.15;
            const localWander = wanderMax * widthFactor;
            const localR = filR * widthFactor;

            const dx = (Math.random()-.5)*localWander + prevDx*0.3;
            const dz = (Math.random()-.5)*localWander + prevDz*0.3;
            cx+=dx; cz+=dz;
            const maxR = (CFG.shape==='block' ? CFG.cylRadius*0.7 : CFG.cylRadius*0.55);
            const dist = Math.sqrt(cx*cx+cz*cz);
            if (dist>maxR) { cx*=maxR/dist; cz*=maxR/dist; }
            prevDx=dx; prevDz=dz;

            // Central atom
            path.push({x:cx+(Math.random()-.5)*atomR*.2, y, z:cz+(Math.random()-.5)*atomR*.2, type:'filament'});

            // Cluster — more atoms at base, fewer at tip
            const nc = Math.max(0, Math.floor(localR/atomR*4));
            for (let i=0; i<nc; i++) {
                const a=Math.random()*Math.PI*2, r=Math.random()*localR;
                path.push({
                    x:cx+Math.cos(a)*r, y:y+(Math.random()-.5)*atomR*1.3,
                    z:cz+Math.sin(a)*r, type: Math.random()<0.3 ? 'vacancy' : 'filament'
                });
            }
            step++;
        }
    }

    if (isDual) {
        const mid = (botY+topY)/2;
        buildHalf(botY+atomR, mid, 1);
        buildHalf(topY-atomR, mid, -1);
    } else if (isReverse) {
        buildHalf(topY-atomR, botY+atomR, -1);
    } else {
        buildHalf(botY+atomR, topY-atomR, 1);
    }

    path.sort((a,b) => a.y-b.y);
    return path;
}

// ═══════ 9. RUPTURE — TRUE RANDOM ═══════
function getRandomRuptureY() {
    const H=CFG.cylHeight, botY=-H/2+CFG.botThick, topY=H/2-CFG.topThick;
    const bodyH = topY-botY;
    return botY + bodyH*0.15 + Math.random()*bodyH*0.7;
}

function buildFilament() {
    while (filamentGroup.children.length) {
        const c=filamentGroup.children[0];
        if(c.geometry) c.geometry.dispose();
        if(c.material){if(Array.isArray(c.material)) c.material.forEach(m=>m.dispose()); else c.material.dispose();}
        filamentGroup.remove(c);
    }
    filamentMesh = null;
    if (!filamentAtoms.length) filamentAtoms = generateFilamentPath();
    if (CFG.buildProg<=0) return;

    const total=filamentAtoms.length;
    const showCount=Math.floor(total*Math.min(CFG.buildProg,1));
    if (!showCount) return;

    const H=CFG.cylHeight, botY=-H/2+CFG.botThick, topY=H/2-CFG.topThick, bodyH=topY-botY;
    let rc;
    if (CFG.ruptureLocation==='top') rc = topY - bodyH*0.08;
    else if (CFG.ruptureLocation==='center') rc = (botY+topY)/2;
    else if (CFG.ruptureLocation==='bottom') rc = botY + bodyH*0.08;
    else if (CFG.ruptureLocation==='random') {
        if (CFG._ruptureY===null) CFG._ruptureY = getRandomRuptureY();
        rc = CFG._ruptureY;
    }

    const rw = bodyH*0.14;
    const filPos=[], vacPos=[];
    for (let i=0; i<showCount; i++) {
        const atom=filamentAtoms[i];
        const d=Math.abs(atom.y-rc), inZone=d<rw;
        if (CFG.rupture>0 && inZone) {
            const localT=1-d/rw;
            if (CFG.ruptureStyle==='abrupt') {
                if (CFG.rupture<=0.1) { if(atom.type==='vacancy') vacPos.push(atom); else filPos.push(atom); }
            } else {
                if (localT>=CFG.rupture) { if(atom.type==='vacancy') vacPos.push(atom); else filPos.push(atom); }
            }
        } else {
            if(atom.type==='vacancy') vacPos.push(atom); else filPos.push(atom);
        }
    }

    if (filPos.length) {
        const fm = createMatteMat(CFG.clrFilament, {roughness:0.72, metalness:0.05, emissive:CFG.clrFilament, emissiveIntensity:0.3});
        filamentMesh = buildAtomInstances(filPos, fm, filamentGroup, CFG.atomSize*1.05);
    }
    if (vacPos.length) {
        const vm = createMatteMat(CFG.clrVacancy, {roughness:0.68, metalness:0.03, emissive:CFG.clrVacancy, emissiveIntensity:0.4});
        buildAtomInstances(vacPos, vm, filamentGroup, CFG.atomSize*0.88);
    }
}

// ═══════ 10. REBUILD ═══════
function clearGroup(g) {
    while(g.children.length){
        const c=g.children[0];
        if(c.children) while(c.children.length){const cc=c.children[0]; if(cc.geometry)cc.geometry.dispose(); if(cc.material)cc.material.dispose(); c.remove(cc);}
        if(c.geometry)c.geometry.dispose();
        if(c.material){if(Array.isArray(c.material))c.material.forEach(m=>m.dispose()); else c.material.dispose();}
        g.remove(c);
    }
}

function rebuildDevice() {
    [topLidGroup, botLidGroup, bodyGroup, filamentGroup, shellGroup].forEach(clearGroup);
    filamentMesh = null;

    const R=CFG.cylRadius, H=CFG.cylHeight, TT=CFG.topThick, BT=CFG.botThick;
    const bodyH=H-TT-BT, botY=-H/2, topY=H/2, bodyBotY=botY+BT, bodyTopY=topY-TT;
    const isSolid=CFG.mode==='solid', isHollow=CFG.mode==='hollow', isSemi=CFG.mode==='semi';
    const isBox=CFG.shape==='block';
    const packFn = isBox
        ? (yMin,yMax) => packAtomsInBox(R, R*0.6, yMin, yMax, CFG.atomSize, CFG.atomDensity)
        : (yMin,yMax) => packAtomsInCylinder(R, yMin, yMax, CFG.atomSize, CFG.atomDensity);

    // Top Lid
    if (CFG.showTopElectrode) {
        if (isSolid) {
            const p=packFn(bodyTopY, topY);
            buildAtomInstances(p, createMatteMat(CFG.clrTopLid,{roughness:0.55,metalness:0.3}), topLidGroup, CFG.atomSize);
        } else {
            topLidGroup.add(buildSolidLid(R, TT, topY-TT/2, CFG.clrTopLid, isBox));
        }
    }

    // Bottom Lid
    if (CFG.showBotElectrode) {
        if (isSolid) {
            const p=packFn(botY, bodyBotY);
            buildAtomInstances(p, createMatteMat(CFG.clrBotLid,{roughness:0.55,metalness:0.3}), botLidGroup, CFG.atomSize);
        } else {
            botLidGroup.add(buildSolidLid(R, BT, botY+BT/2, CFG.clrBotLid, isBox));
        }
    }

    // Body
    if (isSolid) {
        const p=packFn(bodyBotY, bodyTopY);
        buildAtomInstances(p, createMatteMat(CFG.clrBody,{roughness:0.92, transparent:CFG.opacity<1, opacity:CFG.opacity}), bodyGroup, CFG.atomSize);
    }
    if (isSemi) {
        const p=packFn(bodyBotY, bodyTopY);
        const sOp = CFG.opacity*0.3;
        buildAtomInstances(p, createMatteMat(CFG.clrBody,{roughness:0.9, transparent:true, opacity:sOp}), bodyGroup, CFG.atomSize);
    }

    // Shell
    if (isHollow) shellGroup.add(buildHollowShell(R, bodyH, (bodyBotY+bodyTopY)/2, CFG.clrBody, 0.2, isBox));
    if (isSemi) shellGroup.add(buildHollowShell(R, bodyH, (bodyBotY+bodyTopY)/2, CFG.clrBody, 0.08, isBox));

    buildFilament();
    buildGrid();
    rebuildInteractiveParticles();
    if(CFG.cutaway) applyCutaway();
    updateLabels(); updateInfoPanel();
}

// ═══════ 11. CUTAWAY ═══════
function applyCutaway() {
    const cp = new THREE.Plane(new THREE.Vector3(0,0,1), 0);
    renderer.localClippingEnabled = true;
    [bodyGroup, shellGroup].forEach(g => g.traverse(o => { if(o.material) o.material.clippingPlanes=[cp]; }));
}
function removeCutaway() {
    renderer.localClippingEnabled = false;
    [bodyGroup, shellGroup].forEach(g => g.traverse(o => { if(o.material) o.material.clippingPlanes=[]; }));
}

// ═══════ 12. INTERACTIVE PARTICLES ═══════
function isInsideDevice(x, y, z) {
    const H=CFG.cylHeight, R=CFG.cylRadius, BT=CFG.botThick, TT=CFG.topThick;
    const bodyBotY = -H/2 + BT, bodyTopY = H/2 - TT;
    if (y < bodyBotY || y > bodyTopY) return false;
    if (CFG.shape === 'block') {
        return Math.abs(x) <= R && Math.abs(z) <= R * 0.6;
    } else {
        return (x*x + z*z) <= R*R;
    }
}

function createParticleMesh(type) {
    const geo = new THREE.SphereGeometry(CFG.atomSize * 1.4, 20, 16);
    const color = type === 'ion' ? CFG.clrFilament : CFG.clrVacancy;
    const emColor = type === 'ion' ? CFG.clrFilament : CFG.clrVacancy;
    const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: 0.6,
        metalness: 0.05,
        emissive: new THREE.Color(emColor),
        emissiveIntensity: 0.5
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
}

function addInteractiveParticle(type, position) {
    if (!position) {
        // Generate random position inside device
        const H=CFG.cylHeight, R=CFG.cylRadius, BT=CFG.botThick, TT=CFG.topThick;
        const bodyBotY = -H/2 + BT + CFG.atomSize;
        const bodyTopY = H/2 - TT - CFG.atomSize;
        let x, y, z;
        let attempts = 0;
        do {
            if (CFG.shape === 'block') {
                x = (Math.random() - 0.5) * 2 * (R - CFG.atomSize);
                z = (Math.random() - 0.5) * 2 * (R * 0.6 - CFG.atomSize);
            } else {
                const angle = Math.random() * Math.PI * 2;
                const r = Math.random() * (R - CFG.atomSize * 2);
                x = Math.cos(angle) * r;
                z = Math.sin(angle) * r;
            }
            y = bodyBotY + Math.random() * (bodyTopY - bodyBotY);
            attempts++;
        } while (!isInsideDevice(x, y, z) && attempts < 50);
        position = {x, y, z};
    }

    const mesh = createParticleMesh(type);
    mesh.position.set(position.x, position.y, position.z);
    mesh.userData.particleType = type;
    mesh.userData.particleIndex = interactiveParticles.length;
    interactiveGroup.add(mesh);
    interactiveParticles.push({mesh, type, pos: {...position}});
    return mesh;
}

function removeParticle(index) {
    if (index < 0 || index >= interactiveParticles.length) return;
    const p = interactiveParticles[index];
    if (p.mesh.geometry) p.mesh.geometry.dispose();
    if (p.mesh.material) p.mesh.material.dispose();
    interactiveGroup.remove(p.mesh);
    interactiveParticles.splice(index, 1);
    // Re-index
    interactiveParticles.forEach((pp, i) => { pp.mesh.userData.particleIndex = i; });
    if (selectedParticle === p.mesh) { deselectParticle(); }
}

function selectParticle(mesh) {
    deselectParticle();
    selectedParticle = mesh;
    mesh.material.emissiveIntensity = 1.2;
    mesh.scale.setScalar(1.3);
    document.body.classList.add('particle-selected');
}

function deselectParticle() {
    if (selectedParticle) {
        selectedParticle.material.emissiveIntensity = 0.5;
        selectedParticle.scale.setScalar(1.0);
        selectedParticle = null;
    }
    document.body.classList.remove('particle-selected');
    document.body.classList.remove('particle-dragging');
}

function rebuildInteractiveParticles() {
    // Keep interactive particles — just re-add them visually
    // Particles persist across rebuilds
}

function clampToDevice(pos) {
    const H=CFG.cylHeight, R=CFG.cylRadius, BT=CFG.botThick, TT=CFG.topThick;
    const bodyBotY = -H/2 + BT + CFG.atomSize;
    const bodyTopY = H/2 - TT - CFG.atomSize;
    pos.y = Math.max(bodyBotY, Math.min(bodyTopY, pos.y));
    if (CFG.shape === 'block') {
        const maxX = R - CFG.atomSize;
        const maxZ = R * 0.6 - CFG.atomSize;
        pos.x = Math.max(-maxX, Math.min(maxX, pos.x));
        pos.z = Math.max(-maxZ, Math.min(maxZ, pos.z));
    } else {
        const maxR = R - CFG.atomSize * 2;
        const dist = Math.sqrt(pos.x*pos.x + pos.z*pos.z);
        if (dist > maxR) {
            pos.x *= maxR / dist;
            pos.z *= maxR / dist;
        }
    }
    return pos;
}

// ═══════ 13. MOUSE INTERACTION ═══════
function getMouseNDC(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function getInteractiveHit(event) {
    getMouseNDC(event);
    raycaster.setFromCamera(mouse, camera);
    const meshes = interactiveParticles.map(p => p.mesh);
    if (!meshes.length) return null;
    const hits = raycaster.intersectObjects(meshes, false);
    return hits.length ? hits[0] : null;
}

function getDevicePlaneIntersection(event) {
    getMouseNDC(event);
    raycaster.setFromCamera(mouse, camera);
    // Intersect with a plane at y=0 facing camera
    const planeNormal = camera.position.clone().normalize();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, new THREE.Vector3(0, 0, 0));
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersection);
    return intersection;
}

renderer.domElement.addEventListener('pointerdown', function(event) {
    if (event.button !== 0) return; // left click only
    
    // Check if we hit an interactive particle
    const hit = getInteractiveHit(event);
    
    if (hit) {
        // Select/start drag
        const mesh = hit.object;
        selectParticle(mesh);
        isDragging = true;
        controls.enabled = false;
        document.body.classList.add('particle-dragging');
        
        // Set up drag plane facing camera through particle
        const camDir = camera.position.clone().sub(controls.target).normalize();
        dragPlane.setFromNormalAndCoplanarPoint(camDir, mesh.position);
        
        const intersect = new THREE.Vector3();
        raycaster.ray.intersectPlane(dragPlane, intersect);
        dragOffset.copy(mesh.position).sub(intersect);
        
        event.preventDefault();
        event.stopPropagation();
        return;
    }
    
    // If in add mode, place a particle
    if (CFG.interactiveMode) {
        const pos = getDevicePlaneIntersection(event);
        if (pos && isInsideDevice(pos.x, pos.y, pos.z)) {
            addInteractiveParticle(CFG.interactiveMode, {x:pos.x, y:pos.y, z:pos.z});
        } else if (CFG.interactiveMode) {
            // Place at random inside device
            addInteractiveParticle(CFG.interactiveMode);
        }
        return;
    }
    
    // Click on empty space — deselect
    deselectParticle();
});

renderer.domElement.addEventListener('pointermove', function(event) {
    if (!isDragging || !selectedParticle) return;
    getMouseNDC(event);
    raycaster.setFromCamera(mouse, camera);
    const intersect = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(dragPlane, intersect)) {
        const newPos = intersect.add(dragOffset);
        clampToDevice(newPos);
        selectedParticle.position.copy(newPos);
        // Update stored position
        const idx = selectedParticle.userData.particleIndex;
        if (interactiveParticles[idx]) {
            interactiveParticles[idx].pos = {x:newPos.x, y:newPos.y, z:newPos.z};
        }
    }
});

renderer.domElement.addEventListener('pointerup', function() {
    if (isDragging) {
        isDragging = false;
        controls.enabled = true;
        document.body.classList.remove('particle-dragging');
    }
});

// Delete key removes selected particle
document.addEventListener('keydown', function(event) {
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedParticle) {
        // Don't delete if focus is in an input
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return;
        const idx = selectedParticle.userData.particleIndex;
        removeParticle(idx);
        event.preventDefault();
    }
});

// ═══════ 14. ANIMATION ═══════
const clock = new THREE.Clock();
function animationTick(dt) {
    if(!CFG.autoAnimate) return;
    const sp=CFG.animSpeed*dt;
    if(CFG._animPhase==='idle'){ CFG._animPhase='building'; CFG.buildProg=0; CFG.rupture=0; CFG._ruptureY=null; filamentAtoms=[]; rebuildDevice(); }
    if(CFG._animPhase==='building'){ CFG.buildProg+=sp*0.4*CFG.growSpeed; if(CFG.buildProg>=1){CFG.buildProg=1;CFG._animPhase='hold-lrs';CFG._time=0;} syncUI('buildProg'); buildFilament(); }
    if(CFG._animPhase==='hold-lrs'){ CFG._time+=dt; if(CFG._time>1.5) CFG._animPhase='rupturing'; }
    if(CFG._animPhase==='rupturing'){ CFG.rupture+=sp*0.5; if(CFG.rupture>=1){CFG.rupture=1;CFG._animPhase='hold-hrs';CFG._time=0;} syncUI('rupture'); buildFilament(); }
    if(CFG._animPhase==='hold-hrs'){ CFG._time+=dt; if(CFG._time>1.5){ CFG._animPhase='reforming'; } }
    if(CFG._animPhase==='reforming'){ CFG.rupture-=sp*0.4; if(CFG.rupture<=0){CFG.rupture=0;CFG._animPhase='new-cycle';CFG._time=0;} syncUI('rupture'); buildFilament(); }
    if(CFG._animPhase==='new-cycle'){ CFG._ruptureY=null; filamentAtoms=[]; CFG._animPhase='building'; CFG.buildProg=0; rebuildDevice(); }
    updateInfoPanel();
}

function runDemoSequence() {
    CFG.autoAnimate=false; CFG._animPhase='idle'; CFG.buildProg=0; CFG.rupture=0;
    filamentAtoms=[]; rebuildDevice();
    const steps=[
        {delay:500,p:'pristine'},{delay:2000,p:'vacancy-gen'},{delay:3500,p:'electroforming'},
        {delay:5500,p:'lrs'},{delay:7500,p:'partial-rupture'},{delay:9000,p:'hrs'},
        {delay:11000,p:'reforming'},{delay:13000,p:'lrs'}
    ];
    steps.forEach(s => setTimeout(() => applyPreset(s.p), s.delay));
}

// ═══════ 15. LABELS ═══════
const labels = [
    {text:'Top Electrode', getPos:()=>new THREE.Vector3(0, CFG.cylHeight/2, 0)},
    {text:'Bottom Electrode', getPos:()=>new THREE.Vector3(0, -CFG.cylHeight/2, 0)},
    {text:'Switching Body', getPos:()=>new THREE.Vector3(CFG.cylRadius+0.3, 0, 0)},
    {text:'Conductive Filament', getPos:()=>new THREE.Vector3(-CFG.cylRadius-0.3, 0.5, 0)},
    {text:'Oxygen Vacancy Path', getPos:()=>new THREE.Vector3(-CFG.cylRadius-0.3, -0.5, 0)}
];
const labelOverlay = document.getElementById('label-overlay');
let labelElements = [];
function createLabelElements() {
    labelOverlay.innerHTML='';
    labelElements = labels.map(l => {
        const el=document.createElement('div'); el.className='scene-label'; el.textContent=l.text;
        labelOverlay.appendChild(el); return {el, getPos:l.getPos};
    });
}
createLabelElements();
function updateLabels() {
    if(!CFG.showLabels){labelElements.forEach(l=>l.el.style.opacity='0'); return;}
    const w=window.innerWidth, h=window.innerHeight;
    labelElements.forEach(l => {
        const p=l.getPos().clone().project(camera);
        if(p.z>1){l.el.style.opacity='0'; return;}
        l.el.style.left=((p.x*.5+.5)*w)+'px';
        l.el.style.top=((-p.y*.5+.5)*h)+'px';
        l.el.style.opacity='1';
    });
}

// ═══════ 16. INFO ═══════
function updateInfoPanel() {
    const el=document.getElementById('info-text'), bp=CFG.buildProg, rp=CFG.rupture;
    if(bp<=0) el.textContent='Pristine state. No filament formed.';
    else if(bp<0.3) el.textContent='Vacancy Generation. Oxygen vacancies forming under E-field.';
    else if(bp<0.8) el.textContent='Electroforming. Conductive filament growing ('+CFG.growDir+').';
    else if(bp>=0.8 && rp<=0) el.textContent='LRS. Filament connected. Device ON.';
    else if(rp>0 && rp<0.7) el.textContent='Partial Rupture at '+CFG.ruptureLocation+' region.';
    else if(rp>=0.7) el.textContent='HRS. Filament ruptured at '+CFG.ruptureLocation+'. Device OFF.';
}

// ═══════ 17. PRESETS ═══════
function applyPreset(name) {
    CFG.autoAnimate=false;
    const chk=document.getElementById('chk-animate'); if(chk) chk.checked=false;
    const tb=document.getElementById('tb-playpause'); if(tb) tb.classList.remove('active');
    switch(name){
        case 'pristine': CFG.buildProg=0; CFG.rupture=0; break;
        case 'vacancy-gen': CFG.buildProg=0.15; CFG.rupture=0; break;
        case 'electroforming': CFG.buildProg=0.55; CFG.rupture=0; break;
        case 'lrs': CFG.buildProg=1; CFG.rupture=0; break;
        case 'partial-rupture': CFG.buildProg=1; CFG.rupture=0.4; break;
        case 'hrs': CFG.buildProg=1; CFG.rupture=1; break;
        case 'reforming': CFG.buildProg=1; CFG.rupture=0.2; break;
        case 'switching-demo': runDemoSequence(); return;
    }
    syncUI('buildProg'); syncUI('rupture'); buildFilament(); updateInfoPanel();
}

// ═══════ 18. EXPORT ═══════
function exportScreenshot(scale, transparentBg) {
    const w=Math.floor(window.innerWidth*scale), h=Math.floor(window.innerHeight*scale);
    const panel=document.getElementById('control-panel'), info=document.getElementById('info-panel');
    const overlay=document.getElementById('label-overlay'), bar=document.getElementById('top-bar');
    [panel,info,overlay,bar].forEach(e => e.style.display='none');
    renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix();
    const origBg=scene.background;
    if(transparentBg) scene.background=null;
    if(composer && !transparentBg){composer.setSize(w,h); composer.render();} else renderer.render(scene,camera);
    const link=document.createElement('a');
    const suf=transparentBg?'-transparent':'', sc=scale>1?'-'+scale+'x':'';
    link.download='memristive-device'+sc+suf+'-'+Date.now()+'.png';
    link.href=renderer.domElement.toDataURL('image/png'); link.click();
    if(transparentBg) scene.background=origBg;
    renderer.setSize(window.innerWidth,window.innerHeight);
    camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix();
    if(composer) composer.setSize(window.innerWidth,window.innerHeight);
    [panel,info,overlay,bar].forEach(e => e.style.display='');
}

// ═══════ 19. UI BINDING ═══════
function syncUI(key) {
    const el=document.getElementById('ctrl-'+key), ve=document.getElementById('val-'+key);
    if(el) el.value=CFG[key]; if(ve) ve.textContent=parseFloat(CFG[key]).toFixed(2);
}
function syncAllUI() {
    ['cylRadius','cylHeight','topThick','botThick','atomSize','atomDensity',
     'filThick','filRand','growSpeed','buildProg','rupture','opacity','lightInt','glow','animSpeed'].forEach(syncUI);
}
function bindSlider(id, key, cb) {
    const el=document.getElementById('ctrl-'+id); if(!el) return;
    el.addEventListener('input', () => {
        CFG[key]=parseFloat(el.value);
        const ve=document.getElementById('val-'+id); if(ve) ve.textContent=parseFloat(el.value).toFixed(2);
        if(cb) cb();
    });
}
function bindColor(id, key, cb) {
    const el=document.getElementById(id); if(!el) return;
    el.addEventListener('input', () => { CFG[key]=el.value; if(cb) cb(); });
}

const geoRebuild = () => { filamentAtoms=[]; rebuildDevice(); };
bindSlider('cylRadius','cylRadius',geoRebuild);
bindSlider('cylHeight','cylHeight',geoRebuild);
bindSlider('topThick','topThick',geoRebuild);
bindSlider('botThick','botThick',geoRebuild);
bindSlider('atomSize','atomSize',geoRebuild);
bindSlider('atomDensity','atomDensity',geoRebuild);
bindSlider('filThick','filThick',()=>{filamentAtoms=[];buildFilament();});
bindSlider('filRand','filRand',()=>{filamentAtoms=[];buildFilament();});
bindSlider('growSpeed','growSpeed');
bindSlider('buildProg','buildProg',()=>{buildFilament();updateInfoPanel();});
bindSlider('rupture','rupture',()=>{buildFilament();updateInfoPanel();});
bindSlider('opacity','opacity',geoRebuild);
bindSlider('lightInt','lightInt',()=>{dirLight.intensity=CFG.lightInt*0.5;});
bindSlider('glow','glow',()=>{if(composer&&composer._bloomPass)composer._bloomPass.strength=CFG.glow;});
bindSlider('animSpeed','animSpeed');

bindColor('clr-topLid','clrTopLid',geoRebuild);
bindColor('clr-botLid','clrBotLid',geoRebuild);
bindColor('clr-body','clrBody',geoRebuild);
bindColor('clr-filament','clrFilament',()=>buildFilament());
bindColor('clr-vacancy','clrVacancy',()=>buildFilament());

document.querySelectorAll('input[name="ruptureLocation"]').forEach(el => {
    el.addEventListener('change', () => { CFG.ruptureLocation=el.value; CFG._ruptureY=null; buildFilament(); updateInfoPanel(); });
});
document.querySelectorAll('input[name="ruptureStyle"]').forEach(el => {
    el.addEventListener('change', () => { CFG.ruptureStyle=el.value; buildFilament(); });
});
document.querySelectorAll('input[name="growDir"]').forEach(el => {
    el.addEventListener('change', () => { CFG.growDir=el.value; filamentAtoms=[]; buildFilament(); });
});
document.querySelectorAll('input[name="polarity"]').forEach(el => {
    el.addEventListener('change', () => { CFG.polarity=el.value; filamentAtoms=[]; buildFilament(); });
});

// Top bar: Shape toggle
document.querySelectorAll('#top-bar [data-shape]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#top-bar [data-shape]').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active'); CFG.shape=btn.dataset.shape; geoRebuild();
    });
});

// Top bar: Mode toggle
document.querySelectorAll('#top-bar [data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#top-bar [data-mode]').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active'); CFG.mode=btn.dataset.mode; geoRebuild();
    });
});

// Top bar: Theme
document.getElementById('theme-select').addEventListener('change', e => applyTheme(e.target.value));

// Top bar: Download dropdown
const ddToggle = document.getElementById('tb-download-toggle');
const ddMenu = document.getElementById('tb-download-menu');
ddToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    ddMenu.classList.toggle('open');
});
document.addEventListener('click', () => ddMenu.classList.remove('open'));
ddMenu.addEventListener('click', (e) => e.stopPropagation());
document.getElementById('tb-download').addEventListener('click', () => { exportScreenshot(1,false); ddMenu.classList.remove('open'); });
document.getElementById('tb-hires').addEventListener('click', () => { exportScreenshot(4,false); ddMenu.classList.remove('open'); });
document.getElementById('tb-transparent-top').addEventListener('click', () => { exportScreenshot(2,true); ddMenu.classList.remove('open'); });

// Top bar buttons
document.getElementById('tb-playpause').addEventListener('click', function() {
    CFG.autoAnimate = !CFG.autoAnimate;
    this.classList.toggle('active', CFG.autoAnimate);
    if(CFG.autoAnimate) CFG._animPhase='idle';
});
document.getElementById('tb-resetcam').addEventListener('click', () => {
    camera.position.set(6,4.5,8); controls.target.set(0,0,0); controls.update();
});

// Left panel
document.getElementById('preset-select').addEventListener('change', e => applyPreset(e.target.value));
document.getElementById('chk-topElectrode').addEventListener('change', e => { CFG.showTopElectrode=e.target.checked; rebuildDevice(); });
document.getElementById('chk-botElectrode').addEventListener('change', e => { CFG.showBotElectrode=e.target.checked; rebuildDevice(); });
document.getElementById('chk-labels').addEventListener('change', e => { CFG.showLabels=e.target.checked; updateLabels(); });
document.getElementById('chk-grid').addEventListener('change', e => { CFG.showGrid=e.target.checked; buildGrid(); });
document.getElementById('btn-rebuild').addEventListener('click', () => { filamentAtoms=[]; CFG._ruptureY=null; rebuildDevice(); });
document.getElementById('btn-cutaway').addEventListener('click', () => {
    CFG.cutaway = !CFG.cutaway;
    if(CFG.cutaway) applyCutaway(); else { removeCutaway(); rebuildDevice(); }
});
document.getElementById('panel-toggle').addEventListener('click', () => {
    document.getElementById('control-panel').classList.toggle('collapsed');
});

// Interactive buttons
document.getElementById('btn-add-ion').addEventListener('click', function() {
    if (CFG.interactiveMode === 'ion') {
        CFG.interactiveMode = null;
        this.classList.remove('active');
        document.body.classList.remove('add-mode');
    } else {
        CFG.interactiveMode = 'ion';
        this.classList.add('active');
        document.getElementById('btn-add-vacancy').classList.remove('active');
        document.body.classList.add('add-mode');
    }
});
document.getElementById('btn-add-vacancy').addEventListener('click', function() {
    if (CFG.interactiveMode === 'vacancy') {
        CFG.interactiveMode = null;
        this.classList.remove('active');
        document.body.classList.remove('add-mode');
    } else {
        CFG.interactiveMode = 'vacancy';
        this.classList.add('active');
        document.getElementById('btn-add-ion').classList.remove('active');
        document.body.classList.add('add-mode');
    }
});
document.getElementById('btn-delete-particle').addEventListener('click', () => {
    if (selectedParticle) {
        const idx = selectedParticle.userData.particleIndex;
        removeParticle(idx);
    }
});

// ═══════ 20. RESIZE ═══════
window.addEventListener('resize', () => {
    const w=window.innerWidth, h=window.innerHeight;
    camera.aspect=w/h; camera.updateProjectionMatrix();
    renderer.setSize(w,h); if(composer) composer.setSize(w,h);
});

// ═══════ 21. RENDER LOOP ═══════
function animate() {
    requestAnimationFrame(animate);
    const dt=clock.getDelta();
    controls.update(); animationTick(dt); updateLabels();
    if(filamentMesh && CFG.buildProg>=1 && CFG.rupture<0.3) {
        const pulse=0.2+Math.sin(Date.now()*0.003)*0.1;
        if(filamentMesh.material) filamentMesh.material.emissiveIntensity=pulse;
    }
    // Pulse selected particle
    if (selectedParticle && !isDragging) {
        selectedParticle.material.emissiveIntensity = 0.8 + Math.sin(Date.now()*0.005)*0.4;
    }
    if(composer) composer.render(); else renderer.render(scene,camera);
}

// INIT
syncAllUI(); rebuildDevice(); updateInfoPanel(); animate();
  