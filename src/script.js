import './style.css'
import * as dat from 'dat.gui'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import * as CANNON from 'cannon-es'
import cannonDebugger from 'cannon-es-debugger'

/**
 * Base
 */
// Debug
const gui = new dat.GUI({
    width: 400
})
const debugObject = {}

let showDebug = false;
let jump
let inAir
let moveLeft
let moveRight
let topSpeed = 3
let jumpForce = 4.5
let lateralForce = 100
let courseWidth = 6
let characterSpeed = 6


// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()
{
    const near = 10;
    const far = 20;
    const color = '#ff9663';
    scene.fog = new THREE.Fog(color, near, far);
  }

/**
 * Loaders
 */
// Texture loader
const textureLoader = new THREE.TextureLoader()

// Draco loader
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('draco/')

// GLTF loader
const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(dracoLoader)

// Shader

/**
 * Textures
 */

const pyramidguyTexture = textureLoader.load('pyramid-guy.jpg')
pyramidguyTexture.flipY = false
pyramidguyTexture.encoding = THREE.sRGBEncoding


/**
 * Materials
 */

const pyramidguyMaterial = new THREE.MeshBasicMaterial({ map: pyramidguyTexture })

/**
 * Models
 */


// Ground Plane
const groundPlaneGeometry = new THREE.PlaneGeometry(30, 30);
const groundPlaneMaterial = new THREE.ShadowMaterial();
groundPlaneMaterial.opacity = .3
const groundPlane = new THREE.Mesh( groundPlaneGeometry, groundPlaneMaterial );
groundPlane.rotation.x = Math.PI * -0.5
groundPlane.position.y = 0
groundPlane.receiveShadow = true

scene.add( groundPlane );

// Character

let mixer
let character

gltfLoader.load(
    'ramid.glb', (gltf) =>
    {
        gltf.scene.traverse((child) => {
            child.material = pyramidguyMaterial
            child.castShadow = true
            child.receiveShadow = true
        })
        character = gltf.scene
        const anim = new GLTFLoader()
        anim.load('run.glb', (anim) => {
            mixer = new THREE.AnimationMixer(gltf.scene.children[0])
            const run = mixer.clipAction(anim.animations[0])
            run.play();
        })
        scene.add(gltf.scene)
    }
)

/** 
 * Physics
 */

const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);

// Physics materials
const groundMaterial = new CANNON.Material('ground')
const characterMaterial = new CANNON.Material('character')

const groundCharacterContactMaterial = new CANNON.ContactMaterial(
    groundMaterial,
    characterMaterial,
    {
        friction: 0.5,
        restitution: 0.1 
    }
)
world.addContactMaterial(groundCharacterContactMaterial)

// Sphere collider
const sphereShape = new CANNON.Sphere(1)

const characterBody = new CANNON.Body({
    mass: 1,
    position: new CANNON.Vec3(0, 1, 0),
    shape: sphereShape,
    angularDamping: .999
})

world.addBody(characterBody)

// Floor

const floorShape = new CANNON.Plane()
const floorBody = new CANNON.Body()
floorBody.mass = 0
floorBody.addShape(floorShape)
floorBody.quaternion.setFromAxisAngle(
    new CANNON.Vec3(-1, 0, 0), Math.PI * .5
)

world.addBody(floorBody)

// Right Wall

const rightWallShape = new CANNON.Plane()
const rightWallBody = new CANNON.Body()
rightWallBody.mass = 0
rightWallBody.addShape(rightWallShape)
rightWallBody.position.x = -(courseWidth/2)
rightWallBody.quaternion.setFromAxisAngle(
    new CANNON.Vec3(0, 1, 0), Math.PI * .5
)

world.addBody(rightWallBody)

// Left Wall

const leftWallShape = new CANNON.Plane()
const leftWallBody = new CANNON.Body()
leftWallBody.mass = 0
leftWallBody.addShape(leftWallShape)
leftWallBody.position.x = (courseWidth/2)
leftWallBody.quaternion.setFromAxisAngle(
    new CANNON.Vec3(0, -1, 0), Math.PI * .5
)

world.addBody(leftWallBody)

/**
 * Obstacles
 */

// Create poo

const boxGeometry = new THREE.BoxGeometry(1, 1, 1)
const boxMaterial = new THREE.MeshStandardMaterial({
    metalness: 0.3,
    roughness: 0.4,
})

const objectsToUpdate = []

