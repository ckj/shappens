import './style.css'
import * as dat from 'dat.gui'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { BackSide } from 'three'

/**
 * Base
 */
// Debug
// const gui = new dat.GUI({
//     width: 400
// })

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

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
 * Model
 */

// Plane

const planeGeometry = new THREE.PlaneGeometry( 15, 15 );
const planeMaterial = new THREE.ShadowMaterial();
planeMaterial.opacity = .3
const plane = new THREE.Mesh( planeGeometry, planeMaterial );
plane.rotation.x = Math.PI * -0.5
plane.receiveShadow = true

scene.add( plane );

// Character

let mixer

gltfLoader.load(
    'ramid.glb', (gltf) =>
    {
        gltf.scene.traverse((child) => {
            child.material = pyramidguyMaterial
            child.castShadow = true
            child.receiveShadow = true
        })
        const anim = new GLTFLoader()
        anim.load('run.glb', (anim) => {
            mixer = new THREE.AnimationMixer(gltf.scene.children[0])
            const run = mixer.clipAction(anim.animations[0])
            run.play();
            console.log(run)
        })
        scene.add(gltf.scene)
    }
)

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
const camera = new THREE.PerspectiveCamera(50, sizes.width / sizes.height, 0.1, 100)
camera.position.x = 3
camera.position.y = 3
camera.position.z = 4
scene.add(camera)


/**
 * Lights
 */

const directionalLight = new THREE.DirectionalLight(0xffffff, .3)
scene.add(directionalLight)
directionalLight.position.set(1, 1, .75)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.width = 1024 * 4
directionalLight.shadow.mapSize.height = 1024 * 4
directionalLight.shadow.radius = 10

// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.target.y = 1

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

const tick = () =>
{
    const deltaSeconds = clock.getDelta()

    // Update controls
    controls.update()
    

    renderer.render(scene, camera)

    mixer?.update(deltaSeconds)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)

    
    
}

tick()