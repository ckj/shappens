import './style.css'
import * as dat from 'dat.gui'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import * as CANNON from 'cannon-es'
import cannonDebugger from 'cannon-es-debugger'

/**
 * Base
 */

const gui = new dat.GUI({
  width: 400,
})
const debugObject = {}

let clock = new THREE.Clock(),
  scene,
  canvas,
  camera,
  world,
  directionalLight,
  renderer,
  mixer,
  last = 0,
  loaded,
  gameover,
  start,
  characterBody,
  groundPlane,
  objectsToUpdate = [],
  oldElapsedTime,
  jump,
  inAir = false,
  moveLeft,
  moveRight,
  character,
  runAnim,
  idleAnim,
  jumpAnim,
  poo,
  cone,
  topSpeed = 3,
  jumpForce = 4,
  lateralForce = 100,
  courseWidth = 6,
  characterSpeed = 6

init()
animate()

function init() {
  canvas = document.querySelector('canvas.webgl')
  scene = new THREE.Scene()
  {
    const near = 8
    const far = 16
    const color = '#f9a5a4'
    scene.fog = new THREE.Fog(color, near, far)
  }

  /**
   * Loading screen
   */

  const loadingManager = new THREE.LoadingManager(() => {
    const loadingScreen = document.getElementById('loading-screen')
    setTimeout(function () {
      loadingScreen.classList.add('fade-out')
      loaded = true
      startGame()
    }, 1000)
  })

  loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
    const progress = (itemsLoaded / itemsTotal) * 100
    document.getElementById('progress-bar').style.width = progress + '%'
  }

  /**
   * Loaders
   */
  // Texture loader
  const textureLoader = new THREE.TextureLoader(loadingManager)

  // Draco loader
  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath('draco/')

  // GLTF loader
  const gltfLoader = new GLTFLoader(loadingManager)
  gltfLoader.setDRACOLoader(dracoLoader)

  // Shader

  /**
   * Textures
   */

  const pyramidguyTexture = textureLoader.load('pyramid-guy.jpg')
  pyramidguyTexture.flipY = false
  pyramidguyTexture.encoding = THREE.sRGBEncoding

  const pooTexture = textureLoader.load('poo.jpg')
  pooTexture.flipY = false
  pooTexture.encoding = THREE.sRGBEncoding

  const coneTexture = textureLoader.load('cone.jpg')
  coneTexture.flipY = false
  coneTexture.encoding = THREE.sRGBEncoding

  /**
   * Materials
   */

  const pyramidguyMaterial = new THREE.MeshBasicMaterial({
    map: pyramidguyTexture,
  })
  const pooMaterial = new THREE.MeshBasicMaterial({ map: pooTexture })
  const coneMaterial = new THREE.MeshBasicMaterial({ map: coneTexture })

  /**
   * Models
   */

  // Ground Plane
  const groundPlaneGeometry = new THREE.PlaneGeometry(30, 30)
  const groundPlaneMaterial = new THREE.ShadowMaterial()
  groundPlaneMaterial.opacity = 0.3
  groundPlane = new THREE.Mesh(groundPlaneGeometry, groundPlaneMaterial)
  groundPlane.rotation.x = Math.PI * -0.5
  groundPlane.position.y = 0
  groundPlane.receiveShadow = true

  scene.add(groundPlane)

  // Character

  gltfLoader.load('ramid.glb', (gltf) => {
    gltf.scene.traverse((child) => {
      child.material = pyramidguyMaterial
      child.castShadow = true
      child.receiveShadow = true
    })
    character = gltf.scene

    gltfLoader.load('animations.glb', (anim) => {
      console.log(anim)
      mixer = new THREE.AnimationMixer(gltf.scene.children[0])
      runAnim = mixer.clipAction(anim.animations[2])
      idleAnim = mixer.clipAction(anim.animations[1])
      jumpAnim = mixer.clipAction(anim.animations[0])
    })
    scene.add(gltf.scene)
  })

  gltfLoader.load('poo.glb', (gltf) => {
    gltf.scene.traverse((child) => {
      child.material = pooMaterial
      child.castShadow = true
      child.receiveShadow = true
    })
    poo = gltf.scene
  })

  gltfLoader.load('cone.glb', (gltf) => {
    gltf.scene.traverse((child) => {
      child.material = coneMaterial
      child.castShadow = true
      child.receiveShadow = true
    })
    cone = gltf.scene
    gltf.scene.position.x = -1
    scene.add(gltf.scene)
    const clone = cone.clone()
    clone.position.x = 1
    scene.add(clone)
  })

  /**
   * Physics
   */

  world = new CANNON.World()
  world.gravity.set(0, -9.82, 0)

  // Physics materials
  const groundMaterial = new CANNON.Material('ground')
  const characterMaterial = new CANNON.Material('character')

  const groundCharacterContactMaterial = new CANNON.ContactMaterial(
    groundMaterial,
    characterMaterial,
    {
      friction: 0.5,
      restitution: 0.1,
    }
  )
  world.addContactMaterial(groundCharacterContactMaterial)

  // Sphere collider
  const sphereShape = new CANNON.Sphere(0.25)

  characterBody = new CANNON.Body({
    mass: 1,
    position: new CANNON.Vec3(0, 1, 0),
    shape: sphereShape,
    angularDamping: 0.999,
  })

  world.addBody(characterBody)

  // Floor

  const floorShape = new CANNON.Plane()
  const floorBody = new CANNON.Body()
  floorBody.mass = 0
  floorBody.addShape(floorShape)
  floorBody.quaternion.setFromAxisAngle(
    new CANNON.Vec3(-1, 0, 0),
    Math.PI * 0.5
  )

  world.addBody(floorBody)

  // Right Wall

  const rightWallShape = new CANNON.Plane()
  const rightWallBody = new CANNON.Body()
  rightWallBody.mass = 0
  rightWallBody.addShape(rightWallShape)
  rightWallBody.position.x = -(courseWidth / 2)
  rightWallBody.quaternion.setFromAxisAngle(
    new CANNON.Vec3(0, 1, 0),
    Math.PI * 0.5
  )

  world.addBody(rightWallBody)

  // Left Wall

  const leftWallShape = new CANNON.Plane()
  const leftWallBody = new CANNON.Body()
  leftWallBody.mass = 0
  leftWallBody.addShape(leftWallShape)
  leftWallBody.position.x = courseWidth / 2
  leftWallBody.quaternion.setFromAxisAngle(
    new CANNON.Vec3(0, -1, 0),
    Math.PI * 0.5
  )

  world.addBody(leftWallBody)

  /**
   * Collisions
   *  */

  // Ground Detections

  world.addEventListener('endContact', (event) => {
    if (start) {
      if (
        (event.bodyA === floorBody && event.bodyB === characterBody) ||
        (event.bodyB === floorBody && event.bodyA === characterBody)
      ) {
        inAir = true
        blendAnim(idleAnim)
      }
    }
  })

  characterBody.addEventListener('collide', (event) => {
    if (start) {
      if (event.body === floorBody) {
        inAir = false
        blendAnim(runAnim)
      }
      if (event.body.name === 'poo') {
        endGame()
      }
    }
  })

  /**
   * Lights
   */

  directionalLight = new THREE.DirectionalLight(0xffffff, 0.3)
  scene.add(directionalLight)
  directionalLight.position.set(50, 50, 40)
  directionalLight.castShadow = true
  directionalLight.shadow.mapSize.width = 1024 * 4
  directionalLight.shadow.mapSize.height = 1024 * 4
  directionalLight.shadow.radius = 10

  /**
   * Camera
   */

  const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
  }

  // Base camera
  camera = new THREE.PerspectiveCamera(70, sizes.width / sizes.height, 0.1, 100)
  camera.position.x = 0
  camera.position.y = 1
  camera.position.z = -3.5

  camera.rotation.y = Math.PI * 1

  scene.add(camera)

  /**
   * Renderer
   */

  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
  })
  renderer.setSize(sizes.width, sizes.height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputEncoding = THREE.sRGBEncoding
  renderer.shadowMap.enabled = true

  debugObject.createPoo = () => {
    createPoo()
  }

  debugObject.showBodies = () => {
    cannonDebugger(scene, world.bodies)
  }

  gui.add(debugObject, 'createPoo')
  gui.add(debugObject, 'showBodies')

  window.addEventListener('resize', () => {
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  })
}

