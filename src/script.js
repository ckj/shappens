import './style.css'
import * as dat from 'dat.gui'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import * as CANNON from 'cannon-es'
import Hammer from 'hammerjs'
import cannonDebugger from 'cannon-es-debugger'
import * as Sentry from '@sentry/browser'
import { Integrations } from '@sentry/tracing'

/**
 * Base
 */

// const gui = new dat.GUI({
//   width: 400,
// })
// const debugObject = {}

Sentry.init({
  dsn: "https://e079d168ef4440ddb966ad599785cd3b@o87286.ingest.sentry.io/6251992",
  integrations: [new Integrations.BrowserTracing()],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
})

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
  mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
  gameover,
  start,
  sideview,
  fartNoise,
  characterBody,
  leftFootBody,
  rightFootBody,
  groundPlane,
  leftFoot,
  rightFoot,
  leftFootTarget = new THREE.Vector3(),
  rightFootTarget = new THREE.Vector3(),
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
  characterSpeed = 6,
  body = document.querySelector('body'),
  gesture = Hammer(body)

init()
animate()

function init() {
  // Show proper controls
  if (mobile) {
    document.getElementById('mobile-controls').style.display = 'flex'
  } else {
    document.getElementById('desktop-controls').style.display = 'flex'
  }

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
      child.frustumCulled = false
    })
    character = gltf.scene

    gltfLoader.load('animations.glb', (anim) => {
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
    gltf.scene.name = 'Poo'
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
   * Sounds
   */

  fartNoise = new Audio('fartnoise.wav')
  fartNoise.preload = 'auto'

  /**
   * Physics
   */

  world = new CANNON.World()
  world.gravity.set(0, -9.82, 0)
  world.broadphase = new CANNON.SAPBroadphase(world)

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
    position: new CANNON.Vec3(0, 0, 0),
    shape: sphereShape,
    angularDamping: 0.999,
    collisionFilterGroup: 2,
    collisionFilterMask: 1,
  })

  world.addBody(characterBody)

  // Foot colliders
  const footBoxShape = new CANNON.Box(new CANNON.Vec3(0.06, 0.075, 0.1))

  leftFootBody = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(0, 0, 0),
    shape: footBoxShape,
    angularDamping: 1,
    collisionFilterGroup: 4,
    collisionFilterMask: 8,
    name: 'foot',
  })

  world.addBody(leftFootBody)

  rightFootBody = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(0, 0, 0),
    shape: footBoxShape,
    angularDamping: 1,
    collisionFilterGroup: 4,
    collisionFilterMask: 8,
    name: 'foot',
  })

  world.addBody(rightFootBody)

  // Floor

  const floorShape = new CANNON.Plane()
  const floorBody = new CANNON.Body({
    collisionFilterGroup: 1,
  })
  floorBody.mass = 0
  floorBody.addShape(floorShape)
  floorBody.quaternion.setFromAxisAngle(
    new CANNON.Vec3(-1, 0, 0),
    Math.PI * 0.5
  )

  world.addBody(floorBody)

  // Right Wall

  const rightWallShape = new CANNON.Plane()
  const rightWallBody = new CANNON.Body({
    collisionFilterGroup: 1,
  })
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
  const leftWallBody = new CANNON.Body({
    collisionFilterGroup: 1,
  })
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
        blendAnim(jumpAnim)
      }
    }
  })

  characterBody.addEventListener('collide', (event) => {
    if (start) {
      if (event.body === floorBody) {
        inAir = false
        blendAnim(runAnim, 0.1)
      }
      if (event.body.name === 'foot') {
        endGame()
      }
    }
  })

  rightFootBody.addEventListener('collide', (event) => {
    if (start && event.body.name === 'poo') {
      endGame()
    }
  })

  leftFootBody.addEventListener('collide', (event) => {
    if (start && event.body.name === 'poo') {
      endGame()
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
  camera = new THREE.PerspectiveCamera(70, sizes.width / sizes.height, 0.1, 50)
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

  // debugObject.createPoo = () => {
  //   createPoo()
  // }

  // debugObject.showBodies = () => {
  //   cannonDebugger(scene, world.bodies)
  // }

  // debugObject.toggleSideview = () => {
  //   sideview = !sideview
  // }

  // gui.add(debugObject, 'createPoo')
  // gui.add(debugObject, 'showBodies')
  // gui.add(debugObject, 'toggleSideview')

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
    position: new CANNON.Vec3(0, 1, 0),
    shape: shape,
    collisionFilterGroup: 8,
    collisionFilterMask: 1 | 4, // Only collide with ground and feet
  })
  body.name = 'poo'
  body.position.copy(clone.position)
  body.position.y = clone.position.y * 2
  world.addBody(body)

  // Save in objects
  objectsToUpdate.push({ clone, body })
}