const createPoo = (position) =>
{
    // Three.js mesh
    const size = .1;
    const mesh = new THREE.Mesh(boxGeometry, boxMaterial)
    mesh.scale.set(size, size, size)
    mesh.castShadow = true
    mesh.position.copy(position)
    scene.add(mesh)

    // Cannon.js body
    const shape = new CANNON.Box(new CANNON.Vec3(size * 0.5, size * 0.5, size * 0.5))

    const body = new CANNON.Body({
        mass: 1,
        position: new CANNON.Vec3(0, 3, 0),
        shape: shape,
    })
    body.position.copy(position)
    world.addBody(body)

    // Save in objects
    objectsToUpdate.push({ mesh, body })
}

createPoo({ x: 0, y: 3, z: 0 })

debugObject.createPoo = () =>
{
    createPoo(
        {
            x: (Math.random() - 0.5) * 3,
            y: 3,
            z: (Math.random() - 0.5) * 3
        }
    )
}
gui.add(debugObject, 'createPoo')

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () =>
{
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

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(70, sizes.width / sizes.height, 0.1, 100)
camera.position.x = 0
camera.position.y = 1
camera.position.z = -3.5

camera.rotation.y = Math.PI * 1

scene.add(camera)


/**
 * Lights
 */

const directionalLight = new THREE.DirectionalLight(0xffffff, .3)
scene.add(directionalLight)
directionalLight.position.set(5, 5, 4)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.width = 1024 * 4
directionalLight.shadow.mapSize.height = 1024 * 4
directionalLight.shadow.radius = 10


// Input

const handleKeyDown=(keyEvent) => {
    if (keyEvent.key === " " || keyEvent.key === "ArrowUp" ) { //jump
        jump = true;
    } else if (keyEvent.key === "a" || keyEvent.key === "ArrowLeft" ) { // move left
        moveLeft = true;
    } else if (keyEvent.key === "d" || keyEvent.key === "ArrowRight" ) { // move right
        moveRight = true;
    }
}

document.onkeydown = handleKeyDown;


/**
 * Collisions
 *  */

// Ground Detections

world.addEventListener('endContact', (event) => {
if (
    (event.bodyA === floorBody && event.bodyB === characterBody) ||
    (event.bodyB === floorBody && event.bodyA === characterBody)
) {
    inAir = true
} 
})

characterBody.addEventListener('collide', (event) => {
    if (event.body === floorBody) {
        inAir = false
    }
  })


// Controls
// const controls = new OrbitControls(camera, canvas)
// controls.enableDamping = true
// controls.target.y = 1

/**
 * Utils
 */

 const followPlayer = () => {
    if (character) {
        characterBody.velocity.z = characterSpeed;
        character.position.x = characterBody.position.x
        character.position.y = characterBody.position.y - 1
        character.position.z = characterBody.position.z

        groundPlane.position.z = characterBody.position.z
        camera.position.z = characterBody.position.z - 3

        directionalLight.position.z = characterBody.position.z + 2
        directionalLight.target = character

        console.log(groundPlane)
    }
 }

 const createObstacles = () => {
    // Every x units, generate and randomly place poo and other obstacles

    createPoo({x: 5, y: 0, z: characterBody.position.z + 30})

    console.log("creating poo")
 }

 const destroyObstacles = () => {
     // if obstacles are 10 units behind player, destroy them
 }

/**
 * Renderer
 */ 
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.outputEncoding = THREE.sRGBEncoding
renderer.setClearColor (0xff9663, 1);
renderer.shadowMap.enabled = true

/**
 * Animate
 */
const clock = new THREE.Clock()
let oldElapsedTime = 0
cannonDebugger(scene, world.bodies)

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - oldElapsedTime
    oldElapsedTime = elapsedTime

    // Move Character
    
    followPlayer()
    // createObstacles()

    console.log(elapsedTime);
    
    if (jump) {
        if(!inAir) {
            characterBody.applyImpulse(new CANNON.Vec3(0, jumpForce, 0), new CANNON.Vec3(0, characterBody.position.x  ,0))
            jump = false;
        }
    }

    if (moveLeft) {
        if(!inAir && characterBody.velocity.x <= topSpeed) {
            characterBody.applyForce(new CANNON.Vec3(lateralForce, 0, 0), characterBody.position)
            moveLeft = false;
        }
    }

    if (moveRight) {
        if(!inAir && characterBody.velocity.x >= -topSpeed) {
            characterBody.applyForce(new CANNON.Vec3(-lateralForce, 0, 0), characterBody.position)
            moveRight = false;
        }
    }

    // Update controls
    // controls.update()

    window.requestAnimationFrame(tick)
    world.step(1 / 60, deltaTime, 3)

    for(const object of objectsToUpdate)
    {
        object.mesh.position.copy(object.body.position)
    }

    console.log(inAir)

    renderer.render(scene, camera)

    mixer?.update(deltaTime)

    // Call tick again on the next frame
    
}

tick()