function animate(now) {
  requestAnimationFrame(animate)
  render(now)
}

function render(now) {
  if (gameover) return
  const elapsedTime = clock.getElapsedTime()
  const deltaTime = elapsedTime - oldElapsedTime
  oldElapsedTime = elapsedTime

  // Move Character
  followPlayer(now)

  if (jump) {
    if (!inAir) {
      characterBody.applyImpulse(
        new CANNON.Vec3(0, jumpForce, 0),
        new CANNON.Vec3(0, characterBody.position.x, 0)
      )
      jump = false
    }
  }

  if (moveLeft) {
    if (!inAir && characterBody.velocity.x <= topSpeed) {
      characterBody.applyForce(
        new CANNON.Vec3(lateralForce, 0, 0),
        characterBody.position
      )
      moveLeft = false
    }
  }

  if (moveRight) {
    if (!inAir && characterBody.velocity.x >= -topSpeed) {
      characterBody.applyForce(
        new CANNON.Vec3(-lateralForce, 0, 0),
        characterBody.position
      )
      moveRight = false
    }
  }

  // Update controls
  // controls.update()

  world.step(1 / 60)

  objectsToUpdate.forEach((object, index) => {
    if (object.clone.name === 'Poo') {
      object.clone.position.copy(object.body.position)
      object.clone.position.y = object.body.position.y - 0.14
    } else {
      object.clone.position.copy(object.body.position)
    }
    if (object.body.position.z < characterBody.position.z - 10) {
      scene.remove(object.clone)
      world.removeBody(object.body)
      objectsToUpdate.splice(index, 1)
    }
  })

  mixer?.update(deltaTime)
  renderer.render(scene, camera)
}