const getPlacement = () => {
  const min = -3
  const max = 3
  return Math.random() * (max - min) + min
}

/**
 * Input
 */

// Keyboard Input

const handleKeyDown = (keyEvent) => {
  if (!gameover && !mobile) {
    if (keyEvent.key === ' ' || keyEvent.key === 'ArrowUp') {
      //jump
      jump = true
    } else if (keyEvent.key === 'a' || keyEvent.key === 'ArrowLeft') {
      // move left
      moveLeft = true
    } else if (keyEvent.key === 'd' || keyEvent.key === 'ArrowRight') {
      // move right
      moveRight = true
    } else if (keyEvent.key === '`') {
      cannonDebugger(scene, world.bodies)
      sideview = true
    }
  }
}

document.onkeydown = handleKeyDown

// Mobile Input

gesture.on(
  'panleft panright panup tap press',
  debounce(
    function (ev) {
      if (!gameover && mobile) {
        if (ev.type === 'tap') {
          jump = true
        }
        if (ev.type === 'panleft') {
          moveLeft = true
        }
        if (ev.type === 'panright') {
          moveRight = true
        }
      }
    },
    150,
    true
  )
)

/**
 * Utils
 */

function debounce(func, wait, immediate) {
  var timeout
  return function () {
    var context = this,
      args = arguments
    var later = function () {
      timeout = null
      if (!immediate) func.apply(context, args)
    }
    var callNow = immediate && !timeout
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
    if (callNow) func.apply(context, args)
  }
}

let lastAnim

function blendAnim(anim, transitionTime = 0.25) {
  anim.time = 0.0
  anim.enabled = true
  anim.setEffectiveTimeScale(1.0)
  anim.setEffectiveWeight(1.0)
  anim.reset()
  lastAnim && anim.crossFadeFrom(lastAnim, transitionTime, true)
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
  fartNoise.play()
  gameover = true
  characterBody.sleep()
  myUndefinedFunction();
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
    leftFoot = character.children[0].children[6].children[0].children[0]
    rightFoot = character.children[0].children[2].children[0].children[0]

    const leftFootPosition = leftFoot.getWorldPosition(leftFootTarget)
    const rightFootPosition = rightFoot.getWorldPosition(rightFootTarget)

    character.updateMatrix()
    leftFoot.updateMatrix()
    rightFoot.updateMatrix()

    leftFootBody.position.set(
      leftFootPosition.x,
      leftFootPosition.y + 0.05,
      leftFootPosition.z
    )

    rightFootBody.position.set(
      rightFootPosition.x,
      rightFootPosition.y + 0.05,
      rightFootPosition.z
    )

    characterBody.velocity.z = characterSpeed
    character.position.x = characterBody.position.x
    character.position.y = characterBody.position.y - 0.25
    character.position.z = characterBody.position.z

    groundPlane.position.z = characterBody.position.z
    camera.position.z = characterBody.position.z - 3

    directionalLight.position.z = characterBody.position.z + 20
    directionalLight.target = character

    // Sideview

    if (sideview) {
      camera.position.x = -2
      camera.position.z = characterBody.position.z
      camera.position.y = 0
      camera.rotation.y = Math.PI * -0.5
    }

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