/**
 * Obstacles
 */

const createPoo = () => {
  const size = 0.25
  const clone = poo.clone()
  clone.position.set(getPlacement(), 0, characterBody.position.z + 12)
  scene.add(clone)

  // Cannon body
  const shape = new CANNON.Box(
    new CANNON.Vec3(size * 0.5, size * 0.5, size * 0.5)
  )

  const body = new CANNON.Body({
    mass: 0.1,
    position: new CANNON.Vec3(0, 0, 0),
    shape: shape,
    type: CANNON.Body.KINEMATIC,
  })
  body.name = 'poo'
  body.position.copy(clone.position)
  world.addBody(body)

  // Save in objects
  objectsToUpdate.push({ clone, body })
}

const getPlacement = () => {
  const min = -3
  const max = 3
  return Math.random() * (max - min) + min
}

// Input

const handleKeyDown = (keyEvent) => {
  if (!gameover) {
    if (keyEvent.key === ' ' || keyEvent.key === 'ArrowUp') {
      //jump
      jump = true
    } else if (keyEvent.key === 'a' || keyEvent.key === 'ArrowLeft') {
      // move left
      moveLeft = true
    } else if (keyEvent.key === 'd' || keyEvent.key === 'ArrowRight') {
      // move right
      moveRight = true
    }
  }
}

document.onkeydown = handleKeyDown

/**
 * Utils
 */

let lastAnim

function blendAnim(anim) {
  anim.time = 0.0
  anim.enabled = true
  anim.setEffectiveTimeScale(1.0)
  anim.setEffectiveWeight(1.0)
  anim.reset()
  lastAnim && anim.crossFadeFrom(lastAnim, 0.25, true)
  anim.play()
  lastAnim = anim
}

function startGame() {
  blendAnim(idleAnim)
  character.position.set(0, 0, 0)
  characterBody.wakeUp()
  characterBody.position.set(0, 0, 0)
  camera.position.z = -3

  document.getElementById('score').innerText = 'Ready'

  setTimeout(function () {
    document.getElementById('score').innerText = 'Set'
    setTimeout(function () {
      document.getElementById('score').innerText = 'Go!'
      setTimeout(function () {
        start = true
        blendAnim(runAnim)
      }, 1000)
    }, 1000)
  }, 1000)
}

function endGame() {
  console.log('You really stepped in it this time')
  gameover = true
  characterBody.sleep()
  setTimeout(function () {
    resetGame()
    startGame()
  }, 3000)
}

function resetGame() {
  gameover = false
  start = false

  objectsToUpdate.forEach((object, index) => {
    scene.remove(object.clone)
    world.removeBody(object.body)
  })

  objectsToUpdate = []
}

function followPlayer(now) {
  if (character && start) {
    characterBody.velocity.z = characterSpeed
    character.position.x = characterBody.position.x
    character.position.y = characterBody.position.y - 0.25
    character.position.z = characterBody.position.z

    groundPlane.position.z = characterBody.position.z
    camera.position.z = characterBody.position.z - 3

    directionalLight.position.z = characterBody.position.z + 20
    directionalLight.target = character

    // Spawn obstacles
    if (!last || now - last >= 1 * 250) {
      last = now
      createPoo()
    }

    // Update scoreboard
    document.getElementById('score').innerText = String(
      Math.round(characterBody.position.z)
    ).padStart(3, '0')
  }
}
